// ODI 材料模拟原文 + 证据定位(校验结果"原文出处"功能)。
// POC 未接 OCR:按《ODI备案申请材料清单(8类表单)》原始模板版式,从统一字段池
// (含多来源材料值)生成各材料的模拟原文,校验问题的证据值在其中定位 → UI 高亮。
// 真实解析链路接入后,本模块的"生成"替换为真实文档行即可,定位/展示逻辑不变。
//
// 版式来源(ODI流程材料/ODI备案申请材料清单(8类表单)):
//   · 备案表     ← 《1境外投资备案申请表(发改部门)》:十九大项格式文本,2 列表格(栏目|内容)
//   · 商务备案表 ← 《1境外投资备案申请表(商务部门)》:4 列表格复刻 Word 原表
//                  (左侧栏目列合并单元格/联系人侧栏/股权结构中方外方分组/构成境内境外分组)
//   · 承诺书     ← 《4-1境外投资真实性承诺书(商务部门)》:标题→致委→引言→承诺正文→落款→附签字单(信函式)
//   · 请示       ← 《9-1企业项目申请备案的请示(发改部门)》公文版式:标题→文号→主送→正文→附件→落款(信函式)
//   执照/审计/资金证明不属 8 类表单模板,维持骨架式模拟。
// 表格文档:MaterialDoc.rows 提供时 UI 按 Word 表格渲染;lines[i] 恒等于第 i 行文本,
// 证据命中索引空间不变。约定:字段值为空显示"（未识别）";模板栏目无对应字段显示"（略）"。

import type { OdiContributionRow, OdiField, OdiMaterialKey } from "../data/types";
import { getVal } from "../field/odiGuideLogic";

export interface MaterialDoc {
  material: OdiMaterialKey;
  title: string;
  lines: string[];
  rows?: DocCell[][];     // 表格式文档(Word 复刻):提供时按表格渲染
  colWidths?: string[];   // 表格列宽(如 ["16%","44%","12%","28%"])
}

/** 表格单元格:span/rowSpan 对应 Word 合并单元格;lines 为格内多行 */
export interface DocCell {
  text?: string;
  lines?: string[];
  span?: number;
  rowSpan?: number;
  kind?: "label" | "head" | "note" | "title"; // label=左侧栏目(灰底) head=区段标题 note=备注 title=居中标题
  align?: "center" | "right";
}

/** 取字段值:优先指定材料的识别值,回退字段主值 */
function val(pool: OdiField[], code: string, material?: OdiMaterialKey): string {
  if (material) {
    const mv = (pool.find(f => f.code === code)?.materialValues ?? []).find(m => m.material === material);
    if (mv?.value?.trim()) return mv.value;
  }
  return getVal(pool, code);
}

/** 目的地组合值拆栏:"越南·胡志明市" → ["越南","胡志明市"](备案表按 国/省(州、市) 分栏) */
function splitDest(v: string): [string, string] {
  const parts = v.split("·").map(s => s.trim());
  return [parts[0] ?? "", parts[1] ?? ""];
}

function cellTexts(c: DocCell): string[] {
  return c.lines ?? (c.text != null ? [c.text] : [""]);
}

