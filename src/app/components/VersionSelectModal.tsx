// 版本选择弹窗 —— 「新建合规自查」时弹出,登录/匿名用户同布局。
// 照「匿名用户弹窗界面.png」「登陆用户弹窗界面.png」:
//   标题「企业合规自查——选择版本」+ 两信息卡(速测★推荐 / 完整版,无内嵌按钮)
//   + 底部双按钮(左「去速测」次要 / 右「去完整版 →」主要)。
//   匿名版多一行登录引导文案 + 「立即登录」文字按钮。

import { createPortal } from "react-dom";
import { useEscapeClose } from "./useEscapeClose";

const BLUE = "#1890ff";
const PURPLE = "#722ed1";

interface Props {
  variant: "anonymous" | "loggedIn";
  onClose: () => void;
  onQuickTest: () => void; // 去速测
  onFull: () => void;      // 去完整版(匿名也直接开始)
  onLogin?: () => void;    // 匿名版「立即登录」
}

export function VersionSelectModal({ variant, onClose, onQuickTest, onFull, onLogin }: Props) {
  const isAnon = variant === "anonymous";
  useEscapeClose(onClose);

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10020, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: '"Microsoft YaHei","PingFang SC",sans-serif' }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", width: 680, maxWidth: "94%", background: "#fff", borderRadius: 14, boxShadow: "0 16px 48px rgba(0,0,0,0.22)", padding: "32px 36px 26px" }}>
        <button onClick={onClose} aria-label="关闭" style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 22, lineHeight: 1, padding: 4 }} onMouseEnter={e => (e.currentTarget.style.color = "#1f2937")} onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}>×</button>

        {/* 标题(照 PNG) */}
        <h2 style={{ margin: "0 0 24px", fontSize: 21, fontWeight: 700, color: "#1f2937", textAlign: "center" }}>企业合规自查——选择版本</h2>

        {/* 两信息卡(照 PNG:标题+角标+时长/要求+描述,无按钮) */}
        <div style={{ display: "flex", gap: 20 }}>
          <InfoCard title="速测版本" badge={{ text: "★ 推荐", bg: BLUE }} icon="bolt" color={BLUE}
            lines={["无需登录 · 约 10-15 分钟", "含基础判档与风险提示，快速了解合规风险"]} />
          <InfoCard title="完整版本" icon="lock" color={PURPLE}
            lines={["约 40-60 分钟", "支持上传材料与深度分析，适合正式准备申报材料"]} />
        </div>

        {/* 底部双按钮(照 PNG:左次要/右主要) */}
        <div style={{ display: "flex", gap: 14, marginTop: 26 }}>
          <button onClick={onQuickTest}
            style={{ flex: 1, height: 44, borderRadius: 9, background: "#fff", color: BLUE, border: `1.5px solid ${BLUE}`, fontSize: 14.5, fontWeight: 600, cursor: "pointer", transition: "background .15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f0f7ff")} onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>去速测</button>
          <button onClick={onFull}
            style={{ flex: 1, height: 44, borderRadius: 9, background: BLUE, color: "#fff", border: "none", fontSize: 14.5, fontWeight: 600, cursor: "pointer", transition: "opacity .15s" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")} onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>去完整版 →</button>
        </div>

        {/* 匿名版:登录引导文案 + 立即登录(照 匿名用户弹窗界面.png) */}
        {isAnon && (
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 12.5, color: "#94a3b8", lineHeight: 1.7 }}>
              未登录也可直接开始自查；登录后可保存自查进度、留存自查报告并查看历史自查记录。
            </p>
            <button onClick={onLogin}
              style={{ marginTop: 8, background: "none", border: "none", color: BLUE, fontSize: 13.5, fontWeight: 600, cursor: "pointer", padding: "4px 12px" }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}>立即登录</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// 信息卡(照 PNG:纯展示,按钮统一在弹窗底部)
function InfoCard({ title, badge, icon, color, lines }: { title: string; badge?: { text: string; bg: string }; icon: "bolt" | "lock"; color: string; lines: string[] }) {
  return (
    <div style={{ position: "relative", flex: 1, border: "1px solid #eef2f7", borderRadius: 12, padding: "24px 20px 20px", display: "flex", flexDirection: "column", textAlign: "center", background: "#fcfdff" }}>
      {badge && (
        <span style={{ position: "absolute", top: 12, left: 12, background: badge.bg, color: "#fff", fontSize: 11, fontWeight: 600, borderRadius: 10, padding: "2px 9px" }}>{badge.text}</span>
      )}
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
        {icon === "bolt" ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="#fff" /></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" fill="#fff" /><path d="M8 11V8a4 4 0 018 0v3" stroke="#fff" strokeWidth="2" fill="none" /></svg>
        )}
      </div>
      <div style={{ fontSize: 16.5, fontWeight: 700, color: "#1f2937", marginBottom: 10 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: BLUE, fontWeight: 600, marginBottom: 8 }}>{lines[0]}</div>
      <p style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.7, margin: 0 }}>{lines[1]}</p>
    </div>
  );
}
