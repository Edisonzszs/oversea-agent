/**
 * LLM 通道适配层（由原型项目 deepseekApi.ts 重写）
 * ============================================================
 * 与源项目对外签名完全一致（streamChatCompletion / streamReasoningChat /
 * requestJsonCompletion / normalizeApiError / toApiMessages），内部不再走
 * /api/deepseek 裸代理（key 暴露隐患，已废弃），全部改走平台自己的
 * /api/copilot/* —— key 只在 server.js / src/server/copilot.ts 服务端持有。
 *
 *   streamChatCompletion  → POST /api/copilot/general-stream {model:"deepseek-chat"}
 *   streamReasoningChat   → POST /api/copilot/general-stream {model:"deepseek-reasoner"}
 *   requestJsonCompletion → POST /api/copilot/chat（JSON mode，返回 {content}）
 *
 * 保留源项目的传输级健壮性：fetch 阶段 20s 超时、流式 25s 防卡死、
 * AbortSignal 贯穿（用户「停止生成」）。
 */

import type { AgentError } from '../orchestration/types'

export interface LlmMessage {
  role: string
  content: string
}

export function normalizeApiError(error: unknown): AgentError {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { code: 'cancelled', message: '任务已停止' }
  }
  if (error instanceof Error) {
    return {
      code: 'agent_request_failed',
      message: '专业智能体暂时不可用',
      detail: error.message,
    }
  }
  return { code: 'unknown', message: '专业智能体暂时不可用' }
}

/* ─────────── SSE 读取公共实现（general-stream 透传 DeepSeek SSE） ─────────── */

interface SseReadOptions {
  model: string
  messages: LlmMessage[]
  temperature?: number
  maxTokens?: number
  onDelta: (delta: { content?: string; reasoning_content?: string }) => void
  signal?: AbortSignal
}

async function readGeneralStream(options: SseReadOptions): Promise<{ content: string; reasoning: string }> {
  const { model, messages, temperature, maxTokens, onDelta, signal } = options

  // fetch 阶段（等响应头）20s 拿不到就判超时，避免连上但不回包导致无限转圈
  const FETCH_TIMEOUT_MS = 20000
  const ac = new AbortController()
  let fetchTimedOut = false
  const fetchTimer = setTimeout(() => { fetchTimedOut = true; ac.abort() }, FETCH_TIMEOUT_MS)
  const onUserAbort = () => ac.abort()
  signal?.addEventListener('abort', onUserAbort)

  let response: Response
  try {
    response = await fetch('/api/copilot/general-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        // deepseek-reasoner 官方不支持采样参数，非 reasoner 才下发
        ...(model !== 'deepseek-reasoner' && temperature !== undefined ? { temperature } : {}),
        ...(model !== 'deepseek-reasoner' && maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
      }),
      signal: ac.signal,
    })
  } catch (err) {
    clearTimeout(fetchTimer)
    signal?.removeEventListener('abort', onUserAbort)
    if (fetchTimedOut) throw new Error('请求超时：模型服务未响应，请稍后重试')
    throw err
  }
  clearTimeout(fetchTimer)

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`模型服务 error ${response.status}: ${errText}`)
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let content = ''
  let reasoning = ''
  let buffer = ''
  // 流式防卡死：连续 25s 收不到任何数据视为连接中断，结束流式（返回已收到内容），避免无限 loading
  const STALL_MS = 25000
  let stalled = false

  while (true) {
    let timer: ReturnType<typeof setTimeout> | undefined
    const stallGuard = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), STALL_MS)
    })
    const raced = await Promise.race([reader.read(), stallGuard])
    if (timer) clearTimeout(timer)

    if (raced === null) {
      stalled = true
      await reader.cancel().catch(() => {})
      break
    }
    const { done, value } = raced
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]') continue
      if (!trimmed.startsWith('data: ')) continue

      try {
        const json = JSON.parse(trimmed.slice(6))
        if (json?.error) throw new Error(String(json.error))
        const delta = json.choices?.[0]?.delta
        if (delta) {
          if (delta.reasoning_content) {
            reasoning += delta.reasoning_content
            onDelta({ reasoning_content: delta.reasoning_content })
          }
          if (delta.content) {
            content += delta.content
            onDelta({ content: delta.content })
          }
        }
      } catch (e) {
        if (e instanceof Error && !(e instanceof SyntaxError) && e.message && !e.message.startsWith('Unexpected')) {
          // json.error 等业务错误向上抛（吞掉单纯 JSON.parse 失败的 SyntaxError）
          throw e
        }
        // skip malformed chunks
      }
    }
  }

  // 若因中断结束且没有任何内容，抛错让上层提示重试；有部分内容则返回，避免用户白等
  if (stalled && !content.trim() && !reasoning.trim()) {
    throw new Error('响应超时或中断，未收到内容')
  }
  return { content, reasoning }
}

