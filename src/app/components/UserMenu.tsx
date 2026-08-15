// 用户弹出菜单 —— 点击侧栏底部用户区触发，含个人信息 / 记忆管理 / 退出登录。
// 参考 ChatGPT / MiniMax 的用户菜单交互模式。

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  user?: { userName: string; userType: string; certStatus: string; phone?: string; orgName?: string } | null;
}

// ─── mock 记忆条目 ──────────────────────────────────────────────────────────
const MOCK_MEMORIES = [
  { id: "m1", text: "企业主要业务：智能装备制造，面向东南亚市场出口", time: "2026-08-04" },
  { id: "m2", text: "偏好使用中文交流，投资方式以新设（绿地投资）为主", time: "2026-08-05" },
  { id: "m3", text: "关注越南、新加坡两个重点目标国别的投资政策", time: "2026-08-06" },
];

// ─── 小图标 ──────────────────────────────────────────────────────────────────
function PersonGlyph() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4" /><path d="M3 13c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
}
function BrainGlyph() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2.5c-1 0-1.8.5-2.2 1.2C5.2 3.4 4.5 4 4.5 5c0 .3 0 .6.1.8-.6.4-1.1 1-1.1 1.9 0 .7.3 1.3.8 1.7-.3.4-.5.9-.5 1.5 0 1.3 1 2.1 2 2.1.3.8 1 1.5 2.2 1.5M8 2.5c1 0 1.8.5 2.2 1.2.6-.3 1.3.3 1.3 1.3 0 .3 0 .6-.1.8.6.4 1.1 1 1.1 1.9 0 .7-.3 1.3-.8 1.7.3.4.5.9.5 1.5 0 1.3-1 2.1-2 2.1-.3.8-1 1.5-2.2 1.5M8 2.5v11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function LogoutGlyph() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3H4a1 1 0 00-1 1v8a1 1 0 001 1h2M9.5 11l3-3-3-3M6 8h6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function CloseGlyph() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

export function UserMenu({ open, onClose, anchorRef, user }: Props) {
  const [showProfile, setShowProfile] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [memories, setMemories] = useState(MOCK_MEMORIES);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // 计算菜单位置（锚定在用户区上方）
  useEffect(() => {
    if (open && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.top - 8, left: rect.left + 8 });
    }
  }, [open, anchorRef]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const closeAll = () => { setShowProfile(false); setShowMemory(false); setShowLogout(false); onClose(); };

  return createPortal(
    <>
      {/* 遮罩（点击外部关闭） */}
      <div onClick={closeAll} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />

      {/* 弹出菜单 */}
      <div ref={menuRef}
        style={{ position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 9999, width: 240, transform: "translateY(-100%)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5eaf2", boxShadow: "0 8px 28px rgba(15,23,42,0.14)", overflow: "hidden" }}>
          {/* 头部 */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #eef2f7", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#1a5bc6,#60a5fa)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{(user?.userName || "用")[0]}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1f2937" }}>{user?.userName ?? "未登录"}</div>
              <div style={{ fontSize: 11.5, color: "#94a3b8" }}>{[user?.orgName, user?.userType, user?.certStatus].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
          {/* 菜单项 */}
          <div style={{ padding: "5px 0" }}>
            <button onClick={() => { setShowProfile(true); }} style={menuItemStyle} onMouseEnter={e => e.currentTarget.style.background = "#f5f7fa"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ color: "#64748b" }}><PersonGlyph /></span>
              <span>个人信息</span>
            </button>
            <button onClick={() => { setShowMemory(true); }} style={menuItemStyle} onMouseEnter={e => e.currentTarget.style.background = "#f5f7fa"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ color: "#64748b" }}><BrainGlyph /></span>
              <span>记忆管理</span>
              {memories.length > 0 && <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, color: "#94a3b8", background: "#f1f5f9", borderRadius: 10, padding: "1px 7px" }}>{memories.length}</span>}
            </button>
          </div>
          {/* 退出登录 */}
          <div style={{ borderTop: "1px solid #eef2f7", padding: "5px 0" }}>
            <button onClick={() => { setShowLogout(true); }} style={{ ...menuItemStyle, color: "#dc2626" }} onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ color: "#dc2626" }}><LogoutGlyph /></span>
              <span>退出登录</span>
            </button>
          </div>
        </div>
      </div>

      {/* 个人信息弹窗 */}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} user={user} />}
      {/* 记忆管理弹窗 */}
      {showMemory && <MemoryModal memories={memories} onDelete={(id) => setMemories(prev => prev.filter(m => m.id !== id))} onClose={() => setShowMemory(false)} />}
      {/* 退出登录确认 */}
      {showLogout && <LogoutModal onConfirm={closeAll} onCancel={() => setShowLogout(false)} />}
    </>,
    document.body
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 16px",
  border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "#1f2937",
  fontWeight: 400, textAlign: "left", transition: "background .12s",
};

