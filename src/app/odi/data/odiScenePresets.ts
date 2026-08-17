// ODI 预制场景预设值 + 快速体验预填(Task 7,spec §5.1)。
// SCENE_PRESETS:三场景的示例值(fieldCode -> value);applyPreset 把预设写入空池。
// 调用方:createGuideProject(name, scene, "快速体验") 时由 odiProjects.ts 调用 applyPreset。

import type { OdiField, OdiScene } from "./types";
import { commitField } from "../field/odiGuideLogic";

export const SCENE_PRESETS: Record<OdiScene, Record<string, string>> = {
  "新设独资": {
    investment_country: "越南", investment_method: "新设", establishment_method: "新设独资",
    domestic_company_name: "上海XX智能装备集团有限公司",
    overseas_registered_capital: "500万美元", investment_total: "800万美元",
    overseas_company_cn: "越南XX智能装备有限公司", direct_destination: "越南", final_destination: "越南·胡志明市",
    business_scope: "智能装备制造", industry: "制造业",
    contact_name: "王海", contact_phone: "13800138000", contact_email: "wanghai@xx-sh.com",
    chinese_shareholder: "上海XX公司", chinese_ratio: "100",
    chinese_investment_amount: "800", foreign_investment_amount: "0", exchange_rate: "7.2",
    // 现金出资为合计项(=自有资金+银行贷款,备案表口径"现金出资X万,其中:自有Y,银行贷款Z")
    cash_domestic: "800", self_funds_domestic: "800",
    cny_currency_1: "美元", cny_amount_1: "800",
    project_summary: "(示例)在越南胡志明市设立智能装备生产基地,服务东南亚市场。",
    project_significance: "(示例)贴近东南亚客户、降低关税与物流成本。",
  },
  "并购": {
    investment_country: "德国", investment_method: "并购", establishment_method: "并购",
    domestic_company_name: "上海XX工业集团有限公司",
    overseas_registered_capital: "1000万欧元", investment_total: "1000万美元",
    overseas_company_cn: "德国XX工业有限公司", direct_destination: "德国", final_destination: "德国",
    business_scope: "工业设备制造", industry: "工业设备制造",
    contact_name: "李德", contact_phone: "13900139000", contact_email: "lide@xx-sh.com",
    chinese_shareholder: "上海XX公司", chinese_ratio: "80", foreign_shareholder: "原股东", foreign_ratio: "20",
    chinese_investment_amount: "800", foreign_investment_amount: "200", exchange_rate: "7.2",
    merger_subsidiary_name: "上海XX(德国)并购实施子公司",
    merger_background: "(示例)并购德国工业设备企业,获取技术与欧洲渠道。",
  },
  "增资变更": {
    investment_country: "新加坡", investment_method: "增资", establishment_method: "增资变更",
    domestic_company_name: "上海XX科技投资有限公司",
    overseas_registered_capital: "600万美元", investment_total: "500万美元",
    overseas_company_cn: "新加坡XX研发中心", direct_destination: "新加坡", final_destination: "新加坡",
    business_scope: "软件和信息技术服务", industry: "信息传输、软件和信息技术服务业",
    contact_name: "陈新", contact_phone: "13700137000", contact_email: "chenxin@xx-sh.com",
    chinese_shareholder: "上海XX公司", chinese_ratio: "100",
    chinese_investment_amount: "500", foreign_investment_amount: "0", exchange_rate: "7.2",
    project_summary: "(示例)对新加坡研发中心增资,扩大研发团队。",
  },
};

/** 把指定场景的预设值写入字段池;只写池中已存在的字段码(忽略预设里多余的码)。 */
export function applyPreset(pool: OdiField[], scene: OdiScene): OdiField[] {
  const preset = SCENE_PRESETS[scene];
  let p = pool;
  for (const [code, value] of Object.entries(preset)) {
    if (p.some(f => f.code === code)) p = commitField(p, code, value, "guide");
  }
  return p;
}
