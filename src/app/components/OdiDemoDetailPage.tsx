import { useMemo, useRef, useState } from "react";
import { gsap, Flip, useGSAP, DUR, EASE, SHIFT, prefersReducedMotion } from "../motion/tokens";
import type { DemoProject } from "./odiProjectData";
import { allFieldDefs } from "../odi/field/odiFieldCatalog";
import { emptyField, type OdiField } from "../odi/data/types";
import { applyLinkage, commitField, computeDerived } from "../odi/field/odiGuideLogic";
import { type ValidationCheck, type ValidationResult } from "../odi/validation/odiValidationEngine";
import { validateOdiFull } from "../odi/validation/odiNdrcRules";

type Tab = "overview" | "form" | "verify" | "result";
type Scene = "新设独资" | "并购" | "增资变更";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "体验概览" },
  { key: "form",     label: "模拟填报" },
  { key: "verify",   label: "模拟校验" },
  { key: "result",   label: "材料结果" },
];

const STEP_LABELS = ["项目方案", "投资结构与资金", "项目说明", "材料结果"];

// ── Case data by scene ────────────────────────────────────
const CASE_DATA: Record<Scene, {
  investorCN: string; investorEN: string;
  targetCN: string; targetEN: string;
  country: string; industry: string;
  regCapital: string; investAmount: string;
  equity: string; fundSource: string;
  estimatedDocs: string[];
}> = {
  "新设独资": {
    investorCN: "星跃科技集团有限公司", investorEN: "StarLeap Technology Group Co., Ltd.",
    targetCN: "星跃科技（新加坡）有限公司", targetEN: "StarLeap Technology (Singapore) Pte. Ltd.",
    country: "新加坡", industry: "软件和信息技术服务业（I65）",
    regCapital: "SGD 6,850,000", investAmount: "USD 5,000,000",
    equity: "100%", fundSource: "企业自有资金（70%）+ 境内银行贷款（30%）",
    estimatedDocs: ["对外投资备案申请表", "可行性研究报告", "真实性承诺书", "资金来源证明"],
  },
  "并购": {
    investorCN: "华瑞工业集团有限公司", investorEN: "Huarui Industrial Group Co., Ltd.",
    targetCN: "德意志工业设备制造GmbH", targetEN: "Deutsche Industrieausrüstung GmbH",
    country: "德国", industry: "工业设备制造（C35）",
    regCapital: "EUR 8,000,000", investAmount: "USD 10,000,000",
    equity: "80%", fundSource: "并购专项境外贷款（50%）+ 自有资金（50%）",
    estimatedDocs: ["并购项目备案申请表", "可行性研究报告", "收购协议摘要", "目标公司审计报告", "资金筹措说明"],
  },
  "增资变更": {
    investorCN: "泰达实业投资有限公司", investorEN: "TEDA Industrial Investment Co., Ltd.",
    targetCN: "泰达（越南）实业有限公司", targetEN: "TEDA (Vietnam) Industries Co., Ltd.",
    country: "越南", industry: "纺织服装制造（C17）",
    regCapital: "USD 3,500,000（变更后 USD 6,000,000）", investAmount: "USD 2,500,000（增资额）",
    equity: "60%→75%", fundSource: "企业留存收益转增资",
    estimatedDocs: ["变更备案申请表", "股东会决议", "变更原因说明", "财务报告（近2年）"],
  },
};

// ── Scene content sections ────────────────────────────────
// P1:案例字段可编辑并回写字段池(overrides → caseToPool → 联动/派生 → 校验实时变)
type CaseData = (typeof CASE_DATA)["新设独资"];
function CaseFieldInput({ value, onCommit, onClose }: { value: string; onCommit: (v: string) => void; onClose: () => void }) {
  return (
    <div style={{ padding: "4px 8px 8px" }}>
      <input defaultValue={value} autoFocus
        onBlur={e => { onCommit(e.target.value); onClose(); }}
        onKeyDown={e => { if (e.key === "Enter") { onCommit((e.target as HTMLInputElement).value); onClose(); } if (e.key === "Escape") onClose(); }}
        style={{ width: "100%", fontSize: 13, fontWeight: 600, color: "#1f2937", border: "1px solid #1a5bc6", borderRadius: 6, padding: "4px 8px", background: "#fff", outline: "none", boxSizing: "border-box" }} />
    </div>
  );
}

