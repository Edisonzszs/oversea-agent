// 小海·合规伴填 —— 单一对话面板（合并原「伴填 / 法规伴答」两 tab）。
// 用户任意输入：模型自动判断是「描述投资安排→抽取可填字段」还是「提问字段含义/该填什么/法规」，
// 或两者兼有。回复以聊天气泡呈现：通俗解释 + 引用精选条款 + 待确认字段卡。
// 红线不变：抽取结果只是候选，只有用户点「确认填入」才写入表单。

import { useState, useRef, useEffect } from "react";
import { C } from "../complianceTheme";
import type { WizardApi } from "./fields";
import type { Mode } from "../logic/weights";
import { useVoiceInput, MicButton, SendButton, RecordingBar, DictationControls } from "../../components/VoiceInput";
import { getFieldsForStep, type ParsedCandidate } from "../copilot/fieldCatalog";
import { copilotApi } from "../copilot/api";
import { buildChatSystemPrompt, parseChatResponse } from "../copilot/chatPrompt";
import xiaohaiLogo from "../../../imports/a79a33e60349890f7bf1eb25f7af24df.png";

interface Props {
  collapsed: boolean; onToggleCollapse: () => void;
  step: number; mode: Mode | null; api: WizardApi;
  seed?: string | null;
  onSeedConsumed?: () => void;
  instantQA?: { q: string; a: string; clauses?: { id: string; point: string }[] } | null;
  onInstantQAConsumed?: () => void;
}

type Clause = { id: string; point: string };
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text?: string;
  candidates?: ParsedCandidate[];
  clauses?: Clause[];
  pending?: boolean;
  error?: string;
};

// 小海 avatar（渐变蓝圆 + 机器人 SVG）
function XiaohaiAvatar({ size = 32 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#1a5bc6 0%,#3b82f6 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="#fff" strokeWidth="1.6" />
        <path d="M6.5 8.5c0-1.38 1.12-2.5 3.5-2.5s3.5 1.12 3.5 2.5c0 1.5-1.2 2.3-2.5 2.8V13" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="10" cy="14.5" r="0.8" fill="#fff" />
      </svg>
    </div>
  );
}

// 小海真实头像（首页同款 logo）
function XiaohaiLogo({ size = 32 }: { size?: number }) {
  return <img src={xiaohaiLogo} alt="小海" style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, display: "block" }} />;
}

function greeting(): ChatMessage {
  return {
    id: "intro",
    role: "assistant",
    text: "我是小海，合规伴填助手。\n说说您的投资安排，我帮您自动抽取可填字段（标注置信度与依据，确认后才写入）；遇到字段含义、该填什么、相关法规，也随时问我。",
  };
}

