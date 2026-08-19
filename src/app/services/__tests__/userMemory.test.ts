/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest'
import { loadUserMemory, saveUserMemory, USER_MEMORY_KEY, buildMemorySummary } from '../userMemoryStorage'
import { extractMemoryFacts } from '../userMemoryExtract'
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
