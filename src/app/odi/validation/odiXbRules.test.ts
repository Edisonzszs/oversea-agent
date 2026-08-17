import { describe, it, expect } from "vitest";
import { validateXbRules } from "./odiXbRules";
import { allFieldDefs } from "../field/odiFieldCatalog";
import { emptyField, type OdiField } from "../data/types";
import { commitField, setMaterialValues } from "../field/odiGuideLogic";
import { seedAssistFieldPool, DEMO_CONTRIBUTION_ROWS } from "../../components/odiProjectData";
import { validateOdiFull } from "./odiNdrcRules";

function emptyPool(): OdiField[] {
  return allFieldDefs().map(d => emptyField(d.code, d.name, d.round, d.dept));
}
/** 单侧/双侧材料值注入便捷 */
function withCommerce(pool: OdiField[], code: string, value: string): OdiField[] {
  return setMaterialValues(pool, code, [{ material: "商务备案表", value }]);
}

describe("跨业务核心字段(P3 首批 7 组)", () => {
  it("无商务备案表材料值:全部未触发(未同时识别到两侧部门材料)", () => {
    const r = validateXbRules(emptyPool());
    expect(r.checks.length).toBe(7);
    expect(r.checks.every(c => c.status === "未触发")).toBe(true);
  });

  it("D-001 主体名称归一化一致 → 通过;多一字 → 不通过", () => {
    let pool = emptyPool();
    pool = commitField(pool, "domestic_company_name", "上海XX公司", "guide");
    pool = withCommerce(pool, "domestic_company_name", " 上海ＸＸ公司 ");
    expect(validateXbRules(pool).checks.find(c => c.id === "XB-D001")!.status).toBe("通过");
    pool = withCommerce(pool, "domestic_company_name", "上海XX有限责任公司");
    expect(validateXbRules(pool).checks.find(c => c.id === "XB-D001")!.status).toBe("不通过");
  });

  it("D-005 投资方式枚举映射:新设↔新建 → 通过;新设 vs 增资 → 不通过", () => {
    let pool = emptyPool();
    pool = commitField(pool, "investment_method", "新建", "guide");
    pool = withCommerce(pool, "investment_method", "新设");
    expect(validateXbRules(pool).checks.find(c => c.id === "XB-D005")!.status).toBe("通过");
    pool = withCommerce(pool, "investment_method", "增资");
    expect(validateXbRules(pool).checks.find(c => c.id === "XB-D005")!.status).toBe("不通过");
  });

  it("D-006 最终目的地国别段比对(省州市差异不算不一致)", () => {
    let pool = emptyPool();
    pool = commitField(pool, "final_destination", "越南·胡志明市", "guide");
    pool = withCommerce(pool, "final_destination", "越南");
    expect(validateXbRules(pool).checks.find(c => c.id === "XB-D006")!.status).toBe("通过");
    pool = withCommerce(pool, "final_destination", "泰国");
    expect(validateXbRules(pool).checks.find(c => c.id === "XB-D006")!.status).toBe("不通过");
  });

  it("D-008 投资总额:差异≤0.01 通过;差异在±5%内仍不通过并注明 R-004 口径", () => {
    let pool = emptyPool();
    pool = commitField(pool, "investment_total", "800万美元", "guide");
    pool = withCommerce(pool, "investment_total", "800.005万美元");
    expect(validateXbRules(pool).checks.find(c => c.id === "XB-D008")!.status).toBe("通过");
    pool = withCommerce(pool, "investment_total", "820万美元"); // 差 2.5%,在±5%内
    const c = validateXbRules(pool).checks.find(x => x.id === "XB-D008")!;
    expect(c.status).toBe("不通过");
    expect(c.evidence).toContain("±5%"); // 容差仅商务侧预警,发改侧不采用
    pool = withCommerce(pool, "investment_total", "1000万美元"); // 差 25%
    expect(validateXbRules(pool).checks.find(x => x.id === "XB-D008")!.evidence).toContain("超出");
  });

  it("D-009 中方投资额:精确一致且≤总投资 → 通过;大于总投资 → 不通过", () => {
    let pool = emptyPool();
    pool = commitField(pool, "chinese_investment_amount", "800", "guide");
    pool = commitField(pool, "investment_total", "800", "guide");
    pool = withCommerce(pool, "chinese_investment_amount", "800");
    expect(validateXbRules(pool).checks.find(c => c.id === "XB-D009")!.status).toBe("通过");
    pool = commitField(pool, "chinese_investment_amount", "900", "guide"); // 发改侧 900 > 总额 800
    expect(validateXbRules(pool).checks.find(c => c.id === "XB-D009")!.status).toBe("不通过");
  });

  it("D-015 邮箱大小写不敏感比对", () => {
    let pool = emptyPool();
    pool = commitField(pool, "contact_email", "WangHai@XX-Sh.com", "guide");
    pool = withCommerce(pool, "contact_email", "wanghai@xx-sh.com");
    expect(validateXbRules(pool).checks.find(c => c.id === "XB-D015")!.status).toBe("通过");
  });

  it("R-001 注册资本口径提醒:有商务侧语境时输出 hint", () => {
    let pool = emptyPool();
    pool = commitField(pool, "domestic_company_name", "上海XX公司", "guide");
    pool = commitField(pool, "overseas_registered_capital", "500万美元", "guide");
    pool = withCommerce(pool, "domestic_company_name", "上海XX公司");
    const r = validateXbRules(pool);
    expect(r.hints.some(h => h.id === "hint-xb-regcap-scope")).toBe(true);
  });
});

describe("组合引擎(含跨业务)", () => {
  it("种子池:XB 7 组计入跨业务域,干净池全通过", () => {
    const r = validateOdiFull(seedAssistFieldPool(false), { contributionRows: DEMO_CONTRIBUTION_ROWS });
    const xb = r.checks.filter(c => c.id.startsWith("XB-"));
    expect(xb.length).toBe(7);
    expect(xb.every(c => c.status === "通过")).toBe(true);
    expect(r.hints.some(h => h.id === "hint-xb-regcap-scope")).toBe(true); // 口径提醒在,不改三态
    expect(r.summaries.every(s => s.failed + s.missing === 0)).toBe(true);
  });

  it("问题池:投资总额 XB 差异计入跨业务不通过(总计 54/4/2,与 mock p1 口径一致)", () => {
    const r = validateOdiFull(seedAssistFieldPool(true), { contributionRows: DEMO_CONTRIBUTION_ROWS });
    const cross = r.summaries.find(s => s.dept === "跨业务")!;
    expect(cross.failed).toBe(1); // XB-D008 投资总额 820 vs 800(±2.5%,R-004 教学)
    const sum = (k: "passed" | "failed" | "missing") => r.summaries.reduce((n, s) => n + s[k], 0);
    expect(sum("passed")).toBe(54);
    expect(sum("failed")).toBe(4);
    expect(sum("missing")).toBe(2);
  });
});
