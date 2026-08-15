// 通用搜索命令面板 —— 居中弹窗（参考 ChatGPT / Linear / Raycast）。
// 由各侧栏传入 actions（快捷动作）+ items（可搜索历史/列表），即得到统一体验：
// 搜索输入(autofocus) + 分区列表 + 键盘导航(↑↓/Enter/Esc) + 空态 + 背景点击关闭。
// 通过 createPortal 渲染到 document.body，避免被侧栏 overflow/层叠上下文裁切。

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type CmdItem = {
  key: string;
  icon: ReactNode;
  iconColor: string;
  chipBg: string;
  chipBorder: string;
  label: string;
  desc?: string;
  right?: ReactNode;
  run: () => void;
};

interface Props {
  onClose: () => void;
  actions: CmdItem[];
  items: CmdItem[];
  placeholder?: string;
  title?: string;
  actionsLabel?: string;
  itemsLabel?: string;
  emptyCreateLabel?: string;
  emptyCreateRun?: () => void;
}

export function SearchGlyph({ size = 17, color = "#94a3b8" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="5" stroke={color} strokeWidth="1.5" />
      <path d="M11 11l2.6 2.6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
export function PlusGlyph() {
  return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>);
}
export function ChatGlyph() {
  return (<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M3 6a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H8l-3.5 3v-3H5a2 2 0 01-2-2V6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>);
}
export function DocGlyph() {
  return (<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M5 3h7l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M12 3v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M7 11h6M7 14h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>);
}
export function StarGlyph() {
  return (<svg width="13" height="13" viewBox="0 0 20 20" fill="#f59e0b"><path d="M10 2.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L10 14.98 5.3 16.95l.9-5.23-3.8-3.7 5.25-.76L10 2.5z" stroke="#f59e0b" strokeWidth="1" strokeLinejoin="round" /></svg>);
}

const kbdStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  minWidth: 20, height: 20, padding: "0 6px", borderRadius: 5,
  background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#64748b",
  fontSize: 11, fontWeight: 600, fontFamily: "inherit",
};

export function SearchCommandModal({ onClose, actions, items, placeholder = "搜索…", title = "命令面板", actionsLabel = "新建 / 快捷", itemsLabel = "最近", emptyCreateLabel, emptyCreateRun }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const q = query.trim().toLowerCase();

  const fActions = useMemo(() => actions.filter(a => !q || a.label.toLowerCase().includes(q) || (a.desc ?? "").toLowerCase().includes(q)), [q, actions]);
  const fItems = useMemo(() => items.filter(it => !q || it.label.toLowerCase().includes(q) || (it.desc ?? "").toLowerCase().includes(q)), [q, items]);
  const flat = useMemo(() => [...fActions, ...fItems], [fActions, fItems]);

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 8);
    inputRef.current?.focus();
    return () => clearTimeout(t);
  }, []);

  useEffect(() => { setActive(0); if (listRef.current) listRef.current.scrollTop = 0; }, [q]);
  useEffect(() => { if (active > flat.length - 1) setActive(Math.max(0, flat.length - 1)); }, [flat.length, active]);
  useEffect(() => { itemRefs.current[active]?.scrollIntoView({ block: "nearest" }); }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, flat.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); return; }
    if (e.key === "Enter") { e.preventDefault(); flat[active]?.run(); return; }
  };

  const renderItem = (item: CmdItem, idx: number) => {
    const isActive = idx === active;
    return (
      <button
        key={item.key}
        ref={el => { itemRefs.current[idx] = el; }}
        onMouseMove={() => { if (idx !== active) setActive(idx); }}
        onClick={() => item.run()}
        style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "9px 10px", borderRadius: 10, border: "none", background: isActive ? "#eff6ff" : "transparent", cursor: "pointer", textAlign: "left", transition: "background .1s", margin: "1px 0" }}
      >
        <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: item.chipBg, color: item.iconColor, boxShadow: `inset 0 0 0 1px ${item.chipBorder}` }}>{item.icon}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: isActive ? "#1a5bc6" : "#0f172a", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
          {item.desc && <span style={{ display: "block", fontSize: 11, color: "#94a3b8", marginTop: 1.5, lineHeight: 1.2 }}>{item.desc}</span>}
        </span>
        {item.right}
        {isActive && <span style={kbdStyle}>↵</span>}
      </button>
    );
  };

  const sectionLabel = (text: string) => (
    <div style={{ padding: "12px 12px 5px", fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.8 }}>{text}</div>
  );

  return createPortal(
    <div
      onClick={onClose}
      role="presentation"
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "11vh", background: shown ? "rgba(15,23,42,0.42)" : "rgba(15,23,42,0)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", transition: "background .18s ease" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: 580, maxWidth: "92vw", maxHeight: "72vh", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 16, border: "1px solid #e8edf5", boxShadow: "0 24px 70px rgba(15,23,42,0.35)", overflow: "hidden", transform: shown ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.97)", opacity: shown ? 1 : 0, transition: "transform .2s cubic-bezier(0.34,1.56,0.64,1), opacity .16s ease" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 16px", borderBottom: "1px solid #eef2f7", flexShrink: 0 }}>
          <SearchGlyph size={18} color="#94a3b8" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 15, color: "#0f172a", fontFamily: "inherit" }}
          />
          <button onClick={onClose} title="关闭" aria-label="关闭" style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "#f1f5f9", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", flexShrink: 0, transition: "background .12s" }} onMouseEnter={e => e.currentTarget.style.background = "#e2e8f0"} onMouseLeave={e => e.currentTarget.style.background = "#f1f5f9"}><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg></button>
        </div>

        <div ref={listRef} style={{ overflowY: "auto", scrollbarWidth: "none", padding: "4px 8px 6px" }}>
          {flat.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 13.5, color: "#475569", fontWeight: 600 }}>{query ? `未找到「${query}」相关结果` : "暂无内容"}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>试试换个关键词{emptyCreateLabel ? "，或直接新建。" : "。"}</div>
              {emptyCreateLabel && emptyCreateRun && (
                <button onClick={emptyCreateRun} style={{ marginTop: 12, padding: "7px 16px", borderRadius: 8, border: "none", background: "#1a5bc6", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>+ {emptyCreateLabel}</button>
              )}
            </div>
          ) : (
            <>
              {fActions.length > 0 && (<>{sectionLabel(actionsLabel)}{fActions.map((it, i) => renderItem(it, i))}</>)}
              {fItems.length > 0 && (<>{sectionLabel(itemsLabel)}{fItems.map((it, i) => renderItem(it, fActions.length + i))}</>)}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
