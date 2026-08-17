// 合规自查伴填后端 —— 轻量 Node.js HTTP 服务，代理 DeepSeek API。
// 部署在 /opt/chuhai-test/server.js，pm2 守护，端口 3100。
// 红线：key 只从环境变量或同目录 .env 读取，绝不硬编码；逻辑改动与 src/server/copilot.ts 保持同步。

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3100;

// 读取同目录 .env（不覆盖已有环境变量）
(function loadEnvFile() {
  const p = path.resolve(__dirname, ".env");
  let txt = "";
  try { txt = fs.readFileSync(p, "utf8"); } catch { return; }
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
})();

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const BASE = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
if (!DEEPSEEK_KEY) console.warn("[warn] DEEPSEEK_API_KEY 未设置，AI 接口将返回错误（在 server.js 同目录放 .env 或设环境变量）");

function readBody(req) {
  return new Promise((resolve) => {
    let buf = "";
    req.on("data", (c) => (buf += c.toString("utf8")));
    req.on("end", () => resolve(buf));
  });
}

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

async function deepseek(messages, jsonMode) {
  const resp = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, ...(jsonMode ? { response_format: { type: "json_object" } } : {}), stream: false }),
  });
  if (!resp.ok) throw new Error(`DeepSeek HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

const EXTRACT_WRAP = (sys) =>
  `你是境外投资合规自查的结构化抽取伴填器。\n${sys}\n\n规则：只填能从企业描述客观判定的字段；不确定的整字段省略；严禁臆测；value 必须是字段允许值之一（给出 code 列表时用 code）；evidence 为企业原文摘录。只输出严格 JSON：{"字段键":{"value":...,"confidence":0到1的数,"evidence":"..."}}。`;

const REGULATION_WRAP = (ctx) =>
  `你是境外投资合规法规伴答器。\n${ctx}\n\n规则：只能引用上述已提供的条款；不得编造任何未提供的条文或文号；若无可用条款，needFallback=true 且 answer 固定为"该问题超出本工具解读范围，建议查阅平台专业服务联盟机构"。只输出严格 JSON：{"answer":"通俗解释","clauses":[{"id":"条款号","quote":"原文摘录"}],"needFallback":false}。`;

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = req.url;
  try {
    if (url === "/api/copilot/extract") {
      const { systemPrompt = "", userText = "" } = JSON.parse((await readBody(req)) || "{}");
      const content = await deepseek([{ role: "system", content: EXTRACT_WRAP(systemPrompt) }, { role: "user", content: userText }], true);
      send(res, 200, { content });
    } else if (url === "/api/copilot/regulation") {
      const { contextPrompt = "", question = "" } = JSON.parse((await readBody(req)) || "{}");
      const content = await deepseek([{ role: "system", content: REGULATION_WRAP(contextPrompt) }, { role: "user", content: question }], true);
      send(res, 200, { content });
    } else if (url === "/api/copilot/chat") {
      const { systemPrompt = "", userText = "" } = JSON.parse((await readBody(req)) || "{}");
      const content = await deepseek([{ role: "system", content: systemPrompt }, { role: "user", content: userText }], true);
      send(res, 200, { content });
    } else if (url === "/api/copilot/general") {
      const { messages = [] } = JSON.parse((await readBody(req)) || "{}");
      const content = await deepseek(messages, false);
      send(res, 200, { content });
    } else if (url === "/api/copilot/general-stream") {
      const { messages = [] } = JSON.parse((await readBody(req)) || "{}");
      res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", "Connection": "keep-alive" });
      // 客户端断开（浏览器「停止生成」会 abort fetch）→ 中断上游 DeepSeek 流，停止计费
      const abort = new AbortController();
      let clientGone = false;
      res.on("close", () => { clientGone = true; try { abort.abort(); } catch {} });
      const resp = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_KEY}` },
        body: JSON.stringify({ model: "deepseek-reasoner", messages, stream: true }),
        signal: abort.signal,
      });
      if (!resp.ok || !resp.body) { res.end(`data: ${JSON.stringify({ error: `DeepSeek ${resp.status}` })}\n\n`); return; }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done || clientGone) break;
          res.write(decoder.decode(value));
        }
      } catch (e) {
        if (!clientGone) throw e; // 客户端断开引起的 AbortError 是预期，静默
      } finally {
        try { res.end(); } catch {}
      }
    } else {
      send(res, 404, { error: "Not found" });
    }
  } catch (e) {
    try {
      if (res.headersSent) res.end(`data: ${JSON.stringify({ error: String(e?.message || e) })}\n\n`);
      else send(res, 500, { error: String(e?.message || e) });
    } catch {}
  }
});

server.listen(PORT, () => { console.log(`Copilot server on :${PORT}`); });
