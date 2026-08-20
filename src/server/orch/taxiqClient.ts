/**
 * orch · TaxIQ 服务端客户端（中经社国别税策，直连）
 * ============================================================
 * 浏览器版 taxiqApi.ts 的服务端对应物：直连 https://gp.cnfic.com.cn（env TAXIQ_TOKEN），
 * 不走 nginx /api/taxiq。conversation_id 缓存 = 进程内 Map，按 conv 作用域隔离
 * （浏览器版是 localStorage 单全局；服务端多用户必须分会话）。净化/未覆盖契约
 * 复用 app/services/taxiqSanitize（纯函数）。
 */
import { isTaxiqNoDirectSupportAnswer } from "../../app/services/taxiqSanitize";

const API_BASE = "https://gp.cnfic.com.cn/idis_industry/teis";

/** conv 作用域会话缓存（进程重启丢失 → 自愈重建，可接受） */
const convScopes = new Map<string, { conversation_id: string }>();

export class TaxiqNoDirectSupportError extends Error {
  readonly code = "taxiq_no_direct_support";
  constructor() { super("TaxIQ 知识库未覆盖该问题"); this.name = "TaxiqNoDirectSupportError"; }
}

export interface ServerTaxiqResult {
  answer: string;
  conversation_id: string;
  refers: unknown[];
}

async function generateConversationId(signal?: AbortSignal): Promise<string> {
  const resp = await fetch(`${API_BASE}/v1/chat/generate-globe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      ...(process.env.TAXIQ_TOKEN ? { Authorization: process.env.TAXIQ_TOKEN } : {}),
    },
    body: JSON.stringify({ channel: "9" }),
    ...(signal ? { signal } : {}),
  });
  if (!resp.ok) throw new Error(`TaxIQ generate-globe HTTP ${resp.status}`);
  const body: any = await resp.json();
  if (body?.status !== 200 || !body?.success || !body?.data) {
    throw new Error(`TaxIQ generate-globe 业务失败: ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body.data as string;
}

async function runMessages(
  conversationId: string,
  question: string,
  signal?: AbortSignal,
): Promise<ServerTaxiqResult | null> {
  const resp = await fetch(`${API_BASE}/v1/chat/messages-globe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.TAXIQ_TOKEN ? { Authorization: process.env.TAXIQ_TOKEN } : {}),
    },
    body: JSON.stringify({ conversationId, channel: 9, question }),
    ...(signal ? { signal } : {}),
  });
  if (!resp.ok) return null; // 疑似会话失效 → 上层自愈重试
  if (!resp.body) throw new Error("TaxIQ 无响应体");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";
  let refers: unknown[] = [];
  let finished = false;
  const STALL_MS = 25_000;
  while (true) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stall = new Promise<null>((r) => { timer = setTimeout(() => r(null), STALL_MS); });
    const raced = await Promise.race([reader.read(), stall]);
    if (timer) clearTimeout(timer);
    if (raced === null) break;
    const { done, value } = raced;
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload) as any;
        if (Array.isArray(obj.refers) && obj.refers.length) refers = obj.refers;
        if (obj.eventType === "MESSAGE" && typeof obj.answer === "string") full += obj.answer;
        if (obj.eventType === "MESSAGE_FINISH") {
          if (typeof obj.answer === "string" && obj.answer.trim()) {
            if (full && obj.answer !== full) return null; // finish 与拼接不一致 → 流异常
            full = obj.answer;
          }
          finished = true;
        }
      } catch { /* 跳过坏行 */ }
    }
    if (finished) break;
  }
  if (!finished || !full.trim()) return null;
  return { answer: full, conversation_id: conversationId, refers };
}

/** 两步 SSE 问答：会话失效自愈一次；未覆盖契约答复抛 TaxiqNoDirectSupportError。 */
export async function serverTaxiqChat(args: {
  question: string;
  convId: string;
  signal?: AbortSignal;
}): Promise<ServerTaxiqResult> {
  let scope = convScopes.get(args.convId);
  if (!scope) {
    scope = { conversation_id: await generateConversationId(args.signal) };
    convScopes.set(args.convId, scope);
  }
  let result = await runMessages(scope.conversation_id, args.question, args.signal);
  if (!result) {
    scope = { conversation_id: await generateConversationId(args.signal) };
    convScopes.set(args.convId, scope);
    result = await runMessages(scope.conversation_id, args.question, args.signal);
    if (!result) throw new Error("TaxIQ 会话重试仍无响应");
  }
  if (isTaxiqNoDirectSupportAnswer(result.answer)) throw new TaxiqNoDirectSupportError();
  return result;
}
