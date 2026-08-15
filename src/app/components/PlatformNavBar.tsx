import type { AppFrame } from "../App";

interface Props {
  currentFrame: AppFrame;
  goTo: (f: AppFrame) => void;
  topCollapsed?: boolean;
  onToggleTop?: () => void;
}

const NAV_ITEMS = ["首页", "资讯服务", "办事指南", "金融支持", "专业服务", "培训活动", "一带一路", "境外网点", "安全合规", "项目发布", "留言交流"];

export function PlatformNavBar({ goTo, topCollapsed, onToggleTop }: Props) {
  return (
    <div
      style={{
        height: 56,
        background: "#fff",
        borderBottom: "1px solid #e2eaf5",
        display: "flex",
        alignItems: "stretch",
        padding: "0 20px",
        flexShrink: 0,
        boxShadow: "0 1px 4px rgba(26,64,140,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch", flex: 1, justifyContent: "center" }}>
        {NAV_ITEMS.map((item, i) => {
          const isHome = i === 0;
          const isActive = item === "留言交流";
          return (
            <button
              key={i}
              onClick={() => isHome ? goTo("welcome") : undefined}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "0 16px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                color: isActive ? "#1a5bc6" : "#3a4f72",
                fontWeight: isActive ? 600 : 400,
                borderBottom: isActive ? "3px solid #1a5bc6" : "3px solid transparent",
                transition: "color 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {isHome && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M8 2L2 7v7h4v-4h4v4h4V7L8 2z" fill="#3a4f72" />
                </svg>
              )}
              {item}
            </button>
          );
        })}
        {/* 收放按钮：收起/展开顶部辅助条 + Logo 栏 */}
        <button onClick={onToggleTop} title={topCollapsed ? "展开顶部栏" : "收起顶部栏"}
          style={{ display: "flex", alignItems: "center", gap: 3, padding: "0 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#3a4f72", borderBottom: "3px solid transparent", flexShrink: 0, transition: "color .15s" }}
          onMouseEnter={e => e.currentTarget.style.color = "#1a5bc6"}
          onMouseLeave={e => e.currentTarget.style.color = "#3a4f72"}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ transition: "transform .2s", transform: topCollapsed ? "rotate(0deg)" : "rotate(180deg)" }}>
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
