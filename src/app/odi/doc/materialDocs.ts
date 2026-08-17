// ODI 材料模拟原文 + 证据定位(校验结果"原文出处"功能)。
// POC 未接 OCR:按材料模板从统一字段池(含多来源材料值)生成各材料的模拟原文行,
// 校验问题的证据值在其中定位 → UI 高亮。真实解析链路接入后,本模块的"生成"
// 替换为真实文档行即可,定位/展示逻辑不变。
//
// 原文行模板对齐 8 类表单结构(ODI流程材料/备案表样式):
//   发改备案表按十九大项节选;商务备案表按商务版栏目;执照/审计/承诺书/请示/资金证明
//   按 8 类表单模板骨架。值为空时显示"（未识别）"灰字,保持文档结构完整。

import type { OdiContributionRow, OdiField, OdiMaterialKey } from "../data/types";
import { getVal } from "../field/odiGuideLogic";

export interface MaterialDoc {
  material: OdiMaterialKey;
  title: string;
  lines: string[];
}

/** 取字段值:优先指定材料的识别值,回退字段主值 */
function val(pool: OdiField[], code: string, material?: OdiMaterialKey): string {
  if (material) {
    const mv = (pool.find(f => f.code === code)?.materialValues ?? []).find(m => m.material === material);
    if (mv?.value?.trim()) return mv.value;
  }
  return getVal(pool, code);
}

/** 行内是否命中证据值:逐出现位置做数字边界判断(避免"800"命中"1800"这类子串误报) */
export function lineHitsValue(line: string, value: string): boolean {
  const v = (value ?? "").trim();
  if (!v) return false;
  let idx = line.indexOf(v);
  while (idx >= 0) {
    const before = idx > 0 ? line[idx - 1] : "";
    const after = idx + v.length < line.length ? line[idx + v.length] : "";
    const startsDigit = /\d/.test(v[0]);
    const endsDigit = /\d/.test(v[v.length - 1]);
    const okBefore = !startsDigit || !/[.\d]/.test(before);
    const okAfter = !endsDigit || !/[.\d]/.test(after);
    if (okBefore && okAfter) return true;
    idx = line.indexOf(v, idx + 1);
  }
  return false;
}

/** 在文档行中定位证据值 → 命中行下标(全部) */
export function locateInDoc(doc: MaterialDoc, value: string): number[] {
  if (!value?.trim()) return [];
  const hits: number[] = [];
  doc.lines.forEach((line, i) => { if (lineHitsValue(line, value)) hits.push(i); });
  return hits;
}

