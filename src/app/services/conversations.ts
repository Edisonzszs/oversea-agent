/**
 * 服务端会话管理（侧边栏「重命名/删除」）—— 对接 /api/orch/conversations/:id
 * ============================================================
 * 已登录：Bearer 手机号归属校验（他人会话 403）；匿名：user_key 参数归属。
 * 删除会级联清掉该会话的消息/运行/事件（服务端事务内完成）。
 */

import { authHeaders } from "./auth";
import { getUserKey } from "./userKey";

const ORCH = "/api/orch";

/** 重命名服务端会话（本地 mock 会话走 ConversationSidebar 内的 localStorage 覆盖层） */
export async function renameServerConversation(id: string, title: string): Promise<void> {
  const r = await fetch(`${ORCH}/conversations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title, user_key: getUserKey() }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(d.error || "重命名失败");
  }
}

/** 删除服务端会话（含其全部消息与运行记录，不可恢复） */
export async function deleteServerConversation(id: string): Promise<void> {
  const r = await fetch(`${ORCH}/conversations/${encodeURIComponent(id)}?user_key=${encodeURIComponent(getUserKey())}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(d.error || "删除失败");
  }
}
