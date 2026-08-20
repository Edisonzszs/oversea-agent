/**
 * orch · DeepSeek 服务端直连层
 * ============================================================
 * 与浏览器版 deepseekApi.ts 分工：本层在服务端直接持 key 调 DeepSeek
 * （env DEEPSEEK_API_KEY/BASE_URL），不经 /api/copilot 中转。
 * 口径对齐现有约束：reasoner 不传采样参数（temperature/max_tokens），
 * chat 可传；reasoning_content 不外发（内部思考不进任何日志/事件）。
 */
import fs from "node:fs";
import path from "node:path";

// 与 copilot/orch 入口同款：无依赖读 .env（幂等，已有值不覆盖）
export function loadEnvFile() {
  const p = path.resolve(process.cwd(), ".env");
  let txt = "";
  try { txt = fs.readFileSync(p, "utf-8"); } catch { return; }
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}
loadEnvFile();

const BASE = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const CHAT_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const REASONER_MODEL = process.env.DEEPSEEK_REASONER_MODEL || "deepseek-reasoner";

export type LlmMessage = { role: string; content: string };

export interface ServerStreamOptions {
  messages: LlmMessage[];
  systemPrompt: string;
  /** reasoner=true 时不传采样参数（对齐现有 deepseekApi 约束） */
  reasoner?: boolean;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  signal?: AbortSignal;
  onContent?: (delta: string) => void;
}

export interface ServerStreamResult {
  content: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_cache_hit_tokens?: number };
}

/** 流式对话：onContent 逐段回调，返回完整正文与用量（用量进 model_calls 记账）。 */
export async function serverStreamChat(options: ServerStreamOptions): Promise<ServerStreamResult> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY 未设置");
  const model = options.reasoner ? REASONER_MODEL : CHAT_MODEL;

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: options.systemPrompt }, ...options.messages],
      stream: true,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      ...(options.reasoner
        ? {}
        : {
            ...(typeof options.temperature === "number" ? { temperature: options.temperature } : {}),
            ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
          }),
    }),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (!res.ok || !res.body) throw new Error(`DeepSeek HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let content = "";
  let usage: ServerStreamResult["usage"];
  let buffer = "";
  // 流式防卡死（对齐浏览器版 25s 口径）
  const STALL_MS = 25_000;
  while (true) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stall = new Promise<null>((r) => { timer = setTimeout(() => r(null), STALL_MS); });
    const raced = await Promise.race([reader.read(), stall]);
    if (timer) clearTimeout(timer);
    if (raced === null) throw new Error("DeepSeek 流式 25s 无数据");
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
        const delta = obj?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) {
          content += delta;
          options.onContent?.(delta);
        }
        if (obj?.usage) usage = obj.usage;
      } catch { /* 跳过坏行 */ }
    }
  }
  return { content, usage };
}

/** 非流式 JSON 请求（planner 用）：返回解析后的 JSON 对象与用量。 */
export async function serverJsonComplete(args: {
  systemPrompt: string; userPrompt: string; signal?: AbortSignal;
}): Promise<{ value: unknown; usage?: ServerStreamResult["usage"] }> {
  const r = await serverStreamChat({
    messages: [{ role: "user", content: args.userPrompt }],
    systemPrompt: args.systemPrompt,
    jsonMode: true,
    signal: args.signal,
  });
  try { return { value: JSON.parse(r.content), usage: r.usage }; }
  catch { throw new Error("模型服务返回异常响应（非 JSON）"); }
}
