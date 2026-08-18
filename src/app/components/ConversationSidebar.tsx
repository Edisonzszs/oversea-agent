import { useMemo, useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { CONVERSATIONS, type ConversationItem } from "./conversationData";
import xiaohaiLogo from "../../imports/a79a33e60349890f7bf1eb25f7af24df.png";
import { DUR, EASE, CSS_EASE, DIST, REDUCED_MOTION_QUERY } from "../motionTokens";
import { SearchCommandModal, type CmdItem, PlusGlyph, ChatGlyph, StarGlyph } from "./SearchCommandModal";
import { UserMenu } from "./UserMenu";

gsap.registerPlugin(Flip);

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeConvId: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onEnterOdiWorkbench: () => void;
  pendingOdiCount?: number;
  onEnterCompliance?: () => void;
  user?: { userName: string; userType: string; certStatus: string } | null;
  onLogin?: () => void;
}

function MoreMenu({ favorite, onRename, onFavorite, onDelete }: { favorite: boolean; onRename: () => void; onFavorite: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4, color: "#94a3b8", fontSize: 14, lineHeight: 1 }}
        onMouseEnter={e => (e.currentTarget.style.color = "#1a5bc6")}
        onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}
      >···</button>
      {open && (
        <div
          style={{ position: "absolute", right: 0, top: "100%", zIndex: 100, background: "#fff", border: "1px solid #e5eaf2", borderRadius: 8, boxShadow: "0 4px 16px rgba(26,64,140,0.12)", minWidth: 128, overflow: "hidden" }}
          onMouseLeave={() => setOpen(false)}
        >
          {[
            { label: "重命名", fn: onRename },
            { label: favorite ? "取消收藏" : "收藏对话", fn: onFavorite },
            { label: "删除", fn: onDelete },
          ].map(item => (
            <button key={item.label}
              onClick={e => { e.stopPropagation(); item.fn(); setOpen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: item.label === "删除" ? "#dc2626" : "#1f2937" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >{item.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 星标组件：收藏时执行 scale 1→0.85→1.08→1 序列
 * 触发条件：点击收藏/取消收藏
 * 时长：~180ms，ease: back.out(1.4)
 * 降级：reduced-motion 下只切换 fill，无 scale
 */
function StarIcon({ filled, animRef }: { filled: boolean; animRef?: React.RefObject<HTMLElement | null> }) {
  return (
    <svg
      ref={animRef as React.RefObject<SVGSVGElement>}
      width="13" height="13" viewBox="0 0 20 20"
      fill={filled ? "#f59e0b" : "none"}
      style={{ display: "block" }}
    >
      <path d="M10 2.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L10 14.98 5.3 16.95l.9-5.23-3.8-3.7 5.25-.76L10 2.5z"
        stroke={filled ? "#f59e0b" : "#cbd5e1"} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function ConvItem({ conv, active, onSelect, onToggleFavorite }: { conv: ConversationItem; active: boolean; onSelect: () => void; onToggleFavorite: () => void }) {
  const [hovered, setHovered] = useState(false);
  const starRef = useRef<SVGSVGElement>(null);

  const handleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Star scale animation
    const mm = gsap.matchMedia();
    mm.add(`not ${REDUCED_MOTION_QUERY}`, () => {
      if (starRef.current) {
        gsap.killTweensOf(starRef.current);
        gsap.timeline()
          .to(starRef.current, { scale: 0.85, duration: 0.06, ease: "power2.in", overwrite: "auto" })
          .to(starRef.current, { scale: 1.08, duration: 0.08, ease: "power2.out" })
          .to(starRef.current, { scale: 1, duration: DUR.star, ease: EASE.star });
      }
    });
    onToggleFavorite();
  }, [onToggleFavorite]);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ margin: "1px 8px", padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: active ? "#eff6ff" : hovered ? "#f5f7fa" : "transparent", transition: "background 0.15s", display: "flex", alignItems: "center", gap: 8 }}
    >
      <span style={{ fontSize: 13, color: active ? "#1a5bc6" : "#374151", fontWeight: active ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, lineHeight: 1.5 }}>
        {conv.title}
      </span>
      {conv.isOdiRelated && !hovered && (
        <span style={{ fontSize: 9, fontWeight: 700, color: "#1a5bc6", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 5, padding: "1px 5px", flexShrink: 0 }}>ODI</span>
      )}
      {conv.favorite && !hovered && (
        <span style={{ flexShrink: 0, display: "flex" }}><StarIcon filled /></span>
      )}
      {hovered && (
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <button
            onClick={handleFavorite}
            title={conv.favorite ? "取消收藏" : "收藏"}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 3px", borderRadius: 4, display: "flex" }}
          >
            <svg
              ref={starRef}
              width="13" height="13" viewBox="0 0 20 20"
              fill={conv.favorite ? "#f59e0b" : "none"}
              style={{ display: "block", transformOrigin: "center" }}
            >
              <path d="M10 2.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L10 14.98 5.3 16.95l.9-5.23-3.8-3.7 5.25-.76L10 2.5z"
                stroke={conv.favorite ? "#f59e0b" : "#cbd5e1"} strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          </button>
          <MoreMenu favorite={conv.favorite} onRename={() => {}} onFavorite={() => { handleFavorite({ stopPropagation: () => {} } as React.MouseEvent); }} onDelete={() => {}} />
        </div>
      )}
    </div>
  );
}

function CollapseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" stroke="#64748b" strokeWidth="1.5" />
      <path d="M7.5 3.5v13" stroke="#64748b" strokeWidth="1.5" />
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

function OdiFolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M2 7a2 2 0 012-2h3.5L9 7h7a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 12h6M7 14.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M10 2.5l6 2.2v5.1c0 3.7-2.6 6.6-6 7.7-3.4-1.1-6-4-6-7.7V4.7l6-2.2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7.2 10l2 2 3.6-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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

function ToolboxGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M6 5V3.6A1.6 1.6 0 017.6 2h.8A1.6 1.6 0 0110 3.6V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="2.2" y="5" width="11.6" height="8.6" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.2 9h11.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ToolRow({ icon, tint, chipBg, label, onClick, badge, disabled }: { icon: ReactNode; tint: string; chipBg: string; label: string; onClick: () => void; badge?: number; disabled?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const dim = disabled ? 0.4 : 1;
  return (
    <button onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "7px 10px 7px 16px", borderRadius: 8, border: "none", background: hovered ? "#eff6ff" : "transparent", cursor: disabled ? "default" : "pointer", textAlign: "left", transition: "background .13s" }}>
      <span style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: chipBg, color: tint, boxShadow: `inset 0 0 0 1px ${tint}1a` }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, color: hovered ? "#1a5bc6" : "#374151", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {badge != null && badge > 0 && !disabled && <span style={{ background: "#dc2626", color: "#fff", borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "1px 7px", flexShrink: 0 }}>{badge}</span>}
      {!disabled && <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ color: hovered ? tint : "#cbd5e1", transform: hovered ? "translateX(2px)" : "none", transition: "transform .15s, color .15s", flexShrink: 0 }}><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </button>
  );
}

function BrandMark() {
  return (
    <div style={{ width: 30, height: 30, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img src={xiaohaiLogo} alt="沪航者智能体" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
    </div>
  );
}

/**
 * ConversationSidebar
 *
 * 动效一览：
 * 1. 侧边栏展开/收起：Flip 宽度过渡，内容先 autoAlpha→0，再 Flip，再恢复
 *    触发：collapsed 状态切换 | 时长：260ms | ease: power3.inOut | 降级：instant
 * 2. 星标收藏：scale 1→0.85→1.08→1
 *    触发：点击收藏按钮 | 时长：~180ms | ease: back.out(1.4) | 降级：无 scale
 * 3. 按钮微交互：hover scale 1.05，CSS transition 120-160ms
 *    触发：mouseenter/mouseleave | 时长：130ms | ease: CSS ease | 降级：无变化
 */
export function ConversationSidebar({ collapsed, onToggleCollapse, activeConvId, onSelectConversation, onNewConversation, onEnterOdiWorkbench, pendingOdiCount, onEnterCompliance, user, onLogin }: Props) {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [toolboxOpen, setToolboxOpen] = useState(true);
  const [favOpen, setFavOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userAreaRef = useRef<HTMLDivElement>(null);
  const [favs, setFavs] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CONVERSATIONS.map(c => [c.id, c.favorite]))
  );

  const sidebarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const toggleFavorite = (id: string) => setFavs(prev => ({ ...prev, [id]: !prev[id] }));

  const list = useMemo(
    () => CONVERSATIONS.map(c => ({ ...c, favorite: favs[c.id] })),
    [favs]
  );

  const filtered = list;
  const favorites = filtered.filter(c => c.favorite);
  const recent = filtered.filter(c => !c.favorite);

  // Sidebar collapse/expand animation
  useGSAP(() => {
    if (!sidebarRef.current) return;
    const mm = gsap.matchMedia();

    mm.add(`not ${REDUCED_MOTION_QUERY}`, () => {
      // Just animate opacity of content, width is controlled by React rendering
      if (contentRef.current) {
        if (collapsed) {
          // Fading out content before collapse
          gsap.to(contentRef.current, {
            autoAlpha: 0,
            duration: DUR.sidebarFade,
            ease: EASE.in,
            overwrite: "auto",
          });
        } else {
          // Fading in content after expand
          gsap.fromTo(contentRef.current,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: DUR.sidebarFade, ease: EASE.out, delay: 0.05, overwrite: "auto" }
          );
        }
      }
    });

    mm.add(REDUCED_MOTION_QUERY, () => {
      if (contentRef.current) {
        gsap.set(contentRef.current, { autoAlpha: collapsed ? 0 : 1 });
      }
    });
  }, { scope: sidebarRef, dependencies: [collapsed] });

  // 全局快捷键 ⌘/Ctrl + K 打开搜索命令面板
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeSearch = () => setSearchModalOpen(false);
  const paletteActions: CmdItem[] = [
    { key: "new", icon: <PlusGlyph />, iconColor: "#1a5bc6", chipBg: "#e8f1ff", chipBorder: "#cfe0fb", label: "新建对话", desc: "开始一个新的沪航者对话", run: () => { onNewConversation(); closeSearch(); } },
  ];
  const paletteItems: CmdItem[] = list.map(c => ({
    key: c.id, icon: <ChatGlyph />, iconColor: "#64748b", chipBg: "#f1f5f9", chipBorder: "#e6ebf2",
    label: c.title, desc: c.isOdiRelated ? "ODI 相关" : undefined,
    right: c.favorite ? <StarGlyph /> : undefined,
    run: () => { onSelectConversation(c.id); closeSearch(); },
  }));
  const searchModal = searchModalOpen ? (
    <SearchCommandModal
      onClose={closeSearch}
      actions={paletteActions}
      items={paletteItems}
      placeholder="搜索对话…"
      title="沪航者 · 命令面板"
      actionsLabel="新建"
      itemsLabel="最近对话"
      emptyCreateLabel="新建对话"
      emptyCreateRun={() => { onNewConversation(); closeSearch(); }}
    />
  ) : null;

  if (collapsed) {
    return (
      <div ref={sidebarRef} style={{ width: 56, flexShrink: 0, background: "#fff", borderRight: "1px solid #e5eaf2", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", gap: 10, transition: `width ${DUR.sidebarFlip}s ${CSS_EASE.inOut}` }}>
        <button onClick={onToggleCollapse} title="展开侧边栏" style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid #e5eaf2", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CollapseIcon />
        </button>
        <button onClick={onNewConversation} title="新建对话" style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid #e5eaf2", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <button onClick={() => setSearchModalOpen(true)} title="搜索对话 (⌘K)" style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid #e5eaf2", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <SearchGlyph size={15} color="#64748b" />
        </button>
        <div style={{ position: "relative" }}>
          <button onClick={onEnterOdiWorkbench} title="ODI备案助手" style={{ width: 34, height: 34, borderRadius: 8, border: "1.5px solid #e5eaf2", background: "#f5f3ff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6d28d9" }}>
            <OdiFolderIcon />
          </button>
          {pendingOdiCount != null && pendingOdiCount > 0 && (
            <span style={{ position: "absolute", top: -4, right: -4, background: "#dc2626", color: "#fff", borderRadius: 10, fontSize: 9, fontWeight: 700, padding: "1px 4px", lineHeight: 1.2 }}>{pendingOdiCount}</span>
          )}
        </div>
        {onEnterCompliance && (
          <button onClick={onEnterCompliance} title="企业ODI合规自查小助手" style={{ width: 34, height: 34, borderRadius: 8, border: "1.5px solid #bfdbfe", background: "#eff6ff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a5bc6", fontSize: 14, fontWeight: 800 }}>合</button>
        )}
        {searchModal}
      </div>
    );
  }

  const sectionLabel = (text: string, open: boolean, onToggle: () => void, count?: number) => (
    <button onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 5, width: "100%", padding: "10px 14px 4px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
      <Chevron open={open} />
      <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.8, textTransform: "uppercase" }}>{text}</span>
      {count != null && <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>{count}</span>}
    </button>
  );

  return (
    <div ref={sidebarRef} style={{ width: 264, flexShrink: 0, background: "#fbfcfe", borderRight: "1px solid #e5eaf2", display: "flex", flexDirection: "column", overflow: "hidden", transition: `width ${DUR.sidebarFlip}s ${CSS_EASE.inOut}` }}>

      {/* 全部内容区域，统一控制淡入淡出 */}
      <div ref={contentRef} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

        {/* 顶部工具栏 */}
        <div style={{ padding: "12px 12px 8px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BrandMark />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1f2937", flex: 1 }}>沪航者智能体</span>
            <button
              onClick={() => setSearchModalOpen(true)}
              title="搜索对话 (⌘K)"
              style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #e5eaf2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.13s, transform 0.13s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              <SearchGlyph size={14} color="#64748b" />
            </button>
            <button
              onClick={onToggleCollapse}
              title="收起侧边栏"
              style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #e5eaf2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.13s, transform 0.13s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              <CollapseIcon />
            </button>
          </div>

        </div>

        {/* 新建对话 */}
        <div style={{ padding: "2px 12px 8px", flexShrink: 0 }}>
          <button onClick={onNewConversation}
            style={{ width: "100%", height: 38, borderRadius: 10, border: "1px solid #dbe3ef", background: "#fff", color: "#1a5bc6", cursor: "pointer", display: "flex", alignItems: "center", gap: 9, padding: "0 12px", fontSize: 13, fontWeight: 600, transition: "all 0.13s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.borderColor = "#bfdbfe"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#dbe3ef"; }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="#1a5bc6" strokeWidth="1.8" strokeLinecap="round" /></svg>
            新建对话
          </button>
        </div>

        {/* 工具箱 —— 与「新建对话」同级、同形式的可折叠入口 */}
        <div style={{ padding: "0 12px 6px", flexShrink: 0 }}>
          <button onClick={() => setToolboxOpen(v => !v)}
            style={{ width: "100%", height: 38, borderRadius: 10, border: "1px solid #dbe3ef", background: "#fff", color: "#1a5bc6", cursor: "pointer", display: "flex", alignItems: "center", gap: 9, padding: "0 12px", fontSize: 13, fontWeight: 600, transition: "all 0.13s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.borderColor = "#bfdbfe"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#dbe3ef"; }}>
            <span style={{ color: "#1a5bc6", display: "flex" }}><ToolboxGlyph /></span>
            <span style={{ flex: 1, textAlign: "left" }}>工具箱</span>
            <Chevron open={toolboxOpen} />
          </button>
          {toolboxOpen && (
            <div style={{ padding: "4px 0 0" }}>
              <ToolRow icon={<OdiFolderIcon />} tint="#6d28d9" chipBg="#f5f3ff" label="ODI备案助手" onClick={onEnterOdiWorkbench} />
              {onEnterCompliance && (
                <ToolRow icon={<ShieldIcon />} tint="#1a5bc6" chipBg="#eff6ff" label="企业ODI合规自查小助手" onClick={onEnterCompliance} />
              )}
            </div>
          )}
        </div>

        {/* 会话列表 */}
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", paddingTop: 2, paddingBottom: 6 }}>
          {favorites.length > 0 && (
            <>
              {sectionLabel("收藏对话", favOpen, () => setFavOpen(v => !v), favorites.length)}
              {favOpen && favorites.map(conv => (
                <ConvItem key={conv.id} conv={conv} active={conv.id === activeConvId} onSelect={() => onSelectConversation(conv.id)} onToggleFavorite={() => toggleFavorite(conv.id)} />
              ))}
            </>
          )}

          {sectionLabel("最近对话", recentOpen, () => setRecentOpen(v => !v), recent.length)}
          {recentOpen && recent.map(conv => (
            <ConvItem key={conv.id} conv={conv} active={conv.id === activeConvId} onSelect={() => onSelectConversation(conv.id)} onToggleFavorite={() => toggleFavorite(conv.id)} />
          ))}

          {!filtered.length && (
            <div style={{ padding: "24px 20px", textAlign: "center" }}><p style={{ fontSize: 12, color: "#94a3b8" }}>没有找到相关对话</p></div>
          )}
        </div>

        {/* 底部:企业身份(已登录显示身份卡;未登录显示登录入口) */}
        {user ? (
          <div ref={userAreaRef} onClick={() => setUserMenuOpen(v => !v)} title="账户菜单"
            style={{ borderTop: "1px solid #eef2f7", flexShrink: 0, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", transition: "background .12s" }}
            onMouseEnter={e => e.currentTarget.style.background = "#f5f7fa"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#1a5bc6,#60a5fa)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{(user.userName || "用")[0]}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.userName}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{user.userType} · {user.certStatus}</div>
            </div>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color: "#94a3b8", transition: "transform .2s", transform: userMenuOpen ? "rotate(180deg)" : "none" }}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
      {searchModal}
      {user && <UserMenu open={userMenuOpen} onClose={() => setUserMenuOpen(false)} anchorRef={userAreaRef} user={user} />}
    </div>
  );
}
