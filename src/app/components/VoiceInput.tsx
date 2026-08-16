// 语音输入 + 发送按钮组件 —— 使用浏览器 Web Speech API，支持中文识别。
// 视觉对齐 ChatGPT / 豆包：
//   MicButton  —— 静态麦克风;录音中变红 + 双层脉冲扩散环 + 旁边弹出 5 根跳动声纹柱("正在聆听…")
//   SendButton —— 禁用(浅灰)/可发送(蓝渐变+hover 抬升+按压回缩)/loading(旋转 spinner) 三态
// useVoiceInput 升级 interimResults:中间识别文本实时回调(interim),落定后 onResult。

import { useState, useRef, useCallback, useEffect } from "react";
import gsap from "gsap";
import { DUR, EASE } from "../motion/tokens";

// Web Speech API 类型声明
interface SpeechRecognitionType {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionType) | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function useVoiceInput(onResult: (text: string) => void, onInterim?: (text: string) => void) {
  const [listening, setListening] = useState(false);
  // supported 用惰性初始化(渲染期一次性探测,SSR 安全):同组件多次渲染不重复 setState
  const [supported, setSupported] = useState(() => getSpeechRecognition() != null);
  const recogRef = useRef<SpeechRecognitionType | null>(null);
  const wantListenRef = useRef(false); // 用户意图仍在录音(onend 自动重启用)
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  onResultRef.current = onResult;
  onInterimRef.current = onInterim;

  // 初始化(挂载后建识别器)
  useEffect(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;
    const r = new SR();
    r.lang = "zh-CN";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res?.[0]?.transcript ?? "";
        if (res.isFinal) { if (t) onResultRef.current(t); }
        else interim += t;
      }
      onInterimRef.current?.(interim);
    };
    r.onend = () => {
      // Chrome 静音超时会自动停:用户还在录音则重启
      if (wantListenRef.current) { try { r.start(); } catch { setListening(false); } }
      else setListening(false);
    };
    r.onerror = () => { wantListenRef.current = false; setListening(false); onInterimRef.current?.(""); };
    recogRef.current = r;
    return () => { wantListenRef.current = false; try { r.stop(); } catch {} recogRef.current = null; };
  }, []);

  const toggle = useCallback(() => {
    if (!recogRef.current) return;
    if (listening) {
      wantListenRef.current = false;
      recogRef.current.stop();
      setListening(false);
      onInterimRef.current?.("");
    } else {
      wantListenRef.current = true;
      try { recogRef.current.start(); setListening(true); } catch {}
    }
  }, [listening]);

  return { listening, supported, toggle };
}

// ─── 声纹柱(录音中的跳动条;Web Speech 无音量回调,用错峰 CSS 动画模拟) ─────────
function VoiceBars({ scale = 1 }: { scale?: number }) {
  // 5 根柱,每根不同 duration/delay 制造自然错落;reduced-motion 时 CSS 里会停
  const bars = [
    { d: 0.9, delay: 0 },
    { d: 0.7, delay: 0.15 },
    { d: 1.1, delay: 0.05 },
    { d: 0.8, delay: 0.25 },
    { d: 1.0, delay: 0.1 },
  ];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 * scale, height: 18 * scale }}>
      <style>{`
        @keyframes voiceBar{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
        @media (prefers-reduced-motion: reduce){.vb{animation:none !important;transform:scaleY(.6)}}
      `}</style>
      {bars.map((b, i) => (
        <span key={i} className="vb"
          style={{ width: 3 * scale, height: 16 * scale, borderRadius: 2, background: "#dc2626", transformOrigin: "center", animation: `voiceBar ${b.d}s ease-in-out ${b.delay}s infinite` }} />
      ))}
    </span>
  );
}