export interface ChatCompletionOptions {
  messages: LlmMessage[]
  systemPrompt: string
  temperature?: number
  maxTokens?: number
  onChunk: (chunk: string) => void
  signal?: AbortSignal
}

export async function streamChatCompletion(options: ChatCompletionOptions): Promise<string> {
  const { messages, systemPrompt, temperature = 0.7, maxTokens = 2048, onChunk, signal } = options
  const { content } = await readGeneralStream({
    model: 'deepseek-chat',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    temperature,
    maxTokens,
    onDelta: (d) => { if (d.content) onChunk(d.content) },
    signal,
  })
  return content
}

/* ─────────── DeepSeek-Reasoner（思考过程）─────────── */
// deepseek-reasoner 先输出 reasoning_content(思考)，再输出 content(正文)。
// 注意：reasoner 官方不支持 temperature/top_p 等采样参数，故不传。

export interface ReasoningChatOptions {
  messages: LlmMessage[]
  systemPrompt: string
  maxTokens?: number
  onReasoning?: (chunk: string) => void
  onContent: (chunk: string) => void
  signal?: AbortSignal
}

export interface ReasoningChatResult {
  reasoning: string
  content: string
}

export async function streamReasoningChat(options: ReasoningChatOptions): Promise<ReasoningChatResult> {
  const { messages, systemPrompt, onReasoning, onContent, signal } = options
  return readGeneralStream({
    model: 'deepseek-reasoner',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    onDelta: (d) => {
      if (d.reasoning_content) onReasoning?.(d.reasoning_content)
      if (d.content) onContent(d.content)
    },
    signal,
  })
}

export interface JsonCompletionOptions {
  systemPrompt: string
  userPrompt: string
  signal?: AbortSignal
}

/** Request one machine-readable JSON object（走 /api/copilot/chat JSON mode，key 在服务端）。 */
export async function requestJsonCompletion(options: JsonCompletionOptions): Promise<unknown> {
  const { systemPrompt, userPrompt, signal } = options
  const response = await fetch('/api/copilot/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt, userText: userPrompt, temperature: 0 }),
    ...(signal ? { signal } : {}),
  })

  if (!response.ok) {
    throw new Error(`模型服务 error ${response.status}`)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('模型服务返回异常响应')
  }

  const content = getContentField(payload)
  if (!content.trim()) {
    throw new Error('模型服务返回空内容')
  }

  try {
    return JSON.parse(content) as unknown
  } catch {
    throw new Error('模型服务返回的 JSON 无法解析')
  }
}

function getContentField(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return ''
  const content = (payload as { content?: unknown }).content
  return typeof content === 'string' ? content : ''
}

/** 聊天消息 → API messages（过滤 system 与系统通知）。 */
export function toApiMessages(messages: Array<{ role: string; content: string; metadata?: { isSystemNotice?: boolean } }>): LlmMessage[] {
  return messages
    .filter((m) => m.role !== 'system' && !m.metadata?.isSystemNotice)
    .map((m) => ({ role: m.role, content: m.content }))
}
