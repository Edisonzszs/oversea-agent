import { useEffect, useMemo, useRef, useState } from "react";
import {
  PROJECT_STATUS_CONFIG,
  guessMaterialMeta,
  progressFromStatus,
  statusAfterValidation,
  seedAssistFieldPool,
  type AssistMaterialFile,
  type AssistProject,
} from "./odiProjectData";
import type { AssistantContext } from "./OdiProjectAssistantPanel";
import { validateOdiPool, getIssues, type ValidationResult } from "../odi/validation/odiValidationEngine";

type DetailTab = "overview" | "materials" | "review" | "generate";

interface Props {
  project: AssistProject;
  onUpdate: (patch: Partial<AssistProject> | ((p: AssistProject) => Partial<AssistProject>)) => void;
  onBack: () => void;
  onGoToList: () => void;
  onAskAssistant?: (ctx: AssistantContext) => void;
}

const RECOG_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  "已识别": { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  "识别中": { color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
  "待识别": { color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
};
const CHECK_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  "通过":   { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  "不通过": { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  "缺失":   { color: "#d97706", bg: "#fff7ed", border: "#fed7aa" },
  "未触发": { color: "#64748b", bg: "#f8fafc", border: "#e8edf5" },
  "待校验": { color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
};


const CONCLUSION_CFG: Record<string, { color: string; bg: string; border: string }> = {
  "不通过": { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  "缺失":   { color: "#d97706", bg: "#fff7ed", border: "#fed7aa" },
};
const deptLabel = (d: string): "商务委" | "发改委" | "跨部门" => (d === "跨业务" ? "跨部门" : d as "商务委" | "发改委");

// 最近活动从项目实际状态推导（原先写死越南项目历史，新建项目也显示别人的活动）
function buildActivity(project: AssistProject): { icon: string; text: string; time: string; color: string; bg: string }[] {
  const items: { icon: string; text: string; time: string; color: string; bg: string }[] = [
    { icon: "★", text: "创建助办项目", time: project.updatedAt, color: "#1a5bc6", bg: "#eff6ff" },
  ];
  if (project.materials.length > 0) {
    items.unshift({ icon: "↑", text: `上传材料 ${project.materials.length} 份（材料版本 V${project.materialVersion}）`, time: project.updatedAt, color: "#1a5bc6", bg: "#eff6ff" });
  }
  if (project.validatedAt) {
    items.unshift({ icon: "✓", text: `完成材料校验（不通过 ${project.mismatchCount} 项 / 缺失 ${project.missingCount} 项）`, time: project.validatedAt, color: project.mismatchCount + project.missingCount > 0 ? "#d97706" : "#16a34a", bg: project.mismatchCount + project.missingCount > 0 ? "#fff7ed" : "#f0fdf4" });
  }
  if (project.status === "材料校验中") {
    items.unshift({ icon: "…", text: "正在进行材料识别与三域校验", time: "刚刚", color: "#1e40af", bg: "#eff6ff" });
  }
  return items.slice(0, 5);
}

// ── MaterialsPage ─────────────────────────────────────────
function MaterialsPage({ project, onFiles, onAskAssistant }: {
  project: AssistProject;
  onFiles: (files: FileList | File[]) => void;
  onAskAssistant?: (ctx: AssistantContext) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locked = project.status === "材料校验中"; // 校验中锁定上传（流程文档 §7.5）
  const rows = project.materials;

  const pick = () => { if (!locked) fileInputRef.current?.click(); };

  return (
    <div style={{ padding: "24px 44px", overflowY: "auto", flex: 1 }}>
      <input
        ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" style={{ display: "none" }}
        onChange={e => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ""; }}
      />
      <div
        onClick={pick}
        onDragOver={e => { if (!locked) e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); if (!locked && e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files); }}
        style={{
          border: `2px dashed ${locked ? "#cbd5e1" : "#93c5fd"}`, borderRadius: 12, padding: "28px", textAlign: "center",
          background: locked ? "#f8fafc" : "#eff6ff", marginBottom: 24, cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.7 : 1,
        }}
        onMouseEnter={e => { if (!locked) (e.currentTarget as HTMLElement).style.background = "#dbeafe"; }}
        onMouseLeave={e => { if (!locked) (e.currentTarget as HTMLElement).style.background = "#eff6ff"; }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ margin: "0 auto 8px", display: "block" }}>
          <path d="M16 22V10M10 16l6-6 6 6" stroke="#1a5bc6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="4" y="24" width="24" height="4" rx="2" fill="#bfdbfe"/>
        </svg>
        <div style={{ fontSize: 14, color: "#1a5bc6", fontWeight: 600, marginBottom: 4 }}>
          {locked ? "校验进行中，暂锁定上传" : "拖拽文件至此，或点击上传"}
        </div>
        <div style={{ fontSize: 12, color: "#64748b" }}>支持 PDF、Word、Excel，单文件最大 50MB</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8edf5", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["文件名", "材料类型", "所属范围", "上传时间", "识别状态", "校验状态", "操作"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9ca3af", borderBottom: "1px solid #e8edf5" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "36px 14px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
                  尚未上传材料。上传后系统将识别分类，并进入待校验状态。
                </td>
              </tr>
            ) : rows.map((m, i) => {
              const rCfg = RECOG_COLORS[m.recog] ?? RECOG_COLORS["待识别"];
              const cCfg = CHECK_COLORS[m.check] ?? CHECK_COLORS["待校验"];
              return (
                <tr key={m.id} style={{ borderBottom: i < rows.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "#1f2937", maxWidth: 180 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b" }}>{m.type}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b" }}>{m.scope}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "#9ca3af" }}>{m.uploadedAt}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, color: rCfg.color, background: rCfg.bg, border: `1px solid ${rCfg.border}` }}>{m.recog}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, color: cCfg.color, background: cCfg.bg, border: `1px solid ${cCfg.border}` }}>{m.check}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e5eaf2", background: "#f8fafc", fontSize: 11, color: "#374151", cursor: "pointer" }}>预览</button>
                      <button onClick={() => onAskAssistant?.({ type: "material", projectId: project.id, projectName: project.name, materialId: m.id, materialName: m.name })}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #bfdbfe", background: "#eff6ff", fontSize: 11, color: "#1a5bc6", cursor: "pointer" }}>问小海</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ── ReviewPage — 材料校验中心 ─────────────────────────────
function ReviewPage({ project, validation, onStartValidation, onAskAssistant }: {
  project: AssistProject;
  validation: ValidationResult;
  onStartValidation: () => void;
  onAskAssistant?: (ctx: AssistantContext) => void;
}) {
  const [activeDept, setActiveDept] = useState<"商务委" | "发改委" | "跨部门">("商务委");
  const allIssues = getIssues(validation).map(c => ({
    id: c.id, dept: deptLabel(c.domain), field: c.field,
    conclusion: c.status as "不通过" | "缺失", evidence: c.evidence, suggestion: c.suggestion,
  }));
  const filtered = allIssues.filter(i => i.dept === activeDept);

  const validating = project.status === "材料校验中";
  const noMaterials = project.materials.length === 0;
  const versionUnchanged = project.validatedVersion === project.materialVersion; // 硬边界③：材料未变化不允许重复校验
  const cannotRevalidate = validating || noMaterials || versionUnchanged;
  const revalidateHint = validating ? "校验进行中" : noMaterials ? "请先上传材料" : versionUnchanged ? "材料未变化，无需重复校验" : "";

  const deptResults = validation.summaries.map(s => ({
    dept: deptLabel(s.dept),
    passed: s.passed, failed: s.failed, missing: s.missing, skipped: s.skipped, triggered: true, total: s.total,
    checkedAt: project.validatedAt ?? "—",
  }));

  return (
    <div style={{ padding: "24px 44px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Disclaimer */}
      <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 16px", fontSize: 12, color: "#92400e" }}>
        本校验结果由AI辅助生成，仅供参考，不代表主管部门正式审核意见。请在提交前人工复核。
      </div>

      {/* 风险提示(只提示人工确认,不影响三态 —— 流程文档 §1.4) */}
      {validation.hints.length > 0 && (
        <div style={{ background: "#f8fafc", border: "1px solid #e8edf5", borderRadius: 10, padding: "10px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>风险提示 · 仅提示人工确认，不影响校验结论</div>
          {validation.hints.map(h => (
            <div key={h.id} style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>⚠ {h.text}</div>
          ))}
        </div>
      )}

      {/* Version notice */}
      <div style={{ background: "#f8fafc", border: "1px solid #e8edf5", borderRadius: 10, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
        <span style={{ color: "#374151" }}>
          当前校验结果基于材料版本 <strong>V{project.validatedVersion ?? "-"}</strong> · 最近校验时间：{project.validatedAt ?? "未校验"}
        </span>
        <button
          onClick={onStartValidation} disabled={cannotRevalidate} title={revalidateHint}
          style={{
            padding: "5px 14px", borderRadius: 7, border: `1px solid ${cannotRevalidate ? "#e5eaf2" : "#bfdbfe"}`,
            background: cannotRevalidate ? "#f8fafc" : "#eff6ff", fontSize: 12,
            color: cannotRevalidate ? "#9ca3af" : "#1a5bc6", cursor: cannotRevalidate ? "default" : "pointer", fontWeight: 500,
          }}>
          {validating ? "校验中…" : "重新校验"}
        </button>
      </div>

      {/* 3 dept overview cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        {deptResults.map(d => {
          const isActive = activeDept === d.dept;
          const hasIssues = d.failed + d.missing > 0;
          const conclusion = hasIssues ? (d.failed > 0 ? "有问题" : "有缺失") : "全部通过";
          const conclusionColor = hasIssues ? (d.failed > 0 ? "#dc2626" : "#d97706") : "#16a34a";
          const conclusionBg = hasIssues ? (d.failed > 0 ? "#fef2f2" : "#fff7ed") : "#f0fdf4";
          return (
            <button key={d.dept} onClick={() => setActiveDept(d.dept)} style={{
              padding: "16px 18px", borderRadius: 12, border: `2px solid ${isActive ? "#1a5bc6" : "#e8edf5"}`,
              background: isActive ? "#f0f7ff" : "#fff", cursor: "pointer", textAlign: "left",
              boxShadow: isActive ? "0 2px 8px rgba(26,91,198,0.12)" : "none", transition: "all 0.15s",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{d.dept}</span>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, background: conclusionBg, color: conclusionColor, fontWeight: 700 }}>{conclusion}</span>
              </div>
              <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 1 }}>通过</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a" }}>{d.passed}</div>
                </div>
                {d.failed > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 1 }}>不通过</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#dc2626" }}>{d.failed}</div>
                  </div>
                )}
                {d.missing > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 1 }}>缺失</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#d97706" }}>{d.missing}</div>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>共{d.total}项 · 校验时间：{d.checkedAt}</div>
                {d.skipped > 0 && (
                  <div style={{ fontSize: 10, color: "#64748b", background: "#f8fafc", border: "1px solid #e8edf5", borderRadius: 4, padding: "0 6px" }}>
                    未触发 {d.skipped} 项（条件不满足，不计入三态）
                  </div>
                )}
              </div>
              <div style={{ height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round((d.passed / d.total) * 100)}%`, background: "#16a34a", borderRadius: 2 }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Issue list for active dept */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
          {activeDept} · {filtered.length} 个问题
        </div>
        {filtered.length > 0 && (
          <button onClick={() => onAskAssistant?.({ type: "project", projectId: project.id, projectName: project.name })}
            style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #bfdbfe", background: "#eff6ff", fontSize: 12, color: "#1a5bc6", cursor: "pointer" }}>
            问小海如何处理这些问题
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af", fontSize: 13, background: "#fff", borderRadius: 12, border: "1px solid #e8edf5" }}>该部门校验全部通过</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(issue => {
            const cfg = CONCLUSION_CFG[issue.conclusion];
            return (
              <div key={issue.id} style={{ background: "#fff", borderRadius: 12, border: `1px solid ${cfg.border}`, padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, color: "#1e40af", background: "#eff6ff", border: "1px solid #bfdbfe" }}>{issue.dept}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", flex: 1 }}>{issue.field}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{issue.conclusion}</span>
                </div>
                {issue.evidence && <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: issue.suggestion ? 8 : 0 }}>当前:{issue.evidence}</div>}
                {issue.suggestion && (
                  <div style={{ padding: "8px 12px", borderRadius: 8, background: "#fff7ed", fontSize: 12, color: "#92400e", lineHeight: 1.6, marginBottom: 10 }}>💡 {issue.suggestion}</div>
                )}
                <button onClick={() => onAskAssistant?.({ type: "project", projectId: project.id, projectName: project.name })}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #bfdbfe", background: "#eff6ff", fontSize: 11.5, color: "#1a5bc6", cursor: "pointer" }}>问小海如何处理</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── GeneratePage ──────────────────────────────────────────
const GENERATE_ITEMS = [
  { id: "g1", name: "境外投资备案申请表（生成版）", dept: "商务委", fieldTotal: 24, fieldDone: 18, missing: 3, conflict: 1, canGenerate: false },
  { id: "g2", name: "真实性承诺书", dept: "商务委", fieldTotal: 8, fieldDone: 8, missing: 0, conflict: 0, canGenerate: true },
  { id: "g3", name: "项目情况说明", dept: "商务委", fieldTotal: 12, fieldDone: 9, missing: 2, conflict: 1, canGenerate: false },
  { id: "g4", name: "资金来源说明函", dept: "商务委", fieldTotal: 6, fieldDone: 4, missing: 2, conflict: 0, canGenerate: false },
];

function GeneratePage({ project, onAskAssistant }: { project: AssistProject; onAskAssistant?: (ctx: AssistantContext) => void }) {
  return (
    <div style={{ padding: "24px 44px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 16px", fontSize: 12, color: "#1e40af" }}>
        以下材料由系统基于您上传的原始材料自动生成，请确认字段信息后下载使用。发改委材料生成不在本平台服务范围内。
      </div>
      {GENERATE_ITEMS.map(item => {
        const pct = Math.round((item.fieldDone / item.fieldTotal) * 100);
        const hasIssues = item.missing > 0 || item.conflict > 0;
        return (
          <div key={item.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8edf5", padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{item.name}</span>
                <span style={{ marginLeft: 8, fontSize: 11, padding: "1px 7px", borderRadius: 5, background: "#eff6ff", color: "#1a5bc6", border: "1px solid #bfdbfe" }}>{item.dept}</span>
              </div>
              <span style={{ fontSize: 12, color: "#64748b" }}>{item.fieldDone}/{item.fieldTotal} 字段</span>
            </div>
            <div style={{ height: 5, background: "#f1f5f9", borderRadius: 3, marginBottom: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#16a34a" : "#1a5bc6", borderRadius: 3 }} />
            </div>
            {hasIssues && (
              <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                {item.missing > 0 && <span style={{ fontSize: 11, color: "#d97706" }}>缺失字段 {item.missing} 个</span>}
                {item.conflict > 0 && <span style={{ fontSize: 11, color: "#dc2626" }}>冲突字段 {item.conflict} 个</span>}
                {!item.canGenerate && <span style={{ fontSize: 11, color: "#9ca3af" }}>需先处理问题才可生成</span>}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={{ padding: "5px 14px", borderRadius: 7, border: "1px solid #e5eaf2", background: "#f8fafc", fontSize: 12, color: "#374151", cursor: "pointer" }}>预览</button>
              <button disabled={!item.canGenerate} style={{ padding: "5px 14px", borderRadius: 7, border: "none", background: item.canGenerate ? "#1a5bc6" : "#f1f5f9", color: item.canGenerate ? "#fff" : "#9ca3af", fontSize: 12, cursor: item.canGenerate ? "pointer" : "default" }}>生成</button>
              <button disabled={!item.canGenerate} style={{ padding: "5px 14px", borderRadius: 7, border: "1px solid #e5eaf2", background: "#f8fafc", fontSize: 12, color: item.canGenerate ? "#374151" : "#9ca3af", cursor: item.canGenerate ? "pointer" : "default" }}>下载</button>
              <button onClick={() => onAskAssistant?.({ type: "material", projectId: project.id, projectName: project.name, materialId: item.id, materialName: item.name })}
                style={{ padding: "5px 14px", borderRadius: 7, border: "1px solid #bfdbfe", background: "#eff6ff", fontSize: 12, color: "#1a5bc6", cursor: "pointer" }}>询问小海</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Progress stepper ──────────────────────────────────────
const PROGRESS_STEPS = ["创建项目", "上传材料", "智能校验", "问题处理", "材料生成"];
type StepStatus = "done" | "current" | "issue" | "pending";

function ProgressStepper({ steps }: { steps: StepStatus[] }) {
  const colors: Record<StepStatus, { dot: string; label: string; line: string }> = {
    done:    { dot: "#16a34a", label: "#16a34a", line: "#bbf7d0" },
    current: { dot: "#1a5bc6", label: "#1a5bc6", line: "#bfdbfe" },
    issue:   { dot: "#dc2626", label: "#dc2626", line: "#fecaca" },
    pending: { dot: "#d1d5db", label: "#9ca3af", line: "#f1f5f9" },
  };
  const icons: Record<StepStatus, string> = {
    done: "✓", current: "●", issue: "!", pending: "",
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start", padding: "0 4px" }}>
      {PROGRESS_STEPS.map((label, i) => {
        const s = steps[i] ?? "pending";
        const c = colors[s];
        const isLast = i === PROGRESS_STEPS.length - 1;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            {/* Connector line */}
            {!isLast && (
              <div style={{ position: "absolute", top: 11, left: "50%", right: "-50%", height: 2, background: steps[i + 1] !== "pending" ? c.line : "#f1f5f9", zIndex: 0 }} />
            )}
            {/* Dot */}
            <div style={{
              width: 24, height: 24, borderRadius: "50%", background: c.dot,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 10, fontWeight: 700, zIndex: 1,
              boxShadow: s === "current" ? "0 0 0 3px #bfdbfe" : s === "issue" ? "0 0 0 3px #fecaca" : "none",
              flexShrink: 0,
            }}>
              {icons[s]}
            </div>
            <span style={{ marginTop: 6, fontSize: 11, fontWeight: s === "current" || s === "issue" ? 700 : 400, color: c.label, textAlign: "center", whiteSpace: "nowrap" }}>{label}</span>
            <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
              {s === "done" ? "已完成" : s === "current" ? "进行中" : s === "issue" ? "有问题" : "未开始"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Status Card (high weight) ─────────────────────────────
function StatusCard({ project, validation, onTab, onStartValidation }: {
  project: AssistProject;
  validation: ValidationResult;
  onTab: (t: DetailTab) => void;
  onStartValidation: () => void;
}) {
  const issueCount = project.mismatchCount + project.missingCount;
  const deptIssue = (dept: string) => {
    const s = validation.summaries.find(x => deptLabel(x.dept) === dept);
    return s ? s.failed + s.missing : 0;
  };

  const configs: Record<string, {
    bg: string; border: string; titleColor: string; title: string; desc: string;
    btnLabel: string; btnTab: DetailTab; btnStyle: "primary" | "urgent"; btnAction?: "start";
  }> = {
    "待上传材料": {
      bg: "#f8fafc", border: "#e8edf5", titleColor: "#374151",
      title: "尚未上传项目材料",
      desc: "上传材料后，系统将对商务委、发改委及跨业务核心字段进行智能校验。",
      btnLabel: "上传项目材料", btnTab: "materials", btnStyle: "primary",
    },
    "待校验": {
      bg: "#eff6ff", border: "#bfdbfe", titleColor: "#1e40af",
      title: "材料已上传，等待开始校验",
      desc: `已上传 ${project.materials.length} 份材料，系统尚未开始识别与校验。`,
      btnLabel: "开始智能校验", btnTab: "review", btnStyle: "primary", btnAction: "start",
    },
    "材料校验中": {
      bg: "#eff6ff", border: "#bfdbfe", titleColor: "#1e40af",
      title: "系统正在进行智能校验",
      desc: "材料分类 → 内容识别 → 商务委校验 → 发改委校验 → 跨业务字段比对，校验期间请勿重复提交。",
      btnLabel: "查看校验进度", btnTab: "review", btnStyle: "primary",
    },
    "待处理": {
      bg: "#fff7ed", border: "#fed7aa", titleColor: "#92400e",
      title: `本次校验发现 ${issueCount} 个待处理问题`,
      desc: `不通过 ${project.mismatchCount} 项，缺失 ${project.missingCount} 项。商务委 ${deptIssue("商务委")} 项，发改委 ${deptIssue("发改委")} 项，跨部门 ${deptIssue("跨部门")} 项。`,
      btnLabel: `查看并处理 ${issueCount} 个问题`, btnTab: "review", btnStyle: "urgent",
    },
    "已完成": {
      bg: "#f0fdf4", border: "#bbf7d0", titleColor: "#15803d",
      title: "所有问题已处理，可生成商务委材料草稿",
      desc: "当前商务委相关字段已满足材料草稿生成条件。",
      btnLabel: "进入生成管理", btnTab: "generate", btnStyle: "primary",
    },
  };

  const cfg = configs[project.status] ?? configs["待处理"];

  return (
    <div style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: 14, padding: "18px 22px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: cfg.titleColor, marginBottom: 5, opacity: 0.75, letterSpacing: 0.5 }}>当前状态</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: cfg.titleColor, lineHeight: 1.35, marginBottom: 8 }}>{cfg.title}</div>
          <div style={{ fontSize: 12, color: cfg.titleColor, opacity: 0.8, lineHeight: 1.6 }}>{cfg.desc}</div>
        </div>
        <button
          onClick={() => {
            if (cfg.btnAction === "start") { onTab(cfg.btnTab); onStartValidation(); }
            else onTab(cfg.btnTab);
          }}
          style={{
            padding: "11px 24px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", flexShrink: 0,
            background: cfg.btnStyle === "urgent" ? "#dc2626" : "#1a5bc6",
            color: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.18)", alignSelf: "center",
          }}>{cfg.btnLabel}</button>
      </div>
    </div>
  );
}

// ── Four core result cards ────────────────────────────────
function ResultCards({ project, validation, onTab }: { project: AssistProject; validation: ValidationResult; onTab: (t: DetailTab) => void }) {
  const summary = (dept: string) => validation.summaries.find(x => deptLabel(x.dept) === dept)!;
  const mofcom = summary("商务委");
  const ndrc = summary("发改委");
  const cross = summary("跨部门");
  const recognized = project.materials.filter(m => m.recog === "已识别").length;

  const cards = [
    {
      title: "材料情况",
      onClick: () => onTab("materials"),
      rows: [
        { label: "已上传材料", value: `${project.materials.length} 份`, color: "#1a5bc6" },
        { label: "已识别", value: `${recognized} 份`, color: "#16a34a" },
        { label: "识别中", value: `${project.materials.length - recognized} 份`, color: "#9ca3af" },
        { label: "当前版本", value: `V${project.materialVersion}`, color: "#374151" },
      ],
      conclusion: null,
    },
    {
      title: "商务委校验",
      onClick: () => onTab("review"),
      rows: [
        { label: "通过", value: `${mofcom.passed} 项`, color: "#16a34a" },
        { label: "不通过", value: `${mofcom.failed} 项`, color: "#dc2626" },
        { label: "缺失", value: `${mofcom.missing} 项`, color: "#d97706" },
      ],
      conclusion: mofcom.failed + mofcom.missing > 0 ? "有问题" : "全部通过",
      conclusionOk: mofcom.failed + mofcom.missing === 0,
    },
    {
      title: "发改委校验",
      onClick: () => onTab("review"),
      rows: [
        { label: "通过", value: `${ndrc.passed} 项`, color: "#16a34a" },
        { label: "不通过", value: `${ndrc.failed} 项`, color: "#dc2626" },
        { label: "缺失", value: `${ndrc.missing} 项`, color: "#d97706" },
      ],
      conclusion: ndrc.failed + ndrc.missing > 0 ? "有缺失" : "全部通过",
      conclusionOk: ndrc.failed + ndrc.missing === 0,
    },
    {
      title: "跨业务字段",
      onClick: () => onTab("review"),
      rows: [
        { label: "已比对", value: `${cross.total} 项`, color: "#374151" },
        { label: "一致", value: `${cross.passed} 项`, color: "#16a34a" },
        { label: "冲突", value: `${cross.failed} 项`, color: "#dc2626" },
        { label: "未识别", value: "0 项", color: "#9ca3af" },
      ],
      conclusion: cross.failed > 0 ? "有冲突" : "全部一致",
      conclusionOk: cross.failed === 0,
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
      {cards.map(card => (
        <button key={card.title} onClick={card.onClick} style={{
          background: "#fff", borderRadius: 12, border: "1px solid #e8edf5", padding: "14px 16px",
          textAlign: "left", cursor: "pointer", transition: "box-shadow 0.15s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(26,91,198,0.10)"; (e.currentTarget as HTMLElement).style.borderColor = "#c7d9f5"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.borderColor = "#e8edf5"; }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{card.title}</span>
            {card.conclusion && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                color: card.conclusionOk ? "#16a34a" : "#dc2626",
                background: card.conclusionOk ? "#f0fdf4" : "#fef2f2",
              }}>{card.conclusion}</span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {card.rows.map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Next step recommendation ──────────────────────────────
function NextStepCard({ project, onTab }: { project: AssistProject; onTab: (t: DetailTab) => void }) {
  const issueCount = project.mismatchCount + project.missingCount;
  const rec =
    project.status === "待上传材料"
      ? { title: "上传项目材料", desc: "还未上传任何材料。上传后系统将自动分类并开始识别。", btn: "前往上传材料", tab: "materials" as DetailTab }
      : issueCount > 0
      ? { title: "补充资金来源证明", desc: "该材料缺失会影响发改委相关校验，是当前影响最大的未处理问题。", btn: "查看缺失材料", tab: "review" as DetailTab }
      : { title: "生成商务委材料草稿", desc: "当前商务委字段已满足草稿生成条件，可进入生成管理。", btn: "进入生成管理", tab: "generate" as DetailTab };

  return (
    <div style={{ background: "#fff", border: "1.5px solid #e8edf5", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 3v14M3 10h14" stroke="#1a5bc6" strokeWidth="2" strokeLinecap="round"/></svg>
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 3, letterSpacing: 0.5 }}>下一步建议</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{rec.title}</div>
        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{rec.desc}</div>
      </div>
      <button onClick={() => onTab(rec.tab)} style={{
        padding: "10px 22px", borderRadius: 10, border: "none", background: "#1a5bc6",
        color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0,
      }}>{rec.btn}</button>
    </div>
  );
}

// ── OverviewPage ──────────────────────────────────────────
function OverviewPage({ project, validation, onTab, onStartValidation, onAskAssistant }: {
  project: AssistProject;
  validation: ValidationResult;
  onTab: (t: DetailTab) => void;
  onStartValidation: () => void;
  onAskAssistant?: (ctx: AssistantContext) => void;
}) {
  const stepStatuses: StepStatus[] = progressFromStatus(project.status);
  const activity = buildActivity(project);
  // 关键待办 = 校验引擎实算问题 Top3（原先写死 3 条越南项目的假待办）
  const todos = getIssues(validation).slice(0, 3).map(c => ({
    text: `${c.field} — ${c.suggestion}`,
    issueId: c.id,
    dept: deptLabel(c.domain),
    urgent: c.status === "不通过",
  }));

  return (
    <div style={{ padding: "24px 44px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Project identity */}
      <div style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 14, padding: "14px 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, color: "#1e40af", background: "#eff6ff", border: "1px solid #bfdbfe" }}>申报助办</span>
            {[
              { label: "投资方式", value: project.investmentType ?? "新设" },
              { label: "材料版本", value: `V${project.materialVersion}` },
              { label: "最近更新", value: project.updatedAt },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{f.value}</div>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 7, color: PROJECT_STATUS_CONFIG[project.status]?.color ?? "#374151", background: PROJECT_STATUS_CONFIG[project.status]?.bg ?? "#f8fafc", border: `1px solid ${PROJECT_STATUS_CONFIG[project.status]?.border ?? "#e8edf5"}`, fontWeight: 600 }}>
            {project.status}
          </span>
        </div>
      </div>

      {/* 5-step progress */}
      <div style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 14, padding: "18px 28px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 16 }}>办理进度</div>
        <ProgressStepper steps={stepStatuses} />
      </div>

      {/* High-weight status card */}
      <StatusCard project={project} validation={validation} onTab={onTab} onStartValidation={onStartValidation} />

      {/* 4 core result cards */}
      <ResultCards project={project} validation={validation} onTab={onTab} />

      {/* Next step recommendation — single prominent CTA */}
      <NextStepCard project={project} onTab={onTab} />

      {/* Bottom: todos + activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Todos */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edf5", padding: "18px 20px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>关键待办</div>
          {todos.length === 0 ? (
            <div style={{ fontSize: 12, color: "#9ca3af", padding: "8px 0" }}>暂无待办事项</div>
          ) : todos.map((todo, i, arr) => (
            <div key={todo.issueId} style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingBottom: i < arr.length - 1 ? 10 : 0, marginBottom: i < arr.length - 1 ? 10 : 0, borderBottom: i < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: todo.urgent ? "#dc2626" : "#f59e0b", flexShrink: 0, marginTop: 4 }} />
              <span style={{ fontSize: 12, color: "#374151", flex: 1, lineHeight: 1.5 }}>{todo.text}</span>
              <button onClick={() => onAskAssistant?.({ type: "issue", projectId: project.id, projectName: project.name, issueId: todo.issueId, issueName: todo.text, department: todo.dept })}
                style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid #bfdbfe", background: "#eff6ff", fontSize: 10, color: "#1a5bc6", cursor: "pointer", flexShrink: 0 }}>问小海</button>
            </div>
          ))}
        </div>

        {/* Activity */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edf5", padding: "18px 20px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>最近活动</div>
          {activity.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < activity.length - 1 ? 10 : 0, paddingBottom: i < activity.length - 1 ? 10 : 0, borderBottom: i < activity.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0, color: a.color, fontWeight: 700 }}>{a.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>{a.text}</div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
export function OdiProjectDetailPage({ project, onUpdate, onBack, onGoToList, onAskAssistant }: Props) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const timersRef = useRef<number[]>([]);
  const cfg = PROJECT_STATUS_CONFIG[project.status];

  // 校验中心/驾驶舱全部吃项目自身字段池的实算结果（原先用模块级写死演示池）
  const validation = useMemo(() => validateOdiPool(project.fieldPool ?? []), [project.fieldPool]);

  // 卸载时清掉识别/校验的演示定时器
  useEffect(() => () => { timersRef.current.forEach(t => window.clearTimeout(t)); }, []);
  const later = (fn: () => void, ms: number) => { timersRef.current.push(window.setTimeout(fn, ms)); };

  /** 上传：追加了材料行 → 待校验；首传注入演示字段池；1.2s 后置为已识别（POC 演示，未接 OCR）。 */
  const handleFiles = (files: FileList | File[]) => {
    if (project.status === "材料校验中") return; // 校验中锁定上传
    const rows: AssistMaterialFile[] = Array.from(files).map((f, i) => ({
      id: `m${Date.now()}-${i}`,
      name: f.name,
      ...guessMaterialMeta(f.name),
      uploadedAt: "刚刚",
      recog: "识别中",
      check: "待校验" as const,
    }));
    const firstUpload = project.materials.length === 0;
    const nextCount = project.materials.length + rows.length;
    onUpdate({
      materials: [...project.materials, ...rows],
      uploadedCount: nextCount,
      materialVersion: project.materialVersion + 1,
      status: "待校验",
      // POC 演示：未接 OCR，首次上传后按场景预设模拟"已解析"（含 3 处典型问题演示三态校验）
      ...(firstUpload && !project.fieldPool ? { fieldPool: seedAssistFieldPool(true) } : {}),
    });
    later(() => {
      onUpdate(p => ({ materials: p.materials.map(m => (m.recog === "识别中" ? { ...m, recog: "已识别" as const } : m)) }));
    }, 1200);
  };

  /** 开始/重新校验：材料校验中 → 1.6s 后按引擎实算落库（状态、三域计数、版本、时间）。 */
  const runValidation = () => {
    if (project.materials.length === 0 || project.status === "材料校验中") return;
    onUpdate({ status: "材料校验中" });
    const { failed, missing, passed } = validation.summaries.reduce(
      (acc, s) => ({ failed: acc.failed + s.failed, missing: acc.missing + s.missing, passed: acc.passed + s.passed }),
      { failed: 0, missing: 0, passed: 0 },
    );
    later(() => {
      onUpdate({
        status: statusAfterValidation(failed, missing),
        mismatchCount: failed,
        missingCount: missing,
        passedCount: passed,
        validatedAt: "刚刚",
        validatedVersion: project.materialVersion,
        materials: project.materials.map(m => (m.recog === "识别中" ? { ...m, recog: "已识别" as const } : m)),
      });
    }, 1600);
  };

  const TABS: { key: DetailTab; label: string }[] = [
    { key: "overview", label: "项目驾驶舱" },
    { key: "materials", label: "材料管理" },
    { key: "review", label: "材料校验中心" },
    { key: "generate", label: "生成管理" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f5f7fb", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8edf5", padding: "12px 44px", flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>
          <button onClick={onGoToList} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 12, padding: 0 }}>ODI备案助手</button>
          {" / "}
          <span style={{ color: "#374151", fontWeight: 500 }}>{project.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>{project.name}</h2>
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 8, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, fontWeight: 600 }}>{project.status}</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => onAskAssistant?.({ type: "project", projectId: project.id, projectName: project.name })}
              style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid #bfdbfe", background: "#eff6ff", fontSize: 13, color: "#1a5bc6", cursor: "pointer", fontWeight: 500 }}>问小海</button>
            <button onClick={onGoToList} style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, color: "#374151", cursor: "pointer" }}>返回工作台</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8edf5", padding: "0 44px", flexShrink: 0, display: "flex" }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ padding: "12px 20px", border: "none", background: "transparent", fontSize: 14, cursor: "pointer", color: activeTab === tab.key ? "#1a5bc6" : "#64748b", fontWeight: activeTab === tab.key ? 700 : 400, borderBottom: activeTab === tab.key ? "2px solid #1a5bc6" : "2px solid transparent", marginBottom: -1, transition: "color 0.15s" }}
          >{tab.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "overview"   && <OverviewPage   project={project} validation={validation} onTab={setActiveTab} onStartValidation={runValidation} onAskAssistant={onAskAssistant} />}
        {activeTab === "materials"  && <MaterialsPage  project={project} onFiles={handleFiles} onAskAssistant={onAskAssistant} />}
        {activeTab === "review"     && <ReviewPage     project={project} validation={validation} onStartValidation={runValidation} onAskAssistant={onAskAssistant} />}
        {activeTab === "generate"   && <GeneratePage   project={project} onAskAssistant={onAskAssistant} />}
      </div>
    </div>
  );
}
