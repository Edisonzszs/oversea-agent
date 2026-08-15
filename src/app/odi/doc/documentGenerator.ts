// 商务委三件参考稿生成(移植源 POC documentGenerator 子集)。
// 入参为 ODI 统一字段池 OdiField[];用 Task 5 的 getVal 取值,缺失处渲染"（待补充）"。
// 仅产出 Blob,下载由 UI(Task 10)用 file-saver 完成。
//
// Blob 环境:docx 的 Packer.toBlob 在浏览器与 Node 18+(全局 Blob)下均可用,
// 因此 gen*Blob 直接调用 Packer.toBlob;测试在 vitest 默认 node 环境下断言 Blob 非空。
//
// 移植自: E:\claude\出海智能体原生POC\...\services\documentGenerator.ts
// 主要差异: 入参由 DocGenContext 改为 pool: OdiField[];字段码改用 Task 2 字段目录;
//           承诺书按 establishment_method 分版本;字段缺失统一渲染"（待补充）"。

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} from "docx";
import type { OdiField } from "../data/types";
import { getVal } from "../field/odiGuideLogic";

const PENDING = "（待补充）";
const PAGE_MARGINS = { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } };

/** 取字段值;空串/缺失 → "（待补充）"。 */
function gv(pool: OdiField[], code: string): string {
  const v = getVal(pool, code);
  return v && v.trim() !== "" ? v : PENDING;
}

/** 取字段原始值(不回落到 PENDING),用于条件分支。 */
function raw(pool: OdiField[], code: string): string {
  return getVal(pool, code);
}

