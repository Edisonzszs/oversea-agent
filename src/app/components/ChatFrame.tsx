// 沪航者通用对话界面 —— 展示历史消息 + 底部输入框 + 多智能体编排输出。
// 融合原型项目编排层：用户提问 → 主智能体规划（direct/单专家/复合）→ 并行调用专业智能体
// （出海智询 / TaxIQ / ODI）→ 聚合统一答复；气泡上方渲染调用轨迹（状态/耗时/来源/单任务重试）。
// 空对话时展示欢迎页风格（banner + 快捷问题 + ChatInputBar），与原 WelcomeFrame 一致。

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "./conversationData";
import { useVoiceInput, MicButton, SendButton, RecordingBar, DictationControls } from "./VoiceInput";
import { runOrchestration, retryOrchestrationTask } from "../orchestration/orchestrator";
import { orchestrationReducer, createRunState } from "../orchestration/reducer";
import type { AgentRunState, OrchestrationEvent } from "../orchestration/types";
import { stripMarkers } from "../services/intentDetector";
import { loadUserMemory, saveUserMemory, buildMemorySummary } from "../services/userMemoryStorage";
import { extractMemoryFacts } from "../services/userMemoryExtract";
import { AgentRunTrace } from "./agent-run/AgentRunTrace";

// 轻量 Markdown 渲染：标题(##/###)、无序/有序列表、分隔线(---/--/—)、**粗体**、*斜体*、`代码`。
// 政务模型输出以这些符号为主；未识别的行按普通段落呈现，不显示原始符号。
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = (key: string) => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={key} style={{ margin: "4px 0", paddingLeft: 20, lineHeight: 1.75 }}>
        {list.items.map((it, i) => <li key={i} style={{ marginBottom: 2 }}>{renderInline(it)}</li>)}
      </Tag>,
    );
    list = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { flushList(`l${idx}`); return; }

    // 分隔线：--- / -- / *** / ___ / —— 单独成行
    if (/^(\s*)(-{2,}|\*{3,}|_{3,}|—{1,})\s*$/.test(line)) {
      flushList(`l${idx}`);
      blocks.push(<div key={`hr${idx}`} style={{ borderTop: "1px solid #eef2f7", margin: "8px 0" }} />);
      return;
    }
    // 标题 #~####
    const h = line.match(/^\s*(#{1,4})\s+(.*)$/);
    if (h) {
      flushList(`l${idx}`);
      const size = h[1].length <= 2 ? 14.5 : h[1].length === 3 ? 13.5 : 13;
      blocks.push(
        <div key={`h${idx}`} style={{ fontWeight: 700, fontSize: size, color: "#1a2744", margin: "8px 0 4px" }}>
          {renderInline(h[2])}
        </div>,
      );
      return;
    }
    // 无序列表 - / * / +（行首，后跟内容——避开 ** 粗体）
    const ul = line.match(/^\s*[-*+]\s+(.+)$/);
    if (ul && !/^\s*[-*+]\s*\*/.test(line)) {
      if (!list || list.ordered) { flushList(`l${idx}`); list = { ordered: false, items: [] }; }
      list.items.push(ul[1]);
      return;
    }
    // 有序列表 1. / 1、 / 1)
    const ol = line.match(/^\s*\d{1,2}[.、)]\s+(.+)$/);
    if (ol) {
      if (!list || !list.ordered) { flushList(`l${idx}`); list = { ordered: true, items: [] }; }
      list.items.push(ol[1]);
      return;
    }
    // 引用 >
    const bq = line.match(/^\s*>\s?(.*)$/);
    if (bq) {
      flushList(`l${idx}`);
      blocks.push(
        <div key={`bq${idx}`} style={{ borderLeft: "3px solid #d7e5f7", paddingLeft: 10, margin: "4px 0", color: "#4a6490" }}>
          {renderInline(bq[1])}
        </div>,
      );
      return;
    }
    // 普通段落
    flushList(`l${idx}`);
    blocks.push(<div key={`p${idx}`} style={{ margin: "2px 0" }}>{renderInline(line)}</div>);
  });
  flushList("lend");
  return <>{blocks}</>;
}

// 行内元素：**粗体** → `code` → *斜体*（保守：两侧贴字才判斜体，避免吞列表星号）
function renderInline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*[^*\s]\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <b key={i}>{part.slice(2, -2)}</b>;
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
          return <code key={i} style={{ background: "#f4f7fb", borderRadius: 4, padding: "1px 5px", fontSize: 12.5, fontFamily: "Consolas, monospace" }}>{part.slice(1, -1)}</code>;
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2 && !part.includes("**")) return <i key={i}>{part.slice(1, -1)}</i>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
import xiaohaiLogo from "../../imports/a79a33e60349890f7bf1eb25f7af24df.png";

