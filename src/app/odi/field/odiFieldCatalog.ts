import type { OdiDept, OdiScene } from "../data/types";

export interface FieldDef {
  code: string; name: string; round: 1|2|3|4|5|6|7;
  dept: OdiDept; required?: boolean; derived?: boolean;
  kind?: "text" | "select" | "number" | "currency";
  options?: string[];
  note?: string;  // 口径(spec 各轮"字段口径")
}

// R1 基础信息(spec 6.2)
const R1: FieldDef[] = [
  { code: "investment_country", name: "投资国家或地区", round: 1, dept: "shared", required: true, note: "最终目的地国别;用于标准化/币种/风险提示" },
  { code: "investment_method", name: "投资方式", round: 1, dept: "shared", required: true, kind: "select", options: ["新设", "并购", "增资", "变更"], note: "决定是否触发并购专项 R7" },
  { code: "establishment_method", name: "设立方式", round: 1, dept: "commerce", required: true, kind: "select", options: ["新设独资", "合资", "并购", "增资变更"], note: "决定商务委真实性承诺书版本" },
  { code: "overseas_registered_capital", name: "境外目标企业注册资本", round: 1, dept: "shared", required: true, kind: "currency" },
  { code: "investment_total", name: "投资总额", round: 1, dept: "shared", required: true, kind: "currency", note: "金额校验基础" },
];

// R2 项目情况
const R2: FieldDef[] = [
  { code: "domestic_company_name", name: "境内公司名称", round: 2, dept: "shared", required: true, note: "企业主档复用(认证预填)" },
  { code: "overseas_company_cn", name: "境外企业中文名称", round: 2, dept: "shared", required: true },
  { code: "overseas_company_en", name: "境外企业外文名称", round: 2, dept: "shared" },
  { code: "direct_destination", name: "直接目的地", round: 2, dept: "shared", required: true, note: "第一层级境外企业所在地;单层路径可与最终目的地相同(流程文档#11:两档分别保存)" },
  { code: "final_destination", name: "投资目的地(最终目的地)", round: 2, dept: "shared", required: true, note: "最终项目经营/建设/并购标的所在地" },
  { code: "business_scope", name: "经营范围", round: 2, dept: "shared", required: true },
  { code: "industry", name: "所属行业", round: 2, dept: "shared", required: true },
];

// R3 投资结构
const R3: FieldDef[] = [
  { code: "chinese_shareholder", name: "中方股东", round: 3, dept: "shared", required: true },
  { code: "chinese_ratio", name: "中方股比", round: 3, dept: "shared", required: true, kind: "number" },
  { code: "foreign_shareholder", name: "外方股东", round: 3, dept: "shared" },
  { code: "foreign_ratio", name: "外方股比", round: 3, dept: "shared", kind: "number" },
  { code: "restricted_export", name: "是否涉及限制出口产品和技术行业", round: 3, dept: "ndrc", kind: "select", options: ["是", "否"] },
  { code: "multi_country_interest", name: "是否影响一国或地区以上利益", round: 3, dept: "ndrc", kind: "select", options: ["是", "否"] },
  { code: "reg_capital_chinese_ratio", name: "注册资本中方比例", round: 3, dept: "shared", kind: "number" },
  { code: "reg_capital_foreign_ratio", name: "注册资本外方比例", round: 3, dept: "shared", kind: "number" },
];

// R4 投资金额(含派生)
const R4: FieldDef[] = [
  { code: "chinese_investment_amount", name: "中方投资额", round: 4, dept: "shared", required: true, kind: "currency" },
  { code: "foreign_investment_amount", name: "外方投资额", round: 4, dept: "shared", kind: "currency" },
  { code: "exchange_rate", name: "折算汇率", round: 4, dept: "shared", kind: "number" },
  { code: "cny_currency_1", name: "中方出资币种1", round: 4, dept: "shared" },
  { code: "cny_amount_1", name: "中方出资金额1", round: 4, dept: "shared", kind: "currency" },
  { code: "cny_currency_2", name: "中方出资币种2", round: 4, dept: "shared" },
  { code: "cny_amount_2", name: "中方出资金额2", round: 4, dept: "shared", kind: "currency" },
  // 派生
  { code: "chinese_investment_rmb", name: "中方投资额人民币", round: 4, dept: "shared", derived: true, kind: "currency" },
  { code: "foreign_investment_rmb", name: "外方投资额人民币", round: 4, dept: "shared", derived: true, kind: "currency" },
  { code: "investment_total_rmb", name: "投资总额人民币", round: 4, dept: "shared", derived: true, kind: "currency" },
];

