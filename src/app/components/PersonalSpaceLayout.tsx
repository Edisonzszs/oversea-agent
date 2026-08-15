import type { ReactNode } from "react";

export type PersonalSpacePage = "overview" | "conversations" | "favorites" | "odi-projects" | "account";

interface LayoutProps {
  activePage: PersonalSpacePage;
  onNavigate: (page: PersonalSpacePage) => void;
  children: ReactNode;
}

const MENU: { key: PersonalSpacePage; label: string; icon: ReactNode }[] = [
  { key: "overview", label: "个人概览", icon: <GridIcon /> },
  { key: "conversations", label: "历史对话", icon: <ChatIcon /> },
  { key: "favorites", label: "我的收藏", icon: <StarIcon /> },
  { key: "odi-projects", label: "我的ODI项目", icon: <FolderIcon /> },
  { key: "account", label: "账号信息", icon: <UserIcon /> },
];

export function PersonalSpaceLayout({ activePage, onNavigate, children }: LayoutProps) {
  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Left sidebar */}
      <div style={{ width: 220, flexShrink: 0, background: "#fff", borderRight: "1px solid #e8edf5", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 16px 10px", borderBottom: "1px solid #f1f5f9" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase" }}>个人空间</span>
        </div>
        <nav style={{ padding: "8px", flex: 1 }}>
          {MENU.map(item => {
            const active = activePage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "9px 12px", borderRadius: 9, border: "none", textAlign: "left",
                  cursor: "pointer", marginBottom: 2, fontSize: 14,
                  background: active ? "#eff6ff" : "transparent",
                  color: active ? "#1a5bc6" : "#374151",
                  fontWeight: active ? 600 : 400,
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget.style.background = "#f8fafc"); }}
                onMouseLeave={e => { if (!active) (e.currentTarget.style.background = "transparent"); }}
              >
                <span style={{ color: active ? "#1a5bc6" : "#64748b", display: "flex", alignItems: "center", flexShrink: 0 }}>{item.icon}</span>
                {item.label}
                {active && <span style={{ marginLeft: "auto", width: 3, height: 16, background: "#1a5bc6", borderRadius: 2, flexShrink: 0 }} />}
              </button>
            );
          })}
        </nav>
      </div>
      {/* Right content */}
      <div style={{ flex: 1, overflow: "auto", background: "#f5f7fb" }}>
        {children}
      </div>
    </div>
  );
}

export function PersonalOverviewPage() {
  return (
    <div style={{ padding: "36px 44px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "#111827" }}>个人概览</h1>
      <p style={{ margin: "0 0 28px", fontSize: 14, color: "#6b7280" }}>欢迎回来，以下是您的近期使用摘要。</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginBottom: 28 }}>
        {[
          { label: "历史对话", value: "6", sub: "本月新增 3 条", color: "#1a5bc6" },
          { label: "ODI 项目", value: "3", sub: "1 个进行中", color: "#6d5bd0" },
          { label: "我的收藏", value: "1", sub: "政策文件收藏", color: "#f59e0b" },
        ].map(c => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edf5", padding: "22px 24px" }}>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, marginBottom: 4 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edf5", padding: "22px 24px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#111827" }}>近期动态</h3>
        {[
          { text: "完成「越南新设智能装备生产基地项目」发改委材料校验", time: "今天 14:32", dot: "#6d5bd0" },
          { text: "上传境外投资项目备案表", time: "今天 11:20", dot: "#1a5bc6" },
          { text: "咨询 ODI 备案材料要求", time: "昨天 16:45", dot: "#9ca3af" },
          { text: "创建「新加坡研发中心项目」", time: "2026年7月20日", dot: "#16a34a" },
        ].map((item, i, arr) => (
          <div key={i} style={{ display: "flex", gap: 12, paddingBottom: i < arr.length - 1 ? 14 : 0, marginBottom: i < arr.length - 1 ? 14 : 0, borderBottom: i < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.dot, flexShrink: 0, marginTop: 4 }} />
            <div>
              <div style={{ fontSize: 13, color: "#374151" }}>{item.text}</div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{item.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AccountPage() {
  return (
    <div style={{ padding: "36px 44px", maxWidth: 700, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 28px", fontSize: 22, fontWeight: 800, color: "#111827" }}>账号信息</h1>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edf5", overflow: "hidden" }}>
        {[
          { label: "用户名", value: "企业用户 001" },
          { label: "注册邮箱", value: "user@example.com" },
          { label: "手机号", value: "138****8888" },
          { label: "企业名称", value: "XX（集团）有限公司" },
          { label: "注册时间", value: "2026年1月15日" },
        ].map((row, i, arr) => (
          <div key={row.label} style={{ display: "flex", alignItems: "center", padding: "16px 24px", borderBottom: i < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>
            <div style={{ width: 120, fontSize: 13, color: "#9ca3af" }}>{row.label}</div>
            <div style={{ flex: 1, fontSize: 14, color: "#111827" }}>{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GridIcon() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/></svg>;
}
function ChatIcon() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M2 4a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H7l-4 3V4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>;
}
function StarIcon() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 2l2.4 4.9 5.4.78-3.9 3.8.92 5.3L10 14.2l-4.82 2.58.92-5.3-3.9-3.8 5.4-.78L10 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>;
}
function FolderIcon() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M2 6a2 2 0 012-2h3.5L9 6h7a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>;
}
function UserIcon() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.6"/><path d="M3 18c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
}
