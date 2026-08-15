// 登录页 —— 照「用户登陆界面.png」:全屏渐变蓝背景(浅蓝→#1890FF)+底部城市剪影,
// 居中白色卡片:欢迎登录 + 返回 / 手机号 / 短信验证码(自动填 1234) / 登录 / 协议勾选 / 一网通办。
// POC 红线:手机号 + 验证码(自动填)即登录成功,不接真实后端;本版不做法人一证通。

import { useState, useEffect, useRef } from "react";
import { phoneToName, type AuthUser } from "../auth/useAuth";

const BLUE = "#1890ff";
const BLUE_DEEP = "#096dd9";
const TITLE_NAVY = "#1f3a8a";

interface Props {
  onLogin: (user: AuthUser) => void;
  onBack: () => void;
}

export function LoginPage({ onLogin, onBack }: Props) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [agree, setAgree] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const sendCode = () => {
    if (!/^\d{11}$/.test(phone)) { alert("请输入 11 位手机号"); return; }
    setCode("1234"); // POC:自动填入演示验证码
    setCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; } return c - 1; });
    }, 1000);
  };

  const canLogin = /^\d{11}$/.test(phone) && code.trim().length > 0 && agree;

  const doLogin = () => {
    if (!/^\d{11}$/.test(phone)) { alert("请输入 11 位手机号"); return; }
    if (!code.trim()) { alert("请输入短信验证码"); return; }
    if (!agree) { alert("请先阅读并同意《用户服务协议》和《隐私政策》"); return; }
    onLogin({ userName: phoneToName(phone), userType: "法人", certStatus: "已认证", phone: phoneToName(phone) });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: `linear-gradient(135deg, #E6F7FF 0%, ${BLUE} 100%)`, fontFamily: '"Microsoft YaHei","PingFang SC",sans-serif', overflow: "hidden" }}>
      {/* 底部城市天际线剪影(低饱和半透明) */}
      <CityScape />

      {/* 居中白色登录卡片 */}
      <div style={{ position: "relative", width: 400, maxWidth: "92%", margin: "0 auto", top: "50%", transform: "translateY(-54%)", background: "#fff", borderRadius: 8, boxShadow: "0 8px 32px rgba(9,64,127,0.18)", padding: "34px 36px 28px" }}>
        {/* 头部:标题 + 返回 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 26 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TITLE_NAVY }}>欢迎登录</h1>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 14, display: "flex", alignItems: "center", gap: 4, padding: 4 }}
            onMouseEnter={e => (e.currentTarget.style.color = "#555")} onMouseLeave={e => (e.currentTarget.style.color = "#999")}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            返回
          </button>
        </div>

        {/* 手机号 */}
        <InputRow icon="phone">
          <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="请输入手机号" type="tel" maxLength={11}
            style={inputStyle} />
        </InputRow>

        {/* 验证码 + 获取按钮 */}
        <InputRow icon="shield" style={{ marginBottom: 4 }}>
          <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} placeholder="请输入短信验证码" type="tel" maxLength={6}
            style={{ ...inputStyle, border: "none", padding: 0, flex: 1 }} />
          <button onClick={sendCode} disabled={countdown > 0}
            style={{ background: "none", border: "none", cursor: countdown > 0 ? "default" : "pointer", color: countdown > 0 ? "#bbb" : BLUE, fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", padding: "4px 0 4px 10px" }}>
            {countdown > 0 ? `重新获取(${countdown}s)` : "获取验证码"}
          </button>
        </InputRow>

        {/* 登录按钮(未勾协议置灰) */}
        <button onClick={doLogin} disabled={!canLogin}
          style={{ width: "100%", height: 46, marginTop: 22, border: "none", borderRadius: 6, background: canLogin ? BLUE : "#b4d6f5", color: "#fff", fontSize: 16, fontWeight: 700, letterSpacing: 6, cursor: canLogin ? "pointer" : "default", transition: "background .15s" }}
          onMouseEnter={e => { if (canLogin) e.currentTarget.style.background = BLUE_DEEP; }} onMouseLeave={e => { if (canLogin) e.currentTarget.style.background = BLUE; }}>
          登　录
        </button>

        {/* 协议勾选 */}
        <div style={{ marginTop: 14, display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#666", lineHeight: 1.6, cursor: "pointer", userSelect: "none" }} onClick={() => setAgree(v => !v)}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${agree ? BLUE : "#d9d9d9"}`, background: agree ? BLUE : "#fff", flexShrink: 0, marginTop: 2 }}>
            {agree && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6.5l2.6 2.6L10 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </span>
          <span>我已阅读并同意<span style={{ color: BLUE }}>《用户服务协议》</span>和<span style={{ color: BLUE }}>《隐私政策》</span></span>
        </div>

        {/* 其他登录方式 */}
        <div style={{ marginTop: 26, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#999", marginBottom: 10 }}>其他登录方式</div>
          <button onClick={() => alert("一网通办登录 POC 暂未开通，请使用手机号验证码登录")}
            style={{ width: "100%", height: 42, border: "none", borderRadius: 6, background: "#f0f0f0", color: BLUE, fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "background .15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#e6f7ff")} onMouseLeave={e => (e.currentTarget.style.background = "#f0f0f0")}>一网通办登录</button>
        </div>

        {/* POC 演示提示 */}
        <p style={{ margin: "18px 0 0", fontSize: 11.5, color: "#c3cdd9", textAlign: "center" }}>POC 演示：任意 11 位手机号 + 验证码（点击「获取验证码」自动填 1234）</p>
      </div>
    </div>
  );
}

// ─── 输入行(左图标 + 内容) ───────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", height: 42, border: "1px solid #e5e5e5", borderRadius: 4,
  padding: "0 14px", fontSize: 14, color: "#333", outline: "none", background: "#fff",
};

function InputRow({ icon, children, style }: { icon: "phone" | "shield"; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      <div style={{ display: "flex", alignItems: "center", border: "1px solid #e5e5e5", borderRadius: 4, padding: "0 14px", background: "#fff", transition: "border-color .15s", height: 42 }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = BLUE)} onBlurCapture={e => (e.currentTarget.style.borderColor = "#e5e5e5")}>
        <span style={{ color: "#999", marginRight: 10, display: "inline-flex", flexShrink: 0 }}>
          {icon === "phone" ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="4.5" y="1.5" width="7" height="13" rx="1.6" stroke="currentColor" strokeWidth="1.4" /><path d="M7 11.8h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l5 2v4c0 3.2-2.1 5.6-5 7-2.9-1.4-5-3.8-5-7v-4l5-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M5.8 8l1.6 1.6L10.4 6.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </span>
        {children}
      </div>
    </div>
  );
}

// ─── 底部城市天际线剪影(纯 CSS/SVG,无外部图) ─────────────────────────────
function CityScape() {
  // 一排不同高低的楼宇矩形 + 窗点,两个层次(远/近),贴页面底部
  const far = "rgba(9,64,127,0.10)";
  const near = "rgba(9,64,127,0.16)";
  return (
    <svg style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: 220, pointerEvents: "none" }} viewBox="0 0 1200 220" preserveAspectRatio="none">
      {/* 远景楼群 */}
      <g fill={far}>
        {[60, 130, 200, 300, 380, 470, 560, 660, 730, 830, 920, 1010, 1090, 1150].map((x, i) => {
          const h = 70 + ((i * 37) % 85);
          return <rect key={"f" + x} x={x} y={220 - h} width={44 + ((i * 13) % 22)} height={h} rx={2} />;
        })}
      </g>
      {/* 近景楼群(更高,带窗点) */}
      <g fill={near}>
        {[20, 110, 230, 330, 430, 540, 640, 760, 860, 960, 1060, 1140].map((x, i) => {
          const h = 100 + ((i * 53) % 90);
          const w = 52 + ((i * 17) % 26);
          return (
            <g key={"n" + x}>
              <rect x={x} y={220 - h} width={w} height={h} rx={2} />
              {Array.from({ length: Math.floor(h / 26) }).map((_, r) =>
                Array.from({ length: Math.floor(w / 18) }).map((_, c) => (
                  <rect key={`${x}-${r}-${c}`} x={x + 8 + c * 18} y={220 - h + 12 + r * 26} width={6} height={9} fill="rgba(255,255,255,0.5)" />
                ))
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
