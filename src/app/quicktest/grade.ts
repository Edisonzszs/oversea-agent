// 速测版判档引擎 —— 就低原则 worst(A<B<C<D),信息项 I 不参与总档。
// 各题档位映射 + 三套清单/分支/安全审查的合并判档,忠实移植自简化版 HTML 的 genReport()。
// 纯函数,可单测;供 QuickTestReport 渲染。

import { val, checkedVals, hasArch, type Answers } from "./questions";
import { isRiskCtry } from "../compliance/logic/country";

export type Grade = "A" | "B" | "C" | "D" | "I";
const ORDER: Record<Grade, number> = { A: 1, B: 2, C: 3, D: 4, I: 0 };

export function worst(gs: Grade[]): Grade {
  let w: Grade = "A";
  for (const g of gs) { if (g !== "I" && ORDER[g] > ORDER[w]) w = g; }
  return w;
}

function up(v: string): Grade {
  if (!v) return "I";
  const g = v.toUpperCase() as Grade;
  return g === "A" || g === "B" || g === "C" || g === "D" ? g : "I";
}

// ─── 单元判档(一个单元 = 报告明细一行,可能合并多题)─────────────────────
interface Unit {
  key: string;
  module: number;
  label: string;
  applicable: (a: Answers) => boolean;
  gradeOf: (a: Answers) => Grade;
  descOf: (a: Answers, g: Grade) => string;
}

const Z_LABELS: Record<string, string> = {
  z1: "自查1 股权架构及实控人(前置)", z2: "自查2 主营业务合规与关联",
  z3: "自查3 规模与资金实力(前置)", z4: "自查4 违法违规记录(前置)",
  z5: "自查5 负面舆情", z6: "自查6 重大未决诉讼/调查",
};

