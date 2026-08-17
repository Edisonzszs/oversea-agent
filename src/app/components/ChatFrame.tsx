// 小海通用对话界面 —— 展示历史消息 + 底部输入框 + DeepSeek 流式输出（think + content）。
// 空对话时展示欢迎页风格（banner + 快捷问题 + ChatInputBar），与原 WelcomeFrame 一致。

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "./conversationData";
import { useVoiceInput, MicButton, SendButton, RecordingBar, DictationControls } from "./VoiceInput";

// 将 Markdown 风格的 **粗体** 和 *斜体* 转为 React 元素，纯文本渲染（避免显示 ** 符号）。
function RichText({ text }: { text: string }) {
  // 按 ** 分割：偶数段 = 普通文本，奇数段 = 粗体
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <b key={i}>{part.slice(2, -2)}</b>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
import xiaohaiLogo from "../../imports/a79a33e60349890f7bf1eb25f7af24df.png";

const XIAOHAI_SYSTEM = "你是「小海」，上海走出去综合服务平台的 AI 智能助手。你的职责是帮助企业了解境外投资（ODI）相关政策、合规要求、操作流程，以及上海本地企业出海的综合服务。回答要简洁、准确、实用，适当使用列表和加粗。如果问题超出你的知识范围，如实告知并建议咨询专业机构或查阅官方原文。";

const QUICK_QUESTIONS = [
  "对外投资备案需要提交哪些材料？",
  "新加坡设立子公司需要哪些手续？",
  "越南生产基地用工政策有哪些？",
  "ODI 外汇登记怎么办理？",
];

interface Props {
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
}

export function ChatFrame({ messages: initialMessages, onMessagesChange }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [interim, setInterim] = useState("");
  const [loading, setLoading] = useState(false);
  const voice = useVoiceInput((text) => setInput(prev => prev ? prev + text : text), setInterim);
  // 流式状态
  const [thinkText, setThinkText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [phase, setPhase] = useState<"idle" | "thinking" | "answering">("idle");
  const [thinkOpen, setThinkOpen] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null); // 停止生成(中断流式输出)

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading, thinkText, answerText]);
  useEffect(() => { const el = inputRef.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }, [input]);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput("");
    const newMsgs = [...messages, { role: "user" as const, text }];
    setMessages(newMsgs);
    onMessagesChange(newMsgs);

    setLoading(true);
    setThinkText(""); setAnswerText(""); setPhase("thinking"); setThinkOpen(true);

    let accThink = "";
    let accAnswer = "";

    try {
      const apiMessages = [{ role: "system", content: XIAOHAI_SYSTEM }, ...newMsgs.map(m => ({ role: m.role, content: m.text }))];
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const resp = await fetch("/api/copilot/general-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
        signal: ctrl.signal,
      });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          // 只吞 JSON 解析失败;流式错误事件须抛给外层 catch 走友好兜底
          let json: any;
          try { json = JSON.parse(data); } catch { continue; }
          if (json.error) throw new Error(json.error);
          const delta = json.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.reasoning_content) {
            accThink += delta.reasoning_content;
            setPhase("thinking"); setThinkText(accThink);
          }
          if (delta.content) {
            accAnswer += delta.content;
            setPhase("answering"); setAnswerText(accAnswer); setThinkOpen(false);
          }
        }
      }

      const finalMsgs = [...newMsgs, { role: "assistant" as const, text: accAnswer || "（无回复内容）", ...(accThink ? { think: accThink } : {}) }];
      setMessages(finalMsgs);
      onMessagesChange(finalMsgs);
    } catch (e: any) {
      if (e?.name === "AbortError") {
        // 用户点「停止生成」:保留已流式输出的部分
        const finalMsgs = [...newMsgs, { role: "assistant" as const, text: accAnswer || "（已停止生成）", ...(accThink ? { think: accThink } : {}) }];
        setMessages(finalMsgs);
        onMessagesChange(finalMsgs);
      } else {
        const finalMsgs = [...newMsgs, { role: "assistant" as const, text: "抱歉，小海暂时无法回复，请稍后再试。" }];
        setMessages(finalMsgs);
        onMessagesChange(finalMsgs);
      }
    } finally {
      setLoading(false); setPhase("idle"); setThinkText(""); setAnswerText("");
    }
  };

  const isEmpty = messages.length === 0 && !loading;

  // 停止生成(中断流式输出,保留已生成部分)
  const stopStream = () => { try { abortRef.current?.abort(); } catch {} };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: isEmpty ? "16px 12px 0 4px" : "20px 24px" }}>

          {/* 空对话 = 欢迎页风格 */}
          {isEmpty && (
            <>
              <div style={{ background: "linear-gradient(135deg,#e8f9f0 0%,#d6eeff 100%)", borderRadius: 12, padding: "22px 28px", display: "flex", alignItems: "center", gap: 18, border: "1px solid rgba(26,91,198,0.08)" }}>
                <img src={xiaohaiLogo} alt="小海" style={{ width: 68, height: 68, objectFit: "contain", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 19, fontWeight: 600, color: "#1a2744", lineHeight: 1.5, marginBottom: 4 }}>您好，我是小海，欢迎来到上海市企业走出去综合服务平台</p>
                  <p style={{ fontSize: 14, color: "#4a6490", lineHeight: 1.6 }}>可以为您解答出海政策、办事指南、ODI备案、国别风险等问题，请直接提问～</p>
                </div>
              </div>
              <div style={{ background: "#fff", borderRadius: "0 0 12px 12px", padding: "16px 24px 22px", boxShadow: "0 4px 12px rgba(26,64,140,0.06)", border: "1px solid rgba(26,91,198,0.06)", borderTop: "none" }}>
                <p style={{ fontSize: 13, color: "#6b8ab0", marginBottom: 12 }}>您可以这样问我：</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {QUICK_QUESTIONS.map(q => (
                    <button key={q} onClick={() => send(q)} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #1a5bc6", background: "#fff", color: "#1a5bc6", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all .15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#e8f0fe"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>{q}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 消息列表 */}
          {messages.map((m, i) => <Bubble key={i} role={m.role} text={m.text} think={m.think} />)}

          {/* 流式输出区 */}
          {loading && (
            <div style={{ display: "flex", gap: 10, margin: "10px 0", alignItems: "flex-start" }}>
              <img src={xiaohaiLogo} alt="小海" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "contain", flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* think 区 */}
                {(thinkText || phase === "thinking") && (
                  <div style={{ marginBottom: 8 }}>
                    <button onClick={() => setThinkOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#94a3b8", padding: 0, marginBottom: 4 }}>
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ transition: "transform .2s", transform: thinkOpen ? "rotate(0)" : "rotate(-90deg)" }}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {phase === "thinking" ? "思考中…" : "已深度思考"}
                    </button>
                    {thinkOpen && thinkText && (
                      <div style={{ background: "#f8fafc", borderRadius: 8, border: "1px solid #eef2f7", padding: "9px 13px", fontSize: 12.5, color: "#64748b", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 300, overflowY: "auto", scrollbarWidth: "none" }}><RichText text={thinkText} /></div>
                    )}
                    {phase === "thinking" && !thinkText && <div style={{ fontSize: 12.5, color: "#94a3b8", padding: "4px 0" }}>小海正在深度思考…</div>}
                  </div>
                )}
                {/* answer 区 */}
                <div style={{ background: "#fff", borderRadius: "4px 14px 14px 14px", border: "1px solid #e5eaf2", padding: "10px 15px", fontSize: 14, lineHeight: 1.7, color: "#1f2937", whiteSpace: "pre-wrap", minHeight: 20 }}>
                  {answerText ? <RichText text={answerText} /> : (phase === "thinking" ? "" : <span style={{ color: "#94a3b8" }}>正在生成回复…</span>)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部输入（对齐 ChatGPT：录音态整个输入框切换为录音条；生成中发送钮变停止钮） */}
      <div style={{ flexShrink: 0, padding: "12px 0 0" }}>
        <div style={{
          background: voice.listening ? "#fffafa" : "#fff", borderRadius: 10,
          border: `1px solid ${voice.listening ? "#e8a7a7" : "#dde9f7"}`, boxShadow: "0 2px 8px rgba(26,64,140,0.06)",
          display: "flex", alignItems: "flex-end", padding: "10px 12px", gap: 8, minHeight: 56,
          maxWidth: 820, margin: "0 auto", transition: "border-color .15s, background .15s",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {voice.listening ? (
              <RecordingBar elapsed={voice.elapsed} sessionText={voice.sessionText} interim={interim} />
            ) : (
              <>
                <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="请输入您的问题，我会尽力为您解答...（按 Enter 发送，Shift + Enter 换行）"
                  style={{ width: "100%", boxSizing: "border-box", border: "none", outline: "none", resize: "none", fontSize: 13, color: "#1a2744", background: "transparent", lineHeight: 1.6, fontFamily: "inherit", minHeight: 36, display: "block" }}
                  rows={2} />
                {interim && <div style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic", lineHeight: 1.5, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>正在识别：{interim}…</div>}
              </>
            )}
          </div>
          {voice.listening ? (
            <DictationControls size="md" onConfirm={voice.confirm} onCancel={voice.cancel} />
          ) : (
            <>
              <MicButton supported={voice.supported} onClick={voice.toggle} />
              <SendButton size="md" loading={loading} disabled={!input.trim()} onClick={() => send()} onStop={stopStream} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, text, think }: { role: "user" | "assistant"; text: string; think?: string }) {
  if (role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", margin: "10px 0" }}>
        <div style={{ maxWidth: "78%", background: "#1a5bc6", color: "#fff", borderRadius: "14px 14px 4px 14px", padding: "10px 15px", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}><RichText text={text} /></div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 10, margin: "10px 0", alignItems: "flex-start" }}>
      <img src={xiaohaiLogo} alt="小海" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "contain", flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {think && <ThinkBlock text={think} />}
        <div style={{ maxWidth: "78%", background: "#fff", borderRadius: "4px 14px 14px 14px", border: "1px solid #e5eaf2", padding: "10px 15px", fontSize: 14, lineHeight: 1.7, color: "#1f2937", whiteSpace: "pre-wrap" }}><RichText text={text} /></div>
      </div>
    </div>
  );
}

function ThinkBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 8 }}>
      <button onClick={() => setOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#94a3b8", padding: "0 0 4px", transition: "color .15s" }}
        onMouseEnter={e => e.currentTarget.style.color = "#64748b"} onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ transition: "transform .2s", transform: open ? "rotate(0)" : "rotate(-90deg)" }}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        已深度思考（{text.length} 字）
      </button>
      {open && (
        <div style={{ background: "#f8fafc", borderRadius: 8, border: "1px solid #eef2f7", padding: "9px 13px", fontSize: 12.5, color: "#64748b", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 400, overflowY: "auto", scrollbarWidth: "none" }}>{text}</div>
      )}
    </div>
  );
}
