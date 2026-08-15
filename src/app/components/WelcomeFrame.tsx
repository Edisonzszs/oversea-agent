import { useState } from "react";
import type { AppFrame } from "../App";
import robotAvatarImg from "../../imports/a79a33e60349890f7bf1eb25f7af24df.png";

const xiaohaiRobotAvatarSrc = robotAvatarImg;

interface Props {
  goTo: (f: AppFrame) => void;
  onOdiAssistClick?: () => void;
}

const QUICK_QUESTIONS: { text: string; frame: AppFrame }[] = [
  { text: "对外投资备案需要提交哪些材料？", frame: "odi-qa" },
  { text: "申办APEC卡需要提交哪些材料？", frame: "non-odi" },
];

export function WelcomeFrame({ goTo, onOdiAssistClick }: Props) {
  const [inputVal, setInputVal] = useState("");

  const handleSend = () => {
    const v = inputVal.trim().toLowerCase();
    if (v.includes("odi") || v.includes("备案")) goTo("odi-qa");
    else if (v.length > 0) goTo("non-odi");
    setInputVal("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px 12px 0 4px" }}>
      <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "none" }}>
        {/* Welcome banner */}
        <div style={{
          background: "linear-gradient(135deg,#e8f9f0 0%,#d6eeff 100%)",
          borderRadius: 12,
          padding: "22px 28px",
          display: "flex", alignItems: "center", gap: 18,
          border: "1px solid rgba(26,91,198,0.08)",
        }}>
          <RobotAvatar size={68} />
          <div>
            <p style={{ fontSize: 19, fontWeight: 600, color: "#1a2744", lineHeight: 1.5, marginBottom: 4 }}>
              您好，我是小海，欢迎来到上海市企业走出去综合服务平台
            </p>
            <p style={{ fontSize: 14, color: "#4a6490", lineHeight: 1.6 }}>
              可以为您解答出海政策、办事指南、ODI备案、国别风险等问题，请直接提问～
            </p>
          </div>
        </div>

        {/* Suggested questions */}
        <div style={{
          background: "#fff",
          borderRadius: "0 0 12px 12px",
          padding: "16px 24px 22px",
          marginTop: 0,
          boxShadow: "0 4px 12px rgba(26,64,140,0.06)",
          border: "1px solid rgba(26,91,198,0.06)",
          borderTop: "none",
        }}>
          <p style={{ fontSize: 13, color: "#6b8ab0", marginBottom: 12 }}>您可以这样问我：</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {QUICK_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => q.text === "对外投资备案需要提交哪些材料？" && onOdiAssistClick ? onOdiAssistClick() : goTo(q.frame)}
                style={{
                  padding: "8px 18px", borderRadius: 6,
                  borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                  borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                  borderTopColor: "#1a5bc6", borderRightColor: "#1a5bc6", borderBottomColor: "#1a5bc6", borderLeftColor: "#1a5bc6",
                  background: "#fff", color: "#1a5bc6",
                  fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#e8f0fe"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
              >
                {q.text}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ChatInputBar value={inputVal} onChange={setInputVal} onSend={handleSend} />
    </div>
  );
}

export function RobotAvatar({ size = 44 }: { size?: number }) {
  const s = size;

  return (
    <div style={{
      width: s,
      height: s,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <img
        src={xiaohaiRobotAvatarSrc}
        alt="小海机器人头像"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
}

export function ChatInputBar({ value, onChange, onSend, placeholder }: {
  value: string; onChange: (v: string) => void; onSend: () => void; placeholder?: string;
}) {
  const hasContent = value.trim().length > 0;
  return (
    <div style={{ padding: "12px 0 0", flexShrink: 0 }}>
      <div style={{
        background: "#fff", borderRadius: 10,
        border: "1px solid #dde9f7", boxShadow: "0 2px 8px rgba(26,64,140,0.06)",
        display: "flex", alignItems: "flex-end", padding: "10px 12px", gap: 8, minHeight: 72,
      }}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={placeholder ?? "请输入您的问题，我会尽力为您解答...（按 Enter 发送，Shift + Enter 换行）"}
          style={{
            flex: 1, border: "none", outline: "none", resize: "none",
            fontSize: 13, color: "#1a2744", background: "transparent",
            lineHeight: 1.6, fontFamily: "inherit", minHeight: 42,
          }}
          rows={2}
        />
        <button
          onClick={onSend}
          style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: hasContent ? "linear-gradient(135deg,#1a5bc6,#2d78e8)" : "#c8daf0",
            borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
            borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
            borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderLeftColor: "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: hasContent ? "pointer" : "default", transition: "all 0.15s",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8.5L14 2L8.5 14L7 9.5L2 8.5Z" fill="white" />
          </svg>
        </button>
      </div>
      <p style={{ textAlign: "center", fontSize: 12, color: "#8a9bbf", marginTop: 6 }}>
        AI生成回答仅供参考，实际办理以线下政务服务为准
        <span style={{ marginLeft: 6, color: "#1a5bc6", fontWeight: 600, fontSize: 11 }}>测试版</span>
      </p>
    </div>
  );
}
