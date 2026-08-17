import { describe, it, expect } from "vitest";
import {
  normalizeEntity, normalizeProject, isValidUscc,
  validateNdrcRules, validateOdiFull,
} from "./odiNdrcRules";
import { getIssues } from "./odiValidationEngine";
import { allFieldDefs } from "../field/odiFieldCatalog";
import { emptyField, type OdiField } from "../data/types";
import { commitField, setMaterialValues } from "../field/odiGuideLogic";
import { seedAssistFieldPool } from "../../components/odiProjectData";

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
  it("无材料值的池:全部未触发,不产生三态", () => {
    const r = validateNdrcRules(emptyPool());
    expect(r.checks.length).toBe(8);
    expect(r.checks.every(c => c.status === "未触发")).toBe(true);
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
  it("商务线+发改委合并,三域齐全,NDRC 计入发改委域", () => {
    const r = validateOdiFull(seedAssistFieldPool(false));
    expect(r.summaries.length).toBe(3);
    const ndrc = r.summaries.find(s => s.dept === "发改委")!;
    expect(ndrc.passed).toBe(2 + 8); // 商务线归发改委的必填(项目说明2) + NDRC 8 条全部通过
    expect(r.checks.filter(c => c.id.startsWith("NDRC-")).length).toBe(8);
    // 干净池全部通过
    expect(r.summaries.every(s => s.failed + s.missing === 0)).toBe(true);
  });

  it("问题池:USCC 不一致计入发改委不通过(与 mock p1 口径一致)", () => {
    const r = validateOdiFull(seedAssistFieldPool(true));
    const ndrc = r.summaries.find(s => s.dept === "发改委")!;
    expect(ndrc.failed).toBe(1); // NDRC-A-006
    const sum = (k: "passed" | "failed" | "missing") => r.summaries.reduce((n, s) => n + s[k], 0);
    expect(sum("failed")).toBe(2); // 商务线 regcap + NDRC uscc
    expect(sum("missing")).toBe(2);
    expect(sum("passed")).toBe(29);
  });
});
