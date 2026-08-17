// 合规自查列表页 —— 统计摘要 + 卡片网格 + GSAP 入场。筛选由侧栏驱动。

import { useRef, useState } from "react";
import { C, GRADE_COLOR } from "../complianceTheme";
import { gsap, useGSAP, DUR, EASE, SHIFT, STAGGER, prefersReducedMotion } from "../../motion/tokens";
import { COMPLIANCE_STATUS_CONFIG, BRANCH_LABEL, type ComplianceProject } from "../data/complianceProjects";
import { ComplianceItemMenu, RenameModal, DeleteConfirmModal } from "./ComplianceItemMenu";

interface Props {
  projects: ComplianceProject[];
  totalCount: number;
  activeCount: number;
  doneCount: number;
  currentView: string;
  onEnter: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
}

export function ComplianceListPage({ projects, totalCount, activeCount, doneCount, currentView, onEnter, onNew, onDelete, onRename, onDuplicate }: Props) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const renameTarget = projects.find(p => p.id === renameId);
  const deleteTarget = projects.find(p => p.id === deleteId);

  const total = projects.length;

  useGSAP(() => {
    const reduced = prefersReducedMotion();
    const cards = scopeRef.current?.querySelectorAll("[data-anim='compliance-card']");
    if (cards?.length) {
      gsap.from(cards, { autoAlpha: 0, y: reduced ? 0 : SHIFT.card, duration: reduced ? DUR.fadeIn : DUR.enter, ease: EASE.enter, stagger: reduced ? 0 : STAGGER.card, overwrite: "auto" });
    }
  }, { dependencies: [projects.length], scope: scopeRef });

  return (
    <>
    <div ref={scopeRef} style={{ overflowY: "auto", height: "100%", background: C.page }}>
      <div style={{ padding: "32px 44px", maxWidth: 1140, margin: "0 auto", boxSizing: "border-box", width: "100%" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: C.ink }}>企业境外投资合规自查</h1>
            <p style={{ margin: 0, fontSize: 14, color: C.sub }}>申报前的合规风险自查：六大要素双分制（自查档位 A–D + 文件齐备度），输出可随申报材料一并提交的自查报告。</p>
          </div>
          <button onClick={onNew} style={primaryBtnStyle}>+ 新建合规自查</button>
        </div>

        {/* 统计摘要（单行，不重复侧栏分类） */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, fontSize: 13, color: C.sub }}>
          <span>共 <b style={{ color: C.ink }}>{totalCount}</b> 个自查任务</span>
          <span style={{ color: C.line }}>|</span>
          <span>进行中 <b style={{ color: C.warn }}>{activeCount}</b></span>
          <span style={{ color: C.line }}>|</span>
          <span>已完成 <b style={{ color: C.ok }}>{doneCount}</b></span>
          {currentView !== "all" && <span style={{ marginLeft: 8, fontSize: 12, color: C.primary, background: C.primaryBg, borderRadius: 6, padding: "2px 9px", fontWeight: 600 }}>{currentView === "active" ? "仅看进行中" : "仅看已完成"}</span>}
        </div>

        {/* Grid */}
        {projects.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 16 }}>
            {projects.map(p => <ComplianceCard key={p.id} project={p} onEnter={() => onEnter(p.id)} onRename={() => setRenameId(p.id)} onDuplicate={() => onDuplicate(p.id)} onDelete={() => setDeleteId(p.id)} />)}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "72px 0", color: C.muted }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: C.lineSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24 }}>✓</div>
            <p style={{ margin: "0 0 6px", fontSize: 15, color: C.sub, fontWeight: 600 }}>还没有合规自查任务</p>
            <p style={{ margin: "0 0 20px", fontSize: 13, lineHeight: 1.6 }}>创建一个自查任务，对照六大要素评估您本次境外投资的合规就绪度。</p>
            <button onClick={onNew} style={primaryBtnStyle}>+ 新建合规自查</button>
          </div>
        )}

        <div style={{ marginTop: 24, fontSize: 11.5, color: C.muted, background: "#fff", borderRadius: 10, border: `1px solid ${C.line}`, padding: "12px 16px", lineHeight: 1.7 }}>
          本自查为自愿性辅导工具，不是申报条件，任何档位均可依法申报。文件齐备度分数仅反映材料齐备程度，不代表合规结论；上传文件仅用于本次自查计分与报告生成。
        </div>
      </div>
    </div>
      {renameTarget && <RenameModal initialName={renameTarget.name} onConfirm={name => { onRename(renameTarget.id, name); setRenameId(null); }} onCancel={() => setRenameId(null)} />}
      {deleteTarget && <DeleteConfirmModal projectName={deleteTarget.name} onConfirm={() => { onDelete(deleteTarget.id); setDeleteId(null); }} onCancel={() => setDeleteId(null)} />}
    </>
  );
}

function ComplianceCard({ project, onEnter, onRename, onDuplicate, onDelete }: { project: ComplianceProject; onEnter: () => void; onRename: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const cfg = COMPLIANCE_STATUS_CONFIG[project.status];
  const isDone = project.status === "已完成";
  return (
    <div data-anim="compliance-card"
      style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.line}`, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", transition: "box-shadow 0.2s, transform 0.2s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(26,91,198,0.10)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, color: C.primary, background: C.primaryBg, border: `1px solid ${C.primaryBorder}` }}>合规自查</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 7, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{project.status}</span>
        {project.investBranch && <span style={{ fontSize: 11, color: C.sub, background: C.lineSoft, padding: "2px 8px", borderRadius: 7 }}>{BRANCH_LABEL[project.investBranch]}</span>}
      </div>

      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.ink, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</h3>

      {isDone ? (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <Stat label="自查档位" value={project.grade ?? "—"} color={GRADE_COLOR[project.grade ?? ""]} />
          <Stat label="核心齐备度" value={project.coreCompleteness != null ? `${project.coreCompleteness} 分` : "—"} color={C.primary} />
          <Stat label="已生成报告" value={`${project.generatedReports.length} 类`} color={C.ok} />
        </div>
      ) : (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <Stat label="当前进度" value={`${project.snapshot?.curStep ?? 0} / 6 步`} color={C.warn} />
          <Stat label="投资方式" value={project.investBranch ? BRANCH_LABEL[project.investBranch] : "未选定"} color={C.sub} />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid ${C.lineSoft}` }}>
        <span style={{ fontSize: 12, color: C.muted }}>最近更新：{project.updatedAt}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ComplianceItemMenu onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />
          <button onClick={onEnter} style={{ padding: "7px 20px", borderRadius: 8, border: "none", background: C.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{isDone ? "查看报告" : "继续自查"}</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color = C.ink }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 7, padding: "9px 22px", borderRadius: 10, border: "none", background: C.primary, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(26,91,198,0.25)", flexShrink: 0,
};
