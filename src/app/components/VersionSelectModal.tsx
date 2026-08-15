// 版本选择弹窗 —— 进入「ODI 合规自查专家」时,按登录态展示两套文案。
// 照「匿名用户弹窗界面.png」「登陆用户弹窗界面.png」。
//   variant="anonymous":速测(★推荐·无需登录·去速测)/ 完整(需登录·去登录)
//   variant="loggedIn" :速测(10-15 分钟·去速测)/ 完整(40-60 分钟·支持上传/保存·去完整版)

import { createPortal } from "react-dom";

const BLUE = "#1890ff";
const PURPLE = "#722ed1";

interface Props {
  variant: "anonymous" | "loggedIn";
  onClose: () => void;
  onQuickTest: () => void; // 去速测
  onFull: () => void;      // 匿名:去登录;登录:去完整版
}

export function VersionSelectModal({ variant, onClose, onQuickTest, onFull }: Props) {
  const isAnon = variant === "anonymous";

  const quick = {
    title: "速测版本",
    sub: isAnon ? "无需登录" : "10-15 分钟",
    desc: isAnon
      ? "适合快速了解企业 ODI 合规情况,无需登录即可体验。"
      : "适合快速了解企业 ODI 合规情况,覆盖核心自查事项,可快速生成初步自查结果。",
    btn: "去速测",
    color: BLUE,
    recommend: isAnon, // 匿名版速测标★推荐
  };
  const full = {
    title: "完整版本",
    sub: isAnon ? "需登录" : "40-60 分钟",
    desc: isAnon
      ? "适合开展更完整的企业 ODI 合规自查,登录后可使用全部流程。"
      : "适合开展更完整的企业 ODI 合规自查,支持上传材料、保存填报进度,并生成更完整的自查报告。",
    btn: isAnon ? "去登录" : "去完整版",
    color: PURPLE,
  };
  const lead = isAnon
    ? "您即将进入企业 ODI 合规自查流程,请选择使用版本。"
    : "您已登录平台账号,请根据当前需求选择使用版本。";

  // 登录版照「登陆用户弹窗界面.png」:标题「企业合规自查——选择版本」+ 两信息卡(无内嵌按钮)
  // + 底部双按钮(左「去速测」次要/右「去完整版→」主要) + 底行提示。
  // 匿名版沿用旧布局(卡片各自带按钮,含「去登录」入口)。
  if (!isAnon) {
    return createPortal(
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10020, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: '"Microsoft YaHei","PingFang SC",sans-serif' }}>
        <div onClick={e => e.stopPropagation()} style={{ position: "relative", width: 680, maxWidth: "94%", background: "#fff", borderRadius: 14, boxShadow: "0 16px 48px rgba(0,0,0,0.22)", padding: "32px 36px 26px" }}>
          <button onClick={onClose} aria-label="关闭" style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 22, lineHeight: 1, padding: 4 }} onMouseEnter={e => (e.currentTarget.style.color = "#1f2937")} onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}>×</button>

          {/* 标题(照 PNG) */}
          <h2 style={{ margin: "0 0 24px", fontSize: 21, fontWeight: 700, color: "#1f2937", textAlign: "center" }}>企业合规自查——选择版本</h2>

          {/* 两信息卡(照 PNG:标题+推荐标+时长/要求+描述,无按钮) */}
          <div style={{ display: "flex", gap: 20 }}>
            <InfoCard title="速测版本" badge={{ text: "★ 推荐", bg: BLUE }} icon="bolt" color={BLUE}
              lines={["无需登录 · 约 10-15 分钟", "含基础判档与风险提示，快速了解合规风险"]} />
            <InfoCard title="完整版本" icon="lock" color={PURPLE}
              lines={["需登录 · 约 40-60 分钟", "支持上传材料与深度分析，适合正式准备申报材料"]} />
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

          {/* 底行提示(照 PNG) */}
          <p style={{ margin: "16px 0 0", fontSize: 12.5, color: "#94a3b8", textAlign: "center" }}>已有账号？登录可保存进度与报告</p>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10020, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: '"Microsoft YaHei","PingFang SC",sans-serif' }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", width: 680, maxWidth: "94%", background: "#fff", borderRadius: 14, boxShadow: "0 16px 48px rgba(0,0,0,0.22)", padding: "32px 36px 30px" }}>
        {/* 关闭 */}
        <button onClick={onClose} aria-label="关闭" style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 22, lineHeight: 1, padding: 4 }} onMouseEnter={e => (e.currentTarget.style.color = "#1f2937")} onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}>×</button>

        {/* 标题 + 说明 */}
        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "#1f2937", textAlign: "center" }}>进入 ODI 合规自查专家</h2>
        <p style={{ margin: "0 0 28px", fontSize: 14, color: "#64748b", textAlign: "center" }}>{lead}</p>

        {/* 两卡片 */}
        <div style={{ display: "flex", gap: 20 }}>
          <VersionCard {...quick} icon="bolt" onClick={onQuickTest} />
          <VersionCard title={full.title} sub={full.sub} desc={full.desc} btn={full.btn} color={full.color} icon="lock" recommend={false} onClick={onFull} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

// 登录版信息卡(照 PNG:纯展示,按钮统一在弹窗底部)
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

interface CardProps {
  title: string;
  sub: string;
  desc: string;
  btn: string;
  color: string;
  icon: "bolt" | "lock";
  recommend?: boolean;
  onClick: () => void;
}

function VersionCard({ title, sub, desc, btn, color, icon, recommend, onClick }: CardProps) {
  return (
    <div style={{ position: "relative", flex: 1, border: "1px solid #eef2f7", borderRadius: 12, padding: "26px 22px 22px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", background: "#fcfdff" }}>
      {recommend && (
        <span style={{ position: "absolute", top: 12, left: 12, background: color, color: "#fff", fontSize: 11, fontWeight: 600, borderRadius: 10, padding: "2px 9px" }}>★ 推荐</span>
      )}
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        {icon === "bolt" ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="#fff" /></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" fill="#fff" /><path d="M8 11V8a4 4 0 018 0v3" stroke="#fff" strokeWidth="2" fill="none" /></svg>
        )}
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "#94a3b8", marginBottom: 10 }}>{sub}</div>
      <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7, margin: "0 0 22px", minHeight: 66 }}>{desc}</p>
      <button onClick={onClick} style={{ marginTop: "auto", width: "100%", height: 42, border: "none", borderRadius: 8, background: color, color: "#fff", fontSize: 14.5, fontWeight: 600, cursor: "pointer", transition: "opacity .15s" }} onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")} onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>{btn}</button>
    </div>
  );
}
