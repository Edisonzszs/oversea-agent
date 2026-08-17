// 语音听写 + 发送按钮组件 —— 使用浏览器 Web Speech API，支持中文识别。
// 视觉对齐 Codex / ChatGPT 听写形态：
//   MicGlyph          —— 实心胶囊麦克风图标(待录音)
//   MicButton         —— 开始听写按钮
//   TravelingWave     —— 持续横向移动的声纹(正弦波无缝滚动)
//   RecordingBar      —— 听写态占据输入框内部:红点 + 移动声纹 + 计时 + 实时识别文本
//   DictationControls —— 听写中替换 麦克风+发送:✗ 取消听写 / ✓ 完成听写
//   SendButton        —— 向上箭头三态(禁用灰/可发送蓝/loading spinner);
//                        传 onStop 且 loading 时变「停止生成」方块钮(可中断流式输出)
// useVoiceInput 采用会话缓冲:识别文本先积累在 sessionText,✓(confirm)才写入输入框,
// ✗(cancel)全部丢弃;interim 为实时中间识别文本。

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

// onCommit:点 ✓ 后把本次听写的落定文本一次性交回调用方写入输入框
export function useVoiceInput(onCommit: (text: string) => void, onInterim?: (text: string) => void) {
  const [listening, setListening] = useState(false);
  // supported 用惰性初始化(渲染期一次性探测,SSR 安全):同组件多次渲染不重复 setState
  const [supported, setSupported] = useState(() => getSpeechRecognition() != null);
  const [elapsed, setElapsed] = useState(0);        // 听写时长(秒),驱动录音条计时
  const [sessionText, setSessionText] = useState(""); // 本次听写已落定文本(✓ 才提交)
  const recogRef = useRef<SpeechRecognitionType | null>(null);
  const wantListenRef = useRef(false); // 用户意图仍在听写(onend 自动重启用)
  const sessionRef = useRef("");
  const onCommitRef = useRef(onCommit);
  const onInterimRef = useRef(onInterim);
  onCommitRef.current = onCommit;
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
        if (res.isFinal) {
          // 落定文本进会话缓冲(不直接写输入框,等 ✓ 提交)
          if (t) { sessionRef.current += t; setSessionText(sessionRef.current); }
        } else interim += t;
      }
      onInterimRef.current?.(interim);
    };
    r.onend = () => {
      // Chrome 静音超时会自动停:用户还在听写则重启(会话缓冲保留)
      if (wantListenRef.current) { try { r.start(); } catch { setListening(false); } }
      else setListening(false);
    };
    r.onerror = () => { wantListenRef.current = false; setListening(false); onInterimRef.current?.(""); };
    recogRef.current = r;
    return () => { wantListenRef.current = false; try { r.stop(); } catch {} recogRef.current = null; };
  }, []);

  // 听写计时(听写中每 0.4s 刷新,停止归零)
  useEffect(() => {
    if (!listening) { setElapsed(0); return; }
    const t0 = Date.now();
    setElapsed(0);
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 400);
    return () => clearInterval(iv);
  }, [listening]);

  const stop = useCallback(() => {
    wantListenRef.current = false;
    try { recogRef.current?.stop(); } catch {}
    setListening(false);
    onInterimRef.current?.("");
  }, []);

  const clearSession = useCallback(() => { sessionRef.current = ""; setSessionText(""); }, []);

  const start = useCallback(() => {
    if (!recogRef.current) return;
    clearSession();
    wantListenRef.current = true;
    try { recogRef.current.start(); setListening(true); } catch {}
  }, [clearSession]);

  // ✓ 完成听写:停止并把会话文本写入输入框
  const confirm = useCallback(() => {
    const t = sessionRef.current;
    stop();
    clearSession();
    if (t) onCommitRef.current(t);
  }, [stop, clearSession]);

  // ✗ 取消听写:停止并丢弃全部识别文本
  const cancel = useCallback(() => {
    stop();
    clearSession();
  }, [stop, clearSession]);

  // 兼容旧调用:未进入 ×/✓ 界面时的切换(听写中 = 确认提交)
  const toggle = useCallback(() => {
    if (listening) confirm();
    else start();
  }, [listening, confirm, start]);

  return { listening, supported, elapsed, sessionText, toggle, confirm, cancel };
}