/** "标签：值" 段落(label 加粗);值缺失时为"（待补充）"。 */
function fieldParagraph(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}：`, bold: true }),
      new TextRun(value),
    ],
  });
}

/** 标题块:大标题(居中)+ 可选副标题 + 空行。 */
function titleParagraphs(title: string, subtitle?: string): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
  ];
  if (subtitle) paras.push(new Paragraph({ text: subtitle, alignment: AlignmentType.CENTER }));
  paras.push(new Paragraph({}));
  return paras;
}

/** 落款块(盖章/签字/日期)。 */
function signParagraphs(): Paragraph[] {
  return [
    new Paragraph({}),
    new Paragraph({ text: "投资主体（盖章）：", alignment: AlignmentType.RIGHT }),
    new Paragraph({ text: "法定代表人（签字）：", alignment: AlignmentType.RIGHT }),
    new Paragraph({ text: "日期：     年   月   日", alignment: AlignmentType.RIGHT }),
  ];
}

/* ───────────────────────── 境外投资备案表 ───────────────────────── */

export function buildOdiFormDocument(pool: OdiField[]): Document {
  return new Document({
    sections: [{
      properties: PAGE_MARGINS,
      children: [
        ...titleParagraphs("境外投资备案表", "（商务部门备案用）"),

        new Paragraph({ text: "一、投资主体信息", heading: HeadingLevel.HEADING_2 }),
        fieldParagraph("境内公司名称", gv(pool, "domestic_company_name")),
        fieldParagraph("所属行业", gv(pool, "industry")),

        new Paragraph({}),
        new Paragraph({ text: "二、投资事项信息", heading: HeadingLevel.HEADING_2 }),
        fieldParagraph("投资方式", gv(pool, "investment_method")),
        fieldParagraph("设立方式", gv(pool, "establishment_method")),
        fieldParagraph("投资国家或地区", gv(pool, "investment_country")),
        fieldParagraph("投资目的地", gv(pool, "final_destination")),
        fieldParagraph("投资总额", gv(pool, "investment_total")),
        fieldParagraph("中方投资额", gv(pool, "chinese_investment_amount")),

        new Paragraph({}),
        new Paragraph({ text: "三、境外企业信息", heading: HeadingLevel.HEADING_2 }),
        fieldParagraph("境外企业中文名称", gv(pool, "overseas_company_cn")),
        fieldParagraph("境外企业外文名称", gv(pool, "overseas_company_en")),
        fieldParagraph("经营范围", gv(pool, "business_scope")),
        fieldParagraph("境外企业注册资本", gv(pool, "overseas_registered_capital")),

        new Paragraph({}),
        new Paragraph({ text: "四、投资项目情况", heading: HeadingLevel.HEADING_2 }),
        fieldParagraph("项目简况", gv(pool, "project_summary")),
        fieldParagraph("项目意义", gv(pool, "project_significance")),
        fieldParagraph("中方股比", gv(pool, "chinese_ratio")),
        fieldParagraph("外方股比", gv(pool, "foreign_ratio")),

        ...signParagraphs(),
      ],
    }],
  });
}

export async function genOdiFormBlob(pool: OdiField[]): Promise<Blob> {
  return Packer.toBlob(buildOdiFormDocument(pool));
}

/* ───────────────────── 真实性承诺书(按设立方式分版本) ───────────────────── */
// spec §5.3:设立方式决定商务委真实性承诺书版本。
// 本任务做最小两版本分支:establishment_method === "新设独资" → 新设独资版;否则 → 通用版(并购/增资变更/合资)。

export function buildCommitmentLetterDocument(pool: OdiField[]): Document {
  const company = gv(pool, "domestic_company_name");
  const country = gv(pool, "investment_country");
  const total = gv(pool, "investment_total");
  const establishment = raw(pool, "establishment_method");
  const investMethod = gv(pool, "investment_method");

  const isNewWofe = establishment === "新设独资";

  const bodyParagraphs: Paragraph[] = isNewWofe
    ? [
        new Paragraph({
          text: `一、本企业拟在${country}新设境外独资企业,持股比例 100%,投资总额${total}。该境外投资行为真实、合法,不存在虚假投资、虚假注册等情形。`,
        }),
        new Paragraph({ text: "二、本企业投资资金来源合法合规,不涉及非法资金转移、洗钱等违法行为。" }),
        new Paragraph({ text: "三、本次新设独资境外企业符合国家相关法律法规和政策要求,不涉及国家限制或禁止的领域。" }),
        new Paragraph({ text: "四、本企业将按规定办理境外投资外汇、报到及后续报告等手续,并及时报告境外企业设立与运营情况。" }),
        new Paragraph({ text: "五、如违反上述承诺,本企业愿承担相应的法律责任。" }),
      ]
    : [
        new Paragraph({
          text: `一、本企业拟在${country}以「${gv(pool, "establishment_method")}」方式开展境外投资(投资方式:${investMethod};投资总额:${total})。该境外投资行为真实、合法,不存在虚假投资、虚假注册等情形。`,
        }),
        new Paragraph({ text: "二、本企业投资资金来源合法合规,不涉及非法资金转移、洗钱等违法行为。" }),
        new Paragraph({ text: "三、本次境外投资符合国家相关法律法规和政策要求,不涉及国家限制或禁止的领域。" }),
        new Paragraph({ text: "四、本企业将按规定办理境外投资相关手续,并及时报告项目进展和变化情况。" }),
        new Paragraph({ text: "五、如违反上述承诺,本企业愿承担相应的法律责任。" }),
      ];

  return new Document({
    sections: [{
      properties: PAGE_MARGINS,
      children: [
        ...titleParagraphs("境外投资真实性承诺书"),
        new Paragraph({
          children: [
            new TextRun("本企业（"),
            new TextRun({ text: company, bold: true }),
            new TextRun("），统一社会信用代码："),
            new TextRun({ text: gv(pool, "domestic_company_name") === PENDING ? PENDING : "（按企业主档填写）", bold: true }),
            new TextRun("，现就境外投资事项郑重承诺如下："),
          ],
        }),
        new Paragraph({}),
        ...bodyParagraphs,
        ...signParagraphs(),
      ],
    }],
  });
}

export async function genCommitmentLetterBlob(pool: OdiField[]): Promise<Blob> {
  return Packer.toBlob(buildCommitmentLetterDocument(pool));
}

/* ───────────────────── 可行性研究报告(主体/投资/背景/方案/风险/效益) ───────────────────── */

export function buildFeasibilityReportDocument(pool: OdiField[]): Document {
  const company = gv(pool, "domestic_company_name");
  const country = gv(pool, "investment_country");

  return new Document({
    sections: [{
      properties: PAGE_MARGINS,
      children: [
        ...titleParagraphs("境外投资可行性研究报告", `（${company} — ${country}投资）`),

        // 一、主体
        new Paragraph({ text: "一、投资主体基本情况", heading: HeadingLevel.HEADING_2 }),
        fieldParagraph("境内公司名称", gv(pool, "domestic_company_name")),
        fieldParagraph("所属行业", gv(pool, "industry")),

        // 二、投资
        new Paragraph({}),
        new Paragraph({ text: "二、投资情况", heading: HeadingLevel.HEADING_2 }),
        fieldParagraph("投资国家或地区", gv(pool, "investment_country")),
        fieldParagraph("投资目的地", gv(pool, "final_destination")),
        fieldParagraph("投资方式", gv(pool, "investment_method")),
        fieldParagraph("设立方式", gv(pool, "establishment_method")),
        fieldParagraph("境外企业名称", gv(pool, "overseas_company_cn")),
        fieldParagraph("经营范围", gv(pool, "business_scope")),
        fieldParagraph("境外企业注册资本", gv(pool, "overseas_registered_capital")),
        fieldParagraph("投资总额", gv(pool, "investment_total")),
        fieldParagraph("中方投资额", gv(pool, "chinese_investment_amount")),
        fieldParagraph("折算汇率", gv(pool, "exchange_rate")),
        fieldParagraph("投资总额（人民币）", gv(pool, "investment_total_rmb")),

        // 三、背景
        new Paragraph({}),
        new Paragraph({ text: "三、投资背景与必要性", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: gv(pool, "project_summary") }),

        // 四、方案
        new Paragraph({}),
        new Paragraph({ text: "四、投资方案", heading: HeadingLevel.HEADING_2 }),
        fieldParagraph("中方股东", gv(pool, "chinese_shareholder")),
        fieldParagraph("中方股比", gv(pool, "chinese_ratio")),
        fieldParagraph("外方股东", gv(pool, "foreign_shareholder")),
        fieldParagraph("外方股比", gv(pool, "foreign_ratio")),
        fieldParagraph("现金出资_境内", gv(pool, "cash_domestic")),
        fieldParagraph("自有资金_境内", gv(pool, "self_funds_domestic")),
        fieldParagraph("银行贷款_境内", gv(pool, "bank_loan_domestic")),

        // 五、风险
        new Paragraph({}),
        new Paragraph({ text: "五、风险分析", heading: HeadingLevel.HEADING_2 }),
        fieldParagraph("潜在风险及应对方案", gv(pool, "potential_risks")),
        new Paragraph({ text: "（含政治风险、经济风险、法律风险、汇率风险等分析,请据实补充）", italics: true, color: "888888" }),

        // 六、效益
        new Paragraph({}),
        new Paragraph({ text: "六、经济效益与意义", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: gv(pool, "project_significance") }),

        ...signParagraphs(),
      ],
    }],
  });
}

export async function genFeasibilityReportBlob(pool: OdiField[]): Promise<Blob> {
  return Packer.toBlob(buildFeasibilityReportDocument(pool));
}
