// 合规自查侧边栏 —— 沿用首页（ConversationSidebar）视觉风格：
// 顶部工具栏（返回 + 标题 + 搜索开关 + 折叠）、描边「新建合规自查」、
// 可折叠「任务分类 / 最近自查」分区、底部企业身份卡。
// 逻辑（视图切换 / 搜索 / 选中 / 计数）与旧版一致，仅改外观。

import { useRef, useState, useEffect } from "react";
import { gsap, useGSAP, DUR, EASE } from "../../motion/tokens";
import { COMPLIANCE_STATUS_CONFIG, BRANCH_LABEL, type ComplianceProject } from "../data/complianceProjects";
import { SearchCommandModal, type CmdItem, PlusGlyph, DocGlyph } from "../../components/SearchCommandModal";
import { ComplianceItemMenu, RenameModal, DeleteConfirmModal } from "./ComplianceItemMenu";

const CSS_EASE = { inOut: "cubic-bezier(0.76,0,0.24,1)" };
const REDUCED = "(prefers-reduced-motion: reduce)";

export type ComplianceView = "all" | "active" | "done";

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  projects: ComplianceProject[];
  activeProjectId: string | null;
  activeView: ComplianceView;
  onSelectView: (v: ComplianceView) => void;
  onSelectProject: (id: string) => void;
  onNew: () => void;
  onBackToXiaohai: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  user?: { userName: string; userType: string; certStatus: string } | null;
  onLogin?: () => void;
}

function CollapseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" stroke="#64748b" strokeWidth="1.5" />
      <path d="M7.5 3.5v13" stroke="#64748b" strokeWidth="1.5" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
      <path d="M12 5l-5 5 5 5" stroke="#64748b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchGlyph({ size = 13, color = "#94a3b8" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="5" stroke={color} strokeWidth="1.5" />
      <path d="M11 11l2.5 2.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ transition: "transform 0.15s", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>
      <path d="M4 6l4 4 4-4" stroke="#94a3b8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavItem({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 10px", borderRadius: 8, border: "none", background: active ? "#eff6ff" : hovered ? "#f5f7fa" : "transparent", cursor: "pointer", fontSize: 13, color: active ? "#1a5bc6" : "#374151", fontWeight: active ? 600 : 400, textAlign: "left", transition: "background 0.15s", marginBottom: 1 }}>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontSize: 11, color: active ? "#1a5bc6" : "#94a3b8" }}>{count}</span>
    </button>
  );
}

function SectionHeader({ title, open, onToggle, count }: { title: string; open: boolean; onToggle: () => void; count?: number }) {
  return (
    <button onClick={onToggle}
      style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "10px 12px 4px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.8, textTransform: "uppercase", textAlign: "left" }}>
      <Chevron open={open} />
      <span style={{ flex: 1 }}>{title}</span>
      {count != null && <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>{count}</span>}
    </button>
  );
}