const QUICK_QUESTIONS = [
  "对外投资备案需要提交哪些材料？",
  "新加坡设立子公司需要哪些手续？",
  "越南生产基地用工政策有哪些？",
  "ODI 外汇登记怎么办理？",
];

interface Props {
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  /** 门户首页携带的问题:挂载后自动发送一次(新对话落地用) */
  initialQuestion?: string;
  /** 用户发出消息(含携带问题自动发送):App 层据此识别「帮忙搜索网站」等显式请求 */
  onUserMessage?: (text: string) => void;
}

type Phase = "idle" | "planning" | "running" | "aggregating" | "answering";

// chips 兜底：模型未输出 [QUICK_QUESTIONS] 时按参与专家组合给固定引导话题（政务口径，可运营配置）
const FALLBACK_CHIPS: Record<string, string[]> = {
  consulting: ["帮我了解上海出海扶持政策", "介绍一下企业出海办事服务", "告诉我ODI备案的整体流程"],
  taxiq: ["帮我了解目的国企业所得税率", "介绍一下投资国别税收优惠", "告诉我跨境税务合规风险"],
  odi: ["告诉我ODI备案材料清单", "帮我了解发改委备案要求", "介绍一下ODI外汇登记流程"],
  general: ["对外投资备案需要提交哪些材料？", "新加坡设立子公司需要哪些手续？", "ODI 外汇登记怎么办理？"],
};
function fallbackChips(run?: AgentRunState): string[] {
  const ids = run?.plan?.tasks.map(t => t.agentId) ?? [];
  const out: string[] = [];
  for (const id of ids) for (const q of FALLBACK_CHIPS[id] ?? []) { if (out.length < 3 && !out.includes(q)) out.push(q); }
  return out.length > 0 ? out : FALLBACK_CHIPS.general;
}

