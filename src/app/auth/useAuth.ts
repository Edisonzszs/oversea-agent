// 登录态 hook —— POC 阶段用 localStorage mock,不接真实后端。
// 真实平台由「走出去平台」统一提供登录;此处仅在前端 mock 出 isLoggedIn/user,
// 用来驱动「匿名速测版 / 登录完整版」两套入口的分流。
//
// 红线:本 hook 不持有任何真实凭证,不发起任何网络请求;mock login 任意手机号+验证码即过。

import { useState, useEffect, useCallback } from "react";

export interface AuthUser {
  userName: string;
  userType: "个人" | "法人";
  certStatus: "已认证" | "未认证";
  phone?: string;    // 个人登录:手机号(展示用,已是脱敏形态或原号)
  orgName?: string;  // 法人一证通:企业名
}

const STORAGE_KEY = "chuhai_auth_user";

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj && typeof obj.userName === "string") return obj as AuthUser;
    return null;
  } catch {
    return null;
  }
}

export interface UseAuth {
  user: AuthUser | null;
  isAuthed: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
}

export function useAuth(): UseAuth {
  const [user, setUser] = useState<AuthUser | null>(() => loadUser());

  useEffect(() => {
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* localStorage 不可用时降级为内存态,不影响流程 */
    }
  }, [user]);

  const login = useCallback((u: AuthUser) => setUser(u), []);
  const logout = useCallback(() => setUser(null), []);

  return { user, isAuthed: user != null, login, logout };
}

// 把手机号中段脱敏成展示名,如 138****1234;法人一证通 mock 用企业名。
export function phoneToName(phone: string): string {
  const p = phone.trim();
  if (p.length >= 7) return p.slice(0, 3) + "****" + p.slice(-4);
  return p || "用户";
}
