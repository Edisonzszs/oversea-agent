/**
 * orch · M1 run-engine HTTP/SSE 逻辑（纯导出，无 require.main 副作用）
 * ============================================================
 * 路由（nginx /api/orch/ 前缀剥离后）：
 *   GET  /health                      存活 + 迁移状态
 *   POST /runs                        持久入队 → {runId, convId}（dsh 回执口径）
 *   GET  /runs/:id/events?from=seq    SSE：先回放再实时（每条 data = 编排事件 JSON）
 *   POST /runs/:id/cancel             中止（保留已生成部分）
 *   POST /runs/:id/tasks/:tid/retry   单任务重试（事件经原 run 回流）
 *
 * 生产入口：index.ts（esbuild 打包 orch.cjs，pm2 `chuhai-orch` 127.0.0.1:3101）。
 * dev：vite.config 引本文件调 registerOrch（无 DATABASE_URL 时注册失败仅告警，浏览器回落本地编排）。
 */
import http from "node:http";
import type { ViteDevServer } from "vite";
import { migrationInfo, openDb, type Db } from "./db";
import { RunEngine } from "./engine";

function json(res: http.ServerResponse, status: number, obj: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function readBody(req: http.IncomingMessage, limit = 2 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) { reject(new Error("请求体过大")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

export async function createOrchHandler() {
  const db: Db = await openDb();
  const engine = new RunEngine(db);

  return async function handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    url: URL,
  ): Promise<boolean> {
    if (pathname === "/health") {
      json(res, 200, { ok: true, service: "chuhai-orch", db: "ok", migrations: await migrationInfo(db) });
      return true;
    }

    // POST /runs —— 持久入队
    if (req.method === "POST" && pathname === "/runs") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const result = await engine.startRun({
        question: String(body.question ?? ""),
        convId: body.conv_id ? String(body.conv_id) : undefined,
        userKey: body.user_key ? String(body.user_key) : undefined,
        conversation: Array.isArray(body.conversation)
          ? body.conversation.map((m: any) => ({ role: String(m?.role ?? "user"), content: String(m?.content ?? "") }))
          : [],
        profileBlock: body.profile_block != null ? String(body.profile_block) : undefined,
      });
      json(res, 200, result);
      return true;
    }

    // GET /runs/:id/events —— SSE（回放 + 实时）
    const eventsMatch = pathname.match(/^\/runs\/([^/]+)\/events$/);
    if (req.method === "GET" && eventsMatch) {
      const runId = eventsMatch[1]!;
      const from = Number(url.searchParams.get("from") || 0);
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.write("retry: 3000\n\n");
      const heartbeat = setInterval(() => { try { res.write(":hb\n\n"); } catch { /* 关闭自清理 */ } }, 15_000);
      let closed = false;
      const unsubscribe = engine.subscribe(
        runId,
        Number.isFinite(from) ? from : 0,
        (event) => { if (!closed) res.write(`data: ${JSON.stringify(event)}\n\n`); },
        async () => undefined,
        () => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          try { res.end(); } catch { /* 已断 */ }
        },
      );
      req.on("close", () => unsubscribe());
      return true;
    }

    // POST /runs/:id/cancel
    const cancelMatch = pathname.match(/^\/runs\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelMatch) {
      await readBody(req).catch(() => "");
      const ok = await engine.cancel(cancelMatch[1]!);
      json(res, ok ? 200 : 404, ok ? { ok: true } : { error: "运行不存在或已结束" });
      return true;
    }

    // POST /runs/:id/tasks/:tid/retry
    const retryMatch = pathname.match(/^\/runs\/([^/]+)\/tasks\/([^/]+)\/retry$/);
    if (req.method === "POST" && retryMatch) {
      await readBody(req).catch(() => "");
      try {
        await engine.retry(retryMatch[1]!, retryMatch[2]!);
        json(res, 200, { ok: true });
      } catch (e: any) {
        json(res, 404, { error: String(e?.message || e) });
      }
      return true;
    }

    return false;
  };
}

/** dev：挂到 vite 中间件（与生产同源单文件；无 DB 时注册失败仅告警） */
export function registerOrch(server: ViteDevServer) {
  createOrchHandler()
    .then((handle) => {
      server.middlewares.use("/api/orch", (req: any, res: any, next: any) => {
        const url = new URL(req.url || "/", "http://local");
        const pathname = url.pathname.replace(/\/+$/, "") || "/";
        handle(req, res, pathname, url)
          .then((handled) => { if (!handled) next(); })
          .catch((e) => json(res, 500, { error: String(e?.message || e) }));
      });
    })
    .catch((e) => console.error("[chuhai-orch] dev 注册失败（浏览器将回落本地编排）:", e?.message || e));
}