// ─── 麦克风按钮(md=34px 首页 / sm=22px 伴填,热区已保证) ──────────────────────
// supported=false 时仍渲染按钮(探测可能因双模块实例/环境差异失灵),点击时提示不支持。
export function MicButton({ listening, supported, onClick, size = "md" as "md" | "sm" }: {
  listening: boolean; supported: boolean; onClick: () => void; size?: "md" | "sm";
}) {
  const box = size === "sm" ? 22 : 34;
  const icon = size === "sm" ? 11 : 16;
  const fire = () => { if (!supported) { alert("当前浏览器不支持语音输入，请使用 Chrome/Edge"); return; } onClick(); };

  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: size === "sm" ? 5 : 8, flexShrink: 0 }}>
      <button onClick={fire} title={listening ? "停止语音输入" : "语音输入"} aria-label={listening ? "停止语音输入" : "语音输入"}
        style={{
          position: "relative", width: box, height: box, borderRadius: "50%", border: "none",
          background: listening ? "#dc2626" : "#e8edf5", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          transition: `background .15s, transform ${DUR.micro}s ${EASE.micro}`,
          boxShadow: listening ? "0 2px 10px rgba(220,38,38,0.4)" : "none",
        }}
        onMouseEnter={e => { if (!listening) e.currentTarget.style.background = "#dde4f0"; }}
        onMouseLeave={e => { if (!listening) e.currentTarget.style.background = "#e8edf5"; }}>
        {/* 录音中:双层脉冲扩散环(仅装饰动画,合成器友好) */}
        {listening && (
          <>
            <style>{`@keyframes micRing{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.9);opacity:0}}`}</style>
            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid #dc2626", animation: "micRing 1.4s ease-out infinite", pointerEvents: "none" }} />
            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid #dc2626", animation: "micRing 1.4s ease-out .7s infinite", pointerEvents: "none" }} />
          </>
        )}
        {listening ? (
          // 录音中:方形停止符(ChatGPT 式)
          <span style={{ width: size === "sm" ? 8 : 11, height: size === "sm" ? 8 : 11, borderRadius: 2, background: "#fff" }} />
        ) : (
          <svg width={icon} height={icon} viewBox="0 0 16 16" fill="none">
            <rect x="6" y="2" width="4" height="7" rx="2" stroke="#64748b" strokeWidth="1.4" />
            <path d="M4 8c0 2.2 1.8 4 4 4s4-1.8 4-4M8 12v2M5.5 14h5" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {/* 声纹条 + 正在聆听(录音中显示;入场微滑入) */}
      {listening && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: size === "sm" ? 4 : 6, animation: `barsIn ${DUR.fadeIn}s ${EASE.enter} both` }}>
          <style>{`@keyframes barsIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}`}</style>
          <VoiceBars scale={size === "sm" ? 0.7 : 1} />
          {size === "md" && <span style={{ fontSize: 11.5, color: "#dc2626", fontWeight: 600, whiteSpace: "nowrap" }}>正在聆听…</span>}
        </span>
      )}
    </span>
  );
}

// ─── 发送按钮(三态 + 微交互;md=34 方圆角(首页) / sm=30 圆(伴填)) ──────────────
export function SendButton({ disabled, loading, onClick, size = "md" as "md" | "sm", title = "发送" }: {
  disabled?: boolean; loading?: boolean; onClick: () => void; size?: "md" | "sm"; title?: string;
}) {
  const box = size === "sm" ? 30 : 34;
  const active = !disabled && !loading;
  const onEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!active) return;
    gsap.to(e.currentTarget, { y: -1, boxShadow: "0 4px 10px rgba(26,91,198,0.35)", duration: DUR.micro, ease: EASE.micro });
  };
  const onLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    gsap.to(e.currentTarget, { y: 0, boxShadow: "none", duration: DUR.micro, ease: EASE.micro });
  };
  const onDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!active) return;
    gsap.to(e.currentTarget, { scale: 0.92, duration: 0.09, ease: "power2.out" });
  };
  const onUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    gsap.to(e.currentTarget, { scale: 1, duration: 0.12, ease: EASE.micro });
  };

  return (
    <button onClick={onClick} disabled={disabled || loading} title={title} aria-label={title}
      style={{
        width: box, height: box, borderRadius: size === "sm" ? "50%" : 10, flexShrink: 0, border: "none",
        background: active
          ? (size === "sm" ? "#1a5bc6" : "linear-gradient(135deg,#1a5bc6,#2d78e8)")
          : (size === "sm" ? "#d1d9e6" : "#c8daf0"),
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: active ? "pointer" : "default",
        transition: "background .15s",
      }}
      onMouseEnter={onEnter} onMouseLeave={onLeave} onMouseDown={onDown} onMouseUp={onUp}>
      {loading ? (
        // loading:旋转圆环 spinner
        <span style={{
          width: size === "sm" ? 13 : 15, height: size === "sm" ? 13 : 15, borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff",
          display: "inline-block", animation: "sendSpin .7s linear infinite",
        }}>
          <style>{`@keyframes sendSpin{to{transform:rotate(360deg)}}`}</style>
        </span>
      ) : size === "sm" ? (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 12.5V3.5M8 3.5L4 7.5M8 3.5l4 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2.5 8L13.5 3l-2 5 2 5z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /></svg>
      )}
    </button>
  );
}
