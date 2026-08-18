import logoImg from "../../imports/____25.png";

// 全站登录态接口 — 由走出去平台统一提供，此处仅预留展示
export interface PlatformAuthState {
  isLoggedIn: boolean;
  userName?: string;
  userType?: "个人" | "法人";
  certStatus?: "已认证" | "未认证";
}

interface Props {
  authState?: PlatformAuthState;
  onLogin?: () => void;
  onLogout?: () => void;
}

export function PlatformTopBar({ authState, onLogin, onLogout }: Props) {
  const logged = authState?.isLoggedIn ?? false;

  return (
    <>
      {/* 第一栏：顶部辅助条 */}
      <div style={{ height: 32, background: "#3B5099", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ color: "rgba(255,255,255,0.4)", marginRight: 12 }}>|</span>
          <button style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: "0 12px" }}>繁体</button>
          <button style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: "0 12px" }}>无障碍</button>
        </div>
      </div>

      {/* 第二栏：Logo + 全站登录状态（平台公共能力） */}
      <div style={{ height: 80, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0, borderBottom: "1px solid #e8e8e8" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <img src={logoImg} alt="上海市企业出海综合服务平台" style={{ height: 48, objectFit: "contain", display: "block" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {logged ? (
            /* 已登录：显示平台提供的身份信息 */
            <button onClick={onLogout} title="退出登录(POC)" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#374151", fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: "6px 4px" }}>
              {authState?.userName ?? "用户"}
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M3 5.5l4 4 4-4" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            /* 未登录：调用全站统一登录 */
            <>
              <button onClick={onLogin} style={{ color: "#333", fontSize: 14, background: "none", border: "none", cursor: "pointer", padding: "8px 16px" }}>登录</button>
              <button onClick={onLogin} style={{ color: "#fff", fontSize: 14, background: "#3B5099", border: "none", borderRadius: 4, cursor: "pointer", padding: "8px 20px", fontWeight: 500 }}>注册</button>
            </>
          )}
          <button style={{ color: "#666", fontSize: 18, background: "none", border: "none", cursor: "pointer", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6" stroke="#666" strokeWidth="1.5"/>
              <path d="M13.5 13.5L17 17" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
