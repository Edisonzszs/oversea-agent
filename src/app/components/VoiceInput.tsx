// 语音输入 + 发送按钮组件 —— 使用浏览器 Web Speech API，支持中文识别。
// 视觉对齐 ChatGPT / 豆包：
//   MicGlyph     —— 实心胶囊麦克风图标(替代旧细描边)
//   MicButton    —— 录音中变红 + 双层脉冲扩散环 + 白色停止符
//   RecordingBar —— 录音态占据输入框内部：红点 + 7 根声纹 + 计时 + 实时识别文本
//   SendButton   —— 向上箭头三态(禁用灰/可发送蓝/loading spinner)；
//                   传 onStop 且 loading 时变「停止生成」方块钮(可中断流式输出)
// useVoiceInput 额外提供 elapsed(录音秒数)与 interim(实时中间识别文本)。

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
  const [elapsed, setElapsed] = useState(0); // 录音时长(秒),驱动录音条计时
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

  // 录音计时(录音中每 0.4s 刷新,停止归零)
  useEffect(() => {
    if (!listening) { setElapsed(0); return; }
    const t0 = Date.now();
    setElapsed(0);
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 400);
    return () => clearInterval(iv);
  }, [listening]);

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

  return { listening, supported, elapsed, toggle };
}

// ─── 声纹柱(录音中的跳动条;Web Speech 无音量回调,用错峰 CSS 动画模拟) ─────────
function VoiceBars({ scale = 1, count = 5 }: { scale?: number; count?: number }) {
  // 每根不同 duration/delay 制造自然错落;reduced-motion 时 CSS 里会停
  const bars = [
    { d: 0.9, delay: 0 },
    { d: 0.7, delay: 0.15 },
    { d: 1.1, delay: 0.05 },
    { d: 0.8, delay: 0.25 },
    { d: 1.0, delay: 0.1 },
    { d: 0.75, delay: 0.2 },
    { d: 0.95, delay: 0.35 },
  ].slice(0, count);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 * scale, height: 18 * scale, flexShrink: 0 }}>
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

