import { describe, it, expect } from "vitest";
import {
  normalizeEntity, normalizeProject, isValidUscc,
  validateNdrcRules, validateOdiFull,
} from "./odiNdrcRules";
import { getIssues } from "./odiValidationEngine";
import { allFieldDefs } from "../field/odiFieldCatalog";
import { emptyField, type OdiField } from "../data/types";
import { commitField, setMaterialValues } from "../field/odiGuideLogic";
import { seedAssistFieldPool, DEMO_CONTRIBUTION_ROWS } from "../../components/odiProjectData";

function emptyPool(): OdiField[] {
  return allFieldDefs().map(d => emptyField(d.code, d.name, d.round, d.dept));
}

describe("归一化口径(正式版 rules.py)", () => {
  it("企业名:NFKC+去空白,不放宽逐字一致", () => {
    expect(normalizeEntity("上海 XX 公司")).toBe("上海XX公司");
    expect(normalizeEntity("上海ＸＸ公司")).toBe("上海XX公司"); // 全角→半角(NFKC)
    expect(normalizeEntity("上海XX公司 ")).not.toBe("上海XX公 司"); // 多一字仍不同
  });
  it("项目名:NFKC+去空白+去全部中英文标点", () => {
    expect(normalizeProject("A公司（上海）项目")).toBe(normalizeProject("A公司(上海)项目"));
    expect(normalizeProject("A 公司,在甲国.项目")).toBe("A公司在甲国项目");
  });
  it("USCC:18位数字或大写字母", () => {
    expect(isValidUscc("91310000MA1FL2XX3A")).toBe(true);
    expect(isValidUscc("91310000ma1fl2xx3a")).toBe(false); // 小写非法
    expect(isValidUscc("91310000MA1FL2XX3")).toBe(false);  // 17位
  });
});

describe("发改委首批规则(P2)", () => {
  it("无材料值的池:除 blocked 三条外全部未触发,不产生三态", () => {
    const r = validateNdrcRules(emptyPool());
    expect(r.checks.length).toBe(29);
    expect(r.checks.filter(c => c.status === "blocked").length).toBe(3); // A-033/C-010/X-019 恒 blocked
    expect(r.checks.filter(c => c.status === "未触发").length).toBe(26);
    expect(getIssues({ ...r, hints: r.hints }).length).toBe(0);
  });

  it("A-004 主体名跨材料不一致 → 不通过,并列出不一致来源", () => {
    let pool = emptyPool();
    pool = setMaterialValues(pool, "domestic_company_name", [
      { material: "备案表", value: "上海XX智能装备集团有限公司" },
      { material: "营业执照", value: "上海XX智能装备集团有限责任公司" }, // 多"责任"二字
    ]);
    const c = validateNdrcRules(pool).checks.find(x => x.id === "NDRC-A-004")!;
    expect(c.status).toBe("不通过");
    expect(c.suggestion).toContain("营业执照");
  });

  it("A-004 归一化等价(仅空白/全半角差异) → 通过", () => {
    let pool = emptyPool();
    pool = setMaterialValues(pool, "domestic_company_name", [
      { material: "备案表", value: "上海XX智能装备集团有限公司" },
      { material: "营业执照", value: " 上海ＸＸ智能装备集团有限公司 " },
    ]);
    expect(validateNdrcRules(pool).checks.find(x => x.id === "NDRC-A-004")!.status).toBe("通过");
  });

  it("A-006 USCC 备案表≠营业执照 → 不通过;格式非法 → 不通过", () => {
    let pool = emptyPool();
    pool = setMaterialValues(pool, "uscc", [
      { material: "备案表", value: "91310000MA1FL2XX3A" },
      { material: "营业执照", value: "91310000MA1FL2XX3B" },
    ]);
    expect(validateNdrcRules(pool).checks.find(x => x.id === "NDRC-A-006")!.status).toBe("不通过");
    pool = setMaterialValues(pool, "uscc", [{ material: "备案表", value: "9131000XX" }]);
    const c = validateNdrcRules(pool).checks.find(x => x.id === "NDRC-A-006")!;
    expect(c.status).toBe("不通过");
    expect(c.suggestion).toContain("18 位");
  });

  it("A-003 项目名跨材料不一致 → 不通过", () => {
    let pool = emptyPool();
    pool = setMaterialValues(pool, "project_name", [
      { material: "备案表", value: "A公司在越南新建工厂项目" },
      { material: "请示", value: "A公司在越南新建工厂项目" },
      { material: "承诺书", value: "A公司越南工厂项目" },
    ]);
    expect(validateNdrcRules(pool).checks.find(x => x.id === "NDRC-A-003")!.status).toBe("不通过");
  });

  it("A-002 项目名称应包含投资主体名称", () => {
    let pool = emptyPool();
    pool = commitField(pool, "domestic_company_name", "上海XX集团有限公司", "upload");
    pool = commitField(pool, "project_name", "在越南新建工厂项目", "upload"); // 缺主体名
    expect(validateNdrcRules(pool).checks.find(x => x.id === "NDRC-A-002")!.status).toBe("不通过");
    pool = commitField(pool, "project_name", "上海XX集团有限公司在越南新建工厂项目", "upload");
    expect(validateNdrcRules(pool).checks.find(x => x.id === "NDRC-A-002")!.status).toBe("通过");
  });

  it("E-012 净资产 备案表↔审计 差异>0.01万 → 不通过", () => {
    let pool = emptyPool();
    pool = setMaterialValues(pool, "net_assets", [
      { material: "备案表", value: "8000" },
      { material: "审计报告", value: "7500" },
    ]);
    expect(validateNdrcRules(pool).checks.find(x => x.id === "NDRC-E-012")!.status).toBe("不通过");
  });

  it("E-011 容差 ±0.01 万内 → 通过", () => {
    let pool = emptyPool();
    pool = setMaterialValues(pool, "total_assets", [
      { material: "备案表", value: "12000.00" },
      { material: "审计报告", value: "12000.01" },
    ]);
    expect(validateNdrcRules(pool).checks.find(x => x.id === "NDRC-E-011")!.status).toBe("通过");
  });
});