const UNITS: Unit[] = [
  // 模块一 z1-z6:档位 = 所选值大写
  ...(["z1", "z2", "z3", "z4", "z5", "z6"] as const).map(k => ({
    key: k, module: 1, label: Z_LABELS[k],
    applicable: () => true,
    gradeOf: (a: Answers) => up(val(a, k)),
    descOf: (_a: Answers, g: Grade) => zDesc(k, g),
  })),
  // 模块二 分支A 新设
  { key: "n1", module: 2, label: "A-1 成本测算表", applicable: a => a["mode"] === "new",
    gradeOf: a => { const v = val(a, "n1"); return v === "a" ? "A" : v ? "C" : "I"; },
    descOf: (_a, g) => g === "A" ? "已按用款周期、分科目编制" : "未编制或未细分——判档不高于 C" },
  { key: "n2", module: 2, label: "A-2 支出合同/意向书", applicable: a => a["mode"] === "new",
    gradeOf: a => { const v = val(a, "n2"); return v === "a" ? "A" : v === "b" ? "B" : v === "c" ? "C" : "I"; },
    descOf: (_a, g) => g === "A" ? "主要科目均有合同或意向书" : g === "B" ? "部分科目有" : "均无——补齐证明文件" },
  { key: "n3", module: 2, label: "A-3 测算额与投资额匹配", applicable: a => a["mode"] === "new",
    gradeOf: a => { const v = val(a, "n3"); return v === "a" ? "A" : v === "c" ? "C" : "I"; },
    descOf: (_a, g) => g === "A" ? "基本匹配,差异可解释" : "明显失配——影响真实性认定" },
  // 模块二 分支B 并购
  { key: "m0a", module: 2, label: "B-1 交易类型(信息项)", applicable: a => a["mode"] === "ma", gradeOf: () => "I", descOf: a => `本次为${({ bg: "并购", kg: "控股", cg: "参股" } as Record<string, string>)[val(a, "m0a")] || "—"}` },
  { key: "m0b", module: 2, label: "B-2 实现方式(信息项)", applicable: a => a["mode"] === "ma", gradeOf: () => "I", descOf: () => "交易实现方式(老股转让/增资入股/并用)" },
  { key: "m1", module: 2, label: "B-3 三类专业报告齐备性", applicable: a => a["mode"] === "ma",
    gradeOf: a => { const v = val(a, "m1"); return v === "a" || v === "na" ? "A" : v === "b" ? "B" : v === "c" ? "C" : "I"; },
    descOf: (a, g) => g === "A" && val(a, "m1") === "na" ? `财务审计报告客观不适用(${val(a, "m1na_reason") || "未填理由"}),其余齐备` : g === "A" ? "三类报告齐备且资质完备" : g === "B" ? "报告齐备,个别资质/签章待补" : "缺任一类报告——补齐" },
  { key: "preport", module: 2, label: "并购前期报告程序(信息项)", applicable: a => a["mode"] === "ma", gradeOf: () => "I", descOf: () => "并购/增资并购须先选\"并购事项前期报告表\"方可填申请表——纳入交易时间表" },
  // 模块二 分支C 变更(合并 c1+c2)
  { key: "chg", module: 2, label: "C 变更事项对照", applicable: a => a["mode"] === "chg",
    gradeOf: a => { if (!hasNonZero(a, "c1")) return val(a, "c1") !== "" || checkedVals(a, "c1").includes("0") ? "A" : "I"; const v = val(a, "c2"); return v === "a" ? "A" : v === "c" ? "C" : "I"; },
    descOf: (a, g) => {
      if (!hasNonZero(a, "c1")) return "载明事项均未发生变化,本分支不适用";
      const items = checkedVals(a, "c1").filter(x => x !== "0").map(code => ({ amt: "投资额", inv: "投资人", cap: "资本构成", biz: "业务范围", path: "投资路径", oth: "其他" } as Record<string, string>)[code]).filter(Boolean).join("、");
      return g === "A" ? `已发生:${items};已在情形发生前申请并获同意` : `已发生:${items};尚未申请——务必在情形发生前申请变更`;
    } },
  // 模块二 共通
  { key: "g2", module: 2, label: "共通2 关联交易", applicable: () => true,
    gradeOf: a => { const v = val(a, "g2"); return v === "a" || v === "a2" ? "A" : v === "b" ? "B" : v === "d" ? "D" : "I"; },
    descOf: (_a, g) => g === "D" ? "涉及关联方但拟不披露——被审查发现将影响真实性认定(D 风险)" : g === "B" ? "涉及关联方,定价依据说明尚未准备" : "不涉及或已说明定价依据" },
  { key: "g3", module: 2, label: "共通3 控制权安排(信息项)", applicable: () => true, gradeOf: () => "I", descOf: a => `投资完成后:${({ qz: "全资", kg: "控股", gt: "共同控制", cg: "参股" } as Record<string, string>)[val(a, "g3")] || "—"}` },
  // 模块三
  { key: "t3", module: 3, label: "3.1-③ 37号文登记", applicable: a => hasArch(a, "vie"),
    gradeOf: a => { const v = val(a, "t3"); return v === "a" ? "A" : v === "c" ? "C" : "I"; },
    descOf: (_a, g) => g === "A" ? "已办理 37 号文登记" : "尚未登记——先补办登记再申报" },
  { key: "lists", module: 3, label: "3.2 三套负面清单", applicable: () => true,
    gradeOf: a => { if (checkedVals(a, "lsC").length) return "D"; if (checkedVals(a, "lsA").length || checkedVals(a, "lsB").length) return "C"; return "A"; },
    descOf: (a, g) => {
      if (g === "D") return "触及 74 号文禁止类——不予批准/备案";
      if (g === "C") { const hit = checkedVals(a, "lsA").length ? "敏感行业目录(一律核准)" : "74 号文限制类(须经核准)"; return `涉及:${hit}——本项目应走核准路径`; }
      return "经逐项核对,三套清单均不涉及";
    } },
  { key: "t4", module: 3, label: "3.3-① 风险国别防控材料", applicable: a => isRiskCtry(a["p_ctry"]),
    gradeOf: a => { const v = val(a, "t4"); return v === "b" ? "B" : v === "c" ? "C" : "I"; },
    descOf: (_a, g) => g === "B" ? "风险防控材料已备妥" : "尚未备妥——补齐风险评估报告+应急预案" },
  // 模块四
  { key: "s1", module: 4, label: "4-1 出口管制与技术出境", applicable: () => true,
    gradeOf: a => { if (val(a, "s1a") === "n") return "A"; const c = val(a, "s1c"); if (!c) return "I"; return c === "ok" ? "A" : c === "lic" ? "B" : c === "ban" ? "D" : "C"; },
    descOf: (_a, g) => g === "A" ? val(_a, "s1a") === "n" ? "不存在人员/技术跨境安排" : "所涉内容不在禁止/限制范围" : g === "B" ? "涉限制出口,已取得或正在申办许可" : g === "D" ? "涉禁止出口内容——\"一条红线\",不得实施" : "涉限制未申办许可 / 尚未核对——先核对并申办许可" },
  { key: "s2", module: 4, label: "4-2 数据出境合规", applicable: () => true,
    gradeOf: a => { const sc = val(a, "s2c"); const onlyNone = checkedVals(a, "s2a").every(x => x === "0") && checkedVals(a, "s2a").length > 0; if (sc === "a" || onlyNone) return "A"; return sc === "a2" ? "A" : sc === "b" ? "B" : sc === "b2" || sc === "c" ? "C" : "I"; },
    descOf: (_a, g) => g === "A" ? "不涉及数据出境,或已完成法定路径" : g === "B" ? "未达门槛,已按标准合同/保护认证安排" : "未作合规路径安排 / 达到门槛尚未申报——先完成安全评估" },
  { key: "s3", module: 4, label: "4-3 产业链供应链(信息项)", applicable: () => true, gradeOf: () => "I", descOf: () => "关键领域信息采集,提示关注 834 号令及储备/应急义务" },
  // 模块五
  { key: "q52", module: 5, label: "5-2 目的地国别情况(信息项)", applicable: () => true, gradeOf: () => "I", descOf: a => val(a, "q52") === "multi" ? "涉及多个国别——须如实申报,需经核准" : "单一国别" },
  { key: "q53", module: 5, label: "5-3 外资安审了解程度(信息项)", applicable: () => true, gradeOf: () => "I", descOf: () => "建议在交易时间表中预留域外审查周期" },
];

