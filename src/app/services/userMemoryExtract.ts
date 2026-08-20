import type { UserMemory } from './userMemoryStorage'
import { COUNTRY_115 } from './intentDetector'

const INDUSTRY_KEYWORDS = [
  '新能源汽车', '半导体', '制造业', '科技', '金融', '商贸', '医药', '新能源',
  '汽车零部件', '电子', '化工', '物流',
]

const COMPANY_RE = /(?:我们公司是|我叫|本公司是|公司名称[是为])([^\s，。、！？]{2,20})/

/** 从用户输入正则抽取记忆事实（国别/行业/公司名），与既有记忆合并去重。 */
export function extractMemoryFacts(text: string, current: UserMemory): UserMemory {
  const destinations = [...new Set([...current.destinations, ...COUNTRY_115.filter((c) => text.includes(c))])]
  const industryHit = INDUSTRY_KEYWORDS.find((k) => text.includes(k))
  const industry = industryHit || current.industry
  const companyMatch = text.match(COMPANY_RE)
  const company = companyMatch?.[1] || current.company
  return {
    destinations,
    ...(industry ? { industry } : {}),
    ...(company ? { company } : {}),
    notes: current.notes,
  }
}

/**
 * 本轮新增事实摘要（R1 缓存纪律，docs/design/m1-backend-draft.md）：
 * 档案前缀在会话开始时冻结（记忆每轮变化会击穿整个会话历史的 DeepSeek 前缀缓存），
 * 本轮新抽取的事实以增量摘要形式走当轮尾部附件——位于全部历史之后，不影响缓存前缀。
 */
export function diffMemoryFacts(before: UserMemory, after: UserMemory): string {
  const parts: string[] = []
  const newDestinations = after.destinations.filter((d) => !before.destinations.includes(d))
  if (newDestinations.length) parts.push(`目的地：${newDestinations.join('、')}`)
  if (after.industry && after.industry !== before.industry) parts.push(`行业：${after.industry}`)
  if (after.company && after.company !== before.company) parts.push(`公司：${after.company}`)
  return parts.join('；')
}