export function ChatFrame({ messages: initialMessages, onMessagesChange, initialQuestion, onUserMessage }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [interim, setInterim] = useState("");
  const [loading, setLoading] = useState(false);
  const voice = useVoiceInput((text) => setInput(prev => prev ? prev + text : text), setInterim);
  // 编排流式状态
  const [answerText, setAnswerText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  // 所有运行轨迹（runId → 快照）；进行中的消息与重试共用此表做 live 渲染
  const [runs, setRuns] = useState<Record<string, AgentRunState>>({});
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null); // 停止生成(中断流式输出)

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading, answerText, runs, activeRunId]);
  useEffect(() => { const el = inputRef.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }, [input]);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput("");
    const newMsgs = [...messages, { role: "user" as const, text }];
    setMessages(newMsgs);
    onMessagesChange(newMsgs);
    onUserMessage?.(text);

    setLoading(true);
    setAnswerText(""); setPhase("planning"); setActiveRunId(null);

    let accAnswer = "";
    // 运行轨迹：闭包内同步镜像（最终快照落消息）+ React 状态（live 渲染）
    let localRun: AgentRunState | null = null;
    const seenTaskIds = new Set<string>();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      // 用户记忆：正则抽取（国别/行业/公司）→ 落盘 → 以【用户档案】system 消息注入对话上下文
      // （咨询/ODI 智能体把 conversation 透传给模型；TaxIQ 只用 question，不受影响）
      const memory = extractMemoryFacts(text, loadUserMemory());
      saveUserMemory(memory);
      const memSummary = buildMemorySummary(memory);
      const conversation = [
        ...(memSummary ? [{ role: "system", content: `【用户档案】${memSummary}（仅供参考，与当前问题无关时忽略）` }] : []),
        ...newMsgs.slice(0, -1).map(m => ({ role: m.role, content: m.text })),
      ];
      const result = await runOrchestration({
        question: text,
        messageId: "pending",
        conversation,
        signal: ctrl.signal,
        onEvent(ev: OrchestrationEvent) {
          if (ctrl.signal.aborted) return;
          // 轨迹：reduce 进闭包镜像 + upsert 到渲染表
          if (!localRun && ev.type === "run.started") {
            localRun = createRunState(ev.runId, ev.messageId, ev.at);
            setActiveRunId(ev.runId);
          }
          if (localRun) {
            localRun = orchestrationReducer(localRun, ev);
            const snap = localRun;
            setRuns(prev => ({ ...prev, [snap.runId]: snap }));
          }
          // 气泡正文流式
          if (ev.type === "task.pending") seenTaskIds.add(ev.task.id);
          if (ev.type === "plan.completed") setPhase("running");
          if (ev.type === "aggregation.started") { accAnswer = ""; setAnswerText(""); setPhase("aggregating"); }
          if (ev.type === "aggregation.output.delta") {
            accAnswer += ev.delta; setAnswerText(accAnswer); setPhase("answering");
          }
          // 单专家任务：专家输出直接流进主气泡（保持直连时代的流式手感）
          if (ev.type === "task.output.delta" && seenTaskIds.size === 1) {
            accAnswer += ev.delta; setAnswerText(accAnswer); setPhase("answering");
          }
          if (ev.type === "run.completed" || ev.type === "run.cancelled" || ev.type === "run.failed") setPhase("idle");
        },
      });

      const parsed = stripMarkers(result.output);
      const runSnap = localRun ?? undefined;
      // chips：模型输出优先；未输出时按参与专家兜底（保证每条专业答复都有引导话题）
      const chips = parsed.quickQuestions.length > 0 ? parsed.quickQuestions : fallbackChips(runSnap);
      const finalMsgs = [...newMsgs, {
        role: "assistant" as const,
        text: parsed.cleanContent || "（无回复内容）",
        ...(runSnap ? { run: runSnap } : {}),
        ...(chips.length > 0 ? { quickQuestions: chips } : {}),
      }];
      setMessages(finalMsgs);
      onMessagesChange(finalMsgs);
    } catch (e: any) {
      if (e?.name === "AbortError" || ctrl.signal.aborted) {
        // 用户点「停止生成」:保留已流式输出的部分与轨迹
        const finalMsgs = [...newMsgs, { role: "assistant" as const, text: accAnswer || "（已停止生成）", ...(localRun ? { run: localRun } : {}) }];
        setMessages(finalMsgs);
        onMessagesChange(finalMsgs);
      } else {
        const finalMsgs = [...newMsgs, { role: "assistant" as const, text: "抱歉，沪航者暂时无法回复，请稍后再试。" }];
        setMessages(finalMsgs);
        onMessagesChange(finalMsgs);
      }
    } finally {
      setLoading(false); setPhase("idle"); setAnswerText(""); setActiveRunId(null);
    }
  };

  // 单任务重试：重试事件仍走原 run 的 onEvent → runs 表 live 更新（消息上的旧快照被覆盖渲染）
  const handleRetryTask = async (runId: string, taskId: string) => {
    try { await retryOrchestrationTask(runId, taskId); } catch { /* 运行已过期（刷新/新会话）则忽略 */ }
  };

  const isEmpty = messages.length === 0 && !loading;

  // 停止生成(中断流式输出,保留已生成部分)
  const stopStream = () => { try { abortRef.current?.abort(); } catch {} };

  // 门户首页携带问题:挂载后自动发送一次(仅一次)
  const seededRef = useRef(false);
  useEffect(() => {
    if (initialQuestion && !seededRef.current) {
      seededRef.current = true;
      send(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeRun = activeRunId ? runs[activeRunId] : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: isEmpty ? "16px 12px 0 4px" : "20px 24px" }}>

          {/* 空对话 = 欢迎页风格 */}
          {isEmpty && (
            <>
              <div style={{ background: "linear-gradient(135deg,#e8f9f0 0%,#d6eeff 100%)", borderRadius: 12, padding: "22px 28px", display: "flex", alignItems: "center", gap: 18, border: "1px solid rgba(26,91,198,0.08)" }}>
                <img src={xiaohaiLogo} alt="沪航者" style={{ width: 68, height: 68, objectFit: "contain", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 19, fontWeight: 600, color: "#1a2744", lineHeight: 1.5, marginBottom: 4 }}>您好，我是沪航者，欢迎来到上海市企业出海综合服务平台</p>
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

          {/* 消息列表（轨迹 live 覆盖：runs 表里有更新的快照则优先渲染——支撑完成后重试的实时反馈） */}
          {messages.map((m, i) => (
            <Bubble
              key={i}
              role={m.role}
              text={m.text}
              think={m.think}
              run={m.run ? (runs[m.run.runId] ?? m.run) : undefined}
              quickQuestions={m.quickQuestions}
              onQuickPick={send}
              onRetryTask={m.run ? (taskId) => handleRetryTask(m.run!.runId, taskId) : undefined}
            />
          ))}

          {/* 流式输出区 */}
          {loading && (
            <div style={{ display: "flex", gap: 10, margin: "10px 0", alignItems: "flex-start" }}>
              <img src={xiaohaiLogo} alt="沪航者" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "contain", flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* 复合问题实时显示轨迹；单专家直通流式期间隐藏轨迹（完成后消息上方显示收起态），
                    避免出现「专家调用中」与「主气泡已出结果」的视觉交叉 */}
                {activeRun && activeRun.taskOrder.length > 1 && (
                  <div style={{ maxWidth: "78%", background: "#fff", borderRadius: "4px 14px 14px 14px", border: "1px solid #e5eaf2", padding: "8px 14px", marginBottom: 6 }}>
                    <AgentRunTrace run={activeRun} />
                  </div>
                )}
                <div style={{ background: "#fff", borderRadius: "4px 14px 14px 14px", border: "1px solid #e5eaf2", padding: "10px 15px", fontSize: 14, lineHeight: 1.7, color: "#1f2937", minHeight: 20 }}>
                  {answerText ? <RichText text={answerText} /> : (
                    <span style={{ color: "#94a3b8", fontSize: 13 }}>
                      {phase === "planning" ? "正在规划专业智能体调用…" : phase === "aggregating" ? "主智能体正在整合专业结果…" : "专业智能体正在处理…"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部输入（对齐 ChatGPT/Claude/豆包：单行时提示文字/输入内容与麦克风/发送同处一条视觉中心线，
          多行时输入区向上长高、按钮沉底；录音态整体切换为录音条；生成中发送钮变停止钮） */}
      <div style={{ flexShrink: 0, padding: "12px 0 0" }}>
        <div style={{
          background: voice.listening ? "#f4f8fe" : "#fff", borderRadius: 10,
          border: `1px solid ${voice.listening ? "#a9c9f2" : "#dde9f7"}`, boxShadow: "0 2px 8px rgba(26,64,140,0.06)",
          display: "flex", alignItems: voice.listening ? "center" : "flex-end", padding: "9px 12px", gap: 8, minHeight: 52,
          maxWidth: 820, margin: "0 auto", transition: "border-color .15s, background .15s",
        }}>
          {/* 文本列:最小高=按钮高(34px)且内部垂直居中 → 单行时文字与右侧按钮中心线重合、无上下悬空留白;
              多行时随 textarea 长高,容器 flex-end 让按钮沉底(ChatGPT 口径) */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 34, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {voice.listening ? (
              <RecordingBar elapsed={voice.elapsed} sessionText={voice.sessionText} interim={interim} meterRef={voice.meterRef} />
            ) : (
              <>
                <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="请输入您的问题…（Enter 发送，Shift+Enter 换行）"
                  style={{ width: "100%", boxSizing: "border-box", border: "none", outline: "none", resize: "none", fontSize: 13, color: "#1a2744", background: "transparent", lineHeight: 1.6, fontFamily: "inherit", minHeight: 21, display: "block" }}
                  rows={1} />
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

function Bubble({ role, text, think, run, quickQuestions, onQuickPick, onRetryTask }: {
  role: "user" | "assistant";
  text: string;
  think?: string;
  run?: AgentRunState;
  quickQuestions?: string[];
  onQuickPick: (q: string) => void;
  onRetryTask?: (taskId: string) => void;
}) {
  if (role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", margin: "10px 0" }}>
        <div style={{ maxWidth: "78%", background: "#1a5bc6", color: "#fff", borderRadius: "14px 14px 4px 14px", padding: "10px 15px", fontSize: 14, lineHeight: 1.6 }}><RichText text={text} /></div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 10, margin: "10px 0", alignItems: "flex-start" }}>
      <img src={xiaohaiLogo} alt="沪航者" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "contain", flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {think && <ThinkBlock text={think} />}
        {run && (run.taskOrder.length > 0 || run.status === "planning") && (
          <div style={{ maxWidth: "78%", background: "#fff", borderRadius: "4px 14px 14px 14px", border: "1px solid #e5eaf2", padding: "8px 14px", marginBottom: 6 }}>
            <AgentRunTrace run={run} onRetry={onRetryTask} />
          </div>
        )}
        <div style={{ maxWidth: "78%", background: "#fff", borderRadius: "4px 14px 14px 14px", border: "1px solid #e5eaf2", padding: "10px 15px", fontSize: 14, lineHeight: 1.7, color: "#1f2937" }}>
          <RichText text={text} />
          {/* 平台固定咨询口径：所有 AI 答复底部展示 */}
          <div style={{ borderTop: "1px dashed #e3eaf3", marginTop: 10, paddingTop: 8, fontSize: 11.5, color: "#93a5bd", lineHeight: 1.75 }}>
            如需进一步咨询，可拨打服务热线：021-60325182、021-60325183、021-60325185<br />
            服务时间：工作日 9:00–11:30，13:30–17:00
          </div>
        </div>
        {quickQuestions && quickQuestions.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: "78%" }}>
            {quickQuestions.map(q => (
              <button key={q} onClick={() => onQuickPick(q)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #bfdbfe", background: "#fff", color: "#1a5bc6", fontSize: 12.5, cursor: "pointer", transition: "all .15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#e8f0fe"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>{q}</button>
            ))}
          </div>
        )}
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
