import { describe, it, expect } from "vitest";
import { emptyField } from "../data/types";
import { applyLinkage, computeDerived, shouldShowRound7, commitField, getVal } from "./odiGuideLogic";

const pool = () => [
  emptyField("investment_method", "投资方式", 1, "shared"),
  emptyField("domestic_company_name", "境内公司", 2, "shared"),
  emptyField("chinese_shareholder", "中方股东", 3, "shared"),
  emptyField("chinese_ratio", "中方股比", 3, "shared"),
  emptyField("foreign_shareholder", "外方股东", 3, "shared"),
  emptyField("foreign_ratio", "外方股比", 3, "shared"),
  emptyField("reg_capital_chinese_ratio", "注册资中方比例", 3, "shared"),
  emptyField("chinese_investment_amount", "中方投资额", 4, "shared"),
  emptyField("foreign_investment_amount", "外方投资额", 4, "shared"),
  emptyField("exchange_rate", "汇率", 4, "shared"),
  emptyField("investment_total_rmb", "投资总额人民币", 4, "shared"),
  emptyField("chinese_investment_rmb", "中方投资额人民币", 4, "shared"),
  emptyField("foreign_investment_rmb", "外方投资额人民币", 4, "shared"),
];

describe("ODI guide logic", () => {
  it("shouldShowRound7:投资方式=并购 → true,否则 false", () => {
    let p = pool(); expect(shouldShowRound7(p)).toBe(false);
    p = commitField(p, "investment_method", "并购", "guide");
    expect(shouldShowRound7(p)).toBe(true);
  });

  it("applyLinkage:无外方股东 → 单一中方默认(中方=境内公司100%,外方空,注册资中方=100%)", () => {
    let p = pool();
    p = commitField(p, "domestic_company_name", "上海XX公司", "guide");
    p = commitField(p, "foreign_shareholder", "", "guide"); // 无外方
    p = applyLinkage(p);
    expect(getVal(p, "chinese_shareholder")).toBe("上海XX公司");
    expect(getVal(p, "chinese_ratio")).toBe("100");
    expect(getVal(p, "foreign_ratio")).toBe("");
    expect(getVal(p, "reg_capital_chinese_ratio")).toBe("100");
  });

  it("computeDerived:中方100万美元 + 汇率7.2 → 人民币720万;投资总额人民币=中+外", () => {
    let p = pool();
    p = commitField(p, "chinese_investment_amount", "100", "guide");
    p = commitField(p, "foreign_investment_amount", "50", "guide");
    p = commitField(p, "exchange_rate", "7.2", "guide");
    p = computeDerived(p);
    expect(getVal(p, "chinese_investment_rmb")).toBe("720");
    expect(getVal(p, "foreign_investment_rmb")).toBe("360");
    expect(getVal(p, "investment_total_rmb")).toBe("1080");
  });

  it("commitField 写值后 status=confirmed,origin 记入 sources", () => {
    const p = commitField(pool(), "investment_method", "新设", "guide");
    const f = p.find(x => x.code === "investment_method")!;
    expect(f.value).toBe("新设");
    expect(f.status).toBe("confirmed");
    expect(f.sources.some(s => s.origin === "guide")).toBe(true);
  });
});