/** 表格文档:lines[i] = 第 i 行各单元格文本以全角空格连接(证据命中索引空间) */
function tableDoc(material: OdiMaterialKey, title: string, colWidths: string[] | undefined, rows: DocCell[][]): MaterialDoc {
  return { material, title, colWidths, rows, lines: rows.map(r => r.map(c => cellTexts(c).join("　")).join("　")) };
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
  const pct = (v: string) => (v && v.trim() ? `${v}%` : "（未识别）");
  const fd = splitDest(val(pool, "final_destination"));
  const cfd = splitDest(val(pool, "final_destination", "商务备案表"));
  const method = val(pool, "investment_method", "商务备案表");
  const radio = `●${method}　　○${["新设", "并购", "变更"].filter(m => m !== method).join("　　○")}`;

  // ── 发改备案表(十九大项格式文本,2 列表格:区段标题整行 + 栏目|内容) ──
  docs.push(tableDoc("备案表", "境外投资项目备案表（发改部门）", ["50%", "50%"], [
    [{ text: "境外投资项目备案表", kind: "title", span: 2, align: "center" }],
    [{ text: "项目代码：（网络系统自动赋码）", span: 2 }],
    [{ text: "一、项目名称", kind: "head", span: 2 }],
    [{ text: E(val(pool, "project_name")), span: 2 }],
    [{ text: "二、投资主体情况（涉及多个投资主体的，按出资额大小逐一填写）", kind: "head", span: 2 }],
    [{ text: `企业名称：${E(val(pool, "domestic_company_name"))}` }, { text: `信用代码：${E(val(pool, "uscc"))}` }],
    [{ text: "注册地址：（略）" }, { text: `注册资本：${E(val(pool, "domestic_reg_capital"))}` }],
    [{ text: "成立日期：（略）" }, { text: "企业类型：（略）" }],
    [{ text: "经营范围：（略）", span: 2 }],
    [{ text: "近两年信用情况：（略）", span: 2 }],
    [{ text: "企业资产、经营状况（单位：万元人民币）", kind: "head", span: 2 }],
    [{ text: `（最新）年末总资产：${E(val(pool, "total_assets"))}　　净资产：${E(val(pool, "net_assets"))}`, span: 2 }],
    [{ text: `（最新）年度主营业务收入：${E(val(pool, "main_business_revenue"))}　　净利润：${E(val(pool, "net_profit"))}`, span: 2 }],
    [{ text: "三、投资主体控制且本项目涉及的境外企业情况（如有）", kind: "head", span: 2 }],
    [{ text: "（略）", span: 2 }],
    [{ text: "四、投资地点", kind: "head", span: 2 }],
    [{ text: `直接目的地：${E(splitDest(val(pool, "direct_destination"))[0])}`, span: 2 }],
    [{ text: `最终目的地：${E(fd[0])}　　省（州、市）：${E(fd[1])}`, span: 2 }],
    [{ text: "其他有关国家和地区：（略）", span: 2 }],
    [{ text: "五、投资行业领域", kind: "head", span: 2 }],
    [{ text: E(val(pool, "industry")), span: 2 }],
    [{ text: "六、投资方式", kind: "head", span: 2 }],
    [{ text: E(val(pool, "investment_method")), span: 2 }],
    [{ text: "七、项目背景情况", kind: "head", span: 2 }],
    [{ text: "（略）", span: 2 }],
    [{ text: "八、项目主要内容和规模", kind: "head", span: 2 }],
    [{ text: E(val(pool, "project_summary")), span: 2 }],
    [{ text: "九、项目总投资额", kind: "head", span: 2 }],
    [{ text: `美元计价金额（万美元）：${E(val(pool, "investment_total"))}` }, { text: `美元兑人民币汇率：${E(val(pool, "exchange_rate"))}` }],
    [{ text: "十、中方投资额", kind: "head", span: 2 }],
    [{ text: `美元计价金额（万美元）：${E(val(pool, "chinese_investment_amount"))}` }, { text: `美元兑人民币汇率：${E(val(pool, "exchange_rate"))}` }],
    [{ text: "十一、中方投资额构成（逐一填写出资情况）", kind: "head", span: 2 }],
    [{ text: "企业名称｜出资方式｜资金来源｜金额（万美元）", kind: "label", span: 2 }],
    ...(rows.length > 0 ? rows.map((r, i) =>
      [{ text: `${["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"][i] ?? i + 1}　${r.contributor || "（未识别）"}｜${r.method}｜${r.source}｜${r.amountUsdWan}`, span: 2 } as DocCell])
      : [[{ text: "（构成明细未识别）", span: 2 }] as DocCell[]]),
    [{ text: "十二、中方投资的用途说明", kind: "head", span: 2 }],
    [{ text: "（略）", span: 2 }],
    [{ text: "十三、其他企业出资情况（如有）", kind: "head", span: 2 }],
    [{ text: "（略）", span: 2 }],
    [{ text: "十四、项目主要风险及防范应对措施", kind: "head", span: 2 }],
    [{ text: "（略）", span: 2 }],
    [{ text: "十五、项目对我国国家利益和国家安全的影响分析", kind: "head", span: 2 }],
    [{ text: "（略）", span: 2 }],
    [{ text: "十六、下一步工作计划", kind: "head", span: 2 }],
    [{ text: "（略）", span: 2 }],
    [{ text: "十七、希望国家依法给予协助的事项（如有）", kind: "head", span: 2 }],
    [{ text: "（略）", span: 2 }],
    [{ text: "十八、投资主体认为需要说明的事项（如有）", kind: "head", span: 2 }],
    [{ text: "（略）", span: 2 }],
    [{ text: "十九、附件清单", kind: "head", span: 2 }],
    [{ text: "（一）投资主体注册登记证明文件", span: 2 }],
    [{ text: "（二）追溯至最终实际控制人的投资主体股权架构图", span: 2 }],
    [{ text: "（三）最新经审计的投资主体财务报表", span: 2 }],
    [{ text: "（四）投资主体投资决策文件", span: 2 }],
    [{ text: "（五）具有法律约束力的投资协议或类似文件", span: 2 }],
    [{ text: "（六）证明投资资金来源真实合规的支持性文件", span: 2 }],
    [{ text: "（七）境外投资真实性承诺书", span: 2 }],
    [{ text: "申报联系人（网络系统填报）", kind: "head", span: 2 }],
    [{ text: `姓名：${E(val(pool, "contact_name"))}　　手机：${E(val(pool, "contact_phone"))}`, span: 2 }],
    [{ text: `电子邮件：${E(val(pool, "contact_email"))}`, span: 2 }],
  ]));

  // ── 商务备案表(4 列表格复刻 Word 原表:栏目列/内容列/联系人侧栏/合并单元格) ──
  docs.push(tableDoc("商务备案表", "境外投资备案表（商务部门）", ["16%", "44%", "12%", "28%"], [
    [{ text: "境外投资备案表", kind: "title", span: 4, align: "center" }],
    [{ text: "单位：万美元", kind: "note", span: 4, align: "right" }],
    [{ text: "【系统统一编号】", span: 4, align: "center" }],
    [{ text: "基本事由", kind: "label" }, { text: `${E(val(pool, "domestic_company_name"))}申请在${E(val(pool, "investment_country"))}以${E(val(pool, "investment_method", "商务备案表"))}（${E(val(pool, "establishment_method"))}）成立${E(val(pool, "overseas_company_cn"))}`, span: 3 }],
    [
      { text: "境内投资主体", kind: "label", rowSpan: 4 },
      { text: `名称：${E(val(pool, "domestic_company_name", "商务备案表"))}` },
      { text: "联系人", kind: "label", rowSpan: 4 },
      { text: `姓名：${E(val(pool, "contact_name"))}` },
    ],
    [{ text: "法定代表人：（略）" }, { text: "座机：（略）" }],
    [{ text: "地址：（略）" }, { text: `手机：${E(val(pool, "contact_phone", "商务备案表"))}` }],
    [{ text: "所有制类型：（略）" }, { text: `电子邮件：${E(val(pool, "contact_email", "商务备案表"))}` }],
    [{ text: "主管部门/集团总部", kind: "label" }, { text: "（略）", span: 3 }],
    [{ text: "投资路径（仅限第一层级境外企业）", kind: "label" }, { text: "名称：（可视情增加）" }, { text: `国家（地区）：${E(splitDest(val(pool, "direct_destination"))[0])}`, span: 2 }],
    [{ text: "境外投资最终目的地", kind: "label" }, { text: `国家（地区）：${E(cfd[0])}　　省（州）：${E(cfd[1])}　　城市：（略）`, span: 3 }],
    [{ text: "境外企业名称（最终目的地）", kind: "label" }, { text: `中文：${E(val(pool, "overseas_company_cn"))}　　外文：${E(val(pool, "overseas_company_en"))}`, span: 3 }],
    [
      { text: "股权结构", kind: "label", rowSpan: 4 },
      { text: "中方", kind: "label", rowSpan: 2 },
      { text: `股东1：${E(val(pool, "chinese_shareholder"))}` },
      { text: `股比：${pct(val(pool, "chinese_ratio"))}` },
    ],
    [{ text: "股东2：（可视情增加）" }, { text: "股比：（未识别）" }],
    [{ text: "外方", kind: "label", rowSpan: 2 }, { text: `股东1：${E(val(pool, "foreign_shareholder"))}` }, { text: `股比：${pct(val(pool, "foreign_ratio"))}` }],
    [{ text: "股东2：（可视情增加）" }, { text: "股比：（未识别）" }],
    [{ text: "设立方式", kind: "label" }, { text: radio, span: 3 }],
    [{ text: "经营范围", kind: "label" }, { text: E(val(pool, "business_scope")), span: 3 }],
    [{ text: "境外企业所属行业", kind: "label", rowSpan: 2 }, { text: E(val(pool, "industry")), span: 3 }],
    [{ lines: ["□ 是否属于涉及出口国家限制出口的产品和技术的行业", "□ 是否属于影响一国（地区）以上利益的行业"], span: 3 }],
    [{ text: "注册资本", kind: "label" }, { text: `${E(val(pool, "overseas_registered_capital"))}，中方占${pct(val(pool, "reg_capital_chinese_ratio"))}股份，外方占${pct(val(pool, "reg_capital_foreign_ratio"))}股份`, span: 3 }],
    [{ text: "投资规模", kind: "label" }, { text: `投资总额${E(val(pool, "investment_total", "商务备案表"))}（折合${E(val(pool, "investment_total_rmb"))}万元人民币），其中，1.中方投资额${E(val(pool, "chinese_investment_amount", "商务备案表"))}（折合${E(val(pool, "chinese_investment_rmb"))}万元人民币）；2.外方投资额${E(val(pool, "foreign_investment_amount"))}（折合${E(val(pool, "foreign_investment_rmb"))}万元人民币）。折算汇率：1美元＝${E(val(pool, "exchange_rate"))}元人民币`, span: 3 }],
    [{ text: "中方出资币种和金额（单位：万）", kind: "label", rowSpan: 2 }, { text: `币种1：${E(val(pool, "cny_currency_1"))}　　金额：${E(val(pool, "cny_amount_1"))}万`, span: 3 }],
    [{ text: "币种2：（可视情增加）", span: 3 }],
    [
      { text: "中方投资的构成（单位：万美元）", kind: "label", rowSpan: 2 },
      { text: "境内", kind: "label" },
      { lines: [`1.现金出资${E(val(pool, "cash_domestic"))}（包括股东借款等债权出资），其中：自有资金${E(val(pool, "self_funds_domestic"))}，银行贷款${E(val(pool, "bank_loan_domestic"))}（包括项目融资）；`, `2.实物出资${E(val(pool, "inkind_domestic"))}；3.无形资产${E(val(pool, "intangible_domestic"))}；4.股权出资${E(val(pool, "equity_domestic"))}；5.其他${E(val(pool, "other_domestic"))}。`], span: 2 },
    ],
    [{ text: "境外", kind: "label" }, { text: `1.自有资金${E(val(pool, "self_funds_overseas"))}；2.银行贷款${E(val(pool, "bank_loan_overseas"))}（包括内保外贷、外保外贷等）；3.其他${E(val(pool, "other_overseas"))}。`, span: 2 }],
    [{ text: "投资具体情况", kind: "label", rowSpan: 2 }, { text: "项目简况", kind: "label" }, { text: E(val(pool, "project_summary")), span: 2 }],
    [{ text: "项目意义", kind: "label" }, { text: E(val(pool, "project_significance")), span: 2 }],
    [{
      lines: [
        "本单位承诺本表中涉及的投资无以下情形：",
        "（一）危害中华人民共和国国家主权、安全和社会公共利益，或违反中华人民共和国法律法规；",
        "（二）损害中华人民共和国与有关国家（地区）关系；",
        "（三）违反中华人民共和国缔约或者参加的国际条约、协定；",
        "（四）出口中华人民共和国禁止出口的产品和技术。",
        "本单位保证以上填报事项及材料的真实性，承诺遵守中华人民共和国及投资目的地相关法律法规，并按照《境外投资管理办法》（商务部令2014年第3号）的规定开展境外投资。",
        `企业盖章：${E(val(pool, "domestic_company_name"))}`,
        "　　　　年　　月　　日",
      ], span: 4,
    }],
    [{ text: "注：实行核准管理的国家中，与我国未建交的国家名单参见中华人民共和国外交部网站；受联合国制裁的国家名单参见联合国中文网站。", kind: "note", span: 4 }],
    [{ text: "以下由商务部或省级商务主管机关填写：", kind: "head", span: 4 }],
    [{ text: "初核：　　　　复核：　　　　签发：", span: 4 }],
  ]));

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

  // ── 承诺书(4-1 商务部门模板:标题→致委→引言→承诺正文→落款→附签字单) ──
  const bodyLines = val(pool, "commitment_body")
    .split(/\n+/).filter(Boolean).map(l => l.trim())
    .filter(l => l !== "真实性承诺书"); // 字段值首行为标题,模板已提供,避免重复
  docs.push({
    material: "承诺书", title: "境外投资真实性承诺书",
    lines: [
      "境外投资真实性承诺书",
      "上海市商务委员会：",
      `　　${E(val(pool, "domestic_company_name"))}（以下简称“我公司”）在${E(val(pool, "investment_country"))}国家（地区）以境外直接投资方式设立${E(val(pool, "overseas_company_cn"))}（以下简称“本项投资”），为保证本项投资的顺利进行，我公司特此承诺如下：`,
      ...bodyLines.map(l => `　　${l}`),
      "此致。",
      `${E(val(pool, "domestic_company_name"))}（加盖公章）`,
      "　　　　年　　月　　日",
      "附：本项投资决策人员签字单（投资决策人员应包含董事会决议或相关出资决议的签字）",
      "（附本项投资决策人员身份证复印件）",
    ],
  });

  // ── 请示(9-1 发改部门公文模板:标题→文号→主送→正文→附件→落款) ──
  const petitionLines = val(pool, "petition_body").split(/\n+/).filter(Boolean).map(l => l.trim());
  docs.push({
    material: "请示", title: "企业项目申请备案的请示（发改部门）",
    lines: [
      ...(petitionLines.length > 0 ? [petitionLines[0]] : ["（未识别）"]),
      `${E(val(pool, "domestic_company_name"))}〔2026〕X号`,
      ...petitionLines.slice(1),
      "（加盖单位公章或本人签名）",
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
