// 语音输入按钮 + Hook —— 使用浏览器 Web Speech API，支持中文识别。
// 参考 ChatGPT / 豆包的语音输入样式：麦克风图标，录音中变红 + 脉冲动画。

import { useState, useRef, useCallback } from "react";

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

export function useVoiceInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recogRef = useRef<SpeechRecognitionType | null>(null);

  // 初始化
  if (typeof window !== "undefined" && !recogRef.current) {
    const SR = getSpeechRecognition();
    if (SR) {
      setSupported(true);
      const r = new SR();
      r.lang = "zh-CN";
      r.continuous = false;
      r.interimResults = false;
      r.onresult = (e: any) => {
        const transcript = e.results?.[0]?.[0]?.transcript ?? "";
        if (transcript) onResult(transcript);
      };
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      recogRef.current = r;
    }
  }

  const toggle = useCallback(() => {
    if (!recogRef.current) return;
    if (listening) {
      recogRef.current.stop();
      setListening(false);
    } else {
      try { recogRef.current.start(); setListening(true); } catch {}
    }
  }, [listening]);

  return { listening, supported, toggle };
}

// 麦克风按钮（与发送按钮配套使用）
export function MicButton({ listening, supported, onClick }: { listening: boolean; supported: boolean; onClick: () => void }) {
  if (!supported) return null;
  return (
    <button onClick={onClick} title={listening ? "停止语音输入" : "语音输入"} aria-label="语音输入"
      style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: listening ? "#dc2626" : "#e8edf5", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background .15s, transform .15s", transform: listening ? "scale(1.1)" : "none" }}
      onMouseEnter={e => { if (!listening) e.currentTarget.style.background = "#dde4f0"; }}
      onMouseLeave={e => { if (!listening) e.currentTarget.style.background = "#e8edf5"; }}>
      {listening ? (
        // 录音中：脉冲红圆点
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", animation: "voicePulse 1s ease-in-out infinite" }}>
          <style>{`@keyframes voicePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}`}</style>
        </span>
      ) : (
        // 静态麦克风图标
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="6" y="2" width="4" height="7" rx="2" stroke="#64748b" strokeWidth="1.4" />
          <path d="M4 8c0 2.2 1.8 4 4 4s4-1.8 4-4M8 12v2M5.5 14h5" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
