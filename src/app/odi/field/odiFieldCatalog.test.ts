import { describe, it, expect } from "vitest";
import { getFieldsForRound, allFieldCodes } from "./odiFieldCatalog";

describe("ODI 字段目录", () => {
  it("R1 含投资国家/投资方式/设立方式/注册资本/投资总额", () => {
    const codes = getFieldsForRound(1, "新设独资").map(f => f.code);
    expect(codes).toEqual(expect.arrayContaining([
      "investment_country", "investment_method", "establishment_method",
      "overseas_registered_capital", "investment_total",
    ]));
  });

  it("R4 含两个中方出资币种/金额对 + 派生字段标记", () => {
    const r4 = getFieldsForRound(4, "新设独资");
    const codes = r4.map(f => f.code);
    expect(codes).toContain("cny_currency_1"); expect(codes).toContain("cny_amount_1");
    expect(codes).toContain("cny_currency_2"); expect(codes).toContain("cny_amount_2");
    const derived = r4.find(f => f.code === "investment_total_rmb");
    expect(derived?.derived).toBe(true);
  });

  it("并购场景 R7 出现,新设独资 R7 不出现(7 轮函数返回空)", () => {
    expect(getFieldsForRound(7, "并购").length).toBeGreaterThan(0);
    expect(getFieldsForRound(7, "新设独资")).toEqual([]);
  });

  it("allFieldCodes 不重复", () => {
    const all = allFieldCodes();
    expect(new Set(all).size).toBe(all.length);
  });
});
