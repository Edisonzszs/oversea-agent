// 合规自查向导的状态模型、步骤定义与校验规则。
// 校验逻辑忠实移植自合规 HTML 第五版的 next1..next5 + genReport 前置校验。

import type { Mode, FileId } from "./weights";
import { isRiskCtry } from "./country";

export type { Mode, FileId };

// ─── 作答数据 ────────────────────────────────────────────────────────────────
// single：单值项（radio / select / text），按 HTML 的 name 归集
// multi ：多值项（checkbox），按 name 归集
export interface WizardAnswers {
  single: Record<string, string>;
  multi: Record<string, string[]>;
}

export interface Upload {
  name: string;
  masked: boolean; // 脱敏（仅记文件名，不传内容）
}

export type FileUploads = Partial<Record<FileId, Upload>>;

export interface CtryAck {
  ctry: string;
  time: string;
}

export interface WizardState {
  mode: Mode | null;
  answers: WizardAnswers;
  uploads: FileUploads;
  ctryAck: CtryAck | null;
  lsNone: boolean; // 三套负面清单"均不涉及"
  curStep: number; // 0..6
  maxSeen: number;
  generated: boolean; // 是否已生成过报告
}

export function createInitialState(): WizardState {
  return {
    mode: null,
    answers: { single: {}, multi: {} },
    uploads: {},
    ctryAck: null,
    lsNone: false,
    curStep: 0,
    maxSeen: 0,
    generated: false,
  };
}

// ─── 取值辅助（对应 HTML 的 val() / checkedVals()）───────────────────────────
export function val(s: WizardState, name: string): string | null {
  return s.answers.single[name] ?? null;
}
export function checkedVals(s: WizardState, name: string): string[] {
  return s.answers.multi[name] ?? [];
}

// ─── 字段可见性（对应 HTML next1 里对 wrap 显隐的判定）─────────────────────────
export function hasArch(s: WizardState): boolean {
  const a = checkedVals(s, "p_arch");
  return a.length > 0 && !a.includes("none");
}
export function isVie(s: WizardState): boolean {
  return checkedVals(s, "p_arch").includes("vie");
}
export function isMaListVisible(s: WizardState): boolean {
  return s.mode === "ma";
}
export function isVieRegVisible(s: WizardState): boolean {
  return isVie(s);
}
export function isRiskCtryBlockVisible(s: WizardState): boolean {
  return isRiskCtry(val(s, "p_ctry"));
}

// ─── 步骤定义 ────────────────────────────────────────────────────────────────
export interface StepDef {
  key: number;
  short: string; // stepper 文案
  title: string; // 卡片标题
  module?: string;
}

export const STEPS: StepDef[] = [
  { key: 0, short: "使用说明", title: "使用说明（企业必读）" },
  { key: 1, short: "企业画像", title: "模块〇　企业画像（不计分）", module: "模块〇" },
  { key: 2, short: "主体资格", title: "模块一　主体资格自查", module: "模块一" },
  { key: 3, short: "投资方式", title: "模块二　投资方式与投资行为自查（分支填写）", module: "模块二" },
  { key: 4, short: "标的项目", title: "模块三　境外标的与项目信息自查", module: "模块三" },
  { key: 5, short: "安全审查", title: "模块四　安全审查与敏感要素自查", module: "模块四" },
  { key: 6, short: "行业国别", title: "模块五　行业与国别（信息采集）", module: "模块五" },
];

export const REPORT_STEP = 7; // 自查报告