export function ComplianceSidebar({ collapsed, onToggleCollapse, projects, activeProjectId, activeView, onSelectView, onSelectProject, onNew, onBackToXiaohai, onDelete, onRename, onDuplicate, user, onLogin }: Props) {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const renameTarget = projects.find(p => p.id === renameId);
  const deleteTarget = projects.find(p => p.id === deleteId);
  const [catOpen, setCatOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!contentRef.current) return;
    const mm = gsap.matchMedia();
    mm.add(`not ${REDUCED}`, () => {
      if (collapsed) gsap.to(contentRef.current!, { autoAlpha: 0, duration: DUR.fadeOut, ease: EASE.exit, overwrite: "auto" });
      else gsap.fromTo(contentRef.current!, { autoAlpha: 0 }, { autoAlpha: 1, duration: DUR.fadeIn, ease: EASE.enter, delay: 0.05, overwrite: "auto" });
    });
    mm.add(REDUCED, () => { gsap.set(contentRef.current!, { autoAlpha: collapsed ? 0 : 1 }); });
  }, { scope: sidebarRef, dependencies: [collapsed] });

  // ⌘/Ctrl + K 打开搜索命令面板
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); setSearchModalOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeSearch = () => setSearchModalOpen(false);
  const paletteActions: CmdItem[] = [
    { key: "new", icon: <PlusGlyph />, iconColor: "#1a5bc6", chipBg: "#e8f1ff", chipBorder: "#cfe0fb", label: "新建合规自查", desc: "开始一次合规自检", run: () => { onNew(); closeSearch(); } },
  ];
  const paletteItems: CmdItem[] = projects.map(p => {
    const cfg = COMPLIANCE_STATUS_CONFIG[p.status];
    return {
      key: p.id, icon: <DocGlyph />, iconColor: cfg?.color ?? "#64748b", chipBg: cfg?.bg ?? "#f1f5f9", chipBorder: cfg?.border ?? "#e6ebf2",
      label: p.name, desc: `${p.status}${p.investBranch ? " · " + BRANCH_LABEL[p.investBranch] : ""}`,
      run: () => { onSelectProject(p.id); closeSearch(); },
    };
  });
  const searchModal = searchModalOpen ? (
    <SearchCommandModal onClose={closeSearch} actions={paletteActions} items={paletteItems} placeholder="搜索自查任务…" title="企业ODI合规自查小助手" actionsLabel="新建" itemsLabel="最近自查" emptyCreateLabel="新建合规自查" emptyCreateRun={() => { onNew(); closeSearch(); }} />
  ) : null;

  const activeCount = projects.filter(p => p.status !== "已完成").length;
  const doneCount = projects.filter(p => p.status === "已完成").length;
  const visible = projects;

  // 折叠态：图标轨（首页风格）
  if (collapsed) {
    return (
      <div ref={sidebarRef} style={{ width: 56, flexShrink: 0, background: "#fbfcfe", borderRight: "1px solid #e5eaf2", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", gap: 10, transition: `width ${DUR.layout}s ${CSS_EASE.inOut}` }}>
        <button onClick={onToggleCollapse} title="展开侧边栏" style={iconBtn}><CollapseIcon /></button>
        <button onClick={onBackToXiaohai} title="返回沪航者" style={iconBtn}><BackIcon /></button>
        <button onClick={onNew} title="新建合规自查" style={{ ...iconBtn, background: "#1a5bc6", border: "none" }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        {searchModal}
      </div>
    );
  }

  return (
    <div ref={sidebarRef} style={{ width: 264, flexShrink: 0, background: "#fbfcfe", borderRight: "1px solid #e5eaf2", display: "flex", flexDirection: "column", overflow: "hidden", transition: `width ${DUR.layout}s ${CSS_EASE.inOut}` }}>
      <div ref={contentRef} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

        {/* 顶部工具栏（首页风格） */}
        <div style={{ padding: "12px 12px 8px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={onBackToXiaohai} title="返回沪航者"
              style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #e5eaf2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <BackIcon />
            </button>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1f2937", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>企业ODI合规自查小助手</span>
            <button onClick={() => setSearchModalOpen(true)} title="搜索自查任务 (⌘K)"
              style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #e5eaf2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.13s, transform 0.13s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; }} onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}>
              <SearchGlyph size={14} color="#64748b" />
            </button>
            <button onClick={onToggleCollapse} title="收起侧边栏"
              style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #e5eaf2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.13s, transform 0.13s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; }} onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}>
              <CollapseIcon />
            </button>
          </div>
        </div>

        {/* 新建合规（首页风格：描边按钮） */}
        <div style={{ padding: "2px 12px 6px", flexShrink: 0 }}>
          <button onClick={onNew}
            style={{ width: "100%", height: 38, borderRadius: 10, border: "1px solid #dbe3ef", background: "#fff", color: "#1a5bc6", cursor: "pointer", display: "flex", alignItems: "center", gap: 9, padding: "0 12px", fontSize: 13, fontWeight: 600, transition: "all 0.13s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.borderColor = "#bfdbfe"; }} onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#dbe3ef"; }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="#1a5bc6" strokeWidth="1.8" strokeLinecap="round" /></svg>
            新建合规自查
          </button>
        </div>

        {/* 任务分类（可折叠） */}
        <div style={{ flexShrink: 0 }}>
          <SectionHeader title="任务分类" open={catOpen} onToggle={() => setCatOpen(v => !v)} />
          {catOpen && (
            <div style={{ padding: "2px 8px", borderBottom: "1px solid #f1f5f9" }}>
              <NavItem label="全部" count={projects.length} active={activeView === "all"} onClick={() => onSelectView("all")} />
              <NavItem label="进行中" count={activeCount} active={activeView === "active"} onClick={() => onSelectView("active")} />
              <NavItem label="已完成" count={doneCount} active={activeView === "done"} onClick={() => onSelectView("done")} />
            </div>
          )}
        </div>

        {/* 最近自查（可折叠） */}
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
          <SectionHeader title="最近自查" open={recentOpen} onToggle={() => setRecentOpen(v => !v)} count={visible.length} />
          {recentOpen && (
            <div style={{ paddingTop: 2, paddingBottom: 6 }}>
              {visible.length === 0 && <div style={{ padding: "12px 16px", fontSize: 12, color: "#94a3b8" }}>暂无自查任务</div>}
              {visible.map(p => {
                const cfg = COMPLIANCE_STATUS_CONFIG[p.status];
                const active = p.id === activeProjectId;
                return (
                  <div key={p.id} onClick={() => onSelectProject(p.id)}
                    style={{ margin: "1px 8px", padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: active ? "#eff6ff" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#f5f7fa"; }} onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ fontSize: 13, color: active ? "#1a5bc6" : "#374151", fontWeight: active ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.5 }}>{p.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 6, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{p.status}</span>
                      {p.investBranch && <span style={{ fontSize: 10, color: "#64748b" }}>{BRANCH_LABEL[p.investBranch]}</span>}
                      <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>{p.updatedAt}</span>
                      <ComplianceItemMenu onRename={() => setRenameId(p.id)} onDuplicate={() => onDuplicate(p.id)} onDelete={() => setDeleteId(p.id)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部:企业身份(已登录显示身份卡;未登录显示登录入口) */}
        {user ? (
          <div style={{ borderTop: "1px solid #eef2f7", flexShrink: 0, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#1a5bc6,#60a5fa)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{(user.userName || "用")[0]}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.userName}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{user.userType} · {user.certStatus}</div>
            </div>
          </div>
        ) : (
          <div onClick={onLogin} title="登录"
            style={{ borderTop: "1px solid #eef2f7", flexShrink: 0, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", transition: "background .12s" }}
            onMouseEnter={e => e.currentTarget.style.background = "#f5f7fa"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#64748b" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4" /><path d="M3 13c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a5bc6" }}>登录 / 注册</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>登录后可保存进度、使用完整版</div>
            </div>
          </div>
        )}
      </div>
      {renameTarget && <RenameModal initialName={renameTarget.name} onConfirm={name => { onRename(renameTarget.id, name); setRenameId(null); }} onCancel={() => setRenameId(null)} />}
      {deleteTarget && <DeleteConfirmModal projectName={deleteTarget.name} onConfirm={() => { onDelete(deleteTarget.id); setDeleteId(null); }} onCancel={() => setDeleteId(null)} />}
      {searchModal}
    </div>
  );
}

const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #e5eaf2", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
