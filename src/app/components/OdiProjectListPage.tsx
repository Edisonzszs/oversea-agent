import { useRef, useState } from "react";
import {
  PROJECT_STATUS_CONFIG,
  type OdiProject, type AssistProject,
} from "./odiProjectData";
import { gsap, useGSAP, DUR, EASE, SHIFT, STAGGER, prefersReducedMotion } from "../motion/tokens";

interface Props {
  projects: OdiProject[];
  onEnterProject: (id: string) => void;
  onNewProject?: () => void;
  onRename?: (id: string) => void;
  onDelete?: (id: string) => void;
}

type Filter = "all" | "assist" | "active" | "done";

// ── TypeTag ───────────────────────────────────────────────────────────────────
function TypeTag({ type }: { type: "demo" | "assist" }) {
  const isDemo = type === "demo";
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
      color: isDemo ? "#92400e" : "#1e40af",
      background: isDemo ? "#fff7ed" : "#eff6ff",
      border: `1px solid ${isDemo ? "#fde68a" : "#bfdbfe"}`,
    }}>{isDemo ? "模拟" : "助办"}</span>
  );
}

// ── Assist card ───────────────────────────────────────────────────────────────
function AssistCard({ project, onEnter, onRename, onDelete }: { project: AssistProject; onEnter: () => void; onRename?: () => void; onDelete?: () => void }) {
  const cfg = PROJECT_STATUS_CONFIG[project.status];
  const [menuOpen, setMenuOpen] = useState(false);
  const issueCount = project.mismatchCount + project.missingCount;

  return (
    <div
      data-anim="project-card"
      style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edf5", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", transition: "box-shadow 0.2s, transform 0.2s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(26,91,198,0.10)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 7, flexWrap: "wrap", alignItems: "center" }}>
            <TypeTag type="assist" />
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 7, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{project.status}</span>
            {project.investmentType && (
              <span style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", padding: "2px 8px", borderRadius: 7 }}>{project.investmentType}</span>
            )}
          </div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</h3>
        </div>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }} style={{ background: "none", border: "1px solid #e5eaf2", cursor: "pointer", borderRadius: 7, padding: "4px 10px", fontSize: 14, color: "#64748b" }}>···</button>
          {menuOpen && (
            <div style={{ position: "absolute", right: 0, top: "110%", zIndex: 200, background: "#fff", border: "1px solid #e5eaf2", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", minWidth: 120, overflow: "hidden" }} onMouseLeave={() => setMenuOpen(false)}>
              {[{ label: "重命名", color: "#1f2937", run: onRename }, { label: "删除", color: "#dc2626", run: onDelete }].filter(m => m.run).map(m => (
                <button key={m.label} onClick={e => { e.stopPropagation(); setMenuOpen(false); m.run?.(); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: m.color }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >{m.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <StatCell label="已上传材料" value={`${project.uploadedCount} 份`} />
        {project.mismatchCount > 0 && <StatCell label="不通过" value={`${project.mismatchCount} 项`} color="#dc2626" />}
        {project.missingCount > 0 && <StatCell label="缺失" value={`${project.missingCount} 项`} color="#d97706" />}
        {project.passedCount > 0 && <StatCell label="通过" value={`${project.passedCount} 项`} color="#16a34a" />}
        {project.generatedCount > 0 && <StatCell label="可生成" value={`${project.generatedCount} 份`} color="#1a5bc6" />}
      </div>

      {/* Issue alert */}
      {issueCount > 0 && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#92400e" }}>
          共 {issueCount} 个问题待处理（{project.mismatchCount} 项不通过，{project.missingCount} 项缺失）
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>最近更新：{project.updatedAt}</span>
        <button onClick={onEnter}
          style={{ padding: "7px 20px", borderRadius: 8, border: "none", background: "#1a5bc6", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >进入项目</button>
      </div>
    </div>
  );
}

// ── (DemoCard 已删除:填报演示整体下线,见 2026-08-21 需求) ─────────────────────

function StatCell({ label, value, color = "#374151" }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function OdiProjectListPage({ projects, onEnterProject, onNewProject, onRename, onDelete }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const scopeRef = useRef<HTMLDivElement>(null);

  const totalCount = projects.length;
  const activeCount = projects.filter(p => p.status !== "已完成").length;
  const pendingCount = projects.filter(p => p.serviceType === "assist" && ((p as AssistProject).mismatchCount + (p as AssistProject).missingCount) > 0).length;
  const doneCount = projects.filter(p => p.status === "已完成").length;

  const visible = projects.filter(p => {
    const matchSearch = !search || p.name.includes(search);
    const matchFilter =
      filter === "all" ||
      (filter === "assist" && p.serviceType === "assist") ||
      (filter === "active" && p.status !== "已完成") ||
      (filter === "done" && p.status === "已完成");
    return matchSearch && matchFilter;
  });

  useGSAP(() => {
    const reduced = prefersReducedMotion();
    const cards = scopeRef.current?.querySelectorAll("[data-anim='project-card']");
    if (cards?.length) {
      gsap.from(cards, { autoAlpha: 0, y: reduced ? 0 : SHIFT.card, duration: reduced ? DUR.fadeIn : DUR.enter, ease: EASE.enter, stagger: reduced ? 0 : STAGGER.card, overwrite: "auto" });
    }
  }, { dependencies: [filter, search], scope: scopeRef });

  const FILTER_OPTIONS: { key: Filter; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "assist", label: "申报助办" },
    { key: "active", label: "进行中" },
    { key: "done", label: "已完成" },
  ];

  return (
    <div ref={scopeRef} style={{ overflowY: "auto", height: "100%", background: "#f5f7fb" }}>
      <div style={{ padding: "32px 44px", maxWidth: 1140, margin: "0 auto", boxSizing: "border-box", width: "100%" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "#111827" }}>ODI备案助手</h1>
            <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>集中管理ODI申报助办任务，查看进度、校验结果和材料产物。</p>
          </div>
          <button
            onClick={onNewProject}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 22px", borderRadius: 10, border: "none", background: "#1a5bc6", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(26,91,198,0.25)", flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = "#1549a8")}
            onMouseLeave={e => (e.currentTarget.style.background = "#1a5bc6")}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
            新建ODI任务
          </button>
        </div>

        {/* Stats — 4 cards per PRD §9.3（填报演示已删除，全部为申报助办口径） */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "全部任务", value: totalCount, sub: "申报助办", color: "#374151" },
            { label: "进行中", value: activeCount, sub: "未完成项目", color: "#1a5bc6" },
            { label: "待处理", value: pendingCount, sub: "待处理问题", color: "#dc2626" },
            { label: "已完成", value: doneCount, sub: "校验完成", color: "#16a34a" },
          ].map(s => (
            <div key={s.label} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8edf5", padding: "16px 20px" }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#d1d5db", marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* (待处理事项/最近活动两栏已删除:原为写死演示记录,用户要求删除所有记录) */}

        {/* Filter + search */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>全部任务</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3, gap: 2 }}>
              {FILTER_OPTIONS.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: filter === f.key ? "#fff" : "transparent", color: filter === f.key ? "#1a5bc6" : "#64748b", fontWeight: filter === f.key ? 600 : 400, fontSize: 12, cursor: "pointer", boxShadow: filter === f.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>{f.label}</button>
              ))}
            </div>
            <div style={{ position: "relative" }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <circle cx="7" cy="7" r="5" stroke="#94a3b8" strokeWidth="1.5"/><path d="M11 11l2.5 2.5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索任务、国家、场景" style={{ height: 34, paddingLeft: 28, paddingRight: 10, borderRadius: 9, border: "1px solid #e5eaf2", background: "#f8fafc", fontSize: 13, color: "#1f2937", outline: "none", width: 200, boxSizing: "border-box" }} />
            </div>
          </div>
        </div>

        {/* Task grid（填报演示已删除:仅申报助办卡片） */}
        {visible.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 16 }}>
            {visible.map(p =>
              <AssistCard key={p.id} project={p as AssistProject} onEnter={() => onEnterProject(p.id)} onRename={onRename ? () => onRename(p.id) : undefined} onDelete={onDelete ? () => onDelete(p.id) : undefined} />
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "72px 0", color: "#9ca3af" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg>
            </div>
            <p style={{ margin: "0 0 6px", fontSize: 15, color: "#64748b", fontWeight: 600 }}>还没有ODI任务</p>
            <p style={{ margin: "0 0 20px", fontSize: 13, lineHeight: 1.6 }}>创建申报助办任务，上传项目材料即可开始自动识别与合规校验。</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={onNewProject} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "#1a5bc6", fontSize: 13, color: "#fff", fontWeight: 600, cursor: "pointer" }}>创建申报助办任务</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
