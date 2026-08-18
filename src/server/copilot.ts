import type { ViteDevServer } from "vite";
import fs from "node:fs";
import path from "node:path";

// 无依赖读取 .env 到 process.env（仅服务端，不加 VITE_ 前缀，不进前端包）
function loadEnvFile() {
  const p = path.resolve(process.cwd(), ".env");
  let txt = "";
  try { txt = fs.readFileSync(p, "utf8"); } catch { return; }
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}
loadEnvFile();

const KEY = process.env.DEEPSEEK_API_KEY;
const BASE = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

async function deepseek(messages: { role: string; content: string }[], jsonMode: boolean): Promise<string> {
  if (!KEY) throw new Error("DEEPSEEK_API_KEY 未设置");
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, messages, ...(jsonMode ? { response_format: { type: "json_object" } } : {}), stream: false }),
  });
  if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (c: Buffer) => (buf += c.toString("utf8")));
    req.on("end", () => resolve(buf));
    req.on("error", reject);
  });
}
function send(res: any, status: number, obj: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

const EXTRACT_WRAP = (sys: string) =>
  `你是境外投资合规自查的结构化抽取伴填器。\n${sys}\n\n规则：只填能从企业描述客观判定的字段；不确定的整字段省略；严禁臆测；value 必须是字段允许值之一（给出 code 列表时用 code）；evidence 为企业原文摘录。只输出严格 JSON：{"字段键":{"value":...,"confidence":0到1的数,"evidence":"..."}}。`;

const REGULATION_WRAP = (ctx: string) =>
  `你是境外投资合规法规伴答器。\n${ctx}\n\n规则：只能引用上述已提供的条款；不得编造任何未提供的条文或文号；若无可用条款，needFallback=true 且 answer 固定为"该问题超出本工具解读范围，建议查阅原文或咨询平台专业服务联盟机构"。只输出严格 JSON：{"answer":"通俗解释","clauses":[{"id":"条款号","quote":"原文摘录"}],"needFallback":false}。`;

export function registerCopilot(server: ViteDevServer) {
  server.middlewares.use("/api/copilot/extract", async (req: any, res: any) => {
    try {
      const { systemPrompt = "", userText = "" } = JSON.parse((await readBody(req)) || "{}");
      const content = await deepseek([{ role: "system", content: EXTRACT_WRAP(systemPrompt) }, { role: "user", content: userText }], true);
      send(res, 200, { content });
    } catch (e: any) { send(res, 500, { error: String(e?.message || e) }); }
  });
  server.middlewares.use("/api/copilot/regulation", async (req: any, res: any) => {
    try {
      const { contextPrompt = "", question = "" } = JSON.parse((await readBody(req)) || "{}");
      const content = await deepseek([{ role: "system", content: REGULATION_WRAP(contextPrompt) }, { role: "user", content: question }], true);
      send(res, 200, { content });
    } catch (e: any) { send(res, 500, { error: String(e?.message || e) }); }
  });
  // 统一伴填对话：systemPrompt 由前端组装（含可抽取字段 + 法规知识库 + 输出格式），直接透传给 DeepSeek（JSON mode）。
  server.middlewares.use("/api/copilot/chat", async (req: any, res: any) => {
    try {
      const { systemPrompt = "", userText = "" } = JSON.parse((await readBody(req)) || "{}");
      const content = await deepseek([{ role: "system", content: systemPrompt }, { role: "user", content: userText }], true);
      send(res, 200, { content });
    } catch (e: any) { send(res, 500, { error: String(e?.message || e) }); }
  });
  // 沪航者通用对话（非 JSON，自由文本回复）
  server.middlewares.use("/api/copilot/general", async (req: any, res: any) => {
    try {
      const { messages = [] } = JSON.parse((await readBody(req)) || "{}");
      const content = await deepseek(messages, false);
      send(res, 200, { content });
    } catch (e: any) { send(res, 500, { error: String(e?.message || e) }); }
  });
  // 沪航者流式对话（deepseek-reasoner，支持 think + content 流式输出）
  server.middlewares.use("/api/copilot/general-stream", async (req: any, res: any) => {
    try {
      const { messages = [] } = JSON.parse((await readBody(req)) || "{}");
      res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", "Connection": "keep-alive" });
      // 客户端断开（浏览器「停止生成」会 abort fetch）→ 中断上游 DeepSeek 流，停止计费
      const abort = new AbortController();
      let clientGone = false;
      res.on("close", () => { clientGone = true; try { abort.abort(); } catch {} });
      const resp = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: "deepseek-reasoner", messages, stream: true }),
        signal: abort.signal,
      });
      if (!resp.ok || !resp.body) { res.end(`data: ${JSON.stringify({ error: `DeepSeek ${resp.status}` })}\n\n`); return; }
      const reader = (resp.body as any).getReader();
      const decoder = new TextDecoder();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done || clientGone) break;
          res.write(decoder.decode(value));
        }
      } catch (e: any) {
        if (!clientGone) throw e; // 客户端断开引起的 AbortError 是预期，静默
      }
      res.end();
    } catch (e: any) {
      try { res.end(`data: ${JSON.stringify({ error: String(e?.message || e) })}\n\n`); } catch {}
    }
  });
}