// R5 出资安排
const R5: FieldDef[] = [
  { code: "cash_domestic", name: "现金出资_境内", round: 5, dept: "shared", kind: "currency" },
  { code: "self_funds_domestic", name: "自有资金_境内", round: 5, dept: "shared", kind: "currency" },
  { code: "bank_loan_domestic", name: "银行贷款_境内", round: 5, dept: "shared", kind: "currency" },
  { code: "inkind_domestic", name: "实物出资_境内", round: 5, dept: "shared", kind: "currency" },
  { code: "intangible_domestic", name: "无形资产出资_境内", round: 5, dept: "shared", kind: "currency" },
  { code: "equity_domestic", name: "股权出资_境内", round: 5, dept: "shared", kind: "currency" },
  { code: "other_domestic", name: "其他出资_境内", round: 5, dept: "shared", kind: "currency" },
  { code: "self_funds_overseas", name: "自有资金_境外", round: 5, dept: "shared", kind: "currency" },
  { code: "bank_loan_overseas", name: "银行贷款_境外", round: 5, dept: "shared", kind: "currency" },
  { code: "other_overseas", name: "其他出资_境外", round: 5, dept: "shared", kind: "currency" },
];

// R6 项目说明
const R6: FieldDef[] = [
  { code: "project_summary", name: "项目简况", round: 6, dept: "shared", required: true, note: "伴填可起草;禁编造收益/就业/税收/市场规模/经营业绩/风险事实" },
  { code: "project_significance", name: "项目意义", round: 6, dept: "shared", required: true },
];

// R7 并购专项(仅并购)
const R7: FieldDef[] = [
  { code: "merger_subsidiary_name", name: "并购实施子公司名称", round: 7, dept: "shared", required: true },
  { code: "domestic_reg_capital", name: "境内投资主体注册资本", round: 7, dept: "shared", kind: "currency" },
  { code: "merger_subsidiary_reg_capital", name: "并购实施子公司注册资本", round: 7, dept: "shared", kind: "currency" },
  { code: "merger_subsidiary_location", name: "并购实施子公司注册地点", round: 7, dept: "shared" },
  { code: "merger_background", name: "并购背景", round: 7, dept: "shared" },
  { code: "merger_equity_detail", name: "拟并购股权、资产或业务情况", round: 7, dept: "shared" },
  { code: "transaction_method", name: "交易方式", round: 7, dept: "shared" },
  { code: "funding_plan", name: "资金筹措方案", round: 7, dept: "shared" },
  { code: "preliminary_schedule", name: "初步时间安排", round: 7, dept: "shared" },
  { code: "potential_risks", name: "潜在风险及应对方案", round: 7, dept: "shared" },
  { code: "govt_service_needed", name: "需政府提供的服务", round: 7, dept: "shared" },
];

export const ROUND_FIELDS: Record<1|2|3|4|5|6|7, FieldDef[]> = {
  1: R1, 2: R2, 3: R3, 4: R4, 5: R5, 6: R6, 7: R7,
};

export function getFieldsForRound(round: 1|2|3|4|5|6|7, scene: OdiScene): FieldDef[] {
  if (round === 7 && scene !== "并购") return [];
  return ROUND_FIELDS[round];
}

export function allFieldDefs(): FieldDef[] {
  return [1,2,3,4,5,6].flatMap(r => ROUND_FIELDS[r as 1|2|3|4|5|6]).concat(R7);
}
export function allFieldCodes(): string[] {
  return allFieldDefs().map(f => f.code);
}
