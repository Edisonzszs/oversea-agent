// 登录页 —— 全屏左右分栏(照「用户登陆界面.png」)。
// 左 60% 品牌宣传区(插画 + slogan + 特性),右 40% 登录表单(手机号登录 / 法人一证通登录 双 tab)。
// POC 红线:手机号 + 任意密码 + 验证码(自动填 1234)即登录成功;法人一证通 mock 直接登录;
// 不接真实后端、不持有真实凭证、不发起网络请求。

import { useState, useRef, useEffect } from "react";
import type { AuthUser } from "../auth/useAuth";
import { phoneToName } from "../auth/useAuth";

interface Props {
  onLogin: (user: AuthUser) => void;
  onBack: () => void;
}

const NAVY = "#3B5099";
const NAVY_DARK = "#28356B";

type Tab = "phone" | "legal";

export function LoginPage({ onLogin, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("phone");
  const [phone, setPhone] = useState("");
  const [pwd, setPwd] = useState("");
  const [code, setCode] = useState("");
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

  const loginByPhone = () => {
    if (!/^\d{11}$/.test(phone)) { alert("请输入 11 位手机号"); return; }
    if (!pwd.trim()) { alert("请输入密码"); return; }
    if (!code.trim()) { alert("请输入验证码"); return; }
    onLogin({ userName: phoneToName(phone), userType: "法人", certStatus: "已认证", phone: phoneToName(phone) });
  };

  const loginByLegal = () => {
    // POC:法人一证通 mock——真实流程需插入 USB Key 走 CA,这里直接登录。
    onLogin({ userName: "上海三一集团", userType: "法人", certStatus: "已认证", orgName: "上海三一集团" });
  };

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", background: "#fff", fontFamily: '"Microsoft YaHei","PingFang SC",sans-serif' }}>
      {/* ── 左 60% 品牌宣传区 ── */}
      <div style={{ flex: "0 0 60%", position: "relative", background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`, color: "#fff", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 7%" }}>
        {/* 装饰:抽象出海/连接图样 */}
        <DecoArt />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <GlobeLogo />
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>出海合规智能体</span>
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.3, margin: "0 0 16px" }}>
            企业境外投资(ODI)<br />合规自查 · 智能伴填
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.82)", lineHeight: 1.8, margin: "0 0 40px", maxWidth: 460 }}>
            上海市企业走出去综合服务平台 · 依托商务部令 2014 年第 3 号、发改委令第 11 号、国务院令第 837 号等法源,为企业境外投资提供合规自查与材料准备辅导。
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Feature text="匿名速测 · 10–15 分钟初判合规档位" />
            <Feature text="登录完整自查 · 文件齐备度计分 + 报告保存" />
            <Feature text="小海伴填 · 法规依据可溯源,口径要点非逐字条文" />
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 28, left: "7%", right: "7%", zIndex: 2, fontSize: 12, color: "rgba(255,255,255,0.5)", display: "flex", justifyContent: "space-between" }}>
          <span>上海市商务委员会 · 中国(上海)自由贸易试验区</span>
          <span>© 2026 出海合规智能体</span>
        </div>
      </div>

      {/* ── 右 40% 登录表单区 ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 8%", background: "#F7F9FC" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 13, padding: "0 0 18px", display: "flex", alignItems: "center", gap: 6 }}>← 返回首页</button>

          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: "0 0 6px" }}>欢迎登录</h2>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 24px" }}>登录后可使用完整版自查、保存进度与生成报告</p>

          {/* 双 tab */}
          <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: 24 }}>
            {([["phone", "手机号登录"], ["legal", "法人一证通登录"]] as [Tab, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "12px 0", background: "none", border: "none", borderBottom: tab === k ? `2px solid ${NAVY}` : "2px solid transparent", color: tab === k ? NAVY : "#94a3b8", fontSize: 14.5, fontWeight: tab === k ? 600 : 400, cursor: "pointer", marginBottom: -1 }}>
                {label}
              </button>
            ))}
          </div>

          {tab === "phone" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field icon="phone" value={phone} onChange={setPhone} placeholder="请输入手机号" maxLength={11} type="tel" />
              <Field icon="pwd" value={pwd} onChange={setPwd} placeholder="请输入密码" type="password" />
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field icon="code" value={code} onChange={setCode} placeholder="请输入验证码" type="tel" maxLength={6} />
                </div>
                <button onClick={sendCode} disabled={countdown > 0} style={{ flexShrink: 0, width: 112, border: `1px solid ${NAVY}`, background: countdown > 0 ? "#f1f5f9" : "#fff", color: NAVY, borderRadius: 8, fontSize: 12.5, cursor: countdown > 0 ? "not-allowed" : "pointer", fontWeight: 500 }}>
                  {countdown > 0 ? `${countdown}s 后重发` : "获取验证码"}
                </button>
              </div>
              <button onClick={loginByPhone} style={{ marginTop: 4, height: 46, border: "none", borderRadius: 8, background: NAVY, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>登录</button>
              <p style={{ fontSize: 11.5, color: "#cbd5e1", textAlign: "center", margin: "4px 0 0" }}>POC 演示:任意手机号 + 密码 + 验证码(自动填 1234)</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#FFF9EC", border: "1px solid #EAD9A8", borderLeft: `4px solid #B07500`, borderRadius: 8, padding: "12px 14px", fontSize: 12.5, color: "#6B5417", lineHeight: 1.7 }}>
                法人一证通登录需插入 USB Key(上海 CA),由走出去平台统一身份认证。本 POC 演示直接以已认证法人身份登录。
              </div>
              <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
                <UsbKeyArt />
              </div>
              <button onClick={loginByLegal} style={{ height: 46, border: "none", borderRadius: 8, background: NAVY, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>使用法人一证通登录</button>
            </div>
          )}

          <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", margin: "26px 0 0" }}>
            还没有账号?<span style={{ color: NAVY, fontWeight: 600, cursor: "pointer" }} onClick={() => setTab("phone")}>立即注册</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── 子组件 ──────────────────────────────────────────────────────────────────

function Feature({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.16)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-6.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <span style={{ fontSize: 15, color: "rgba(255,255,255,0.92)" }}>{text}</span>
    </div>
  );
}

function Field({ icon, value, onChange, placeholder, type = "text", maxLength, }: { icon: "phone" | "pwd" | "code"; value: string; onChange: (v: string) => void; placeholder: string; type?: string; maxLength?: number; }) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: 46, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", padding: "0 14px", gap: 10, transition: "border-color .15s" }} onFocus={e => (e.currentTarget.style.borderColor = NAVY)} onBlur={e => (e.currentTarget.style.borderColor = "#e2e8f0")}>
      <span style={{ color: "#94a3b8", display: "inline-flex" }}>
        {icon === "phone" && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="4.5" y="2" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><circle cx="8" cy="11.5" r="0.6" fill="currentColor" /></svg>}
        {icon === "pwd" && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.4" /></svg>}
        {icon === "code" && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="3" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>}
      </span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} maxLength={maxLength} style={{ flex: 1, border: "none", outline: "none", fontSize: 14, color: "#1f2937", background: "transparent", height: "100%" }} />
    </div>
  );
}

function GlobeLogo() {
  return (
    <span style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.14)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="1.6" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" stroke="#fff" strokeWidth="1.6" /></svg>
    </span>
  );
}