// ─── 校验：能否离开当前步（对应 HTML next1..next5 + genReport 前置）──────────────
// 返回 null 表示通过，返回字符串为阻断提示。
export function validateStep(step: number, s: WizardState): string | null {
  // step 1：模块〇 企业画像
  if (step === 1) {
    if (!s.mode) return "请选择投资方式（新设类 / 并购类 / 变更类）";
    const cv = val(s, "p_ctry");
    if (cv && !s.ctryAck) return "请先阅读并知悉《对外投资提示事项》国别提示";
    return null;
  }

  // step 2：模块一 主体资格（z1..z6）
  if (step === 2) {
    const need = ["z1", "z2", "z3", "z4", "z5", "z6"];
    for (let i = 0; i < need.length; i++) {
      if (!val(s, need[i])) return `模块一共 6 项，请全部作答（自查 ${i + 1} 未答）`;
    }
    return null;
  }

  // step 3：模块二 投资方式（分支 + 共通）
  if (step === 3) {
    if (s.mode === "new") {
      if (!val(s, "n1") || !val(s, "n2") || !val(s, "n3")) return "请完成分支 A 全部问题";
    }
    if (s.mode === "ma") {
      if (!val(s, "m0a") || !val(s, "m0b") || !val(s, "m1") || !val(s, "m2") || !val(s, "m3"))
        return "请完成分支 B 全部问题";
      if (val(s, "m1") === "na" && !(val(s, "m1na_reason") ?? "").trim())
        return 'B-3 选择"部分文件客观不适用"的，须填写具体理由';
    }
    if (s.mode === "chg") {
      const c1 = checkedVals(s, "c1");
      if (c1.length === 0) return "请完成 C-1 勾选";
      const hits = c1.filter((v) => v !== "0");
      if (hits.length > 0) {
        if (c1.includes("inv")) {
          if (checkedVals(s, "c3").length === 0) return "请勾选投资人变化的具体情形（C-2）";
          if (!val(s, "c4")) return "请回答投资人变化的实现形式（C-3）";
          if (checkedVals(s, "c3").includes("nd") && !val(s, "c5"))
            return "请回答申报主体确定情况（C-4）";
          if (!val(s, "c6")) return "请回答投资额与持股比例联动核对情况（C-5）";
        }
        if (!val(s, "c2")) return "请回答变更申请办理情况（C-6）";
      }
    }
    if (!val(s, "g1") || !val(s, "g2") || !val(s, "g3")) return "请完成共通项 1-3";
    if (hasArch(s) && !val(s, "g4")) return "请完成共通项 4（架构商业理由）";
    return null;
  }

  // step 4：模块三 标的与负面清单
  if (step === 4) {
    if (isMaListVisible(s) && !val(s, "t2")) return "请回答 3.1-②（登记文件）";
    if (isVieRegVisible(s) && !val(s, "t3")) return "请回答 3.1-③（37 号文登记）";
    const a = checkedVals(s, "lsA");
    const b = checkedVals(s, "lsB");
    const c = checkedVals(s, "lsC");
    if (a.length === 0 && b.length === 0 && c.length === 0 && !s.lsNone)
      return '请逐项核对三套负面清单；均不涉及的请勾选"均不涉及"';
    if (isRiskCtryBlockVisible(s) && !val(s, "t4")) return "请回答 3.3-①（风险防控材料）";
    return null;
  }

  // step 5：模块四 安全审查
  if (step === 5) {
    if (!val(s, "s1a")) return "请回答 4-1a（人员/技术跨境安排）";
    if (val(s, "s1a") === "y") {
      if (checkedVals(s, "s1b").length === 0)
        return '请勾选 4-1b 所涉领域（均不涉及请勾"以上均不涉及"）';
      if (!val(s, "s1c")) return "请回答 4-1c（目录核对情况）";
    }
    if (checkedVals(s, "s2a").length === 0)
      return '请勾选 4-2a 数据场景（不涉及请勾"均不涉及"）';
    if (!val(s, "s2c")) return "请回答 4-2c（合规路径状态）";
    if (checkedVals(s, "s3").length === 0)
      return '请勾选 4-3 所在领域（均不属于请勾"均不属于"）';
    if (!val(s, "s4")) return "请回答 4-4（域外证据调取）";
    return null;
  }

  // step 6：模块五 行业国别（genReport 前置）
  if (step === 6) {
    if (!val(s, "q52")) return "请回答 5-2（目的地国别情况）";
    if (!val(s, "q53")) return "请回答 5-3（外资安审了解程度）";
    if (!val(s, "q54")) return "请回答 5-4（国别风险资料）";
    if (s.mode === "ma" && val(s, "m1") === "na" && !(val(s, "m1na_reason") ?? "").trim())
      return 'B-3 选择"部分文件客观不适用"的，须填写具体理由';
    return null;
  }

  return null;
}

// 各分支专属字段（切换投资方式时自动清理旧分支作答，避免残留无效数据）
const BRANCH_KEYS: Record<Mode, { single: string[]; multi: string[] }> = {
  new: { single: ["n1", "n2", "n3"], multi: [] },
  ma: { single: ["m0a", "m0b", "m1", "m2", "m3", "m1na_reason"], multi: [] },
  chg: { single: ["c2", "c4", "c5", "c6"], multi: ["c1", "c3"] },
};

export function clearBranchAnswers(state: WizardState, oldMode: Mode | null): WizardState {
  if (!oldMode || !BRANCH_KEYS[oldMode]) return state;
  const { single, multi } = BRANCH_KEYS[oldMode];
  const s = { ...state.answers.single };
  single.forEach(k => delete s[k]);
  const m = { ...state.answers.multi };
  multi.forEach(k => delete m[k]);
  return { ...state, answers: { single: s, multi: m } };
}

// ─── 速测版 → 完整版 作答灌入 ────────────────────────────────────────────────
// 速测与完整版同题号体系（同源于交付稿 HTML）。速测 Answers 是扁平 Record<string,string>
// （multi 为逗号拼接字符串），完整版是 {single,multi} 分仓。此函数按题号映射预填：
//   - mode / lsNone 是向导顶层状态字段
//   - 完整版不存在的速测字段（如 p_org 申报归口）自动跳过
//   - multi 值拆逗号回数组；速测的 lsNone 键也兼容
export function prefillFromQuickAnswers(
  state: WizardState,
  quick: Record<string, string>,
): { state: WizardState; filled: number } {
  const MULTI_KEYS = new Set(["p_arch", "c1", "lsA", "lsB", "lsC", "s1b", "s2a", "s3"]);
  const SKIP = new Set(["p_org"]); // 完整版无此题
  let single = { ...state.answers.single };
  let multi = { ...state.answers.multi };
  let filled = 0;
  let mode = state.mode;
  let lsNone = state.lsNone;

  for (const [k, raw] of Object.entries(quick)) {
    const v = (raw ?? "").trim();
    if (!v || SKIP.has(k)) continue;
    if (k === "mode") { if (v === "new" || v === "ma" || v === "chg") mode = v; continue; }
    if (k === "lsNone") { lsNone = v === "1" || v === "true" || v === "是"; continue; }
    if (MULTI_KEYS.has(k)) {
      const vals = v.split(/[,，]/).map(x => x.trim()).filter(Boolean);
      if (vals.length) { multi = { ...multi, [k]: vals }; filled++; }
    } else {
      single = { ...single, [k]: v };
      filled++;
    }
  }
  return { state: { ...state, mode, lsNone, answers: { single, multi } }, filled };
}

// 读取并消费 sessionStorage 里的速测作答（升级完整版时存入）。返回 null 表示无。
export function takeQuickAnswersFromSession(): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem("chuhai_quick_answers");
    if (!raw) return null;
    sessionStorage.removeItem("chuhai_quick_answers"); // 一次性消费
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}
