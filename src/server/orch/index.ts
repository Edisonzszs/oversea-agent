/**
 * orch · M1 run-engine 入口（2b 骨架：health + DB 连通）
 * ============================================================
 * 生产：`npm run build:orch` → esbuild 打包成 orch.cjs（external pg），pm2 `chuhai-orch`
 *       独立进程（127.0.0.1:3101，nginx /api/orch/ 反代 + SSE 不缓冲）。
 * dev（2c 接入）：registerOrch(server) 挂 vite 中间件，与生产同源（根除双文件同步坑）。
 *
 * 事件契约（2c 实现）：POST /api/orch/runs → {run_id}；GET /api/orch/runs/:id/events?from=seq → SSE
 * （每条 data 即现有 OrchestrationEvent JSON，浏览器 reducer 契约不变）。
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import type { ViteDevServer } from "vite";
import { migrationInfo, openDb, type Db } from "./db";

// 与 copilot 同款：无依赖读取 ${cwd}/.env（pm2 cwd=/opt/chuhai-test → 读服务器 .env）
function loadEnvFile() {
  const p = path.resolve(process.cwd(), ".env");
  let txt = "";
  try { txt = fs.readFileSync(p, "utf-8"); } catch { return; }
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}
loadEnvFile();

const PORT = Number(process.env.ORCH_PORT || 3101);

function json(res: http.ServerResponse, status: number, obj: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

export async function createOrchHandler() {
  const db: Db = await openDb();
  return async function handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
  ): Promise<boolean> {
    if (pathname === "/health") {
      json(res, 200, {
        ok: true,
        service: "chuhai-orch",
        db: "ok",
        migrations: await migrationInfo(db),
      });
      return true;
    }
    // 2c: POST /runs · GET /runs/:id/events (SSE) · POST /runs/:id/cancel · POST /runs/:id/tasks/:tid/retry
    return false;
  };
}

/** dev：挂到 vite 中间件（与生产同源单文件） */
export function registerOrch(server: ViteDevServer) {
  createOrchHandler()
    .then((handle) => {
      server.middlewares.use("/api/orch", (req: any, res: any, next: any) => {
        const pathname = (req.url || "").split("?")[0];
        handle(req, res, pathname === "/health" ? "/health" : pathname)
          .then((handled) => { if (!handled) next(); })
          .catch((e) => json(res, 500, { error: String(e?.message || e) }));
      });
    })
    .catch((e) => console.error("[chuhai-orch] dev 启动失败:", e?.message || e));
}

// 直接运行（node orch.cjs）→ 独立 HTTP 服务
if (typeof require !== "undefined" && require.main === module) {
  createOrchHandler()
    .then((handle) => {
      http
        .createServer((req, res) => {
          const pathname = (req.url || "").split("?")[0];
          handle(req, res, pathname)
            .then((handled) => { if (!handled) json(res, 404, { error: "not found" }); })
            .catch((e) => json(res, 500, { error: String(e?.message || e) }));
        })
        .listen(PORT, "127.0.0.1", () => console.log(`[chuhai-orch] listening on 127.0.0.1:${PORT}`));
    })
    .catch((e) => { console.error("[chuhai-orch] 启动失败:", e?.message || e); process.exit(1); });
}