describe("组合引擎 validateOdiFull", () => {
  it("商务线+发改委+跨业务合并,三域齐全,NDRC 计入发改委域", () => {
    const r = validateOdiFull(seedAssistFieldPool(false), { contributionRows: DEMO_CONTRIBUTION_ROWS });
    expect(r.summaries.length).toBe(3);
    const ndrc = r.summaries.find(s => s.dept === "发改委")!;
    expect(ndrc.passed).toBe(2 + 25); // 商务线归发改委的必填(项目说明2) + NDRC 25 条通过(P3 含存在性/格式4条)
    expect(ndrc.blocked).toBe(3);     // A-033/C-010/X-019 口径待定,不计入三态
    expect(r.checks.filter(c => c.id.startsWith("NDRC-")).length).toBe(29);
    // 干净池全部通过
    expect(r.summaries.every(s => s.failed + s.missing === 0)).toBe(true);
  });

  it("问题池:USCC/承诺书计入发改委不通过,XB 投资总额计入跨业务(与 mock p1 口径一致)", () => {
    const r = validateOdiFull(seedAssistFieldPool(true), { contributionRows: DEMO_CONTRIBUTION_ROWS });
    const ndrc = r.summaries.find(s => s.dept === "发改委")!;
    expect(ndrc.failed).toBe(2); // NDRC-A-006 + NDRC-C-009
    const sum = (k: "passed" | "failed" | "missing") => r.summaries.reduce((n, s) => n + s[k], 0);
    expect(sum("failed")).toBe(4); // 商务线 regcap + NDRC uscc + NDRC 承诺书 + XB 投资总额
    expect(sum("missing")).toBe(2);
    expect(sum("passed")).toBe(54);
  });
});