function formatElapsed(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ─── 录音条(录音态占据输入框内部,替代 textarea 的视觉;ChatGPT/豆包式) ─────────
export function RecordingBar({ elapsed, interim, compact = false }: { elapsed: number; interim?: string; compact?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 1 : 2, minWidth: 0, flex: 1 }}>
      <style>{`
        @keyframes recDot{0%,100%{opacity:1}50%{opacity:.25}}
        @media (prefers-reduced-motion: reduce){.rd{animation:none !important}}
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: compact ? 6 : 10, minHeight: compact ? 20 : 36 }}>
        <span className="rd" style={{ width: compact ? 7 : 9, height: compact ? 7 : 9, borderRadius: "50%", background: "#dc2626", flexShrink: 0, animation: "recDot 1.1s ease-in-out infinite" }} />
        <VoiceBars scale={compact ? 0.75 : 1.05} count={7} />
        <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", letterSpacing: 0.5 }}>{formatElapsed(elapsed)}</span>
        {!compact && <span style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>再次点击麦克风结束录音</span>}
      </div>
      {interim && <div style={{ fontSize: compact ? 11.5 : 12, color: "#b91c1c", fontStyle: "italic", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>正在识别：{interim}…</div>}
    </div>
  );
}

// ─── 实心麦克风图标(胶囊机身 + 弧形支架,替代旧细描边) ────────────────────────
function MicGlyph({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="6" y="1.7" width="4" height="7.3" rx="2" fill={color} />
      <path d="M3.8 7.6a4.2 4.2 0 0 0 8.4 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 11.8v2M5.7 14h4.6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── 麦克风按钮(md=34px 首页 / sm=22px 伴填,热区已保证) ──────────────────────
// supported=false 时仍渲染按钮(探测可能因双模块实例/环境差异失灵),点击时提示不支持。
// 录音中的声纹/计时/识别文本由 RecordingBar 在输入框内部呈现,这里只保留按钮本体。
export function MicButton({ listening, supported, onClick, size = "md" as "md" | "sm" }: {
  listening: boolean; supported: boolean; onClick: () => void; size?: "md" | "sm";
}) {
  const box = size === "sm" ? 22 : 34;
  const icon = size === "sm" ? 12 : 16;
  const fire = () => { if (!supported) { alert("当前浏览器不支持语音输入，请使用 Chrome/Edge"); return; } onClick(); };

  return (
    <button onClick={fire} title={listening ? "停止语音输入" : "语音输入"} aria-label={listening ? "停止语音输入" : "语音输入"}
      style={{
        position: "relative", width: box, height: box, borderRadius: "50%", border: "none", flexShrink: 0,
        background: listening ? "#dc2626" : "#e8edf5", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
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
        <MicGlyph size={icon} color="#64748b" />
      )}
    </button>
  );
}

// ─── 发送按钮(向上箭头三态 + 停止生成;md=34 首页 / sm=30 伴填,统一圆形) ───────
export function SendButton({ disabled, loading, onClick, onStop, size = "md" as "md" | "sm", title = "发送" }: {
  disabled?: boolean; loading?: boolean; onClick: () => void; onStop?: () => void; size?: "md" | "sm"; title?: string;
}) {
  const box = size === "sm" ? 30 : 34;
  const stopping = loading && !!onStop; // 生成中且支持中断 → 停止钮
  const active = !disabled && !loading;
  const interactive = active || stopping;
  const onEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!interactive) return;
    gsap.to(e.currentTarget, { y: -1, boxShadow: "0 4px 10px rgba(26,91,198,0.35)", duration: DUR.micro, ease: EASE.micro });
  };
  const onLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!interactive) return;
    gsap.to(e.currentTarget, { y: 0, boxShadow: "none", duration: DUR.micro, ease: EASE.micro });
  };
  const onDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!interactive) return;
    gsap.to(e.currentTarget, { scale: 0.92, duration: 0.09, ease: "power2.out" });
  };
  const onUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    gsap.to(e.currentTarget, { scale: 1, duration: 0.12, ease: EASE.micro });
  };

  return (
    <button onClick={stopping ? onStop : onClick} disabled={stopping ? false : disabled || loading}
      title={stopping ? "停止生成" : title} aria-label={stopping ? "停止生成" : title}
      style={{
        width: box, height: box, borderRadius: "50%", flexShrink: 0, border: "none",
        background: stopping ? "#1a5bc6"
          : active ? (size === "sm" ? "#1a5bc6" : "linear-gradient(135deg,#1a5bc6,#2d78e8)")
          : (size === "sm" ? "#d1d9e6" : "#c8daf0"),
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: interactive ? "pointer" : "default",
        transition: "background .15s",
      }}
      onMouseEnter={onEnter} onMouseLeave={onLeave} onMouseDown={onDown} onMouseUp={onUp}>
      {stopping ? (
        // 生成中:停止符(白色方块,ChatGPT 式)
        <span style={{ width: size === "sm" ? 11 : 12, height: size === "sm" ? 11 : 12, borderRadius: 2, background: "#fff" }} />
      ) : loading ? (
        // loading:旋转圆环 spinner
        <span style={{
          width: size === "sm" ? 13 : 15, height: size === "sm" ? 13 : 15, borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff",
          display: "inline-block", animation: "sendSpin .7s linear infinite",
        }}>
          <style>{`@keyframes sendSpin{to{transform:rotate(360deg)}}`}</style>
        </span>
      ) : (
        // 向上箭头(ChatGPT 式,大小号统一)
        <svg width={size === "sm" ? 15 : 16} height={size === "sm" ? 15 : 16} viewBox="0 0 16 16" fill="none"><path d="M8 12.5V3.5M8 3.5L4.2 7.3M8 3.5l3.8 3.8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      )}
    </button>
  );
}