function formatElapsed(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ─── 持续移动的声纹(Codex 式:横向往一个方向无缝滚动的正弦波) ────────────────
function TravelingWave({ height = 26, color = "#dc2626" }: { height?: number; color?: string }) {
  const W = 800;              // 总宽 = 整数个周期,平移 -50%(400px)无缝循环
  const HALF = 20;            // 半周期宽
  const base = height / 2;
  const amp = height * 0.6;   // 二次曲线控制点高度(视觉峰约其一半)
  let d = `M0 ${base} q ${HALF} ${-amp} ${HALF * 2} 0`;
  for (let x = HALF * 2; x < W; x += HALF * 2) d += ` t ${HALF * 2} 0`;
  return (
    <div style={{ flex: 1, minWidth: 30, height, overflow: "hidden" }}>
      <style>{`@keyframes waveScroll{to{transform:translateX(-400px)}}`}</style>
      <svg className="tw" width={W} height={height} viewBox={`0 0 ${W} ${height}`}
        style={{ display: "block", animation: "waveScroll 2.4s linear infinite" }}>
        <path d={d} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ─── 听写条(听写态占据输入框内部,替代 textarea 的视觉;Codex 式) ─────────────
export function RecordingBar({ elapsed, sessionText = "", interim, compact = false }: {
  elapsed: number; sessionText?: string; interim?: string; compact?: boolean;
}) {
  const hasText = !!(sessionText || interim);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 1 : 3, minWidth: 0, flex: 1 }}>
      <style>{`
        @keyframes recDot{0%,100%{opacity:1}50%{opacity:.25}}
        @media (prefers-reduced-motion: reduce){.rd{animation:none !important}.tw{animation:none !important}}
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: compact ? 6 : 10, minHeight: compact ? 20 : 36 }}>
        <span className="rd" style={{ width: compact ? 7 : 9, height: compact ? 7 : 9, borderRadius: "50%", background: "#dc2626", flexShrink: 0, animation: "recDot 1.1s ease-in-out infinite" }} />
        <TravelingWave height={compact ? 16 : 26} />
        <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", letterSpacing: 0.5 }}>{formatElapsed(elapsed)}</span>
      </div>
      <div style={{ fontSize: compact ? 11.5 : 12.5, lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {hasText ? (
          <>
            <span style={{ color: "#b91c1c", fontWeight: 600 }}>{sessionText}</span>
            {interim && <span style={{ color: "#dc2626", fontStyle: "italic" }}>{sessionText ? " " : ""}{interim}…</span>}
          </>
        ) : (
          <span style={{ color: "#94a3b8" }}>{compact ? "正在聆听…说出您的问题" : "正在聆听，识别内容会实时显示在这里（✓ 完成听写，✗ 取消）"}</span>
        )}
      </div>
    </div>
  );
}

// ─── 实心麦克风图标(胶囊机身 + 弧形支架) ────────────────────────────────────
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
// 听写中的停止/取消/确认由 DictationControls 负责,本按钮只在待录音时渲染。
export function MicButton({ supported, onClick, size = "md" as "md" | "sm" }: {
  supported: boolean; onClick: () => void; size?: "md" | "sm";
}) {
  const box = size === "sm" ? 22 : 34;
  const icon = size === "sm" ? 12 : 16;
  const fire = () => { if (!supported) { alert("当前浏览器不支持语音输入，请使用 Chrome/Edge"); return; } onClick(); };

  return (
    <button onClick={fire} title="语音输入" aria-label="语音输入"
      style={{
        width: box, height: box, borderRadius: "50%", border: "none", flexShrink: 0,
        background: "#e8edf5", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: `background .15s, transform ${DUR.micro}s ${EASE.micro}`,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "#dde4f0"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "#e8edf5"; }}>
      <MicGlyph size={icon} color="#64748b" />
    </button>
  );
}

// ─── 听写确认控件(听写中替换 麦克风+发送:✗ 取消 / ✓ 完成;Codex 式) ───────────
export function DictationControls({ onConfirm, onCancel, size = "md" as "md" | "sm" }: {
  onConfirm: () => void; onCancel: () => void; size?: "md" | "sm";
}) {
  const box = size === "sm" ? 24 : 34;
  const icon = size === "sm" ? 13 : 16;
  const press = {
    onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => gsap.to(e.currentTarget, { scale: 0.92, duration: 0.09, ease: "power2.out" }),
    onMouseUp: (e: React.MouseEvent<HTMLButtonElement>) => gsap.to(e.currentTarget, { scale: 1, duration: 0.12, ease: EASE.micro }),
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size === "sm" ? 6 : 8, flexShrink: 0 }}>
      {/* ✗ 取消听写:丢弃全部识别文本 */}
      <button onClick={onCancel} title="取消听写" aria-label="取消听写"
        style={{
          width: box, height: box, borderRadius: "50%", border: "1px solid #e8b4b4", background: "#fff",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          transition: "background .15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "#fdf3f3"; gsap.to(e.currentTarget, { y: -1, duration: DUR.micro, ease: EASE.micro }); }}
        onMouseLeave={e => { e.currentTarget.style.background = "#fff"; gsap.to(e.currentTarget, { y: 0, duration: DUR.micro, ease: EASE.micro }); }}
        {...press}>
        <svg width={icon} height={icon} viewBox="0 0 16 16" fill="none"><path d="M4.8 4.8l6.4 6.4M11.2 4.8l-6.4 6.4" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
      {/* ✓ 完成听写:识别文本写入输入框 */}
      <button onClick={onConfirm} title="完成听写" aria-label="完成听写"
        style={{
          width: box, height: box, borderRadius: "50%", border: "none", background: "#1a5bc6",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          boxShadow: "0 2px 8px rgba(26,91,198,0.35)", transition: "background .15s",
        }}
        onMouseEnter={e => { gsap.to(e.currentTarget, { y: -1, boxShadow: "0 4px 10px rgba(26,91,198,0.45)", duration: DUR.micro, ease: EASE.micro }); }}
        onMouseLeave={e => { gsap.to(e.currentTarget, { y: 0, boxShadow: "0 2px 8px rgba(26,91,198,0.35)", duration: DUR.micro, ease: EASE.micro }); }}
        {...press}>
        <svg width={icon} height={icon} viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3.2 3.2 5.8-6.6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </span>
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