function NewSetupCase({ c, editable, onEdit, onCommit }: {
  c: CaseData; editable: string | null; onEdit: (field: string | null) => void; onCommit: (key: string, value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Investment path diagram */}
      <div style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 12, padding: "20px 24px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 16 }}>投资路径</div>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {[
            { label: "境内投资主体", sub: c.investorCN, color: "#eff6ff", border: "#bfdbfe" },
            null,
            { label: "境外子公司（新设）", sub: c.targetCN, color: "#fff7ed", border: "#fde68a" },
          ].map((node, i) => node === null ? (
            <div key={i} style={{ flex: 1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ height: 2, width: "100%", background: "#1a5bc6" }} />
              <div style={{ fontSize: 11, color: "#1a5bc6", fontWeight: 700 }}>100% 股权</div>
              <div style={{ fontSize: 10, color: "#64748b" }}>{c.investAmount}</div>
            </div>
          ) : (
            <div key={i} style={{ padding: "12px 16px", borderRadius: 10, background: node.color, border: `1.5px solid ${node.border}`, minWidth: 150, textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>{node.label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>{node.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Fields grid */}
      <div style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 12, padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>案例要素</div>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>点击字段值可调整</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "注册资本", value: c.regCapital, key: "regCapital", highlight: true },
            { label: "投资总额", value: c.investAmount, key: "investAmount", highlight: true },
            { label: "中方股比", value: c.equity, key: "equity" },
            { label: "资金来源", value: c.fundSource, key: "fundSource" },
            { label: "目标国家/地区", value: c.country, key: "country" },
            { label: "行业分类", value: c.industry, key: "industry" },
          ].map(f => (
            <div key={f.key} style={{ borderRadius: 9, border: `1px solid ${f.highlight ? "#fde68a" : "#e8edf5"}`, background: f.highlight ? "#fffbeb" : "#f8fafc", overflow: "hidden" }}>
              <div style={{ padding: "8px 12px 0", fontSize: 10, color: "#9ca3af" }}>{f.label}</div>
              {editable === f.key ? (
                <CaseFieldInput value={f.value} onCommit={v => onCommit(f.key, v)} onClose={() => onEdit(null)} />
              ) : (
                <div onClick={() => onEdit(f.key)} style={{ padding: "4px 12px 10px", fontSize: 13, fontWeight: 600, color: f.highlight ? "#92400e" : "#1f2937", cursor: "text" }}>
                  {f.value}
                  <span style={{ marginLeft: 6, fontSize: 10, color: "#1a5bc6", opacity: 0, transition: "opacity 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
                  >修改</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Expected docs */}
      <div style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 12, padding: "16px 20px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>预计生成材料参考稿</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {c.estimatedDocs.map(d => (
            <span key={d} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 7, background: "#eff6ff", color: "#1a5bc6", border: "1px solid #bfdbfe" }}>{d}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function AcquisitionCase({ c, editable, onEdit, onCommit }: {
  c: CaseData; editable: string | null; onEdit: (field: string | null) => void; onCommit: (key: string, value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Equity before/after diagram */}
      <div style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 12, padding: "20px 24px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 16 }}>并购后股权结构</div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ flex: 1, padding: "12px 16px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e8edf5", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>并购前</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{c.investorCN.slice(0, 6)}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#9ca3af" }}>0%</div>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 22, color: "#1a5bc6", fontWeight: 700 }}>→</div>
            <div style={{ fontSize: 11, color: "#d97706", fontWeight: 700 }}>收购</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>{c.investAmount}</div>
          </div>
          <div style={{ flex: 1, padding: "12px 16px", borderRadius: 10, background: "#fff7ed", border: "1.5px solid #fde68a", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#92400e", marginBottom: 4 }}>并购后</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1f2937" }}>{c.investorCN.slice(0, 6)}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#d97706" }}>{c.equity}</div>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 12, padding: "20px 24px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 16 }}>并购要素</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "并购目标", value: c.targetCN, key: "targetCN" },
            { label: "目标国家", value: c.country, key: "country" },
            { label: "收购价款（合并口径）", value: c.investAmount, key: "investAmount", highlight: true },
            { label: "收购比例", value: c.equity, key: "equity", highlight: true },
            { label: "资金筹措方式", value: c.fundSource, key: "fundSource" },
            { label: "行业分类", value: c.industry, key: "industry" },
          ].map(f => (
            <div key={f.key} style={{ borderRadius: 9, border: `1px solid ${(f as any).highlight ? "#fde68a" : "#e8edf5"}`, background: (f as any).highlight ? "#fffbeb" : "#f8fafc" }}>
              <div style={{ padding: "8px 12px 0", fontSize: 10, color: "#9ca3af" }}>{f.label}</div>
              {editable === f.key ? (
                <CaseFieldInput value={f.value} onCommit={v => onCommit(f.key, v)} onClose={() => onEdit(null)} />
              ) : (
                <div onClick={() => onEdit(f.key)} style={{ padding: "4px 12px 10px", fontSize: 13, fontWeight: 600, color: (f as any).highlight ? "#92400e" : "#1f2937", cursor: "text" }}>{f.value}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Special docs */}
      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "14px 18px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>并购专项材料提示</div>
        <div style={{ fontSize: 12, color: "#7f1d1d", lineHeight: 1.6 }}>并购场景需额外提供：目标企业审计报告、收购协议（草稿/正式版）、并购风险评估说明。商务委可能要求提交尽职调查报告摘要。</div>
      </div>
    </div>
  );
}

function ChangeCase({ c, editable, onEdit, onCommit }: {
  c: CaseData; editable: string | null; onEdit: (field: string | null) => void; onCommit: (key: string, value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Before → after comparison */}
      <div style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 12, padding: "20px 24px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 16 }}>变更前 → 变更后</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "center" }}>
          {/* Before */}
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e8edf5" }}>
            <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 6, fontWeight: 700 }}>变更前</div>
            {[
              { label: "注册资本", value: "USD 3,500,000" },
              { label: "中方股比", value: "60%" },
            ].map(r => (
              <div key={r.label} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>{r.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>{r.value}</div>
              </div>
            ))}
          </div>
          {/* Arrow */}
          <div style={{ textAlign: "center", fontSize: 24, color: "#d97706", fontWeight: 700 }}>→</div>
          {/* After */}
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "#fff7ed", border: "1.5px solid #fde68a" }}>
            <div style={{ fontSize: 10, color: "#92400e", marginBottom: 6, fontWeight: 700 }}>变更后</div>
            {[
              { label: "注册资本", value: "USD 6,000,000" },
              { label: "中方股比", value: "75%" },
            ].map(r => (
              <div key={r.label} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>{r.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Change delta */}
        <div style={{ marginTop: 12, padding: "10px 14px", background: "#fffbeb", borderRadius: 8, border: "1px solid #fde68a" }}>
          <span style={{ fontSize: 12, color: "#92400e" }}>本次增资额：<strong>USD 2,500,000</strong> · 股权增加：<strong>+15%</strong></span>
        </div>
      </div>

      {/* Change reason */}
      <div style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 12, padding: "20px 24px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 14 }}>变更信息</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "变更类型", value: "增资 + 股权变更", key: "type" },
            { label: "资金来源", value: c.fundSource, key: "fundSource" },
            { label: "变更原因", value: "产能扩张，引入本地战略股东", key: "reason" },
            { label: "目标国家", value: c.country, key: "country" },
          ].map(f => (
            <div key={f.key} style={{ borderRadius: 9, border: "1px solid #e8edf5", background: "#f8fafc" }}>
              <div style={{ padding: "8px 12px 0", fontSize: 10, color: "#9ca3af" }}>{f.label}</div>
              {editable === f.key ? (
                <CaseFieldInput value={f.value} onCommit={v => onCommit(f.key, v)} onClose={() => onEdit(null)} />
              ) : (
                <div onClick={() => onEdit(f.key)} style={{ padding: "4px 12px 10px", fontSize: 13, fontWeight: 600, color: "#1f2937", cursor: "text" }}>{f.value}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── FormTab — case experience ─────────────────────────────
function FormTab({ scene, overrides, onCommit }: {
  scene: Scene; overrides: Record<string, string>; onCommit: (key: string, value: string) => void;
}) {
  const [step, setStep] = useState(0); // 0=项目方案 1=投资结构 2=项目说明
  const [editable, setEditable] = useState<string | null>(null);
  const stepLabels = ["项目方案", "投资结构与资金", "项目说明"];
  const c: CaseData = { ...CASE_DATA[scene], ...overrides };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Step nav */}
      <div style={{ width: 180, flexShrink: 0, borderRight: "1px solid #f1f5f9", padding: "16px 0", display: "flex", flexDirection: "column" }}>
        {stepLabels.map((label, i) => (
          <button key={i} onClick={() => setStep(i)} style={{
            width: "100%", textAlign: "left", padding: "10px 16px", background: step === i ? "#fff7ed" : "none",
            border: "none", borderLeft: `3px solid ${step === i ? "#d97706" : "transparent"}`,
            cursor: "pointer", fontSize: 12, fontWeight: step === i ? 700 : 400,
            color: step === i ? "#92400e" : "#374151",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 16, height: 16, borderRadius: "50%", background: step === i ? "#d97706" : "#e5eaf2", color: step === i ? "#fff" : "#9ca3af", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
              {label}
            </div>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: "12px 14px", margin: "0 8px", background: "#fff7ed", borderRadius: 8, border: "1px solid #fde68a" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>系统派生字段</div>
          <div style={{ fontSize: 10, color: "#92400e", lineHeight: 1.5 }}>标注"系统计算"的字段为只读，根据您输入的主字段自动带出。</div>
        </div>
      </div>

      {/* Case content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>{stepLabels[step]}</h3>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "#fff7ed", color: "#92400e", border: "1px solid #fde68a" }}>模拟数据 · 仅演示</span>
        </div>

        {step === 0 && scene === "新设独资" && <NewSetupCase c={c} editable={editable} onEdit={setEditable} onCommit={onCommit} />}
        {step === 0 && scene === "并购"     && <AcquisitionCase c={c} editable={editable} onEdit={setEditable} onCommit={onCommit} />}
        {step === 0 && scene === "增资变更" && <ChangeCase c={c} editable={editable} onEdit={setEditable} onCommit={onCommit} />}

        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "出资方式", value: "现汇出资", key: "method", readonly: false },
              { label: "境外汇款金额（美元）", value: c.investAmount, key: "investAmount", readonly: false, highlight: true },
              { label: "对应人民币（系统计算）", value: "≈ RMB 3,608万（参考汇率 7.216）", key: "rmb", readonly: true },
              { label: "注册资本", value: c.regCapital, key: "regCapital", readonly: false, highlight: true },
              { label: "资金来源说明", value: c.fundSource, key: "fundSource", readonly: false },
              { label: "预计汇款期限", value: "批准后6个月内", key: "deadline", readonly: true, sysLabel: "根据场景默认" },
            ].map(f => (
              <div key={f.key} style={{ borderRadius: 10, border: `1px solid ${(f as any).highlight ? "#fde68a" : "#e8edf5"}`, background: f.readonly ? "#f8fafc" : (f as any).highlight ? "#fffbeb" : "#fff", padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{f.label}</span>
                  {f.readonly && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#f1f5f9", color: "#64748b" }}>{(f as any).sysLabel ?? "系统计算"}</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: f.readonly ? "#9ca3af" : (f as any).highlight ? "#92400e" : "#1f2937" }}>{f.value}</div>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "项目背景", value: "为拓展东南亚市场，提升本地化服务能力，在新加坡设立全资子公司，承接软件定制开发和系统集成业务。", key: "bg" },
              { label: "主营业务", value: "企业数字化转型咨询、软件定制开发、系统集成", key: "biz" },
              { label: "预计运营年限", value: "长期（永续经营）", key: "years", readonly: true, sysLabel: "根据场景默认" },
              { label: "投资期限", value: "自批准之日起20年", key: "period", readonly: true, sysLabel: "根据场景默认" },
              { label: "预期效益说明", value: "预计3年内实现盈亏平衡，税后年利润约USD 80万，年均汇回利润比例不低于60%。", key: "benefit" },
            ].map(f => (
              <div key={f.key} style={{ borderRadius: 10, border: "1px solid #e8edf5", background: (f as any).readonly ? "#f8fafc" : "#fff", padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{f.label}</span>
                  {(f as any).readonly && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#f1f5f9", color: "#64748b" }}>{(f as any).sysLabel}</span>}
                </div>
                <div style={{ fontSize: 13, color: (f as any).readonly ? "#9ca3af" : "#1f2937", lineHeight: 1.6 }}>{f.value}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
          <button disabled={step === 0} onClick={() => setStep(s => s - 1)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #e5eaf2", background: step === 0 ? "#f8fafc" : "#fff", fontSize: 13, color: step === 0 ? "#9ca3af" : "#374151", cursor: step === 0 ? "default" : "pointer" }}>上一步</button>
          <button disabled={step === 2} onClick={() => setStep(s => s + 1)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: step === 2 ? "#f1f5f9" : "#d97706", fontSize: 13, fontWeight: 600, color: step === 2 ? "#9ca3af" : "#fff", cursor: step === 2 ? "default" : "pointer" }}>下一步</button>
        </div>
      </div>
    </div>
  );
}

// ── 案例数据 → 字段池(供校验引擎跑「模拟校验」)──────────────
// P1:overrides = 用户在案例字段上的编辑(按 CASE_DATA 键),合并后建池;编辑实时反映到校验。
function caseToPool(scene: Scene, overrides: Record<string, string> = {}): OdiField[] {
  const c: CaseData = { ...CASE_DATA[scene], ...overrides };
  const method: string = scene === "并购" ? "并购" : scene === "增资变更" ? "增资" : "新设";
  let pool = allFieldDefs().map(d => emptyField(d.code, d.name, d.round, d.dept));
  const set = (code: string, value?: string) => { if (value && value.trim()) pool = commitField(pool, code, value, "guide"); };
  set("investment_country", c.country);
  set("investment_method", method);
  set("establishment_method", scene);
  set("overseas_registered_capital", c.regCapital);
  set("investment_total", c.investAmount);
  set("domestic_company_name", c.investorCN);
  set("overseas_company_cn", c.targetCN);
  set("industry", c.industry);
  set("direct_destination", c.country);
  set("final_destination", c.country);
  const eqRaw = c.equity.replace(/%/g, "").replace(/→.*/, "").trim(); // "60%→75%" 取变更前
  const eqNum = parseFloat(eqRaw);
  set("chinese_ratio", eqRaw);
  if (!Number.isNaN(eqNum)) set("foreign_ratio", String(100 - eqNum));
  // 中方/外方投资额(按股比拆分投资总额,仅用于金额校验演示)
  const totalNum = parseFloat((c.investAmount.replace(/,/g, "").match(/-?\d+(\.\d+)?/) || [""])[0]);
  if (!Number.isNaN(eqNum) && !Number.isNaN(totalNum)) {
    set("chinese_investment_amount", String(Math.round(totalNum * eqNum / 100)));
    set("foreign_investment_amount", String(Math.round(totalNum * (100 - eqNum) / 100)));
  }
  return pool;
}

// 校验五态 → 展示样式
const CHECK_DISPLAY: Record<"ok" | "adjust" | "missing" | "skip" | "blocked", { label: string; color: string; bg: string; border: string }> = {
  ok:       { label: "通过",     color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  adjust:   { label: "不通过",   color: "#d97706", bg: "#fff7ed", border: "#fde68a" },
  missing:  { label: "缺失",     color: "#b45309", bg: "#fff7ed", border: "#fed7aa" },
  skip:     { label: "未触发",   color: "#64748b", bg: "#f8fafc", border: "#e8edf5" },
  blocked:  { label: "口径待定", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
};
function checkDisplay(status: string) {
  return status === "通过" ? CHECK_DISPLAY.ok : status === "不通过" ? CHECK_DISPLAY.adjust : status === "未触发" ? CHECK_DISPLAY.skip : status === "blocked" ? CHECK_DISPLAY.blocked : CHECK_DISPLAY.missing;
}

function VerifyTab({ result }: { result: ValidationResult }) {
  const checks = result.checks;
  const counts = {
    ok: checks.filter(c => c.status === "通过").length,
    adjust: checks.filter(c => c.status === "不通过").length,
    missing: checks.filter(c => c.status === "缺失").length,
    skip: checks.filter(c => c.status === "未触发").length,
    blocked: checks.filter(c => c.status === "blocked").length,
  };

  return (
    <div style={{ padding: "28px 32px" }}>
      <div style={{ background: "#fff7ed", border: "1.5px solid #fde68a", borderRadius: 12, padding: "12px 18px", marginBottom: 24, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>💡</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 2 }}>模拟校验说明</div>
          <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
            以下结果由校验引擎基于当前案例字段实时计算(通过/不通过/缺失/未触发),仅用于理解 ODI 填报逻辑,不等于正式审核结论。「未触发」表示规则条件不满足(如缺对应输入),不算问题。模拟问题不会阻断材料生成。
          </div>
        </div>
      </div>

      {result.hints.length > 0 && (
        <div style={{ background: "#f8fafc", border: "1px solid #e8edf5", borderRadius: 12, padding: "12px 18px", marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>风险提示 · 仅提示人工确认，不影响校验结论</div>
          {result.hints.map(h => (
            <div key={h.id} style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>⚠ {h.text}</div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {([
          { key: "ok",      label: "通过",   color: "#15803d", bg: "#f0fdf4" },
          { key: "adjust",  label: "不通过", color: "#d97706", bg: "#fff7ed" },
          { key: "missing", label: "缺失",   color: "#b45309", bg: "#fff7ed" },
          { key: "skip",    label: "未触发", color: "#64748b", bg: "#f8fafc" },
          { key: "blocked", label: "口径待定", color: "#7c3aed", bg: "#f5f3ff" },
        ] as const).map(s => (
          <div key={s.key} style={{ padding: "10px 18px", borderRadius: 10, background: s.bg, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{counts[s.key]}</span>
            <span style={{ fontSize: 12, color: s.color }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {checks.map(c => {
          const cfg = checkDisplay(c.status);
          return (
            <div key={c.id} style={{ background: "#fff", borderRadius: 12, border: `1px solid ${c.status === "通过" ? "#e8edf5" : cfg.border}`, padding: "14px 18px", opacity: c.status === "未触发" ? 0.75 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", background: "#f1f5f9", padding: "2px 7px", borderRadius: 5, flexShrink: 0 }}>{c.domain}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", flex: 1 }}>{c.field}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
              </div>
              {c.evidence && c.status !== "通过" && (
                <div style={{ marginTop: 8, fontSize: 11.5, color: "#64748b" }}>当前:{c.evidence}</div>
              )}
              {c.suggestion && c.status !== "未触发" && (
                <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 8, background: "#fff7ed", fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
                  💡 {c.suggestion}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Result docs ───────────────────────────────────────────
const RESULT_DOCS = [
  { name: "对外投资备案申请表（模拟参考稿）", pages: 4, dept: "商务委" },
  { name: "可行性研究报告提纲（模拟参考稿）", pages: 12, dept: "发改委" },
  { name: "境外投资协议要点清单（模拟参考稿）", pages: 3, dept: "通用" },
];

function ResultTab({ project }: { project: DemoProject }) {
  return (
    <div style={{ padding: "28px 32px" }}>
      <div style={{ background: "#f0f9ff", border: "1.5px solid #bae6fd", borderRadius: 12, padding: "12px 18px", marginBottom: 24, display: "flex", gap: 10 }}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>📄</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0c4a6e", marginBottom: 2 }}>模拟材料参考稿</div>
          <div style={{ fontSize: 12, color: "#0369a1", lineHeight: 1.6 }}>
            仅用于了解材料结构和填报方式，不可直接作为正式申报材料提交。所有文件均附有「模拟演示」水印。
          </div>
        </div>
      </div>

      {project.generatedCount === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "#64748b" }}>尚未生成模拟参考稿</p>
          <p style={{ margin: 0, fontSize: 13 }}>完成前三步骤后，系统将自动生成模拟材料参考稿。</p>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 14 }}>已生成参考稿（{RESULT_DOCS.length} 份）</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {RESULT_DOCS.map((doc, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 44, height: 52, background: "#f8fafc", border: "1px solid #e8edf5", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span style={{ fontSize: 7, fontWeight: 800, color: "#fbbf24", marginTop: 2 }}>模拟</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>{doc.name}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{doc.pages} 页</span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>·</span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{doc.dept}</span>
                    <span style={{ fontSize: 11, padding: "0 6px", borderRadius: 4, background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>含模拟水印</span>
                  </div>
                </div>
                <button style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #e5eaf2", background: "#f8fafc", fontSize: 12, color: "#374151", cursor: "pointer", flexShrink: 0 }}>预览</button>
              </div>
            ))}
          </div>

          {/* Upgrade CTA */}
          <div style={{ marginTop: 24, background: "linear-gradient(135deg,#eff6ff 0%,#fff7ed 100%)", border: "1.5px solid #bfdbfe", borderRadius: 14, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e40af", marginBottom: 4 }}>已完成模拟体验</div>
              <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>可基于本次模拟体验发起正式申报助办任务，系统将引用模拟数据作为初始值。<br/>
              <span style={{ color: "#9ca3af" }}>模拟填报和申报助办的数据相互独立，模拟内容不会进入正式项目。</span></div>
            </div>
            <button style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: "#1a5bc6", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>发起正式申报</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────
function OverviewTab({ project, checkCount, onChangeTab }: { project: DemoProject; checkCount: number; onChangeTab: (t: Tab) => void }) {
  const completedSteps = project.stepStatuses.filter(s => s === "completed").length;
  const c = CASE_DATA[project.scene as Scene] ?? CASE_DATA["新设独资"];

  // Scene-specific investment diagram
  const SceneDiagram = () => {
    if (project.scene === "新设独资" || project.scene === "新设") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "14px 20px" }}>
          <div style={{ padding: "10px 14px", borderRadius: 9, background: "#eff6ff", border: "1.5px solid #bfdbfe", textAlign: "center", minWidth: 120 }}>
            <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>境内投资主体</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af" }}>{c.investorCN}</div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ height: 2, background: "#1a5bc6", margin: "0 4px" }} />
            <div style={{ fontSize: 11, color: "#1a5bc6", fontWeight: 700, marginTop: 4 }}>100% 股权</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>{c.investAmount}</div>
          </div>
          <div style={{ padding: "10px 14px", borderRadius: 9, background: "#fff7ed", border: "1.5px solid #fde68a", textAlign: "center", minWidth: 120 }}>
            <div style={{ fontSize: 10, color: "#92400e", marginBottom: 2 }}>境外新设子公司</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>{c.targetCN}</div>
          </div>
        </div>
      );
    }
    if (project.scene === "并购") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px" }}>
          <div style={{ flex: 1, padding: "10px", borderRadius: 9, background: "#f8fafc", border: "1px solid #e8edf5", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>并购前</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>{c.investorCN.slice(0, 6)}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#9ca3af" }}>0%</div>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 20, color: "#d97706", fontWeight: 700 }}>→</div>
            <div style={{ fontSize: 11, color: "#d97706", fontWeight: 700 }}>收购</div>
          </div>
          <div style={{ flex: 1, padding: "10px", borderRadius: 9, background: "#fff7ed", border: "1.5px solid #fde68a", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#92400e" }}>并购后</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>{c.investorCN.slice(0, 6)}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#d97706" }}>{c.equity}</div>
          </div>
        </div>
      );
    }
    // 增资变更
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, padding: "14px 20px", alignItems: "center" }}>
        <div style={{ padding: "10px 14px", borderRadius: 9, background: "#f8fafc", border: "1px solid #e8edf5" }}>
          <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700, marginBottom: 4 }}>变更前</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>注册资本 <strong>USD 3,500,000</strong></div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>中方股比 <strong>60%</strong></div>
        </div>
        <div style={{ textAlign: "center", fontSize: 20, color: "#d97706", fontWeight: 700 }}>→</div>
        <div style={{ padding: "10px 14px", borderRadius: 9, background: "#fff7ed", border: "1.5px solid #fde68a" }}>
          <div style={{ fontSize: 10, color: "#92400e", fontWeight: 700, marginBottom: 4 }}>变更后</div>
          <div style={{ fontSize: 11, color: "#92400e" }}>注册资本 <strong>USD 6,000,000</strong></div>
          <div style={{ fontSize: 11, color: "#92400e" }}>中方股比 <strong>75%</strong></div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Disclaimer */}
      <div style={{ background: "#fff7ed", border: "1.5px solid #fde68a", borderRadius: 10, padding: "10px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>📋</span>
        <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
          本案例使用模拟数据演示ODI信息填写与材料结构。企业名称、金额和项目内容均为演示用途，不构成任何法律或合规建议。
        </div>
      </div>

      {/* Case summary with investment diagram */}
      <div style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12 }}>
            {project.scene} · 案例概要
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { label: "境内投资主体", value: c.investorCN },
              { label: "境外企业", value: c.targetCN },
              { label: "投资国家/地区", value: c.country },
              { label: "所属行业", value: c.industry.slice(0, 16) },
              { label: "投资总额", value: c.investAmount },
              { label: "中方持股比例", value: c.equity },
            ].map(f => (
              <div key={f.label} style={{ padding: "9px 12px", background: "#f8fafc", borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Investment relationship diagram */}
        <div style={{ background: "#fafbfe" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", padding: "10px 20px 0", letterSpacing: 0.5 }}>
            {project.scene === "增资变更" ? "变更前后对比" : "投资路径"}
          </div>
          <SceneDiagram />
        </div>
      </div>

      {/* Progress */}
      <div style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 14, padding: "18px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>体验进度</div>
          <span style={{ fontSize: 12, color: "#d97706", fontWeight: 700 }}>{completedSteps}/{project.stepStatuses.length} 步骤已完成</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
          {STEP_LABELS.map((label, i) => {
            const s = project.stepStatuses[i] ?? "pending";
            const dot = s === "completed" ? "#d97706" : s === "active" ? "#f59e0b" : "#d1d5db";
            const lbl = s !== "pending" ? "#92400e" : "#9ca3af";
            const connColor = project.stepStatuses[i + 1] !== "pending" ? "#fde68a" : "#f1f5f9";
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                {i < STEP_LABELS.length - 1 && <div style={{ position: "absolute", top: 10, left: "50%", right: "-50%", height: 2, background: connColor, zIndex: 0 }} />}
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: dot, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, fontSize: 9, fontWeight: 700, color: "#fff" }}>
                  {s === "completed" ? "✓" : s === "active" ? "●" : ""}
                </div>
                <span style={{ marginTop: 7, fontSize: 11, fontWeight: s !== "pending" ? 700 : 400, color: lbl, textAlign: "center" }}>{label}</span>
                <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{s === "completed" ? "已完成" : s === "active" ? "进行中" : "待完成"}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { label: "体验提示", value: project.warningCount, color: "#d97706", sub: "仅供参考" },
          { label: "模拟校验项", value: checkCount, color: "#374151", sub: "引擎实时计算" },
          { label: "已生成参考稿", value: project.generatedCount, color: "#1a5bc6", sub: "含水印·仅演示" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#d1d5db", marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Recommended next step */}
      <div style={{ background: "#fff", border: "1.5px solid #fde68a", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#92400e", fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>推荐下一步</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
            {completedSteps < 3 ? "继续体验模拟填报" : "查看模拟材料结果"}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
            {completedSteps < 3 ? "了解ODI各字段的关联逻辑和校验规则" : "查看系统生成的模拟材料参考稿"}
          </div>
        </div>
        <button onClick={() => onChangeTab(completedSteps < 3 ? "form" : "result")}
          style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#d97706", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
          {completedSteps < 3 ? "继续体验" : "查看结果"}
        </button>
      </div>

      {/* Expected docs */}
      <div style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 12, padding: "14px 18px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>预计生成参考材料</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {c.estimatedDocs.map(d => (
            <span key={d} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 7, background: "#eff6ff", color: "#1a5bc6", border: "1px solid #bfdbfe" }}>{d}</span>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: "#9ca3af" }}>所有生成材料均附有"模拟参考稿"标记，不可直接用于正式申报</div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
interface Props { project: DemoProject; onBack: () => void; }

export function OdiDemoDetailPage({ project, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  // P1:案例字段编辑(overrides)回写字段池,经 联动/派生 后供校验实时计算
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const verifyResult = useMemo(() => {
    const pool = applyLinkage(computeDerived(caseToPool(project.scene as Scene, overrides)));
    return validateOdiFull(pool); // P2:商务线 + 发改委首批(演示池无材料值,NDRC 规则未触发,不产生噪音)
  }, [project.scene, overrides]);
  const evaluatedCount = verifyResult.checks.filter(c => c.status !== "未触发").length;
  const handleCommit = (key: string, value: string) => {
    setOverrides(prev => (prev[key] === value ? prev : { ...prev, [key]: value }));
  };
  const tabBarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const underlineFlip = useRef<ReturnType<typeof Flip.getState> | null>(null);

  function changeTab(tab: Tab) {
    if (tab === activeTab) return;
    const underlineEl = tabBarRef.current?.querySelector("[data-tab-underline]");
    if (underlineEl) underlineFlip.current = Flip.getState(underlineEl);
    setActiveTab(tab);
  }

  useGSAP(() => {
    const reduced = prefersReducedMotion();
    const underlineEl = tabBarRef.current?.querySelector("[data-tab-underline]");
    if (underlineEl && underlineFlip.current) {
      Flip.from(underlineFlip.current, { targets: underlineEl, duration: reduced ? 0 : DUR.layout, ease: EASE.layout, overwrite: "auto" });
      underlineFlip.current = null;
    }
    if (contentRef.current) {
      gsap.fromTo(contentRef.current, { autoAlpha: 0, y: reduced ? 0 : SHIFT.card }, { autoAlpha: 1, y: 0, duration: DUR.enter, ease: EASE.enter, overwrite: "auto" });
    }
  }, { dependencies: [activeTab], scope: tabBarRef });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f5f7fb", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, background: "#fff", borderBottom: "1px solid #e8edf5", padding: "14px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid #e5eaf2", cursor: "pointer", borderRadius: 7, padding: "5px 12px", fontSize: 12, color: "#64748b" }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 3l-5 5 5 5" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            返回列表
          </button>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, color: "#92400e", background: "#fff7ed", border: "1px solid #fde68a" }}>模拟</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>{project.scene} · {project.mode}</span>
          </div>
        </div>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#111827" }}>{project.name}</h2>
        <div style={{ fontSize: 12, color: "#9ca3af" }}>最近更新：{project.updatedAt}</div>
      </div>

      {/* Tab bar */}
      <div ref={tabBarRef} style={{ flexShrink: 0, background: "#fff", borderBottom: "1px solid #e8edf5", display: "flex", padding: "0 28px", position: "relative" }}>
        {TABS.map(t => {
          const isActive = t.key === activeTab;
          return (
            <button key={t.key} onClick={() => changeTab(t.key)} style={{ padding: "12px 20px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: isActive ? 700 : 400, color: isActive ? "#d97706" : "#64748b", position: "relative", transition: "color 0.15s" }}>
              {t.label}
              {isActive && <span data-tab-underline style={{ position: "absolute", bottom: 0, left: 12, right: 12, height: 2, background: "#d97706", borderRadius: 2 }} />}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div ref={contentRef} style={{ flex: 1, overflowY: "auto" }}>
        {activeTab === "overview" && <OverviewTab project={project} checkCount={evaluatedCount} onChangeTab={changeTab} />}
        {activeTab === "form"     && <FormTab scene={project.scene as Scene} overrides={overrides} onCommit={handleCommit} />}
        {activeTab === "verify"   && <VerifyTab result={verifyResult} />}
        {activeTab === "result"   && <ResultTab project={project} />}
      </div>
    </div>
  );
}