// ─── 个人信息弹窗 ────────────────────────────────────────────────────────────
function ProfileModal({ onClose, user }: { onClose: () => void; user?: Props["user"] }) {
  const rows = [
    { label: "姓名", value: user?.userName ?? "—" },
    { label: "企业名称", value: user?.orgName ?? "—" },
    { label: "用户类型", value: user?.userType ?? "—" },
    { label: "认证状态", value: user?.certStatus ?? "—" },
    { label: "联系电话", value: user?.phone ?? "—" },
  ];
  return (
    <ModalShell title="个人信息" onClose={onClose}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#1a5bc6,#60a5fa)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{(user?.userName || "用")[0]}</span>
        </div>
      </div>
      {rows.map(r => (
        <div key={r.label} style={{ display: "flex", padding: "9px 0", borderBottom: "1px solid #f1f5f9" }}>
          <span style={{ flex: "0 0 130px", fontSize: 13, color: "#94a3b8" }}>{r.label}</span>
          <span style={{ flex: 1, fontSize: 13, color: "#1f2937", fontWeight: 500 }}>{r.value}</span>
        </div>
      ))}
    </ModalShell>
  );
}

// ─── 记忆管理弹窗 ────────────────────────────────────────────────────────────
function MemoryModal({ memories, onDelete, onClose }: { memories: { id: string; text: string; time: string }[]; onDelete: (id: string) => void; onClose: () => void }) {
  return (
    <ModalShell title="记忆管理" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.6, marginBottom: 14 }}>
        小海会记住您告诉它的企业信息和偏好，以便在后续对话中提供更准确的建议。您可以随时删除不需要的记忆。
      </p>
      {memories.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 13 }}>暂无记忆条目</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {memories.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 9, background: "#f8fafc", border: "1px solid #eef2f7" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#1f2937", lineHeight: 1.5 }}>{m.text}</div>
                <div style={{ fontSize: 10.5, color: "#cbd5e1", marginTop: 4 }}>{m.time}</div>
              </div>
              <button onClick={() => onDelete(m.id)} title="删除" style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 15, padding: 0, lineHeight: 1, flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = "#dc2626"} onMouseLeave={e => e.currentTarget.style.color = "#cbd5e1"}>✕</button>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}

// ─── 退出登录确认 ────────────────────────────────────────────────────────────
function LogoutModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 10010, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 380, maxWidth: "92%", padding: "26px 28px", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "#1f2937" }}>退出登录</h3>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "#64748b", lineHeight: 1.6 }}>确定退出当前账号吗？退出后需要重新登录。</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onCancel} style={{ background: "none", border: "1px solid #e5eaf2", color: "#64748b", borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer" }}>取消</button>
          <button onClick={onConfirm} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "8px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>退出</button>
        </div>
      </div>
    </div>
  );
}

// ─── 弹窗外壳（复用） ──────────────────────────────────────────────────────────
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10010, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 460, maxWidth: "92%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px 14px", borderBottom: "1px solid #eef2f7", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1f2937" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }} onMouseEnter={e => e.currentTarget.style.color = "#1f2937"} onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}><CloseGlyph /></button>
        </div>
        <div style={{ padding: "18px 24px 24px" }}>{children}</div>
      </div>
    </div>
  );
}
