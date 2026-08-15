import type { AppFrame, AttachedFile } from "../App";
import { OdiWorkbenchPanelContent } from "./OdiWorkbenchPanelContent";

interface Props {
  frame: AppFrame;
  goTo: (f: AppFrame) => void;
  showOdiWorkbench: boolean;
  onShowOdiWorkbench: () => void;
  onHideOdiWorkbench: () => void;
  investMethod: string;
  entityType: string;
  destination: string;
  amount: string;
  preInfoConfirmed: boolean;
  attachedFiles: AttachedFile[];
  materialGenerationStarted: boolean;
}

const HISTORY = [
  { text: "ODI备案需要提交哪些材料？", frame: "odi-qa" as AppFrame },
  { text: "个人境外直接投资是否需要备案...", frame: "welcome" as AppFrame },
  { text: "境外投资备案的办理时限是多久？", frame: "welcome" as AppFrame },
];

const WORKBENCH_FRAMES: AppFrame[] = ["odi-preinfo", "odi-materials", "odi-project", "odi-prereview"];

export function SelfServicePanel({
  frame,
  goTo,
  showOdiWorkbench,
  onShowOdiWorkbench,
  onHideOdiWorkbench,
  investMethod,
  entityType,
  destination,
  amount,
  preInfoConfirmed,
  attachedFiles,
  materialGenerationStarted
}: Props) {
  const isOdiActive = frame !== "welcome";
  const isWorkbench = WORKBENCH_FRAMES.includes(frame);

  // 如果显示ODI工作台，渲染工作台内容
  if (showOdiWorkbench) {
    return (
      <div style={{
        width: 400,
        height: "100%",
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 2px 12px rgba(26,64,140,0.10)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        border: "1px solid #e2eaf5",
      }}>
        <OdiWorkbenchPanelContent
          frame={frame}
          onClose={onHideOdiWorkbench}
          investMethod={investMethod}
          entityType={entityType}
          destination={destination}
          amount={amount}
          preInfoConfirmed={preInfoConfirmed}
          attachedFiles={attachedFiles}
          materialGenerationStarted={materialGenerationStarted}
        />
      </div>
    );
  }

  return (
    <div style={{
      width: 272,
      height: "100%",
      background: "#fff",
      borderRadius: 12,
      boxShadow: "0 2px 12px rgba(26,64,140,0.10)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      border: "1px solid #e2eaf5",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 12px", borderBottom: "1px solid #eef3fb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="2" width="6" height="6" rx="1.5" fill="#1a5bc6" />
            <rect x="10" y="2" width="6" height="6" rx="1.5" fill="#1a5bc6" />
            <rect x="2" y="10" width="6" height="6" rx="1.5" fill="#1a5bc6" />
            <rect x="10" y="10" width="6" height="6" rx="1.5" fill="#1a5bc6" />
          </svg>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#1a2744" }}>自助服务</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="4" width="12" height="1.5" rx="0.75" fill="#8a9bbf" />
          <rect x="2" y="7.25" width="12" height="1.5" rx="0.75" fill="#8a9bbf" />
          <rect x="2" y="10.5" width="12" height="1.5" rx="0.75" fill="#8a9bbf" />
        </svg>
      </div>

      {/* ODI任务状态横幅 - 只在workbench状态时显示 */}
      {isWorkbench && (
        <div style={{
          padding: "12px 16px",
          background: "#f0f6ff",
          borderBottom: "1px solid #dbeafe",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#1a5bc6",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a5bc6" }}>ODI备案任务进行中</span>
          </div>
          <button
            onClick={onShowOdiWorkbench}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              color: "#1a5bc6",
              fontWeight: 500,
            }}
          >
            查看工作台
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2l4 4-4 4" stroke="#1a5bc6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, borderBottom: "1px solid #eef3fb" }}>
        {[
          { label: "新对话", icon: <GreenPlusIcon />, onClick: () => goTo("welcome") },
          { label: "我的收藏", icon: <YellowStarIcon />, onClick: () => {} },
          { label: "历史记录", icon: <BlueClockIcon />, onClick: () => {} },
        ].map((item, i) => (
          <button
            key={i}
            onClick={item.onClick}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              padding: "14px 8px", background: "none", border: "none", cursor: "pointer",
              borderRight: i < 2 ? "1px solid #eef3fb" : "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f9ff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: i === 0 ? "#e8fef2" : i === 1 ? "#fffbeb" : "#e8f0fe" }}>
              {item.icon}
            </div>
            <span style={{ fontSize: 12, color: i === 2 ? "#1a5bc6" : "#3a4f72", fontWeight: i === 2 ? 600 : 400 }}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* History list */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {HISTORY.map((item, i) => {
          const active = i === 0 && isOdiActive;
          return (
            <button
              key={i}
              onClick={() => goTo(item.frame)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "11px 16px",
                background: active ? "#eef4fe" : "none",
                borderTopWidth: 0, borderTopStyle: "solid", borderTopColor: "transparent",
                borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
                borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: active ? "#1a5bc6" : "transparent",
                borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#eef3fb",
                textAlign: "left", cursor: "pointer",
              }}
            >
              <span style={{
                fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                flex: 1, color: active ? "#1a5bc6" : "#3a4f72", fontWeight: active ? 600 : 400,
              }}>
                {item.text}
              </span>
              <span style={{ fontSize: 16, color: "#aab8cf", paddingLeft: 8, flexShrink: 0 }}>···</span>
            </button>
          );
        })}
      </div>

      {/* Show more */}
      
    </div>
  );
}

function GreenPlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="#22c55e" strokeWidth="1.8" />
      <path d="M10 6.5v7M6.5 10h7" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function YellowStarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="#f59e0b">
      <path d="M10 3l1.8 4.5H16L12.4 10l1.4 4.5L10 12l-3.8 2.5L7.6 10 4 7.5h4.2L10 3z" />
    </svg>
  );
}

function BlueClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.5" stroke="#1a5bc6" strokeWidth="1.8" />
      <path d="M10 6.5v4l2.5 2" stroke="#1a5bc6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