export function ComplianceCopilotPanel({ collapsed, onToggleCollapse, step, mode, api, seed, onSeedConsumed, instantQA, onInstantQAConsumed }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greeting()]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [interim, setInterim] = useState("");
  const voice = useVoiceInput((text) => setInput(prev => prev ? prev + text : text), setInterim);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stepRef = useRef(step);
  const modeRef = useRef(mode);

  // 步骤切换 → 重置对话（新步骤的 greeting + 可抽取字段不同）
  useEffect(() => {
    if (stepRef.current !== step || modeRef.current !== mode) {
      stepRef.current = step; modeRef.current = mode;
      setMessages([greeting()]);
    }
  }, [step, mode]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  // 题目「问小海」一键种入输入框（用户可改可发）
  useEffect(() => {
    if (seed) { setInput(seed); onSeedConsumed?.(); setTimeout(() => inputRef.current?.focus(), 0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  // 预设问答：点击 sparkle 后直接以 Q&A 对形式追加到对话（不走 API）
  useEffect(() => {
    if (instantQA) {
      setMessages(m => [...m, { id: "u" + Date.now(), role: "user", text: instantQA.q }, { id: "a" + Date.now(), role: "assistant", text: instantQA.a, clauses: instantQA.clauses }]);
      onInstantQAConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instantQA]);

  // 输入框随内容自适应高度（空时一行，无中间空白）
  useEffect(() => { const el = inputRef.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }, [input]);

  if (collapsed) {
    // 收起态：右上角悬浮角标（Codex/MiniMax 风格），点回展开
    return (
      <button onClick={onToggleCollapse} title="展开小海·合规伴填" aria-label="展开小海·合规伴填"
        style={{ position: "absolute", top: 14, right: 14, zIndex: 30, width: 44, height: 44, borderRadius: 12, border: "1px solid #e6ecf4", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(15,23,42,0.12)", padding: 0, transition: "transform .15s ease, box-shadow .15s ease" }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(26,91,198,0.20)"; }} onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(15,23,42,0.12)"; }}>
        <XiaohaiLogo size={30} />
      </button>
    );
  }

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const uid = "u" + Date.now();
    const pid = "a" + Date.now();
    setMessages(m => [...m, { id: uid, role: "user", text }, { id: pid, role: "assistant", pending: true }]);
    setLoading(true);
    try {
      const sys = buildChatSystemPrompt(step, mode);
      const raw = await copilotApi.chat(sys, text);
      const { answer, candidates, clauses } = parseChatResponse(raw, getFieldsForStep(step, mode));
      setMessages(m => m.map(msg => msg.id === pid ? {
        ...msg, pending: false, text: answer, candidates, clauses,
        error: (!answer && candidates.length === 0 && clauses.length === 0) ? "小海暂时没有识别到可填字段，也没能生成回答。可以补充更多描述，或换个问法试试。" : undefined,
      } : msg));
    } catch (e: any) {
      setMessages(m => m.map(msg => msg.id === pid ? { ...msg, pending: false, error: "伴填暂不可用：" + (e?.message || e) + "，可手动填写。" } : msg));
    } finally { setLoading(false); }
  };

  const confirmCandidate = (mid: string, c: ParsedCandidate, edited?: string) => {
    c.field.write(api, edited ?? c.value);   // 红线：仅「确认」写入
    setMessages(m => m.map(msg => msg.id === mid ? { ...msg, candidates: (msg.candidates || []).filter(x => x !== c) } : msg));
  };
  const discardCandidate = (mid: string, c: ParsedCandidate) => {
    setMessages(m => m.map(msg => msg.id === mid ? { ...msg, candidates: (msg.candidates || []).filter(x => x !== c) } : msg));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{ width: 360, flexShrink: 0, background: "#fff", borderLeft: `1px solid ${C.line}`, boxShadow: "-4px 0 14px rgba(15,23,42,0.04)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* 头部 */}
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.lineSoft}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <XiaohaiLogo size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>小海·合规伴填</div>
          <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>智能伴填 · 仅供参考</div>
        </div>
        <button onClick={onToggleCollapse} title="收起" style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 16, padding: 4, borderRadius: 6 }}
          onMouseEnter={e => { e.currentTarget.style.color = C.ink; }} onMouseLeave={e => { e.currentTarget.style.color = C.muted; }}>›</button>
      </div>

      {/* 对话区 */}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "6px 0 10px" }}>
        {messages.map(m => (
          <MessageView key={m.id} m={m} onConfirm={(c, v) => confirmCandidate(m.id, c, v)} onDiscard={c => discardCandidate(m.id, c)} />
        ))}
      </div>

      {/* 输入区（对齐 ChatGPT：录音态整个输入框切换为录音条）*/}
      <div style={{ borderTop: `1px solid ${C.lineSoft}`, padding: "8px 10px 10px", flexShrink: 0, background: "#fff" }}>
        <div style={{ border: `1px solid ${voice.listening ? "#a9c9f2" : (input.trim() || interim ? C.primaryBorder : C.line)}`, borderRadius: 12, background: voice.listening ? "#f4f8fe" : C.field, padding: "6px 6px 5px 10px", transition: "border-color .15s, background .15s" }}>
          {voice.listening ? (
            <RecordingBar elapsed={voice.elapsed} sessionText={voice.sessionText} interim={interim} meterRef={voice.meterRef} compact />
          ) : (
            <>
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} placeholder="描述投资安排，或问字段含义/该填什么/法规…" rows={1}
                style={{ width: "100%", boxSizing: "border-box", fontSize: 13, border: "none", background: "transparent", color: C.ink, outline: "none", resize: "none", lineHeight: 1.5, padding: 0, minHeight: 20, maxHeight: 120, overflow: "hidden" }} />
              {interim && <div style={{ fontSize: 11.5, color: C.muted, fontStyle: "italic", lineHeight: 1.4, margin: "2px 0" }}>正在识别：{interim}…</div>}
            </>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 0 }}>
            <span style={{ fontSize: 11.5, color: C.sub, paddingLeft: 2, display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
              {!voice.listening && <MicButton size="sm" supported={voice.supported} onClick={voice.toggle} />}
              {voice.listening ? <span style={{ fontSize: 11.5, color: C.primary, fontWeight: 600 }}>正在聆听…</span> : "Enter 发送 · Shift+Enter 换行"}
            </span>
            {voice.listening
              ? <DictationControls size="sm" onConfirm={voice.confirm} onCancel={voice.cancel} />
              : <SendButton size="sm" loading={loading} disabled={!input.trim()} onClick={send} />}
          </div>
        </div>
      </div>
    </div>
  );
}

const bubbleStyle: React.CSSProperties = { background: "#f8fafc", borderRadius: "4px 12px 12px 12px", border: `1px solid ${C.lineSoft}`, padding: "9px 12px", fontSize: 13, color: C.ink, lineHeight: 1.6, whiteSpace: "pre-wrap" };

// 去除 ** 等 Markdown 标记的轻量渲染
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>)}</>;
}

