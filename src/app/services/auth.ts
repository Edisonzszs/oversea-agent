/**
 * 手机号+验证码登录（通路版客户端）—— 对接 /api/orch/auth/*
 * ============================================================
 * POC 口径：send-code 响应回传验证码供自动预填（与 LoginPage 演示交互一致）；
 * 真实生产环境为短信下发、响应不含验证码。token 存 localStorage（30 天会话），
 * 与展示用 chuhai_auth_user 并存：token 是服务端会话凭证，user 是 UI 展示对象。
 */

const ORCH = "/api/orch";
const SESSION_KEY = "chuhai_auth_session"; // { token, phone }

export interface AuthSession {
  token: string;
  phone: string;
}

function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Partial<AuthSession>;
    if (obj && typeof obj.token === "string" && typeof obj.phone === "string") return obj as AuthSession;
    return null;
  } catch {
    return null;
  }
}

function writeSession(s: AuthSession | null): void {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* localStorage 不可用时降级内存态 */ }
}

/** 请求登录验证码；返回服务端下发的 6 位码（POC 自动预填用）。 */
export async function requestLoginCode(phone: string): Promise<string> {
  const r = await fetch(`${ORCH}/auth/send-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const data = await r.json() as { code?: string; error?: string };
  if (!r.ok) throw new Error(data.error || "验证码发送失败");
  return data.code!;
}

/** 校验验证码并建立会话；成功返回 {token, phone} 并落盘。 */
export async function loginWithCode(phone: string, code: string): Promise<AuthSession> {
  const r = await fetch(`${ORCH}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });
  const data = await r.json() as { token?: string; error?: string };
  if (!r.ok || !data.token) throw new Error(data.error || "登录失败");
  const session = { token: data.token, phone };
  writeSession(session);
  return session;
}

/** 退出：撤销服务端会话 + 清本地（本地清除不等待网络结果）。 */
export function logout(): void {
  const s = readSession();
  writeSession(null);
  if (s) void fetch(`${ORCH}/auth/logout`, { method: "POST", headers: authHeaders(s) }).catch(() => undefined);
}

export function getAuthSession(): AuthSession | null {
  return readSession();
}

/** 登录态下带 Bearer 头（会话/对话请求归属校验用）；匿名返回空对象。 */
export function authHeaders(s?: AuthSession | null): Record<string, string> {
  const session = s ?? readSession();
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}
