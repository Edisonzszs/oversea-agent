/**
 * 稳定匿名 user_key（M1 无登录；localStorage 生成一次长期复用，M2 接真实账号替换）。
 * ChatFrame（创建 run）与 App（拉会话列表）共用同一 key。
 */
export function getUserKey(): string {
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
