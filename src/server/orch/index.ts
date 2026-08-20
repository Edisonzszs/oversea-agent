/**
 * orch · 生产独立入口（esbuild 打包 orch.cjs，pm2 `chuhai-orch` 127.0.0.1:3101）
 * 逻辑全在 server.ts（dev 的 vite 中间件与生产共用，单源双端）。
 */
import http from "node:http";
import { createOrchHandler } from "./server";

const PORT = Number(process.env.ORCH_PORT || 3101);

function json(res: http.ServerResponse, status: number, obj: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

if (typeof require !== "undefined" && require.main === module) {
  createOrchHandler()
    .then((handle) => {
      http
        .createServer((req, res) => {
          const url = new URL(req.url || "/", "http://local");
          const pathname = url.pathname.replace(/\/+$/, "") || "/";
          handle(req, res, pathname, url)
            .then((handled) => { if (!handled) json(res, 404, { error: "not found" }); })
            .catch((e) => json(res, 500, { error: String(e?.message || e) }));
        })
        .listen(PORT, "127.0.0.1", () => console.log(`[chuhai-orch] listening on 127.0.0.1:${PORT}`));
    })
    .catch((e) => { console.error("[chuhai-orch] 启动失败:", e?.message || e); process.exit(1); });
} else {
  // 被 ESM 环境直接 import（不应发生）：提示走 server.ts
  console.warn("[chuhai-orch] 请从 server.ts 导入（本文件仅作 cjs 独立入口）");
}
