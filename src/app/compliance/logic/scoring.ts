// 合规自查评分引擎 —— 业务逻辑层（无 React 依赖，可独立单测）。
// 忠实移植自合规 HTML 第五版 genReport() 的全部判档与计分逻辑。

import type { FileId, Mode } from "./weights";
import { fw, isENH, fileSet, FILE_LABEL, FILE_MOD, ENH_CAP, MODE_NAME } from "./weights";
import { isRiskCtry } from "./country";
import {
  type WizardState, val, checkedVals,
  hasArch, isMaListVisible, isVieRegVisible, isRiskCtryBlockVisible,
} from "./wizardModel";

export type Grade = "A" | "B" | "C" | "D";
export type ItemGrade = Grade | "I"; // I = 信息采集项，不参与判档

// ─── 档位文字（GRADE_TEXT）──────────────────────────────────────────────────
export const GRADE_TEXT: Record<Grade, [string, string]> = {
  A: ["材料齐备，可直接申报", "各项事实回答均达到申报要求，请按文件编制清单核对成册。"],
  B: ["基本具备，需补充材料", "基本达标，请按下方建议补齐材料后申报。"],
  C: ["存在需先解决的问题", "请先解决下列事项再行申报，避免被一次性告知补正甚至不予受理。"],
  D: ["存在禁止性情形或重大缺陷", "不建议按现方案申报，请调整方案或咨询专业机构。"],
};

// 档位 × 核心齐备度分档 的组合结论（COMBO）
export const COMBO: Record<Grade, { hi: string; mid: string; lo: string }> = {
  A: {
    hi: "材料齐备，可直接申报。",
    mid: "判断达标，请按缺失清单补齐材料后申报。",
    lo: "判断达标但材料不足，请先系统备料。",
  },
  B: {
    hi: "补少量说明类材料即可申报。",
    mid: "材料与说明并补后申报。",
    lo: "先备料，再申报。",
  },
  C: {
    hi: "材料虽齐，存在须先解决的实质问题，以整改为先。",
    mid: "问题整改与备料并行。",
    lo: "暂缓申报，系统整改。",
  },
  D: {
    hi: "档位 D：分数不改变结论，存在禁止性情形，不建议申报（分数仅供整改后备料参考）。",
    mid: "档位 D：分数不改变结论，不建议申报。",
    lo: "档位 D：分数不改变结论，不建议申报。",
  },
};

const ORDER: Record<Grade, number> = { A: 1, B: 2, C: 3, D: 4 };
export function worst(gs: Grade[]): Grade {
  let w: Grade = "A";
  for (const g of gs) if (ORDER[g] > ORDER[w]) w = g;
  return w;
}

// ─── 模块一 主体资格：描述 / 名称 / 行动 ───────────────────────────────────────
const Z_NAME: Record<string, string> = {
  z1: "自查1 股权架构及实控人（前置门槛）",
  z2: "自查2 主业合规性及关联性",
  z3: "自查3 规模与资金实力（前置门槛）",
  z4: "自查4 违法违规记录（前置门槛）",
  z5: "自查5 负面舆情",
  z6: "自查6 重大诉讼仲裁及调查",
};
const Z_DESC: Record<string, Record<string, string>> = {
  z1: { a: "架构完整、文件齐备、权益比例已算清，无空转安排", b: "架构完整，部分层级登记文件未齐——补齐文件", c: "多层嵌套但可说明商业合理性——备妥说明供审查判断", d: "无商业实质安排或无法追溯实控人——前置门槛：审查环节将不予受理" },
  z2: { a: "主业合规且与标的相关联", b: "主业合规但关联不明显——需补充商业合理性说明", c: "限制类/“两高”已完成合规改造——附改造证明", d: "淘汰类或未完成改造" },
  z3: { a: "实缴资本与所有者权益双覆盖且全自有资金", b: "覆盖，含非自有资金但合法来源可说明", c: "接近但未完全覆盖——补充其他合法资金来源证明", d: "明显不足且无合法来源证明——前置门槛：审查环节将不予受理" },
  z4: { a: "无违法违规记录，不在惩戒名单", b: "一般性行政处罚，与境外投资无关——附说明", c: "涉境外投资行政处罚但影响已消除——附整改证明", d: "刑罚记录/失信名单/资格罚限制期——前置门槛：审查环节将不予受理" },
  z5: { a: "无负面舆情", b: "有负面报道但与本次投资无关——附说明", c: "经营相关负面舆情已澄清处理——附澄清材料", d: "重大且未澄清的负面舆情" },
  z6: { a: "无未决诉讼仲裁调查", b: "一般性诉讼仲裁，金额小", c: "重大诉讼仲裁但经评估不影响——附分析说明", d: "可能影响正常经营及真实性认定的重大诉讼/调查" },
};
const Z_ACT: Record<string, Record<string, string>> = {
  z1: { b: "补齐部分层级的登记证明文件及加盖公章的中文翻译件", c: "编制多层嵌套架构的商业合理性说明（真实历史沿革、合规税务筹划等）", d: "调整架构：消除无商业实质安排，或补全至最终实际控制人的追溯链条（前置门槛）" },
  z2: { b: "补充主业与标的关联性的商业合理性说明（并入可研“投资合理性”专节）", c: "备妥限制类/“两高”合规改造完成的证明材料", d: "主业属淘汰类或未完成改造，不建议按现方案申报" },
  z3: { b: "备妥非自有资金合法来源说明（贷款合同、第三方资金协议等）", c: "补充其他合法资金来源证明（银行资金证明：商务、发改各一份独立出具）", d: "资金实力明显不足，建议调减投资额或引入合规共同投资人（前置门槛）" },
  z4: { b: "备妥一般性行政处罚与境外投资无关联的说明", c: "备妥行政处罚影响消除与整改证明", d: "处于禁止性情形（刑罚/失信/资格罚），不建议申报（前置门槛）" },
  z5: { b: "备妥负面报道与本次投资无关的说明（附检索记录）", c: "备妥舆情澄清或处理证明（可并入法律调查报告）", d: "先行处理并澄清重大负面舆情，再行申报" },
  z6: { b: "在法律调查报告中如实列明一般性诉讼仲裁情况", c: "编制重大诉讼仲裁不影响投资真实性与履约能力的分析说明", d: "重大诉讼/调查可能影响真实性认定，建议先行解决或调整方案；涉外国政府调查的注意 837 号令第二十二条程序" },
};

