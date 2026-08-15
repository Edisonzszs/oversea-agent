// 小海·ODI 伴填 —— ODI 详情页右侧伴填面板(Step 2)。
// 设计照搬合规 ComplianceCopilotPanel(360px 可收起聊天面板 + 小海头像 + 气泡 +
// 引用条款 + 输入框 + 语音),内容换成 ODI 备案语境;走同一个 /api/copilot/chat。
// 红线同合规:回答仅供参考,不编造事实/法规;字段级「候选→确认填入」是「进入后」能力,
// 本版先只做问答 + 引用条款,候选卡待填报演示流程接入 ODI 字段目录后再开。

import { useState, useRef, useEffect } from "react";
import { C } from "../compliance/complianceTheme";
import { useVoiceInput } from "./VoiceInput";
import { copilotApi } from "../compliance/copilot/api";
import xiaohaiLogo from "../../imports/a79a33e60349890f7bf1eb25f7af24df.png";

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  context?: { projectId: string; projectName: string };
}

type Clause = { id: string; point: string };
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text?: string;
  clauses?: Clause[];
  pending?: boolean;
  error?: string;
};

// 小海真实头像(首页同款 logo)
function XiaohaiLogo({ size = 32 }: { size?: number }) {
  return <img src={xiaohaiLogo} alt="小海" style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, display: "block" }} />;
}

function greeting(projectName?: string): ChatMessage {
  return {
    id: "intro",
    role: "assistant",
    text: `我是小海,ODI 备案伴填助手。${projectName ? `当前项目:【${projectName}】。` : ""}
说说您在 ODI 备案里遇到的问题——字段怎么填、填报口径、备案流程、所需材料、商务委/发改委差异,我帮您解答。
(字段自动抽取与「确认填入」将在填报演示流程内开放。)`,
  };
}

// ODI system prompt(通俗问答 + 参考依据;不编造逐字条文)
function buildOdiPrompt(): string {
  return [
    "你是「小海」,上海市企业走出去综合服务平台的 ODI(企业境外投资)备案伴填助手。",
    "用户正在进行 ODI 备案(商务主管部门 + 发改部门)相关操作。用通俗中文回答关于:填报口径(字段该填什么)、备案流程、所需材料、商务委与发改委要求差异、相关法规的问题。",
    "红线:不要编造事实、数字、金额或法规条文;不确定时如实说明并建议以主管部门官方要求为准。",
    "clauses 里的 point 是该法规/条款对此问题的【口径要点】,不是逐字条文;须标注法规名称(id),不得当作官方原文呈现,正式材料以官方原文为准。",
    '输出严格 JSON,不要输出 JSON 以外的任何字符:{"answer":"<通俗回答,可用 **加粗>","clauses":[{"id":"<法规/条款简称>","point":"<口径要点,非逐字条文,简短>"}]}',
    "clauses 可为空数组 []。若无把握给出条款,clauses 返回 []。",
  ].join("\n");
}

// 轻量解析:容错 JSON,失败则把原文当 answer。
function parseOdiResponse(raw: string): { answer: string; clauses: Clause[] } {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const obj = JSON.parse(trimmed.slice(start, end + 1));
      const answer = typeof obj.answer === "string" ? obj.answer : "";
      const clauses = Array.isArray(obj.clauses)
        ? obj.clauses.filter((c: any) => c && typeof c.id === "string" && typeof c.point === "string").map((c: any) => ({ id: c.id, point: c.point }))
        : [];
      return { answer, clauses };
    } catch { /* fallthrough */ }
  }
  return { answer: trimmed, clauses: [] };
}

