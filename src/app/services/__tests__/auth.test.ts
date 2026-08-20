/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authHeaders,
  getAuthSession,
  loginWithCode,
  logout,
  requestLoginCode,
} from "../auth";
import { getUserKey } from "../userKey";

function stubFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any, init?: any) => {
    const h = handler(String(input), init);
    return new Response(JSON.stringify(h.body), { status: h.status, headers: { "Content-Type": "application/json" } });
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("auth 服务（手机号+验证码通路）", () => {
  it("requestLoginCode 返回服务端下发码（POC 预填）", async () => {
    const spy = stubFetch((url) => {
      expect(url).toContain("/api/orch/auth/send-code");
      return { status: 200, body: { ok: true, code: "482913" } };
    });
    expect(await requestLoginCode("13800138000")).toBe("482913");
    expect(JSON.parse(String(spy.mock.calls[0]![1]!.body))).toEqual({ phone: "13800138000" });
  });

  it("下发失败（手机号非法）抛服务端错误", async () => {
    stubFetch(() => ({ status: 400, body: { error: "手机号须为 11 位（1 开头）" } }));
    await expect(requestLoginCode("123")).rejects.toThrow("手机号须为 11 位");
  });

  it("loginWithCode 建立 token 会话并落盘；authHeaders 带 Bearer；getUserKey 切手机号", async () => {
    stubFetch((url) => {
      expect(url).toContain("/api/orch/auth/login");
      return { status: 200, body: { token: "tok-1", user: { phone: "13800138000" } } };
    });
    const session = await loginWithCode("13800138000", "482913");
    expect(session).toEqual({ token: "tok-1", phone: "13800138000" });
    expect(getAuthSession()).toEqual({ token: "tok-1", phone: "13800138000" });
    expect(authHeaders()).toEqual({ Authorization: "Bearer tok-1" });
    expect(getUserKey()).toBe("13800138000"); // 已登录 → 会话归属 key = 手机号
  });

  it("验证码错误 401 抛错且不落盘", async () => {
    stubFetch(() => ({ status: 401, body: { error: "验证码错误或已过期" } }));
    await expect(loginWithCode("13800138000", "000000")).rejects.toThrow("验证码错误或已过期");
    expect(getAuthSession()).toBeNull();
  });

  it("logout 清会话并请求服务端撤销", async () => {
    stubFetch((url) =>
      url.includes("/auth/login")
        ? { status: 200, body: { token: "tok-2", user: { phone: "13900139000" } } }
        : { status: 200, body: { ok: true } },
    );
    await loginWithCode("13900139000", "123456");
    logout();
    expect(getAuthSession()).toBeNull();
    expect(authHeaders()).toEqual({}); // 匿名态无头
    expect(getUserKey()).toMatch(/^u-/); // 回落匿名 key
  });
});