// ─── 变更类文字映射 ─────────────────────────────────────────────────────────
const C1_TEXT: Record<string, string> = { amt: "投资额变化", inv: "投资人变化", cap: "投资资本构成变化", biz: "业务范围变化", path: "投资路径变化", oth: "其他证书载明事项变化" };
const C3_TEXT: Record<string, string> = { nd: "新增境内投资人", nf: "新增境外投资人", rd: "减少既有投资人" };
const C4_TEXT: Record<string, string> = { zg: "转股", zjz: "增资或减资", tb: "转股与增资/减资同时进行" };
const S1B_TEXT: Record<string, string> = {
  li1: "锂电池正极材料", li2: "锂矿提锂/金属锂制备", re: "稀土提炼加工/永磁体", sc: "半导体/集成电路制造",
  ai: "人工智能大模型/算法", bd: "北斗/卫星导航技术", bio: "基因编辑/生物技术", uav: "无人机/反无人机技术",
  p3d: "3D 打印/增材制造", cnc: "高档数控机床", aero: "航空航天/燃气轮机", cf: "碳纤维/复合材料",
  uhv: "特高压输变电", tcm: "中药饮片炮制/珍稀药材",
};
const S3_TEXT: Record<string, string> = {
  ic: "集成电路与半导体设备", min: "关键矿产与稀土", bat: "新能源电池与材料", biomed: "生物医药与医疗器械",
  eq: "高端装备与数控机床", sw: "基础软件与工业软件", aero: "航空航天与燃气轮机", net: "通信与网络设备",
  pw: "特高压输变电与能源装备", mat: "碳纤维等关键新材料",
};

// ─── 结果类型 ────────────────────────────────────────────────────────────────
export interface ReportItem { mod: string; name: string; grade: ItemGrade; desc: string; }
export interface DocRow { file: string; form: string; }
export interface ScoreRow { fid: FileId; mod: string; label: string; tierLabel: string; status: string; got: number; }
export interface MissingCore { label: string; weight: number; }

interface ItemsResult {
  items: ReportItem[];
  actsD: string[]; actsC: string[]; actsB: string[];
  docs: DocRow[];
  path: string; route: string;
}

export interface FileScoreResult {
  score: number;          // 核心层得分（满分 100）
  maxAvail: number;       // 实际可得上限（100 - 不适用项合计）
  refScore: number;       // 含脱敏折算的核心参考分（80% 口径）
  enhScore: number;       // 增强加分
  enhCap: number;         // 增强上限
  maskW: number; maskN: number; maskNames: string[]; maskEnhN: number;
  missCore: MissingCore[]; missEnh: string[];
  rows: ScoreRow[];
}

export interface ActionItem { grade: "D" | "C" | "B"; text: string; orgs: string[]; }

export interface ReportResult {
  items: ReportItem[];
  actions: ActionItem[];   // 已按 D→C→B 排序
  docs: DocRow[];
  pathLine: string; routeLine: string; ackLine: string;
  grade: Grade;
  fileScore: FileScoreResult;
  comboText: string;
}