export function OdiCopilotPanel({ collapsed, onToggleCollapse, context }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greeting(context?.projectName)]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const voice = useVoiceInput((text) => setInput(prev => prev ? prev + text : text));
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const projectRef = useRef(context?.projectName);

  // 切项目 → 重置对话
  useEffect(() => {
    if (projectRef.current !== context?.projectName) {
      projectRef.current = context?.projectName;
      setMessages([greeting(context?.projectName)]);
    }
  }, [context?.projectName]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);
  useEffect(() => { const el = inputRef.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }, [input]);

  if (collapsed) {
    return (
      <button onClick={onToggleCollapse} title="展开小海·ODI 伴填" aria-label="展开小海·ODI 伴填"
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
      const raw = await copilotApi.chat(buildOdiPrompt(), text);
      const { answer, clauses } = parseOdiResponse(raw);
      setMessages(m => m.map(msg => msg.id === pid ? {
        ...msg, pending: false, text: answer, clauses,
        error: (!answer && clauses.length === 0) ? "小海暂时没能生成回答,可以补充更多细节,或换个问法试试。" : undefined,
      } : msg));
    } catch (e: any) {
      setMessages(m => m.map(msg => msg.id === pid ? { ...msg, pending: false, error: "伴填暂不可用:" + (e?.message || e) + "。可稍后重试。" } : msg));
    } finally { setLoading(false); }
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
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>小海·ODI 伴填</div>
          <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>备案口径 · 流程 · 材料 · 仅供参考</div>
        </div>
        <button onClick={onToggleCollapse} title="收起" style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 16, padding: 4, borderRadius: 6 }}
          onMouseEnter={e => { e.currentTarget.style.color = C.ink; }} onMouseLeave={e => { e.currentTarget.style.color = C.muted; }}>›</button>
      </div>

      {/* 对话区 */}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "6px 0 10px" }}>
        {messages.map(m => <MessageView key={m.id} m={m} />)}
      </div>

      {/* 输入区 */}
      <div style={{ borderTop: `1px solid ${C.lineSoft}`, padding: "8px 10px 10px", flexShrink: 0, background: "#fff" }}>
        <div style={{ border: `1px solid ${input.trim() ? C.primaryBorder : C.line}`, borderRadius: 12, background: C.field, padding: "6px 6px 5px 10px", transition: "border-color .15s" }}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} placeholder="问字段怎么填、口径、流程、材料、法规…" rows={1}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 13, border: "none", background: "transparent", color: C.ink, outline: "none", resize: "none", lineHeight: 1.5, padding: 0, minHeight: 20, maxHeight: 120, overflow: "hidden" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 0 }}>
            <span style={{ fontSize: 10.5, color: C.muted, paddingLeft: 2, display: "flex", alignItems: "center", gap: 6 }}>
              {voice.supported && <MicButtonSmall listening={voice.listening} onClick={voice.toggle} />}
              Enter 发送 · Shift+Enter 换行
            </span>
            <button onClick={send} disabled={loading || !input.trim()} title="发送" aria-label="发送"
              style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: input.trim() && !loading ? C.primary : C.faint, color: "#fff", cursor: input.trim() && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s" }}>
              {loading ? <span style={{ fontSize: 13 }}>…</span> : <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 12.5V3.5M8 3.5L4 7.5M8 3.5l4 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const bubbleStyle: React.CSSProperties = { background: "#f8fafc", borderRadius: "4px 12px 12px 12px", border: `1px solid ${C.lineSoft}`, padding: "9px 12px", fontSize: 13, color: C.ink, lineHeight: 1.6, whiteSpace: "pre-wrap" };

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>)}</>;
}

function MessageView({ m }: { m: ChatMessage }) {
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
              <div key={i} style={{ fontSize: 11.5, color: C.sub, background: "#fff", borderRadius: 6, padding: "5px 9px", marginBottom: 4, borderLeft: `2px solid ${C.primaryBorder}` }}><b style={{ color: C.primary }}>{cl.id}</b>:{cl.point}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MicButtonSmall({ listening, onClick }: { listening: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={listening ? "停止语音" : "语音输入"} aria-label="语音输入"
      style={{ width: 22, height: 22, borderRadius: "50%", border: "none", background: listening ? "#dc2626" : "#e8edf5", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background .15s", verticalAlign: "middle" }}>
      {listening ? (
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", animation: "voicePulseS 1s ease-in-out infinite" }}>
          <style>{`@keyframes voicePulseS{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}`}</style>
        </span>
      ) : (
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
          <rect x="6" y="2" width="4" height="7" rx="2" stroke="#64748b" strokeWidth="1.4" />
          <path d="M4 8c0 2.2 1.8 4 4 4s4-1.8 4-4M8 12v2M5.5 14h5" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