export function buildMaterialDocs(pool: OdiField[], rows: OdiContributionRow[]): MaterialDoc[] {
  const docs: MaterialDoc[] = [];
  const E = (v: string) => (v && v.trim() ? v : "（未识别）");

  // ── 发改备案表(境外投资项目备案表,十九大项节选) ──
  docs.push({
    material: "备案表", title: "境外投资项目备案表（发改部门）",
    lines: [
      "境外投资项目备案表",
      "一、项目名称",
      `　　${E(val(pool, "project_name"))}`,
      "二、投资主体情况",
      `　　企业名称：${E(val(pool, "domestic_company_name"))}`,
      `　　统一社会信用代码：${E(val(pool, "uscc"))}`,
      "　　企业资产经营状况（万元人民币）",
      `　　　　年末总资产：${E(val(pool, "total_assets"))}　　净资产：${E(val(pool, "net_assets"))}`,
      `　　　　主营业务收入：${E(val(pool, "main_business_revenue"))}　　净利润：${E(val(pool, "net_profit"))}`,
      "四、投资地点",
      `　　直接目的地：${E(val(pool, "direct_destination"))}　　最终目的地：${E(val(pool, "final_destination"))}`,
      "九、项目总投资额",
      `　　美元计价金额（万美元）：${E(val(pool, "investment_total"))}`,
      `　　美元兑人民币汇率：${E(val(pool, "exchange_rate"))}`,
      "十、中方投资额",
      `　　中方投资额（万美元）：${E(val(pool, "chinese_investment_amount"))}`,
      "十一、中方投资额构成（逐一填写，万美元）",
      ...(rows.length > 0 ? rows.map((r, i) =>
        `　　${["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"][i] ?? i + 1}　${r.contributor || "（未识别）"}　${r.method}　${r.source}　${r.amountUsdWan}${r.note ? `　备注：${r.note}` : ""}`)
        : ["　　（构成明细未识别）"]),
      "表尾　联系人",
      `　　单位/部门：—　职务：—　联系人：${E(val(pool, "contact_name"))}`,
      `　　手机：${E(val(pool, "contact_phone"))}　　电子邮件：${E(val(pool, "contact_email"))}`,
    ],
  });

  // ── 商务备案表(境外投资备案表,商务部门版式) ──
  docs.push({
    material: "商务备案表", title: "境外投资备案表（商务部门）",
    lines: [
      "境外投资备案表（样式）　单位：万美元",
      "基本事由",
      `　　${E(val(pool, "domestic_company_name"))}申请在${E(val(pool, "investment_country"))}以${E(val(pool, "investment_method"))}（${E(val(pool, "establishment_method"))}）成立${E(val(pool, "overseas_company_cn"))}`,
      "境内投资主体　名称",
      `　　${E(val(pool, "domestic_company_name"))}`,
      "境外投资最终目的地",
      `　　国家（地区）：${E(val(pool, "final_destination", "商务备案表").split(/[·(（]/)[0])}　　省（州）/城市：${E(val(pool, "final_destination").split(/[·(（]/)[1] ?? "")}`,
      "股权结构　中方",
      `　　股东1：${E(val(pool, "chinese_shareholder"))}，股比：${E(val(pool, "chinese_ratio"))}%`,
      "注册资本",
      `　　${E(val(pool, "overseas_registered_capital"))}，中方占${E(val(pool, "reg_capital_chinese_ratio"))}股份`,
      "投资规模",
      `　　投资总额${E(val(pool, "investment_total", "商务备案表"))}；其中：1.中方投资额${E(val(pool, "chinese_investment_amount"))}（折合${E(val(pool, "chinese_investment_rmb"))}万元人民币）；2.外方投资额${E(val(pool, "foreign_investment_amount"))}。折算汇率：1：${E(val(pool, "exchange_rate"))}`,
      "中方出资币种和金额（单位：万）",
      `　　币种1：${E(val(pool, "cny_currency_1"))}　金额：${E(val(pool, "cny_amount_1"))}万`,
      "中方投资的构成（单位：万美元）—境内",
      `　　1.现金出资${E(val(pool, "cash_domestic"))}万（包括股东借款等债权出资），其中：自有资金${E(val(pool, "self_funds_domestic"))}万，银行贷款${E(val(pool, "bank_loan_domestic"))}万（包括项目融资）`,
      `　　2.实物出资${E(val(pool, "inkind_domestic"))}　3.无形资产${E(val(pool, "intangible_domestic"))}　4.股权出资${E(val(pool, "equity_domestic"))}　5.其他${E(val(pool, "other_domestic"))}`,
      "中方投资的构成—境外",
      `　　1.自有资金${E(val(pool, "self_funds_overseas"))}　2.银行贷款${E(val(pool, "bank_loan_overseas"))}（包括内保外贷、外保外贷等）　3.其他${E(val(pool, "other_overseas"))}`,
      "投资具体情况　项目简况",
      `　　${E(val(pool, "project_summary"))}`,
      "投资具体情况　项目意义",
      `　　${E(val(pool, "project_significance"))}`,
    ],
  });

  // ── 营业执照 ──
  docs.push({
    material: "营业执照", title: "营业执照（副本）",
    lines: [
      "营业执照（副本）",
      `　　名称：${E(val(pool, "domestic_company_name", "营业执照"))}`,
      `　　统一社会信用代码：${E(val(pool, "uscc", "营业执照"))}`,
      "　　类型：有限责任公司（法人独资）",
      "　　住所：上海市浦东新区XX路XX号",
      "　　注册资本：人民币 5,000 万元",
      "　　成立日期：2015年6月18日",
      "　　经营范围：智能装备制造、进出口业务…",
    ],
  });

  // ── 审计报告(取数口径行对齐 E-005~008) ──
  docs.push({
    material: "审计报告", title: "审计报告及财务报表",
    lines: [
      "审计报告及财务报表（最新年度，万元人民币）",
      "一、资产负债表",
      `　　负债和所有者权益合计（总资产）：${E(val(pool, "total_assets", "审计报告"))}`,
      `　　所有者权益合计（净资产）：${E(val(pool, "net_assets", "审计报告"))}`,
      "二、利润表",
      `　　营业收入（主营业务收入）：${E(val(pool, "main_business_revenue", "审计报告"))}`,
      `　　净利润：${E(val(pool, "net_profit", "审计报告"))}`,
    ],
  });

  // ── 承诺书(正文按行拆) ──
  docs.push({
    material: "承诺书", title: "境外投资真实性承诺书",
    lines: [
      "境外投资真实性承诺书",
      ...val(pool, "commitment_body").split(/\n+/).filter(Boolean).map(l => l.trim()),
      "　　承诺主体（盖章）：__",
      "　　日期：____年__月__日",
    ],
  });

  // ── 请示(正文按行拆) ──
  docs.push({
    material: "请示", title: "企业项目申请备案的请示",
    lines: [
      ...val(pool, "petition_body").split(/\n+/).filter(Boolean).map(l => l.trim()),
    ],
  });

  // ── 资金证明 ──
  docs.push({
    material: "资金证明", title: "银行存款证明 / 资金来源支持文件",
    lines: [
      "银行存款证明",
      `　　账户名称：${E(val(pool, "domestic_company_name"))}`,
      `　　自有资金可用余额（万美元）：${E(val(pool, "self_funds_available"))}`,
      `　　银行融资可用（万美元）：${E(val(pool, "financing_available"))}`,
      `　　人民币余额（万元）：${E(val(pool, "cny_balance"))}`,
      `　　折算美元（万美元）：${E(val(pool, "cny_balance_usd"))}　折算汇率：${E(val(pool, "exchange_rate"))}`,
    ],
  });

  return docs;
}