// ─── 条件不适用（对应 HTML fileNA）────────────────────────────────────────────
export function fileNA(fid: FileId, s: WizardState): boolean {
  if (fid === "f_t4") return !isRiskCtry(val(s, "p_ctry"));
  if (fid === "f_m1b") return val(s, "m1") === "na";
  return false;
}

// ─── 模块一~五 判档（对应 genReport 主体）──────────────────────────────────────
function computeItems(s: WizardState): ItemsResult {
  const items: ReportItem[] = [];
  const actsD: string[] = [], actsC: string[] = [], actsB: string[] = [];
  let docs: DocRow[] = [];
  let route = "";
  const mode = s.mode!;
  const item = (mod: string, name: string, g: ItemGrade, desc: string) =>
    items.push({ mod, name, grade: g, desc });
  const act = (g: Grade, txt: string) => {
    if (g === "D") actsD.push("【D】" + txt);
    else if (g === "C") actsC.push("【C】" + txt);
    else if (g === "B") actsB.push("【B】" + txt);
  };

  // 模块一
  (["z1", "z2", "z3", "z4", "z5", "z6"] as const).forEach((k) => {
    const v = val(s, k) ?? "";
    const g = v.toUpperCase() as Grade;
    item("模块一", Z_NAME[k], g, Z_DESC[k][v] ?? "");
    const a = Z_ACT[k][v];
    if (a) act(g, a);
  });

  // 模块二 分支
  let path = MODE_NAME[mode];
  if (mode === "new") {
    path += "（境外设立新企业·绿地投资）";
    const n1 = val(s, "n1"), n2 = val(s, "n2"), n3 = val(s, "n3");
    const g1: Grade = n1 === "a" ? "A" : "C";
    item("模块二·分支A", "成本测算表编制情况", g1, n1 === "a" ? "已按用款周期、分科目编制" : "未编制或未细分——未按周期分科目列示判档不高于 C");
    if (g1 !== "A") act("C", "编制成本测算表：以 1-3 年为一个用款周期，分科目列示各项支出");
    const g2: Grade = n2 === "a" ? "A" : n2 === "b" ? "B" : "C";
    item("模块二·分支A", "主要科目证明文件", g2, n2 === "a" ? "主要科目均有合同或意向书支持" : n2 === "b" ? "部分科目缺证明文件" : "大额科目缺乏证明文件");
    if (g2 === "B") act("B", "补充设备采购、雇员成本等大额科目对应的合同或合作意向书");
    if (g2 === "C") act("C", "取得主要支出科目对应的合同或合作意向书");
    const g3: Grade = n3 === "a" ? "A" : "C";
    item("模块二·分支A", "测算总额与投资额匹配度", g3, n3 === "a" ? "基本匹配" : "明显失配且无法解释——提示重新测算");
    if (g3 !== "A") act("C", "重新测算或书面解释投资额与支出的差异");
    docs = [
      { file: "成本测算表（分用款周期、分科目）", form: "加盖公章" },
      { file: "主要支出科目对应合同或合作意向书", form: "原件或复印件加盖公章" },
      { file: "可行性研究报告（含“投资合理性”专节）", form: "按指引结构编制" },
      { file: "拟设立境外企业章程（草案）", form: "外文附中文翻译" },
    ];
  }

  if (mode === "ma") {
    const m0a = val(s, "m0a"), m0b = val(s, "m0b"), m1 = val(s, "m1"), m2 = val(s, "m2"), m3 = val(s, "m3");
    const TYPE: Record<string, string> = { bg: "并购（取得全部股权）", kg: "控股（过半数股权或实际控制）", cg: "参股（不构成控制）" };
    const METH: Record<string, string> = { zr: "受让既有股东股份（老股转让）", zz: "增资认购新发行股份（增资入股）", hh: "转让+增资同时进行" };
    path += " · " + (TYPE[m0a ?? ""] ?? "") + " · " + (METH[m0b ?? ""] ?? "");
    item("模块二·分支B", "交易类型与实现方式", "I", (TYPE[m0a ?? ""] ?? "") + "；" + (METH[m0b ?? ""] ?? "") + "。（客观事实项，不参与判档，决定文件清单与审查要点）");
    item("模块二·分支B", "前期事项报告程序", "I", "并购/增资并购须先选择已填写或已通过的“并购事项前期报告表”（备案（核准）报告应用）方可填写申请表——请纳入交易时间表（商务部系统实测规则）");
    let g1: Grade;
    if (m1 === "na") {
      g1 = "A";
      const naR = (val(s, "m1na_reason") ?? "").replace(/</g, "＜");
      item("模块二·分支B", "尽调·审计·估值三报告", g1, "企业声明：标的公司财务审计报告因【" + naR + "】客观不适用，已按已满足处理；其余报告齐备。该声明向审批端披露，审批环节可复核。");
    } else {
      g1 = m1 === "a" ? "A" : m1 === "b" ? "B" : "C";
      item("模块二·分支B", "尽调·审计·估值三报告", g1, m1 === "a" ? "三报告齐备、机构资质完备" : m1 === "b" ? "个别资质证明或签章待补" : "缺报告——形式要件不满足判档不高于 C");
    }
    if (g1 === "B") act("B", "补齐出具机构执业资质证明及正式签章");
    if (g1 === "C") act("C", "委托有资质机构出具所缺报告（法律尽调/审计/估值）");
    const g2: Grade = m2 === "a" ? "A" : m2 === "c" ? "C" : "B";
    item("模块二·分支B", "定价公允性", g2, m2 === "a" ? "定价落在可比区间内" : m2 === "b" ? "定价偏离但已备充分理由，供审查判断" : m2 === "b2" ? "估值报告缺可比案例区间，需补充" : "定价偏离且无依据说明");
    if (m2 === "b2") act("B", "请估值机构补充相似/可比案例及估值区间分析");
    if (m2 === "c") act("C", "准备定价偏离的充分依据与理由说明");
    if (m0b === "hh") act("B", "转让+增资并用：核对老股受让价与新股认购价的定价基准，差异须可解释并在估值说明中列明");
    const g3: Grade = m3 === "a" ? "A" : m3 === "b" ? "B" : "C";
    item("模块二·分支B", "交易协议惯常条款", g3, m3 === "a" ? "惯常条款齐备" : m3 === "b" ? "个别条款谈判中" : "缺关键条款或存在明显不利异常安排——提示审查环节可能不予批准");
    if (g3 === "C") act("C", "完善协议关键条款；异常安排须能作出合理解释");
    docs = [
      { file: "并购事项前期报告表（系统“备案（核准）报告”应用先行填报）", form: "系统在线填报" },
      { file: "法律尽职调查报告", form: "机构资质证明+签章" },
      { file: "标的公司财务审计报告", form: "机构资质证明+签章" },
      { file: "第三方资产评估/估值报告（含可比区间）", form: "机构资质证明+签章" },
    ];
    if (m0b === "zr" || m0b === "hh") docs.push({ file: "股权转让协议（SPA）", form: "签署版或最终谈判版" });
    if (m0b === "zz" || m0b === "hh") docs.push({ file: "增资认购协议+标的公司股东（大）会增资决议", form: "签署版；决议附中文翻译" });
    docs.push({ file: "标的注册证明、股东名册、董事名册", form: "附中文翻译件（加盖公章）" });
    if (m0a === "cg") docs.push({ file: "股东协议/少数股东权利保护与退出安排条款", form: "签署版或最终谈判版" });
  }

  if (mode === "chg") {
    const c1 = checkedVals(s, "c1");
    const hits = c1.filter((v) => v !== "0").map((v) => C1_TEXT[v]);
    if (hits.length === 0) {
      path += "（证书载明事项均无变化）";
      item("模块二·分支C", "证书载明事项变化对照", "A", "投资额、投资人、资本构成、业务范围、投资路径等载明事项均未发生变化，本分支不适用，无需办理变更");
      docs = [{ file: "本分支无需追加文件", form: "" }];
    } else {
      path += " · " + hits.join("、");
      const c2 = val(s, "c2");
      const gApply: Grade = c2 === "a" ? "A" : "C";
      item("模块二·分支C", "证书载明事项变化对照", gApply, "已发生：" + hits.join("；"));
      const invOn = c1.includes("inv");
      if (invOn) {
        const c3 = checkedVals(s, "c3");
        const c4 = val(s, "c4");
        const c3n = c3.map((v) => C3_TEXT[v]);
        item("模块二·分支C", "投资人变化情形与实现形式", "I", c3n.join("、") + "；实现形式：" + (C4_TEXT[c4 ?? ""] ?? "") + "。（客观事实项，不参与判档）");
        if (c3.includes("nd")) {
          const c5 = val(s, "c5");
          const g5: Grade = c5 === "a" ? "A" : c5 === "b" ? "B" : "C";
          item("模块二·分支C", "申报权限归属（新增境内投资人）", g5, c5 === "a" ? "已由投资完成后持股比例最大的境内企业牵头办理 ODI 联合申报" : c5 === "b" ? "持股比例已测算，联合申报安排待落实" : "尚未测算投资完成后各境内投资人持股比例——申报主体无法确定");
          if (c5 === "b") act("B", "落实联合申报安排：由持股比例最大的境内企业牵头，取得其他境内投资方书面同意后办理");
          if (c5 === "c") act("C", "先行测算投资完成后各境内投资人持股比例，确定持股比例最大者为申报主体，再启动 ODI 联合申报");
        }
        const c6 = val(s, "c6");
        const g6: Grade = c6 === "a" ? "A" : "B";
        item("模块二·分支C", "投资额与持股比例联动核对", g6, c6 === "a" ? "投资额及持股比例变化已核对并纳入变更申请" : "尚未核对——增减投资人往往伴随投资额及持股比例变化，遗漏将导致变更事项不完整");
        if (g6 === "B") act("B", "同步核对投资人增减引起的投资额、持股比例变化，与投资人变更一并纳入变更申请");
      }
      item("模块二·分支C", "变更申请办理情况", gApply, c2 === "a" ? "已在情形发生前申请并获同意" : "尚未申请——务必在情形发生前向原核准/备案机关申请变更");
      if (gApply === "C") act("C", "立即向原核准/备案机关申请变更（应在情形发生前申请）");
      docs = [
        { file: "原核准文件/备案通知书及《企业境外投资证书》", form: "复印件加盖公章" },
        { file: "变更事项说明（逐项对照证书载明事项）", form: "加盖公章" },
      ];
      if (c1.includes("amt")) docs.push({ file: "投资额变化说明及资金来源/退出安排证明", form: "加盖公章" });
      if (invOn) {
        docs.push({ file: "股权转让协议或增资/减资决议及协议（按实现形式）", form: "签署版或最终谈判版" });
        docs.push({ file: "新增投资人主体资格材料（营业执照/注册证明）", form: "复印件加盖公章；境外主体附中文翻译" });
        if (checkedVals(s, "c3").includes("nd")) docs.push({ file: "联合申报安排：其他境内投资方出具的书面同意文件", form: "原件" });
        docs.push({ file: "（新增投资主体按模块一逐项自查）", form: "系统提示" });
      }
      if (c1.includes("cap")) docs.push({ file: "投资资本构成变化说明（出资方式/股债结构/币种）", form: "加盖公章" });
      if (c1.includes("biz")) docs.push({ file: "业务范围变化说明及新增业务合规性分析（涉敏感行业须重新对照目录）", form: "加盖公章" });
      if (c1.includes("path")) docs.push({ file: "投资路径变化说明及新旧架构图", form: "加盖公章" });
    }
  }
  docs.push({ file: "董事会（合伙人）决议（同意本次境外投资及相关安排）", form: "加盖公章" });
  docs.push({ file: "——以上为本分支追加件，通用必备件详见另册《文件编制清单（分支化·含齐备度权重）》最新版", form: "" });
  docs.push({ file: "（形式要件提示）全套材料金额与币种应一致；涉及小币种出资的，建议提前与经办银行沟通购汇安排", form: "" });

  // 模块二 共通项
  const g1v = val(s, "g1");
  const cg1: Grade = g1v === "a" ? "A" : "B";
  item("模块二·共通", "项目团队行业经验", cg1, g1v === "a" ? "实控人及关键负责人具备相关行业经验，简历已备" : g1v === "b" ? "简历尚未整理/部分缺失" : "不具备直接相关经验——建议补充团队配置或外部顾问安排说明");
  if (g1v === "b") act("B", "整理实际控制人及关键业务负责人简历（附行业经验）");
  if (g1v === "c") act("B", "补充团队行业经验说明或外部专业顾问安排，支持投资合理性");
  const g2v = val(s, "g2");
  const cg2: Grade = g2v === "a" ? "A" : g2v === "a2" ? "A" : g2v === "b" ? "B" : "D";
  item("模块二·共通", "关联交易核查", cg2, g2v === "a" ? "不涉及关联方" : g2v === "a2" ? "涉及关联方，定价依据已说明" : g2v === "b" ? "涉及关联方，定价依据说明待准备" : "涉及关联方但拟不披露——未披露被审查发现将影响真实性认定（D 风险）");
  if (g2v === "b") act("B", "编制关联方交易定价依据说明");
  if (g2v === "d") act("D", "必须如实披露关联关系并说明定价依据（837 号令如实报告义务，提交虚假材料最高可处投资额千分之五罚款）");
  const g3v = val(s, "g3");
  const G3T: Record<string, string> = { qz: "全资", kg: "控股", gt: "共同控制", cg: "参股" };
  item("模块二·共通", "控制权结构", "I", "投资完成后：" + (G3T[g3v ?? ""] ?? "") + "。（信息采集项，供审查参考）");
  if (hasArch(s)) {
    const g4v = val(s, "g4");
    item("模块二·共通", "特殊架构商业理由", "I", g4v === "a" ? "各层商业理由能够说明（信息采集项）" : "部分层级理由待整理——与模块一自查 1 联动，建议尽快补齐（信息采集项）");
    if (g4v === "b") act("B", "逐层整理特殊架构（SPV/多层控股/VIE）设立的商业理由说明");
    docs.push({ file: "投资后股权（控制）结构图", form: "加盖公章" });
  }

  // 模块三
  if (isMaListVisible(s)) {
    const t2 = val(s, "t2");
    const gt2: Grade = t2 === "a" ? "A" : "C";
    item("模块三", "标的登记文件（注册证明·股东名册·董事名册）", gt2, t2 === "a" ? "三类文件齐备，中文翻译件已备" : "部分缺失或翻译件未备——形式要件：缺登记文件判档不得高于 C");
    if (gt2 === "C") act("C", "取得标的注册证明、股东名册、董事名册并备妥加盖公章的中文翻译件");
  }
  if (isVieRegVisible(s)) {
    const t3 = val(s, "t3");
    const gt3: Grade = t3 === "a" ? "A" : "C";
    item("模块三", "37 号文外汇登记（VIE/返程投资）", gt3, t3 === "a" ? "境内创始人/股东已办理登记" : "尚未登记——先补办登记再申报");
    if (gt3 === "C") act("C", "办理汇发〔2014〕37 号文境内居民境外投融资外汇登记");
  }
  const lsA = checkedVals(s, "lsA"), lsB = checkedVals(s, "lsB"), lsC = checkedVals(s, "lsC");
  if (lsC.length > 0) {
    item("模块三", "三套负面清单核对", "D", "触及 74 号文禁止类——不予批准/备案");
    act("D", "项目触及禁止类情形，不得实施；请调整投资方案");
    route = "路径判断：触及禁止类，不予批准/备案。";
  } else if (lsA.length > 0 || lsB.length > 0) {
    const why: string[] = [];
    if (lsA.length > 0) why.push("敏感行业目录（不分金额一律核准）");
    if (lsB.length > 0) why.push("74 号文限制类（须经核准）");
    item("模块三", "三套负面清单核对", "C", "涉及：" + why.join("；") + "——本项目应走核准路径");
    act("C", "按核准路径准备申报：敏感类项目向国家发展改革委申请核准；商务主管部门对涉敏感国别/行业的实行核准");
    route = "路径判断（系统输出）：本项目应走【核准】路径，请注意对应受理机关层级。";
  } else {
    item("模块三", "三套负面清单核对", "A", "经逐项核对，三套清单均不涉及");
    route = "路径判断（系统输出）：本项目应走【备案】路径（非敏感类，向地方发展改革、商务主管部门备案）。";
  }
  if (isRiskCtryBlockVisible(s)) {
    const t4 = val(s, "t4");
    const gt4: Grade = t4 === "b" ? "B" : "C";
    item("模块三", "3.3 未建交/受制裁/战乱国别·风险防控能力", gt4, t4 === "b" ? "风险防控材料已备妥，供审查判断（该国别属从严核准范围）" : "风险防控材料尚未备妥");
    if (t4 === "b") act("B", "该国别属从严核准范围：随申报提交风险评估报告、应急预案、当地合规资源安排，是否核准由主管机关按从严原则裁量");
    if (t4 === "c") act("C", "编制境外风险识别与防控能力证明材料（风险评估报告+应急预案+当地合规资源安排）");
  }

  // 模块四
  const s1a = val(s, "s1a"), s1c = val(s, "s1c");
  let gs1: Grade, ds1: string;
  if (s1a === "n") { gs1 = "A"; ds1 = "不存在人员/技术跨境安排"; }
  else {
    const doms = checkedVals(s, "s1b").filter((v) => v !== "0").map((v) => S1B_TEXT[v]);
    const domTxt = doms.length ? "所涉领域：" + doms.join("、") + "；" : "所涉领域：均不属列举领域；";
    if (s1c === "ok") { gs1 = "A"; ds1 = domTxt + "已核对目录及三项清单，不在禁限范围"; }
    else if (s1c === "lic") { gs1 = "B"; ds1 = domTxt + "涉限制出口内容，已取得或正在申办许可——附许可文件或申办凭证"; act("B", "备妥限制出口内容的出口许可文件（或申办进度凭证），取得许可前不得实施相关跨境安排"); }
    else if (s1c === "not") { gs1 = "C"; ds1 = domTxt + "尚未对照目录核对——先行核对（可用商务部系统管制商品库查证）"; act("C", "对照《中国禁止出口限制出口技术目录》及三项清单逐项核对所涉内容（商务部备案系统内嵌商品库可检索），并留存查证记录"); }
    else if (s1c === "nolic") { gs1 = "C"; ds1 = domTxt + "涉限制出口内容且未申办许可——先办许可"; act("C", "向主管部门申请限制出口技术许可，取得前不得实施相关跨境安排"); }
    else { gs1 = "D"; ds1 = domTxt + "涉禁止出口内容——“一条红线”，不得实施"; act("D", "所涉内容属禁止出口范围，不得实施；请调整投资与运营方案"); }
  }
  item("模块四", "4-1 出口管制与技术出境（837 号令第十三条）", gs1, ds1);

  const s2a = checkedVals(s, "s2a"), s2c = val(s, "s2c");
  const scenes = s2a.filter((v) => v !== "0");
  const SC_TEXT: Record<string, string> = { b2c: "B2C 用户数据", b2b: "B2B 客户数据", hr: "员工信息跨境", ops: "跨境运维", rd: "跨境研发数据" };
  const scTxt = scenes.length ? "场景：" + scenes.map((v) => SC_TEXT[v]).join("、") + "；" : "不涉及数据处理场景；";
  let gs2: Grade, ds2: string;
  if (scenes.length === 0 || s2c === "a") { gs2 = "A"; ds2 = scTxt + "不涉及数据出境"; }
  else if (s2c === "a2") { gs2 = "A"; ds2 = scTxt + "已完成数据出境安全评估等法定路径"; }
  else if (s2c === "b") { gs2 = "B"; ds2 = scTxt + "未达申报门槛，已按标准合同备案或保护认证路径作出合规安排"; act("B", "落实数据出境合规路径（标准合同备案/保护认证等），并在数据出境合规说明中列明"); }
  else if (s2c === "b2") { gs2 = "C"; ds2 = scTxt + "未达申报门槛，尚未作出合规路径安排——出境前应补齐"; act("C", "实施数据出境前补齐合规路径（标准合同备案/保护认证等），并在数据出境合规说明中列明"); }
  else { gs2 = "C"; ds2 = scTxt + "达到申报门槛尚未申报——先完成安全评估"; act("C", "先完成数据出境安全评估（或适用的法定路径）再实施相关数据出境"); }
  item("模块四", "4-2 数据出境合规", gs2, ds2);

  const s3v = checkedVals(s, "s3").filter((v) => v !== "0");
  item("模块四", "4-3 产业链供应链安全（834 号令）", "I", s3v.length ? "属于关键领域：" + s3v.map((v) => S3_TEXT[v]).join("、") + "——提示关注产业链供应链安全要求及储备、应急义务；并关注可能触及外国“脱钩断链”措施的情形（被列实体清单/关键客户供应商位于敏感辖区/单一来源依赖）" : "不属于列举的关键领域（信息采集项）");
  const s4v = val(s, "s4");
  item("模块四", "4-4 外国域外管辖与证据调取（837 号令第二十二条·835 号令）", "I", s4v === "y" ? "存在或可能存在外国机构证据调取要求——提示：向境外提供证据材料须遵守保密与数据安全规定、依法经主管机关准许（同方威视案已有反制先例）" : "不存在相关情形（信息采集项）");

  // 模块五 采集结果
  const q52 = val(s, "q52"), q53 = val(s, "q53"), q54 = val(s, "q54");
  const q52txt = q52 === "one" ? "单一国别" : "涉及多个国别（" + (val(s, "q52list") ?? "未列举") + "）——注意“一国（地区）以上利益”申报口径（涉及的须经商务部核准）";
  const Q53T: Record<string, string> = { a: "已了解并完成初步评估", b: "初步了解", c: "尚未了解——建议先行了解目的地外资安审制度（CFIUS/FSR/SIRA 等）并预留审查周期" };
  const Q54T: Record<string, string> = { a: "已取得国别风险参考资料", b: "尚未取得——请查阅商务部国别指南、信保国家风险评级、领事提醒三项公开资源" };
  item("模块五", "国别范围（采集）", "I", q52txt);
  item("模块五", "外资安审了解程度（采集）", "I", Q53T[q53 ?? ""] ?? "");
  item("模块五", "国别风险资料（采集）", "I", Q54T[q54 ?? ""] ?? "");
  if (q53 === "c") act("B", "了解目的地外资安全审查制度（CFIUS/FSR/SIRA 等），在交易时间表中预留审查周期");
  if (q54 === "b") act("B", "取得国别风险参考资料：商务部《对外投资合作国别（地区）指南》+ 中国信保国家风险评级 + 外交部领事提醒");
  if (q52 === "multi") act("B", "涉及多个国别（地区）：对照“是否涉及一国（地区）以上利益”敏感问答口径如实申报（涉及的须经商务部核准）");

  return { items, actsD, actsC, actsB, docs, path, route };
}

