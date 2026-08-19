/** 用户长期记忆（localStorage 版，真实化后迁 user_memory_facts 表）。 */

export interface UserMemory {
  destinations: string[]
  industry?: string
  company?: string
  notes: string[]
}

export const USER_MEMORY_KEY = 'chuhai:user-memory'

const DEFAULT: UserMemory = { destinations: [], notes: [] }

export function loadUserMemory(): UserMemory {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT }
    const raw = localStorage.getItem(USER_MEMORY_KEY)
    if (!raw) return { ...DEFAULT }
    const p = JSON.parse(raw) as Partial<UserMemory>
    const industry = typeof p.industry === 'string' ? p.industry : undefined
    const company = typeof p.company === 'string' ? p.company : undefined
    return {
      destinations: Array.isArray(p.destinations) ? p.destinations : [],
      ...(industry ? { industry } : {}),
      ...(company ? { company } : {}),
      notes: Array.isArray(p.notes) ? p.notes : [],
    }
  } catch {
    return { ...DEFAULT }
  }
}

export function saveUserMemory(m: UserMemory): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(USER_MEMORY_KEY, JSON.stringify(m))
  } catch {
    /* 配额满或不可用 → 静默跳过 */
  }
}

/** 记忆 → system prompt 注入行（【用户档案】段正文）。 */
export function buildMemorySummary(m: UserMemory): string {
  const parts: string[] = []
  if (m.destinations.length) parts.push(`目的地：${m.destinations.join('、')}`)
  if (m.industry) parts.push(`行业：${m.industry}`)
  if (m.company) parts.push(`公司：${m.company}`)
  if (m.notes.length) parts.push(`关注：${m.notes.join('；')}`)
  return parts.join('；')
}