function MessageView({ m, onConfirm, onDiscard }: { m: ChatMessage; onConfirm: (c: ParsedCandidate, edited?: string) => void; onDiscard: (c: ParsedCandidate) => void }) {
  if (m.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", margin: "6px 10px" }}>
        <div style={{ maxWidth: "85%", background: C.primary, color: "#fff", borderRadius: "12px 12px 4px 12px", padding: "8px 12px", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.text}</div>
      </div>
    );
  }
  return (
    <div style={{ margin: "6px 10px" }}>
      <div style={{ minWidth: 0 }}>
        {m.pending && <div style={bubbleStyle}>小海正在思考…</div>}
        {m.error && <div style={{ ...bubbleStyle, color: C.bad, background: C.badBg, borderColor: C.badBorder }}>{m.error}</div>}
        {m.text && <div style={bubbleStyle}><RichText text={m.text} /></div>}
        {m.clauses && m.clauses.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11, color: C.muted, margin: "0 0 4px 2px", fontWeight: 600 }}>参考依据（以官方原文为准）</div>
            {m.clauses.map((cl, i) => (
              <div key={i} style={{ fontSize: 11.5, color: C.sub, background: "#fff", borderRadius: 6, padding: "5px 9px", marginBottom: 4, borderLeft: `2px solid ${C.primaryBorder}` }}><b style={{ color: C.primary }}>{cl.id}</b>：{cl.point}</div>
            ))}
          </div>
        )}
        {m.candidates && m.candidates.map(c => <ConfirmCard key={c.field.key} c={c} onConfirm={(v) => onConfirm(c, v)} onDiscard={() => onDiscard(c)} />)}
      </div>
    </div>
  );
}

function ConfirmCard({ c, onConfirm, onDiscard }: { c: ParsedCandidate; onConfirm: (edited?: string) => void; onDiscard: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(c.value);
  const pct = Math.round(c.confidence * 100);
  const confColor = pct >= 80 ? C.ok : pct >= 60 ? C.warn : C.bad;
  return (
    <div style={{ marginTop: 10, background: "#f8fafc", borderRadius: "10px 10px 10px 4px", border: `1px solid ${C.lineSoft}`, padding: "10px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: 0.3 }}>{c.field.label}</span>
        <span title="置信度" style={{ fontSize: 11, color: confColor, fontWeight: 700 }}>{pct}%{c.lowConf ? " ·低置信" : ""}</span>
      </div>
      <div style={{ height: 4, borderRadius: 3, background: "#fff", marginBottom: 8 }}><div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: confColor }} /></div>
      {editing && c.field.kind === "select" ? (
        <select value={val} onChange={e => setVal(e.target.value)} style={{ width: "100%", fontSize: 12.5, padding: "5px 8px", borderRadius: 7, border: `1px solid ${C.primaryBorder}`, background: "#fff", marginBottom: 8 }}>
          {c.field.allowed!.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      ) : (
        <div style={{ fontSize: 13.5, color: C.primary, fontWeight: 700, marginBottom: 6 }}>{c.field.kind === "multi" ? c.value.split(",").map(x => c.field.allowed!.find(a => a.value === x)?.label ?? x).join("、") : c.field.kind === "select" ? (c.field.allowed!.find(a => a.value === c.value)?.label ?? c.value) : c.value}</div>
      )}
      <div style={{ fontSize: 11.5, color: C.muted, background: "#fff", borderRadius: 6, padding: "5px 9px", marginBottom: 10, lineHeight: 1.5, borderLeft: `2px solid ${C.primaryBorder}` }}>依据：「{c.evidence}」</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onConfirm(editing ? val : undefined)} style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: "none", background: C.primary, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✓ 确认填入</button>
        {c.field.kind === "select" && <button onClick={() => setEditing(v => !v)} style={{ padding: "6px 11px", borderRadius: 7, border: `1px solid ${C.primaryBorder}`, background: C.primaryBg, color: C.primary, fontSize: 12, cursor: "pointer" }}>{editing ? "取消" : "✎ 改"}</button>}
        <button onClick={onDiscard} style={{ padding: "6px 11px", borderRadius: 7, border: `1px solid ${C.line}`, background: "#fff", color: C.bad, fontSize: 12, cursor: "pointer" }}>✗</button>
      </div>
    </div>
  );
}