// ─── 文件齐备度计分（核心 + 增强双层制）──────────────────────────────────────
export function computeFileScore(s: WizardState): FileScoreResult {
  const mode = s.mode!;
  const set = fileSet(mode);
  let score = 0, naSum = 0, maskW = 0, maskN = 0, maskEnhN = 0;
  let enhScore = 0;
  const maskNames: string[] = [];
  const missCore: MissingCore[] = [];
  const missEnh: string[] = [];
  const rows: ScoreRow[] = [];

  for (const fid of set) {
    const u = s.uploads[fid];
    if (isENH(fid, mode)) {
      const eg = u && u.name ? 1 : 0;
      enhScore += eg;
      let est: string;
      if (u && u.name && u.masked) { est = "已上传·脱敏（增强）"; maskEnhN++; }
      else if (u && u.name) { est = "已上传（增强）"; }
      else { est = "未上传·不扣分"; missEnh.push(FILE_LABEL[fid]); }
      rows.push({ fid, mod: FILE_MOD[fid], label: FILE_LABEL[fid], tierLabel: "增强 +1", status: est, got: eg });
      continue;
    }
    const w = fw(fid, mode);
    if (w <= 0) continue;
    const na = fileNA(fid, s);
    const got = !na && u && u.name ? w : 0;
    let st: string;
    if (na) { st = fid === "f_m1b" ? "客观不适用·记 0·已披露" : "不适用·记 0"; naSum += w; }
    else if (u && u.name && u.masked) { st = "已上传·脱敏"; maskW += w; maskN++; maskNames.push(FILE_LABEL[fid]); }
    else if (u && u.name) { st = "已上传"; }
    else { st = "未上传"; missCore.push({ label: FILE_LABEL[fid], weight: w }); }
    score += got;
    rows.push({ fid, mod: FILE_MOD[fid], label: FILE_LABEL[fid], tierLabel: "核心 " + w, status: st, got });
  }

  const maxAvail = 100 - naSum;
  const refScore = Math.round((score - 0.2 * maskW) * 10) / 10;
  const enhCap = ENH_CAP[mode] ?? 0;
  return { score, maxAvail, refScore, enhScore, enhCap, maskW, maskN, maskNames, maskEnhN, missCore, missEnh, rows };
}

