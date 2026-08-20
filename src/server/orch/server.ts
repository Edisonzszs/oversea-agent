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
import crypto from "node:crypto";
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

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

/* ── 手机号+验证码登录（通路版；随申办不做） ─────────────────────────────
 * POC 口径：POST /auth/send-code 生成的 6 位码在响应里回传，前端自动预填——
 * 真实生产环境验证码走短信通道下发且【绝不】回传响应，仅此一处差异。 */
const PHONE_RE = /^1[3-9]\d{9}$/;

/** 从 Authorization: Bearer <token> 解析已登录手机号（会话无效返回 null）。 */
async function resolveAuthPhone(db: Db, req: http.IncomingMessage): Promise<string | null> {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const r = await db.query<{ phone: string }>(
    `SELECT phone FROM auth_sessions WHERE token = $1 AND expires_at > now()`,
    [token],
  );
  return r.rows[0]?.phone ?? null;
}

async function handleAuth(
  db: Db,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (pathname === "/auth/send-code" && req.method === "POST") {
    const { phone } = JSON.parse((await readBody(req)) || "{}");
    if (!PHONE_RE.test(String(phone ?? ""))) { json(res, 400, { error: "手机号须为 11 位（1 开头）" }); return true; }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await db.query(
      `INSERT INTO auth_codes (phone, code, expires_at) VALUES ($1, $2, now() + interval '5 minutes')`,
      [phone, code],
    );
    // 顺手清理该手机号过期验证码
    await db.query(`DELETE FROM auth_codes WHERE phone = $1 AND expires_at < now()`, [phone]);
    json(res, 200, { ok: true, code }); // POC：回传供前端预填；生产改短信下发并删掉 code 字段
    return true;
  }

  if (pathname === "/auth/login" && req.method === "POST") {
    const { phone, code } = JSON.parse((await readBody(req)) || "{}");
    if (!PHONE_RE.test(String(phone ?? ""))) { json(res, 400, { error: "手机号格式不正确" }); return true; }
    const r = await db.query(
      `SELECT code FROM auth_codes
       WHERE phone = $1 AND used = false AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [phone],
    );
    const expected = r.rows[0]?.code;
    if (!expected || expected !== String(code ?? "")) {
      json(res, 401, { error: "验证码错误或已过期" });
      return true;
    }
    await db.query(`UPDATE auth_codes SET used = true WHERE phone = $1 AND code = $2`, [phone, expected]);
    await db.query(
      `INSERT INTO users (phone, last_login_at) VALUES ($1, now())
       ON CONFLICT (phone) DO UPDATE SET last_login_at = now()`,
      [phone],
    );
    const token = crypto.randomUUID();
    await db.query(
      `INSERT INTO auth_sessions (token, phone, expires_at) VALUES ($1, $2, now() + interval '30 days')`,
      [token, phone],
    );
    json(res, 200, { token, user: { phone } });
    return true;
  }

  if (pathname === "/auth/logout" && req.method === "POST") {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (token) await db.query(`DELETE FROM auth_sessions WHERE token = $1`, [token]);
    json(res, 200, { ok: true });
    return true;
  }

  if (pathname === "/auth/me" && req.method === "GET") {
    const phone = await resolveAuthPhone(db, req);
    if (!phone) { json(res, 401, { error: "未登录或会话已过期" }); return true; }
    const u = await db.query(`SELECT phone, created_at, last_login_at FROM users WHERE phone = $1`, [phone]);
    json(res, 200, { user: u.rows[0] ?? { phone } });
    return true;
  }

  return false;
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

    // 登录通路（/auth/*）
    if (await handleAuth(db, req, res, pathname)) return true;

    // 已登录请求：user_key 以会话手机号为准（客户端参数仅匿名时生效）——
    // 对话与历史按账号真实归属，不可冒领他人 user_key
    const authPhone = await resolveAuthPhone(db, req);

    // POST /runs —— 持久入队
    if (req.method === "POST" && pathname === "/runs") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const result = await engine.startRun({
        question: String(body.question ?? ""),
        convId: body.conv_id ? String(body.conv_id) : undefined,
        userKey: authPhone ?? (body.user_key ? String(body.user_key) : undefined),
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

    // GET /conversations?user_key= —— 会话列表（2d：前端侧边栏从服务端读）
    if (req.method === "GET" && pathname === "/conversations") {
      const userKey = authPhone ?? url.searchParams.get("user_key") ?? "anon";
      const r = await db.query(
        `SELECT c.id, c.title, c.updated_at,
                (SELECT count(*) FROM messages m WHERE m.conv_id = c.id) AS message_count
         FROM conversations c WHERE c.user_key = $1
         ORDER BY c.updated_at DESC NULLS LAST LIMIT 30`,
        [userKey],
      );
      json(res, 200, { conversations: r.rows });
      return true;
    }

    // GET /conversations/:id/messages —— 历史消息（按 seq 升序，含 meta）
    const convMsgsMatch = pathname.match(/^\/conversations\/([^/]+)\/messages$/);
    if (req.method === "GET" && convMsgsMatch) {
      // 已登录时校验会话归属（他人会话 403；匿名 POC 仍可读演示数据）
      if (authPhone) {
        const own = await db.query(
          `SELECT 1 FROM conversations WHERE id = $1 AND user_key = $2`,
          [convMsgsMatch[1]!, authPhone],
        );
        if (!own.rows.length) { json(res, 403, { error: "无权访问该会话" }); return true; }
      }
      const r = await db.query(
        `SELECT seq, role, content, meta FROM messages WHERE conv_id = $1 ORDER BY seq`,
        [convMsgsMatch[1]!],
      );
      json(res, 200, {
        messages: r.rows.map((row: any) => ({
          role: row.role, content: row.content,
          meta: typeof row.meta === "string" ? safeParse(row.meta) : row.meta,
        })),
      });
      return true;
    }

    // GET /runs/:id/audit —— 全链路审计导出（政务留痕：run + tasks + 事件时间线）
    const auditMatch = pathname.match(/^\/runs\/([^/]+)\/audit$/);
    if (req.method === "GET" && auditMatch) {
      const runId = auditMatch[1]!;
      const run = await db.query(`SELECT * FROM agent_runs WHERE id = $1`, [runId]);
      if (!run.rows.length) { json(res, 404, { error: "run 不存在" }); return true; }
      const tasks = await db.query(`SELECT * FROM agent_tasks WHERE run_id = $1 ORDER BY started_at NULLS LAST`, [runId]);
      const events = await db.query(
        `SELECT seq, type, task_id, payload, created_at FROM agent_events WHERE run_id = $1 ORDER BY seq`, [runId],
      );
      const parseMaybe = (v: unknown) => (typeof v === "string" ? safeParse(v) : v);
      json(res, 200, {
        run: Object.fromEntries(Object.entries(run.rows[0]!).map(([k, v]) => [k, ["plan", "usage"].includes(k) ? parseMaybe(v) : v])),
        tasks: tasks.rows.map((t: any) => ({ ...t, sources: parseMaybe(t.sources), usage: parseMaybe(t.usage) })),
        events: events.rows.map((e: any) => ({ ...e, payload: parseMaybe(e.payload) })),
      });
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
