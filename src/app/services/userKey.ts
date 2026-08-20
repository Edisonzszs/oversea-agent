/**
 * 会话归属 key：已登录 → 手机号（对话/历史按账号归档）；匿名 → localStorage 稳定随机 key。
 * M2 接真实账号体系时本文件是唯一替换点。
 */
import { getAuthSession } from "./auth";

export function getUserKey(): string {
  const session = getAuthSession();
  if (session) return session.phone;
  try {
    let k = localStorage.getItem("chuhai:user-key");
    if (!k) {
      k = "u-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("chuhai:user-key", k);
    }
    return k;
  } catch {
    return "anon";
  }
}
