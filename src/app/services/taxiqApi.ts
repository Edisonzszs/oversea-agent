/**
 * TaxIQ 国别税策智能体（中经国别助手）前端服务
 * ============================================================
 * 对应 国别智能体/systemprompt.md「步骤 1K 国别税收问答」与生产侧 taxiq_chat.py。
 * 命中国别税策意图（见 intentDetector.detectTaxiqIntent）后，由 useStreamingChat
 * 分流到本服务，流式回显 TaxIQ 回答；多轮上下文通过复用 conversation_id 维持。
 *
 * TaxIQ API（走 vite.config.ts 的 /api/taxiq 代理，规避浏览器 CORS）：
 *   1) POST /v1/chat/generate-globe  body {"channel":"9"}  → data=会话ID
 *   2) POST /v1/chat/messages-globe  body {conversationId, channel:9, question}
 *      → text/event-stream：逐段 data:{json}，按序拼接 answer；MESSAGE_FINISH 取 sessionId
 *
 * 鉴权由 /api/taxiq 代理注入 Authorization（见 vite.config.ts），客户端不持有 token。
 */

const API_BASE = '/api/taxiq'
const STATE_KEY = 'taxiq:state' // localStorage：对应生产 MEMORY/taxiq_state.json

interface TaxiqState {
  conversation_id: string | null
  session_id?: string | null
  updated_at?: number
}

/** 读取/写入 localStorage 状态（conversation_id 复用 = 多轮上下文） */
function loadState(): TaxiqState {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || '') as TaxiqState
  } catch {
    return { conversation_id: null }
  }
}
function saveState(state: TaxiqState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({ ...state, updated_at: Date.now() }))
  } catch {
    /* 忽略隐私模式等写入失败 */
  }
}

/**
 * 接口1：获取会话 ID。有则复用，无则新建并落盘。
 * channel 文档约定为字符串 "9"。
 */
async function getOrCreateConversationId(signal?: AbortSignal): Promise<string> {
  const st = loadState()
  if (st.conversation_id) return st.conversation_id

  const resp = await fetch(`${API_BASE}/v1/chat/generate-globe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body: JSON.stringify({ channel: '9' }),
    ...(signal ? { signal } : {}),
  })
  if (!resp.ok) throw new Error(`generate-globe HTTP ${resp.status}`)
  const body = await resp.json()
  if (body?.status !== 200 || !body?.success || !body?.data) {
    throw new Error(`generate-globe 业务失败: ${JSON.stringify(body).slice(0, 200)}`)
  }
  const conversationId: string = body.data
  saveState({ conversation_id: conversationId })
  return conversationId
}

export interface TaxiqChatResult {
  answer: string
  conversation_id: string
  session_id?: string | null
  refers: unknown[]
}

export interface TaxiqChatOptions {
  question: string
  onChunk: (chunk: string) => void
  signal?: AbortSignal
}

/**
 * 接口2：流式问答。复用 conversation_id，逐段拼接 answer。
 * 会话疑似失效（非200或空答）时自愈：重新 generate-globe 并重试一次。
 * 返回完整 answer（与 deepseekApi.streamChatCompletion 同款 onChunk 流式回显）。
 */
export async function streamTaxiqChat(options: TaxiqChatOptions): Promise<TaxiqChatResult> {
  const { question, onChunk, signal } = options

  const conversationId = await getOrCreateConversationId(signal)

  let result = await runMessages(conversationId, question, onChunk, signal)
  // 自愈：会话失效 → 重新生成会话ID并重试一次
  if (!result) {
    const freshId = await regenerateConversationId(signal)
    result = await runMessages(freshId, question, onChunk, signal)
    if (!result) throw new Error('TaxIQ 会话重试仍无响应')
  }
  return result
}

/** 单次 messages-globe 调用；返回 null 表示会话疑似失效（需上层自愈重试）。 */
async function runMessages(
  conversationId: string,
  question: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<TaxiqChatResult | null> {
  // channel 文档约定为整数 9
  const resp = await fetch(`${API_BASE}/v1/chat/messages-globe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, channel: 9, question }),
    ...(signal ? { signal } : {}),
  })
  if (!resp.ok) return null // 疑似会话失效

  const reader = resp.body?.getReader()
  if (!reader) throw new Error('TaxIQ 无响应体')

  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''
  let sessionId: string | null = null
  let refers: unknown[] = []
  let finished = false
  // 流式防卡死：25s 收不到数据视为中断（与 deepseekApi 一致）
  const STALL_MS = 25000

  while (true) {
    let timer: ReturnType<typeof setTimeout> | undefined
    const stallGuard = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), STALL_MS)
    })
    const raced = await Promise.race([reader.read(), stallGuard])
    if (timer) clearTimeout(timer)

    if (raced === null) break // stall
    const { done, value } = raced
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const payloadStr = trimmed.slice(5).trimStart() // 去掉 "data:"（兼容有无空格）
      if (!payloadStr || payloadStr === '[DONE]') continue
      let obj: Record<string, unknown>
      try {
        obj = JSON.parse(payloadStr)
      } catch {
        continue
      }
      const eventType = obj.eventType as string | undefined
      if (Array.isArray(obj.refers) && (obj.refers as unknown[]).length) refers = obj.refers as unknown[]
      if (eventType === 'MESSAGE') {
        const seg = obj.answer as string | undefined
        if (seg) {
          full += seg
          onChunk(seg)
        }
      } else if (eventType === 'MESSAGE_FINISH') {
        sessionId = (obj.sessionId as string | null) ?? null
        finished = true
      }
    }
    if (finished) break
  }

  if (!finished && !full.trim()) return null // 空答 → 疑似会话失效
  saveState({ conversation_id: conversationId, session_id: sessionId })
  return { answer: full, conversation_id: conversationId, session_id: sessionId, refers }
}

/** 清掉本地会话ID并重新生成（自愈用）。 */
async function regenerateConversationId(signal?: AbortSignal): Promise<string> {
  saveState({ conversation_id: null })
  return getOrCreateConversationId(signal)
}

/** 重置 TaxIQ 会话（用户开新会话 / 切换国别话题时可调用）。 */
export function resetTaxiqState() {
  try {
    localStorage.removeItem(STATE_KEY)
  } catch {
    /* ignore */
  }
}