describe("发改委第二批规则(P2 续)", () => {
  const row = (over: Partial<import("../data/types").OdiContributionRow>) => ({
    id: "r1", contributor: "上海XX公司", method: "货币", source: "境内自有", amountUsdWan: "800", ...over,
  });

  it("A-035 出资方式非法枚举 → 不通过;A-036 来源非法 → 不通过", () => {
    let pool = emptyPool();
    pool = commitField(pool, "chinese_investment_amount", "800", "guide");
    const r = validateNdrcRules(pool, { contributionRows: [row({ method: "现金" }), row({ source: "境外融资", id: "r2" })] });
    expect(r.checks.find(c => c.id === "NDRC-A-035")!.status).toBe("不通过");
    expect(r.checks.find(c => c.id === "NDRC-A-036")!.status).toBe("不通过");
  });

  it("A-037 行内折算冲突 → FIELD_CONFLICT;A-039 冲突先行不通过", () => {
    let pool = emptyPool();
    pool = commitField(pool, "chinese_investment_amount", "800", "guide");
    const rows = [row({ amountUsdWan: "50", note: "人民币400万元按7.2折算" })]; // 400/7.2=55.56 ≠ 50
    const r = validateNdrcRules(pool, { contributionRows: rows });
    expect(r.checks.find(c => c.id === "NDRC-A-037")!.status).toBe("不通过");
    expect(r.checks.find(c => c.id === "NDRC-A-037")!.evidence).toContain("FIELD_CONFLICT");
    expect(r.checks.find(c => c.id === "NDRC-A-039")!.status).toBe("不通过");
  });

  it("A-038 method=其他 无备注 → 缺失;有备注 → 通过", () => {
    let pool = emptyPool();
    pool = commitField(pool, "chinese_investment_amount", "800", "guide");
    let r = validateNdrcRules(pool, { contributionRows: [row({ method: "其他" })] });
    expect(r.checks.find(c => c.id === "NDRC-A-038")!.status).toBe("缺失");
    r = validateNdrcRules(pool, { contributionRows: [row({ method: "其他", note: "境外发债" })] });
    expect(r.checks.find(c => c.id === "NDRC-A-038")!.status).toBe("通过");
  });

  it("A-039 合计≠中方投资额 → 不通过;一致 → 通过", () => {
    let pool = emptyPool();
    pool = commitField(pool, "chinese_investment_amount", "800", "guide");
    let r = validateNdrcRules(pool, { contributionRows: [row({ amountUsdWan: "500" })] });
    expect(r.checks.find(c => c.id === "NDRC-A-039")!.status).toBe("不通过");
    r = validateNdrcRules(pool, { contributionRows: [row({ amountUsdWan: "800" })] });
    expect(r.checks.find(c => c.id === "NDRC-A-039")!.status).toBe("通过");
  });

  it("F-007 自有余额不足 → 不通过(覆盖判定 actual+0.01≥expected)", () => {
    let pool = emptyPool();
    pool = commitField(pool, "self_funds_available", "700", "guide");
    pool = commitField(pool, "self_funds_domestic", "800", "guide"); // 构成回退口径
    const r = validateNdrcRules(pool);
    expect(r.checks.find(c => c.id === "NDRC-F-007")!.status).toBe("不通过");
    expect(r.checks.find(c => c.id === "NDRC-F-007")!.suggestion).toContain("资金证明");
  });

  it("F-006 全部自有场景:余额覆盖中方投资额 → 通过;混合来源 → 未触发", () => {
    let pool = emptyPool();
    pool = commitField(pool, "self_funds_available", "800", "guide");
    pool = commitField(pool, "chinese_investment_amount", "800", "guide");
    let r = validateNdrcRules(pool, { contributionRows: [row({})] });
    expect(r.checks.find(c => c.id === "NDRC-F-006")!.status).toBe("通过");
    r = validateNdrcRules(pool, { contributionRows: [row({ source: "境内其他", note: "银行贷款" })] });
    expect(r.checks.find(c => c.id === "NDRC-F-006")!.status).toBe("未触发");
  });

  it("R-009 人民币折算不符 → 不通过;缺汇率 → 未触发", () => {
    let pool = emptyPool();
    pool = commitField(pool, "cny_balance", "5760", "guide");
    pool = commitField(pool, "cny_balance_usd", "700", "guide"); // 5760/7.2=800 ≠ 700
    pool = commitField(pool, "exchange_rate", "7.2", "guide");
    expect(validateNdrcRules(pool).checks.find(c => c.id === "NDRC-R-009")!.status).toBe("不通过");
    pool = commitField(pool, "exchange_rate", "", "guide");
    expect(validateNdrcRules(pool).checks.find(c => c.id === "NDRC-R-009")!.status).toBe("未触发");
  });

  it("M-003 四要件缺「真实商业需求」→ 不通过;C-009 缺责任表述 → 不通过", () => {
    let pool = emptyPool();
    pool = commitField(pool, "commitment_body", "材料真实、合法、有效。本项目投资真实存在。不存在虚假投资。", "guide");
    const r = validateNdrcRules(pool);
    expect(r.checks.find(c => c.id === "NDRC-M-003")!.status).toBe("不通过");
    expect(r.checks.find(c => c.id === "NDRC-M-003")!.evidence).toContain("真实商业需求");
    expect(r.checks.find(c => c.id === "NDRC-C-009")!.status).toBe("不通过");
  });

  it("B-012 请示缺附件说明 → 缺失(五要素)", () => {
    let pool = emptyPool();
    pool = commitField(pool, "domestic_company_name", "上海XX公司", "guide");
    pool = commitField(pool, "petition_body", "关于上海XX公司项目申请备案的请示\n上海市发展和改革委员会：\n按照《企业境外投资管理办法》有关规定申请备案。\n上海XX公司", "guide");
    const r = validateNdrcRules(pool);
    const c = r.checks.find(x => x.id === "NDRC-B-012")!;
    expect(c.status).toBe("缺失");
    expect(c.evidence).toContain("附件");
  });

  it("blocked 三条恒为 blocked,不计入三态", () => {
    const r = validateNdrcRules(emptyPool());
    const blocked = r.checks.filter(c => c.status === "blocked");
    expect(blocked.map(c => c.id).sort()).toEqual(["NDRC-A-033", "NDRC-C-010", "NDRC-X-019"]);
    expect(r.summaries[0].blocked).toBe(3);
    expect(r.summaries[0].total).toBe(0);
  });
});