function DecoArt() {
  // 抽象出海连接图样:同心圆 + 经纬 + 节点。
  return (
    <svg style={{ position: "absolute", right: -80, top: "50%", transform: "translateY(-50%)", opacity: 0.16, zIndex: 1 }} width="520" height="520" viewBox="0 0 520 520" fill="none">
      <circle cx="260" cy="260" r="250" stroke="#fff" strokeWidth="1" />
      <circle cx="260" cy="260" r="190" stroke="#fff" strokeWidth="1" />
      <circle cx="260" cy="260" r="130" stroke="#fff" strokeWidth="1" />
      <circle cx="260" cy="260" r="70" stroke="#fff" strokeWidth="1" />
      <path d="M10 260h500M260 10v500" stroke="#fff" strokeWidth="1" />
      <path d="M85 85l350 350M435 85L85 435" stroke="#fff" strokeWidth="0.8" />
      {[[150, 120], [380, 180], [200, 360], [400, 380], [120, 280]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill="#fff" />)}
    </svg>
  );
}

function UsbKeyArt() {
  return (
    <svg width="88" height="60" viewBox="0 0 88 60" fill="none">
      <rect x="2" y="20" width="54" height="20" rx="3" fill="#3B5099" />
      <rect x="56" y="24" width="26" height="12" rx="1" fill="#94a3b8" />
      <rect x="82" y="27" width="4" height="6" fill="#64748b" />
      <circle cx="16" cy="30" r="3" fill="#fff" opacity="0.8" />
      <rect x="34" y="10" width="14" height="10" rx="2" fill="#1E7B4D" />
    </svg>
  );
}
