// ODI 校验引擎(「进入后」内在校验逻辑 · Step 1)。
// 纯函数:输入统一字段池 → 输出三态校验结果(通过/不通过/缺失),按 商务委/发改委/跨业务 分组。
// 规则来自 spec §12.3(各轮字段口径与校验)+ §12.9(三域三态):
//   1. 必填完整性(缺失)
//   2. 投资方式 ↔ 设立方式 一致
//   3. 投资金额:中方投资额 + 外方投资额 = 投资总额
//   4. 股权比例:中方股比 + 外方股比 = 100%
//   5. 境外注册资本 ≤ 投资总额
//   6. 出资构成:各项出资合计 = 中方投资额
// 确定性、无副作用,便于单测与前后端复用。汇总优先级(展示用):不通过 > 缺失 > 通过。

import type { OdiField } from "../data/types";
import { getVal } from "../field/odiGuideLogic";
import { allFieldDefs } from "../field/odiFieldCatalog";

export type ValidationDomain = "商务委" | "发改委" | "跨业务";
export type ValidationStatus = "通过" | "不通过" | "缺失";

export interface ValidationCheck {
  id: string;
  domain: ValidationDomain;
  field: string;          // 检查项 / 字段名
  status: ValidationStatus;
  evidence?: string;      // 当前值 / 依据
  suggestion?: string;    // 修正建议(非通过/缺失时)
}

export interface DeptSummary {
  dept: ValidationDomain;
  passed: number;
  failed: number;   // 不通过
  missing: number;  // 缺失
  total: number;
}

export interface ValidationResult {
  checks: ValidationCheck[];
  summaries: DeptSummary[];
}

const DOMAINS: ValidationDomain[] = ["商务委", "发改委", "跨业务"];

// 完整性检查时,把字段归到校验域(catalog 的 dept 之外,做业务分组微调)。
function domainFor(code: string): ValidationDomain {
  if (code === "project_summary" || code === "project_significance") return "发改委"; // 项目说明归发改委
  if (code === "establishment_method") return "商务委"; // 设立方式归商务委
  return "跨业务"; // 其余 shared 核心字段归跨业务
}

// 解析金额/数值字符串前导数字:"800万美元"→800,"1,200"→1200,"100"→100,""→NaN。
function parseNum(s: string): number {
  if (!s) return NaN;
  const cleaned = s.replace(/[,，\s]/g, "");
  const m = cleaned.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}

// 解析币种 token:"USD 5,000,000"→USD,"500万美元"→美元,"SGD 6,850,000"→SGD。
// 用于「注册资本≤投资总额」等需要同币种才可直接比较的规则;不同币种则跳过(避免误报)。
function parseCurrency(s: string): string {
  if (!s) return "";
  const m = s.match(/USD|SGD|EUR|RMB|CNY|HKD|JPY|美元|人民币|日元|欧元|港元|英镑/i);
  return m ? m[0].toUpperCase() : "";
}

