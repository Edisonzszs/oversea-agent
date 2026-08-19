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