// ─── 行动建议：按 D→C→B 排序，匹配可寻求协助机构 ────────────────────────────────
function svcOrgs(txt: string): string[] {
  const orgs: string[] = [];
  if (/法律|尽调|律师/.test(txt)) orgs.push("律师事务所");
  if (/审计|验资/.test(txt)) orgs.push("会计师事务所");
  if (/银行资金/.test(txt)) orgs.push("银行");
  if (/估值|可比案例/.test(txt)) orgs.push("评估机构");
  return orgs;
}

// ─── 汇总：生成完整报告 ─────────────────────────────────────────────────────
export function buildReport(s: WizardState): ReportResult {
  const { items, actsD, actsC, actsB, docs, path, route } = computeItems(s);
  const fileScore = computeFileScore(s);

  const gradeable: Grade[] = items.filter((it) => it.grade !== "I").map((it) => it.grade as Grade);
  const grade = worst(gradeable);

  const band: "hi" | "mid" | "lo" = fileScore.score >= 80 ? "hi" : fileScore.score >= 60 ? "mid" : "lo";
  const comboText = "组合解读：档位 " + grade + " × 核心齐备度 " + fileScore.score + " 分（满分 100）+ 增强加分 " + Math.min(fileScore.enhScore, fileScore.enhCap) + " 分——" + COMBO[grade][band];

  const ordered = [...actsD, ...actsC, ...actsB];
  const actions: ActionItem[] = ordered.map((a) => {
    const grade = (a.slice(1, 2) as "D" | "C" | "B");
    const text = a.replace(/^【[DCB]】/, "");
    const orgs = grade === "D" || grade === "C" ? svcOrgs(a) : [];
    return { grade, text, orgs };
  });

  const ctryName = val(s, "p_ctry") ?? "国别未选";
  const pathLine = "本次自查路径：" + path + "（" + ctryName + "）";
  const ackLine = s.ctryAck
    ? "合规告知留痕：已确认阅读《对外投资提示事项》（国别：" + s.ctryAck.ctry + "，确认时间：" + s.ctryAck.time + "）"
    : "合规告知留痕：本次未选定国别或未触发提示书确认。";

  return { items, actions, docs, pathLine, routeLine: route, ackLine, grade, fileScore, comboText };
}
