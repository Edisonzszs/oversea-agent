/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest'
import { loadUserMemory, saveUserMemory, USER_MEMORY_KEY, buildMemorySummary } from '../userMemoryStorage'
import { extractMemoryFacts, diffMemoryFacts } from '../userMemoryExtract'
import type { UserMemory } from '../userMemoryStorage'

const empty: UserMemory = { destinations: [], notes: [] }

describe('userMemoryStorage', () => {
  beforeEach(() => localStorage.clear())
  it('round-trips', () => { saveUserMemory({ destinations: ['越南'], notes: ['x'] }); expect(loadUserMemory().destinations).toEqual(['越南']) })
  it('empty/malformed → empty default', () => { expect(loadUserMemory()).toEqual(empty); localStorage.setItem(USER_MEMORY_KEY, '{bad'); expect(loadUserMemory()).toEqual(empty) })
  it('summary line covers all facts', () => {
    expect(buildMemorySummary({ destinations: ['越南', '新加坡'], industry: '制造业', company: '华为技术', notes: ['税制'] }))
      .toBe('目的地：越南、新加坡；行业：制造业；公司：华为技术；关注：税制')
    expect(buildMemorySummary(empty)).toBe('')
  })
})

describe('extractMemoryFacts', () => {
  it('extracts destination from COUNTRY_115', () => {
    expect(extractMemoryFacts('我想去越南设厂', empty).destinations).toContain('越南')
  })
  it('extracts company name', () => {
    expect(extractMemoryFacts('我们公司是华为技术', empty).company).toBe('华为技术')
  })
  it('extracts industry keyword', () => {
    expect(extractMemoryFacts('做新能源汽车零部件', empty).industry).toBeTruthy()
  })
  it('accumulates destinations, dedups', () => {
    const m = extractMemoryFacts('去过越南', empty)
    const m2 = extractMemoryFacts('新加坡呢', m)
    expect(m2.destinations).toEqual(expect.arrayContaining(['越南', '新加坡']))
    expect(m2.destinations).toHaveLength(2)
  })
})

describe('diffMemoryFacts（R1 缓存纪律：本轮新增事实摘要）', () => {
  it('无新事实 → 空串（不产生尾部附件）', () => {
    const m = extractMemoryFacts('我想去越南设厂', empty)
    expect(diffMemoryFacts(m, extractMemoryFacts('越南企业所得税是多少', m))).toBe('')
  })
  it('新增目的地被检出并顿号连接（按 COUNTRY_115 表序）', () => {
    const m = extractMemoryFacts('去过越南', empty)
    const m2 = extractMemoryFacts('再去新加坡和泰国', m)
    expect(diffMemoryFacts(m, m2)).toBe('目的地：泰国、新加坡')
  })
  it('行业/公司首次出现被检出', () => {
    const m2 = extractMemoryFacts('我们公司是华为技术，做新能源汽车', empty)
    expect(diffMemoryFacts(empty, m2)).toBe('行业：新能源汽车；公司：华为技术')
  })
  it('既有事实重复提及不误报', () => {
    const m = extractMemoryFacts('我们公司是华为技术', empty)
    expect(diffMemoryFacts(m, extractMemoryFacts('华为技术在越南的税负', m))).toBe('目的地：越南')
  })
})
