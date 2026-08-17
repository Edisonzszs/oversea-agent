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

  it("空池:所有必填 → 缺失;条件规则缺输入 → 未触发(不静默消失)", () => {
    const pool = createGuideProject("空", "新设独资").fieldPool; // 无 mode = 空池
    const r = validateOdiPool(pool);
    const missing = r.checks.filter(c => c.status === "缺失");
    expect(missing.length).toBeGreaterThan(5);
    // investment_total 为空 → 金额规则未触发(规则存在,状态=未触发,不计入三态)
    expect(r.checks.find(c => c.id === "rule-amount-consistency")?.status).toBe("未触发");
    // 未触发不算问题
    expect(getIssues(r).some(i => i.status === "未触发")).toBe(false);
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

  it("summaries:三域齐全,passed+failed+missing=total(不含未触发),合计+未触发=checks 数", () => {
    const pool = createGuideProject("越南", "新设独资", "快速体验").fieldPool;
    const r = validateOdiPool(pool);
    expect(r.summaries.length).toBe(3);
    for (const s of r.summaries) expect(s.passed + s.failed + s.missing).toBe(s.total);
    expect(r.summaries.reduce((a, s) => a + s.total + s.skipped, 0)).toBe(r.checks.length);
  });

  // ── P1 新增规则 ──────────────────────────────────────────

  it("P1 预设池:新规则全通过(股比占比/币种折算/现金构成/目的地)", () => {
    const pool = createGuideProject("越南", "新设独资", "快速体验").fieldPool;
    const r = validateOdiPool(pool);
    const byId = (id: string) => r.checks.find(c => c.id === id)?.status;
    expect(byId("rule-ratio-amount-alignment")).toBe("通过"); // 100% vs 800/800
    expect(byId("rule-currency-breakdown")).toBe("通过");     // 美元 800 = 中方 800
    expect(byId("rule-cash-breakdown")).toBe("通过");         // 现金 800 = 自有 800 + 贷款 0
    expect(byId("rule-destination")).toBe("通过");            // 直接=越南 最终=越南·胡志明市
    expect(byId("rule-contribution")).toBe("通过");           // 子项合计 800(现金合计项不重复计)
  });

  it("P1 股比与占比不一致(>5个百分点) → 不通过", () => {
    let pool = createGuideProject("越南", "新设独资", "快速体验").fieldPool;
    pool = commitField(pool, "chinese_ratio", "60", "guide"); // 占比应为 100%
    const r = validateOdiPool(pool);
    expect(r.checks.find(c => c.id === "rule-ratio-amount-alignment")!.status).toBe("不通过");
  });

  it("P1 币种折算:人民币对按汇率折算;缺汇率 → 未触发", () => {
    let pool = createGuideProject("越南", "新设独资", "快速体验").fieldPool;
    pool = commitField(pool, "cny_currency_1", "人民币", "guide");
    pool = commitField(pool, "cny_amount_1", "5760", "guide"); // 5760万人民币 / 7.2 = 800万美元
    expect(validateOdiPool(pool).checks.find(c => c.id === "rule-currency-breakdown")!.status).toBe("通过");
    pool = commitField(pool, "exchange_rate", "", "guide"); // 缺汇率不计算
    expect(validateOdiPool(pool).checks.find(c => c.id === "rule-currency-breakdown")!.status).toBe("未触发");
  });

  it("P1 现金出资 ≠ 自有资金+银行贷款 → 不通过", () => {
    let pool = createGuideProject("越南", "新设独资", "快速体验").fieldPool;
    pool = commitField(pool, "cash_domestic", "500", "guide"); // 500 ≠ 800+0
    const r = validateOdiPool(pool);
    expect(r.checks.find(c => c.id === "rule-cash-breakdown")!.status).toBe("不通过");
  });

  it("P1 目的地占位词(待定/待填写) → 缺失", () => {
    let pool = createGuideProject("越南", "新设独资", "快速体验").fieldPool;
    pool = commitField(pool, "final_destination", "待定", "guide");
    const r = validateOdiPool(pool);
    expect(r.checks.find(c => c.id === "rule-destination")!.status).toBe("缺失");
  });

  it("P1 风险提示:敏感国家/敏感行业/3亿美元/多层级路径 → hints(不改三态)", () => {
    let pool = createGuideProject("越南", "新设独资", "快速体验").fieldPool;
    pool = commitField(pool, "investment_country", "伊朗", "guide");
    pool = commitField(pool, "industry", "房地产开发", "guide");
    pool = commitField(pool, "chinese_investment_amount", "31000", "guide"); // 3.1亿美元
    pool = commitField(pool, "direct_destination", "新加坡", "guide");        // 与最终目的地(越南)不同
    const r = validateOdiPool(pool);
    expect(r.hints.map(h => h.id).sort()).toEqual(["hint-large-investment", "hint-multi-layer-path", "hint-sensitive-country", "hint-sensitive-industry"]);
    // 提示不进 checks(不产生通过/不通过/缺失,只走 hints 通道)
    expect(r.checks.some(c => c.id.startsWith("hint-"))).toBe(false);
  });
});
