import { describe, it, expect } from "vitest";
import { validateOdiPool, getIssues } from "./odiValidationEngine";
import { createGuideProject } from "../data/odiProjects";
import { commitField } from "../field/odiGuideLogic";

describe("odiValidationEngine", () => {
  it("预设新设独资池:金额/股比/注册资本/出资 一致 → 这些规则通过", () => {
    const pool = createGuideProject("越南", "新设独资", "快速体验").fieldPool;
    const r = validateOdiPool(pool);
    const byId = (id: string) => r.checks.find(c => c.id === id);
    expect(byId("rule-amount-consistency")?.status).toBe("通过");
    expect(byId("rule-equity-ratio")?.status).toBe("通过");
    expect(byId("rule-regcap-vs-total")?.status).toBe("通过");
    expect(byId("rule-contribution")?.status).toBe("通过");
    expect(byId("rule-method-consistency")?.status).toBe("通过");
  });

  it("空池:所有必填 → 缺失;一致性规则因无总额等被跳过", () => {
    const pool = createGuideProject("空", "新设独资").fieldPool; // 无 mode = 空池
    const r = validateOdiPool(pool);
    const missing = r.checks.filter(c => c.status === "缺失");
    expect(missing.length).toBeGreaterThan(5);
    // investment_total 为空 → 金额规则不产生
    expect(r.checks.some(c => c.id === "rule-amount-consistency")).toBe(false);
    // 跨业务域(核心字段)有缺失汇总
    const cross = r.summaries.find(s => s.dept === "跨业务")!;
    expect(cross.missing).toBeGreaterThan(0);
  });

  it("金额不一致:中方+外方≠总额 → 不通过,且进入 issues", () => {
    let pool = createGuideProject("越南", "新设独资", "快速体验").fieldPool;
    pool = commitField(pool, "chinese_investment_amount", "100", "guide");
    const r = validateOdiPool(pool);
    const amount = r.checks.find(c => c.id === "rule-amount-consistency")!;
    expect(amount.status).toBe("不通过");
    expect(amount.suggestion).toContain("投资总额");
    expect(getIssues(r).some(i => i.id === "rule-amount-consistency")).toBe(true);
  });

  it("股比不平衡 → 不通过", () => {
    let pool = createGuideProject("越南", "新设独资", "快速体验").fieldPool;
    pool = commitField(pool, "foreign_ratio", "30", "guide"); // 100+30=130
    const r = validateOdiPool(pool);
    expect(r.checks.find(c => c.id === "rule-equity-ratio")!.status).toBe("不通过");
  });

  it("并购池:R7 必填参与;非并购池:R7 必填跳过", () => {
    const merger = createGuideProject("德", "并购", "快速体验").fieldPool;
    const rm = validateOdiPool(merger);
    expect(rm.checks.some(c => c.id === "req-merger_subsidiary_name")).toBe(true);
    const fresh = createGuideProject("新", "新设独资").fieldPool;
    const rf = validateOdiPool(fresh);
    expect(rf.checks.some(c => c.id === "req-merger_subsidiary_name")).toBe(false);
  });

  it("summaries:三域齐全,passed+failed+missing=total,合计=checks 数", () => {
    const pool = createGuideProject("越南", "新设独资", "快速体验").fieldPool;
    const r = validateOdiPool(pool);
    expect(r.summaries.length).toBe(3);
    for (const s of r.summaries) expect(s.passed + s.failed + s.missing).toBe(s.total);
    expect(r.summaries.reduce((a, s) => a + s.total, 0)).toBe(r.checks.length);
  });
});
