// 规则 id → 证据引用(校验结果"原文出处"定位)。
// 集中维护映射而不是侵入各规则实现:49 条规则在 odiValidationEngine/odiNdrcRules/odiXbRules,
// 定位展示只在本表登记的规则上出现「原文出处」入口。
// 语义:code = 涉及字段;materials = 限定材料(缺省时用该字段全部材料值,或主值+默认材料)。

import type { OdiMaterialKey } from "../data/types";

export interface EvidenceRef {
  code: string;
  materials?: OdiMaterialKey[];
}

/** 商务线口径字段(值默认在商务备案表原文定位);其余默认发改备案表 */
const COMMERCE_DEFAULT_CODES = new Set([
  "investment_country", "investment_method", "establishment_method", "overseas_registered_capital",
  "investment_total", "overseas_company_cn", "overseas_company_en", "direct_destination", "final_destination",
  "business_scope", "industry", "chinese_shareholder", "chinese_ratio", "foreign_shareholder", "foreign_ratio",
  "reg_capital_chinese_ratio", "reg_capital_foreign_ratio",
  "chinese_investment_amount", "foreign_investment_amount", "exchange_rate",
  "cny_currency_1", "cny_amount_1", "cny_currency_2", "cny_amount_2",
  "cash_domestic", "self_funds_domestic", "bank_loan_domestic", "inkind_domestic", "intangible_domestic",
  "equity_domestic", "other_domestic", "self_funds_overseas", "bank_loan_overseas", "other_overseas",
  "project_summary", "project_significance",
]);

export function defaultMaterialFor(code: string): OdiMaterialKey {
  return COMMERCE_DEFAULT_CODES.has(code) ? "商务备案表" : "备案表";
}

const NDRC_SIDE: OdiMaterialKey[] = ["备案表", "营业执照", "审计报告", "承诺书", "请示"];
const BOTH_SIDES: OdiMaterialKey[] = ["商务备案表", "备案表"];

export const RULE_EVIDENCE_REFS: Record<string, EvidenceRef[]> = {
  // ── 商务线 13 条即时校验 ──
  "rule-method-consistency": [{ code: "investment_method" }, { code: "establishment_method" }],
  "rule-amount-consistency": [{ code: "chinese_investment_amount" }, { code: "foreign_investment_amount" }, { code: "investment_total" }],
  "rule-equity-ratio": [{ code: "chinese_ratio" }, { code: "foreign_ratio" }],
  "rule-ratio-amount-alignment": [{ code: "chinese_ratio" }, { code: "chinese_investment_amount" }, { code: "investment_total" }],
  "rule-currency-breakdown": [{ code: "cny_currency_1" }, { code: "cny_amount_1" }, { code: "chinese_investment_amount" }],
  "rule-cash-breakdown": [{ code: "cash_domestic" }, { code: "self_funds_domestic" }, { code: "bank_loan_domestic" }],
  "rule-regcap-vs-total": [{ code: "overseas_registered_capital" }, { code: "investment_total" }],
  "rule-contribution": [{ code: "self_funds_domestic" }, { code: "chinese_investment_amount" }],
  "rule-destination": [{ code: "direct_destination" }, { code: "final_destination" }],
  // ── 发改委规则族 ──
  "NDRC-A-002": [{ code: "project_name" }, { code: "domestic_company_name" }],
  "NDRC-A-003": [{ code: "project_name", materials: ["备案表", "请示", "承诺书"] }],
  "NDRC-A-004": [{ code: "domestic_company_name", materials: NDRC_SIDE }],
  "NDRC-A-006": [{ code: "uscc", materials: ["备案表", "营业执照"] }],
  "NDRC-E-011": [{ code: "total_assets", materials: ["备案表", "审计报告"] }],
  "NDRC-E-012": [{ code: "net_assets", materials: ["备案表", "审计报告"] }],
  "NDRC-E-013": [{ code: "main_business_revenue", materials: ["备案表", "审计报告"] }],
  "NDRC-E-014": [{ code: "net_profit", materials: ["备案表", "审计报告"] }],
  "NDRC-A-026": [{ code: "exchange_rate" }],
  "NDRC-A-030": [{ code: "cny_currency_1" }, { code: "cny_amount_1" }],
  "NDRC-A-051": [{ code: "contact_phone" }],
  "NDRC-A-054": [{ code: "contact_email" }],
  "NDRC-A-039": [{ code: "chinese_investment_amount" }],
  "NDRC-F-006": [{ code: "self_funds_available", materials: ["资金证明"] }, { code: "chinese_investment_amount" }],
  "NDRC-F-007": [{ code: "self_funds_available", materials: ["资金证明"] }, { code: "self_funds_domestic" }],
  "NDRC-F-011": [{ code: "financing_available", materials: ["资金证明"] }, { code: "bank_loan_domestic" }],
  "NDRC-F-014": [{ code: "self_funds_available", materials: ["资金证明"] }, { code: "financing_available", materials: ["资金证明"] }],
  "NDRC-R-009": [{ code: "cny_balance", materials: ["资金证明"] }, { code: "cny_balance_usd", materials: ["资金证明"] }],
  "NDRC-M-003": [{ code: "commitment_body", materials: ["承诺书"] }],
  "NDRC-C-009": [{ code: "commitment_body", materials: ["承诺书"] }],
  "NDRC-B-012": [{ code: "petition_body", materials: ["请示"] }],
  // ── 跨业务核心字段 ──
  "XB-D001": [{ code: "domestic_company_name", materials: BOTH_SIDES }],
  "XB-D005": [{ code: "investment_method", materials: BOTH_SIDES }],
  "XB-D006": [{ code: "final_destination", materials: BOTH_SIDES }],
  "XB-D008": [{ code: "investment_total", materials: BOTH_SIDES }],
  "XB-D009": [{ code: "chinese_investment_amount", materials: BOTH_SIDES }],
  "XB-D014": [{ code: "contact_phone", materials: BOTH_SIDES }],
  "XB-D015": [{ code: "contact_email", materials: BOTH_SIDES }],
};

/** 展示层入口:该规则是否提供原文出处 */
export function hasEvidenceRefs(ruleId: string): boolean {
  return !!RULE_EVIDENCE_REFS[ruleId];
}