export function validateOdiPool(pool: OdiField[]): ValidationResult {
  const val = (code: string) => getVal(pool, code);
  const has = (code: string) => { const v = val(code); return !!(v && v.trim()); };
  // 取数值,空值按 0 参与求和(parseNum 空串为 NaN → 0)。
  const num = (code: string): number => { const n = parseNum(val(code)); return Number.isNaN(n) ? 0 : n; };
  const isMerger = val("investment_method") === "并购";

  const checks: ValidationCheck[] = [];

  // 1) 必填完整性(缺失)。非并购时跳过 R7 必填。
  for (const def of allFieldDefs()) {
    if (!def.required) continue;
    if (def.round === 7 && !isMerger) continue;
    const filled = has(def.code);
    checks.push({
      id: `req-${def.code}`,
      domain: domainFor(def.code),
      field: def.name,
      status: filled ? "通过" : "缺失",
      evidence: filled ? val(def.code) : "未填写",
      suggestion: filled ? undefined : `请填写「${def.name}」`,
    });
  }

  // 2) 投资方式 ↔ 设立方式 一致(并购必须对应并购)。商务委。
  if (has("investment_method") && has("establishment_method")) {
    const im = val("investment_method"), em = val("establishment_method");
    const consistent = (im === "并购") === (em === "并购");
    checks.push({
      id: "rule-method-consistency",
      domain: "商务委",
      field: "投资方式与设立方式",
      status: consistent ? "通过" : "不通过",
      evidence: `投资方式=${im} · 设立方式=${em}`,
      suggestion: consistent ? undefined : "投资方式与设立方式需保持一致(如「并购」对应「并购」)。",
    });
  }

  // 3) 投资金额:中方 + 外方 = 投资总额。商务委。
  if (has("investment_total") && (has("chinese_investment_amount") || has("foreign_investment_amount"))) {
    const sum = num("chinese_investment_amount") + num("foreign_investment_amount");
    const total = num("investment_total");
    const ok = Math.abs(sum - total) < 1;
    checks.push({
      id: "rule-amount-consistency",
      domain: "商务委",
      field: "投资金额(中方+外方=总额)",
      status: ok ? "通过" : "不通过",
      evidence: `中方+外方=${sum} · 投资总额=${total}`,
      suggestion: ok ? undefined : `中方投资额 + 外方投资额 应等于投资总额(当前相差 ${Math.abs(total - sum)})。`,
    });
  }

  // 4) 股权比例:中方 + 外方 = 100%。商务委。
  if (has("chinese_ratio") || has("foreign_ratio")) {
    const sum = num("chinese_ratio") + num("foreign_ratio");
    const ok = Math.abs(sum - 100) < 1;
    checks.push({
      id: "rule-equity-ratio",
      domain: "商务委",
      field: "股权比例(中外合计=100%)",
      status: ok ? "通过" : "不通过",
      evidence: `中方+外方=${sum}%`,
      suggestion: ok ? undefined : "中外股比合计应为 100%。",
    });
  }

  // 5) 境外注册资本 ≤ 投资总额(仅同币种可比;不同币种跳过,避免误报)。商务委。
  if (has("overseas_registered_capital") && has("investment_total")) {
    const regRaw = val("overseas_registered_capital"), totalRaw = val("investment_total");
    const rc = parseCurrency(regRaw), tc = parseCurrency(totalRaw);
    if (rc && tc && rc === tc) {
      const reg = parseNum(regRaw), total = parseNum(totalRaw);
      const ok = reg <= total;
      checks.push({
        id: "rule-regcap-vs-total",
        domain: "商务委",
        field: "注册资本与投资总额",
        status: ok ? "通过" : "不通过",
        evidence: `注册资本=${reg} · 投资总额=${total}(${rc})`,
        suggestion: ok ? undefined : "境外企业注册资本通常不应大于投资总额,请核实。",
      });
    }
    // 不同币种或无币种 token:跳过(不产生 check),避免跨币种误报。
  }

  // 6) 出资构成:各项出资合计 = 中方投资额。商务委。
  const contribCodes = [
    "cash_domestic", "self_funds_domestic", "bank_loan_domestic", "inkind_domestic",
    "intangible_domestic", "equity_domestic", "other_domestic",
    "self_funds_overseas", "bank_loan_overseas", "other_overseas",
  ];
  const anyContrib = contribCodes.some(has);
  if (anyContrib && has("chinese_investment_amount")) {
    const sum = contribCodes.reduce((a, c) => a + num(c), 0);
    const cia = num("chinese_investment_amount");
    const ok = Math.abs(sum - cia) < 1;
    checks.push({
      id: "rule-contribution",
      domain: "商务委",
      field: "出资构成(合计=中方投资额)",
      status: ok ? "通过" : "不通过",
      evidence: `出资合计=${sum} · 中方投资额=${cia}`,
      suggestion: ok ? undefined : "各项出资合计应与中方投资额一致。",
    });
  }

  const summaries: DeptSummary[] = DOMAINS.map(d => {
    const cs = checks.filter(c => c.domain === d);
    return {
      dept: d,
      passed: cs.filter(c => c.status === "通过").length,
      failed: cs.filter(c => c.status === "不通过").length,
      missing: cs.filter(c => c.status === "缺失").length,
      total: cs.length,
    };
  });

  return { checks, summaries };
}

// 便捷:只取需要处理的问题(不通过 + 缺失),按 优先级(不通过 > 缺失)排序。
export function getIssues(result: ValidationResult): ValidationCheck[] {
  return result.checks
    .filter(c => c.status !== "通过")
    .sort((a, b) => (a.status === "不通过" ? -1 : 1) - (b.status === "不通过" ? -1 : 1));
}