function zDesc(k: string, g: Grade): string {
  const map: Record<string, Record<string, string>> = {
    z1: { A: "架构完整,登记文件齐备", B: "架构完整,部分层级登记文件未齐——补齐文件", C: "多层嵌套但能说明商业合理性", D: "无商业实质安排或无法追溯实控人——前置门槛,审查将不予受理" },
    z2: { A: "主业合规且与标的关联", B: "关联不明显,需补商业合理性说明", C: "属限制/两高但已完成合规改造", D: "属淘汰类或未完成合规改造" },
    z3: { A: "规模资金覆盖且为自有资金", B: "能覆盖,含非自有但来源合法", C: "接近未覆盖,需补资金来源证明", D: "明显不足且无合法来源——前置门槛,审查将不予受理" },
    z4: { A: "无刑罚/失信/资格罚记录", B: "曾有一般处罚,与境外投资无关", C: "曾有相关处罚但已整改", D: "刑罚/失信/资格罚——前置门槛,审查将不予受理" },
    z5: { A: "无负面报道", B: "有负面但与本次投资无关", C: "有相关负面但已澄清/处理", D: "重大且未澄清的负面舆情" },
    z6: { A: "无未决诉讼/调查", B: "一般诉讼,金额小不影响经营", C: "重大诉讼但不影响真实性,有分析说明", D: "重大诉讼/调查影响经营与真实性认定" },
  };
  return (map[k]?.[g]) || "—";
}

function hasNonZero(a: Answers, id: string): boolean {
  const vs = checkedVals(a, id);
  return vs.length > 0 && vs.some(x => x !== "0");
}

// ─── 报告数据 ──────────────────────────────────────────────────────────────
export interface GradeItem { key: string; module: number; label: string; grade: Grade; desc: string; }

export interface ReportData {
  items: GradeItem[];
  total: Grade;
  routeLine: string;
  pathLine: string;
  ackLine: string;
  missList: string[];
}

const GRADE_TEXT: Record<Exclude<Grade, "I">, { title: string; desc: string }> = {
  A: { title: "材料齐备,可直接申报", desc: "各项事实回答均达到申报要求,请按文件编制清单核对成册。" },
  B: { title: "基本具备,需补充材料", desc: "基本达标,请按下方建议补齐材料后申报。" },
  C: { title: "存在需先解决的问题", desc: "请先解决下列事项再行申报,避免被一次性告知补正甚至不予受理。" },
  D: { title: "存在禁止性情形或重大缺陷", desc: "不建议按现方案申报,请调整方案或咨询专业机构。" },
};
export function gradeMeta(g: Exclude<Grade, "I">) { return GRADE_TEXT[g]; }

const MODE_ECHO: Record<string, string> = { new: "新设类", ma: "并购类", chg: "变更类" };

export function gradeAll(a: Answers): ReportData {
  const items: GradeItem[] = UNITS.filter(u => u.applicable(a)).map(u => {
    const g = u.gradeOf(a);
    return { key: u.key, module: u.module, label: u.label, grade: g, desc: u.descOf(a, g) };
  });

  const total = worst(items.map(i => i.grade));

  // 路径判断
  let routeLine: string;
  if (checkedVals(a, "lsC").length) routeLine = "路径判断:触及禁止类,不予批准/备案。";
  else if (checkedVals(a, "lsA").length || checkedVals(a, "lsB").length) routeLine = "路径判断(系统输出):本项目应走【核准】路径,请注意对应受理机关层级。";
  else routeLine = "路径判断(系统输出):本项目应走【备案】路径(非敏感类,向地方发展改革、商务主管部门备案)。";

  // 本次自查路径
  const modeEcho = MODE_ECHO[val(a, "mode")] || "(未选投资方式)";
  const ctry = val(a, "p_ctry") || "(未选国别)";
  const maSub = val(a, "m0a") ? `·${({ bg: "并购", kg: "控股", cg: "参股" } as Record<string, string>)[val(a, "m0a")]}` : "";
  const chgSub = val(a, "mode") === "chg" && hasNonZero(a, "c1") ? `·${checkedVals(a, "c1").filter(x => x !== "0").length}项变化` : "";
  const pathLine = `本次自查路径:${modeEcho}${maSub}${chgSub}(${ctry})——简化版`;

  // 合规告知留痕(简化版无国别提示书确认流程)
  const ackLine = val(a, "p_ctry")
    ? `合规告知留痕:本次为简化版速测,国别(${val(a, "p_ctry")})《对外投资提示事项》确认以完整版为准。`
    : "合规告知留痕:本次未选定国别。";

  // 建议补充材料(C/D 项)
  const missList: string[] = [];
  for (const it of items) {
    if (it.grade === "D" || it.grade === "C") missList.push(`${it.label}:${it.desc}`);
  }
  if (missList.length === 0) missList.push("本次回答未显示核心材料缺失;登录完整版可逐项核对全部应准备文件并完成齐备度计分。");

  return { items, total, routeLine, pathLine, ackLine, missList };
}
