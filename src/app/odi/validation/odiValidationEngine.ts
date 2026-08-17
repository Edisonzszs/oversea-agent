// ODI 校验引擎(P1:商务线 13 条即时校验补全 + 未触发语义 + 风险提示通道)。
// 纯函数:输入统一字段池 → 输出校验结果,按 商务委/发改委/跨业务 分组。
//
// 结果四态(流程文档 §15):通过/不通过/缺失 计入汇总;「未触发」是规则执行状态
// (触发条件不满足,如缺另一侧输入),不计入三态、不算问题,在规则详情中说明触发条件。
// 风险提示(hints):敏感国家/行业、中方投资额≥3亿美元、多层级投资路径 ——
// 只提示人工确认,不改变三态(流程文档 §1.4/§6.4)。
//
// 规则清单(对应 流程文档 §6.4 13 条即时校验 + 场景层,§6.4 序号标注在规则后):
//   1) 必填完整性(缺失)
//   2) 投资方式 ↔ 设立方式 一致(场景层)
//   3) 投资金额:中方 + 外方 = 投资总额(#2)
//   4) 股权比例:中方 + 外方 = 100%(#3)
//   5) 股比与投资额占比基本一致(±5 个百分点,演示口径)(#4)
//   6) 中方出资币种金额折算合计 = 中方投资额(缺币种/汇率 → 未触发)(#5,#9)
//   7) 现金出资_境内 = 自有资金_境内 + 银行贷款_境内(现金为合计项)(#6)
//   8) 境外注册资本 ≤ 投资总额(仅同币种可比)(#1)
//   9) 出资构成:子项合计 = 中方投资额(现金合计项不重复计入)(#7)
//   10) 直接/最终目的地已填且非占位词(#10,#11 分别保存为两字段)
// 确定性、无副作用,便于单测与前后端复用。汇总优先级(展示用):不通过 > 缺失 > 通过。

import type { OdiField } from "../data/types";
import { getVal } from "../field/odiGuideLogic";
import { allFieldDefs } from "../field/odiFieldCatalog";

export type ValidationDomain = "商务委" | "发改委" | "跨业务";
/** 五态(对齐正式版):通过/不通过/缺失 计入汇总;未触发=条件不满足;
 *  blocked=业务口径待确认(正式版 A-033/C-010/X-019),本轮不执行。后两者不计入三态。 */
export type ValidationStatus = "通过" | "不通过" | "缺失" | "未触发" | "blocked";

export interface ValidationCheck {
  id: string;
  domain: ValidationDomain;
  field: string;          // 检查项 / 字段名
  status: ValidationStatus;
  evidence?: string;      // 当前值 / 依据 / 未触发原因
  suggestion?: string;    // 修正建议(不通过/缺失时)或触发条件说明(未触发时)
}

export interface ValidationHint {
  id: string;
  domain: ValidationDomain;
  field: string;
  text: string;
}

export interface DeptSummary {
  dept: ValidationDomain;
  passed: number;
  failed: number;   // 不通过
  missing: number;  // 缺失
  skipped: number;  // 未触发(条件不满足,不计入三态)
  blocked: number;  // 业务口径待确认(不计入三态)
  total: number;    // 已执行规则数 = passed+failed+missing(不含未触发/blocked)
}

export interface ValidationResult {
  checks: ValidationCheck[];
  hints: ValidationHint[];
  summaries: DeptSummary[];
}

const DOMAINS: ValidationDomain[] = ["商务委", "发改委", "跨业务"];

// 敏感提示词表(公开监管口径的演示子集;命中只提示人工确认,不改三态 —— §6.4 第12条)。
const SENSITIVE_COUNTRIES = ["伊朗", "朝鲜", "叙利亚", "古巴", "苏丹", "委内瑞拉"];
const SENSITIVE_INDUSTRIES = ["武器", "军工", "跨境水资源", "新闻媒体", "房地产", "酒店", "影城", "娱乐业", "体育俱乐部"];
// 中方投资额 3 亿美元阈值(万美元计)触发金额风险提示场景(条件触发表)。
const LARGE_INVESTMENT_USD_10K = 30000;

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
function parseCurrency(s: string): string {
  if (!s) return "";
  const m = s.match(/USD|SGD|EUR|RMB|CNY|HKD|JPY|美元|人民币|日元|欧元|港元|英镑/i);
  return m ? m[0].toUpperCase() : "";
}

// 目的地占位词:填了但无法判定国别(待定/待填写/无/TBD…)→ 按"缺失"处理(#10)。
function isPlaceholderDestination(v: string): boolean {
  return /^(待定|待填写|待补充|无|tbd|-+|—+)$/i.test(v.trim());
}

// 目的地取国别段:"越南·胡志明市"→"越南","德国(巴伐利亚)"→"德国"。
function countrySegment(v: string): string {
  return v.split(/[·•・(（,，]/)[0].trim();
}

export function validateOdiPool(pool: OdiField[]): ValidationResult {
  const val = (code: string) => getVal(pool, code);
  const has = (code: string) => { const v = val(code); return !!(v && v.trim()); };
  // 取数值,空值按 0 参与求和(parseNum 空串为 NaN → 0)。
  const num = (code: string): number => { const n = parseNum(val(code)); return Number.isNaN(n) ? 0 : n; };
  const isMerger = val("investment_method") === "并购";

  const checks: ValidationCheck[] = [];
  const hints: ValidationHint[] = [];
  // 条件规则统一产出:触发 → 三态;不触发 → 「未触发」+ 原因(不静默消失)。
  const nt = (id: string, domain: ValidationDomain, field: string, reason: string): ValidationCheck =>
    ({ id, domain, field, status: "未触发", evidence: reason, suggestion: "满足触发条件后自动执行。" });

  // 1) 必填完整性(缺失)。非并购时 R7 整轮未开启(属采集条件,不按规则未触发逐条产出,避免噪音)。
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
  {
    const triggered = has("investment_method") && has("establishment_method");
    if (triggered) {
      const im = val("investment_method"), em = val("establishment_method");
      const consistent = (im === "并购") === (em === "并购");
      checks.push({
        id: "rule-method-consistency", domain: "商务委", field: "投资方式与设立方式",
        status: consistent ? "通过" : "不通过",
        evidence: `投资方式=${im} · 设立方式=${em}`,
        suggestion: consistent ? undefined : "投资方式与设立方式需保持一致(如「并购」对应「并购》)。",
      });
    } else {
      checks.push(nt("rule-method-consistency", "商务委", "投资方式与设立方式", "投资方式与设立方式未同时填写。"));
    }
  }

  // 3) 投资金额:中方 + 外方 = 投资总额(#2)。商务委。
  {
    const triggered = has("investment_total") && (has("chinese_investment_amount") || has("foreign_investment_amount"));
    if (triggered) {
      const sum = num("chinese_investment_amount") + num("foreign_investment_amount");
      const total = num("investment_total");
      const ok = Math.abs(sum - total) < 1;
      checks.push({
        id: "rule-amount-consistency", domain: "商务委", field: "投资金额(中方+外方=总额)",
        status: ok ? "通过" : "不通过",
        evidence: `中方+外方=${sum} · 投资总额=${total}`,
        suggestion: ok ? undefined : `中方投资额 + 外方投资额 应等于投资总额(当前相差 ${Math.abs(total - sum)})。`,
      });
    } else {
      checks.push(nt("rule-amount-consistency", "商务委", "投资金额(中方+外方=总额)", "投资总额与中方/外方投资额未填写。"));
    }
  }

  // 4) 股权比例:中方 + 外方 = 100%(#3)。商务委。
  {
    const triggered = has("chinese_ratio") || has("foreign_ratio");
    if (triggered) {
      const sum = num("chinese_ratio") + num("foreign_ratio");
      const ok = Math.abs(sum - 100) < 1;
      checks.push({
        id: "rule-equity-ratio", domain: "商务委", field: "股权比例(中外合计=100%)",
        status: ok ? "通过" : "不通过",
        evidence: `中方+外方=${sum}%`,
        suggestion: ok ? undefined : "中外股比合计应为 100%。",
      });
    } else {
      checks.push(nt("rule-equity-ratio", "商务委", "股权比例(中外合计=100%)", "中外股比均未填写。"));
    }
  }

  // 5) 股比与投资额占比基本一致(#4,±5 个百分点为"基本一致"演示口径)。商务委。
  {
    const triggered = has("chinese_ratio") && has("investment_total") && has("chinese_investment_amount") && num("investment_total") > 0;
    if (triggered) {
      const total = num("investment_total");
      const deviations: string[] = [];
      let ok = true;
      const cnExpect = (num("chinese_investment_amount") / total) * 100;
      if (Math.abs(num("chinese_ratio") - cnExpect) > 5) { ok = false; deviations.push(`中方股比${num("chinese_ratio")}% vs 占比${cnExpect.toFixed(1)}%`); }
      if (has("foreign_ratio") && has("foreign_investment_amount")) {
        const fnExpect = (num("foreign_investment_amount") / total) * 100;
        if (Math.abs(num("foreign_ratio") - fnExpect) > 5) { ok = false; deviations.push(`外方股比${num("foreign_ratio")}% vs 占比${fnExpect.toFixed(1)}%`); }
      }
      checks.push({
        id: "rule-ratio-amount-alignment", domain: "商务委", field: "股比与投资额占比(基本一致)",
        status: ok ? "通过" : "不通过",
        evidence: deviations.length ? deviations.join(" · ") : "中外股比与投资额占比偏差在 5 个百分点内",
        suggestion: ok ? undefined : "股比应与对应投资额占总投资额的比例基本一致(±5 个百分点)。",
      });
    } else {
      checks.push(nt("rule-ratio-amount-alignment", "商务委", "股比与投资额占比(基本一致)", "中方股比、投资总额、中方投资额未同时填写。"));
    }
  }

  // 6) 中方出资币种金额折算合计 = 中方投资额(#5)。美元直接计,人民币按折算汇率折美元;
  //    其他币种或缺汇率 → 未触发(缺币种/单位/汇率不计算,#9)。商务委。
  {
    const pairs = [["cny_currency_1", "cny_amount_1"], ["cny_currency_2", "cny_amount_2"]] as const;
    const filled = pairs.filter(([, a]) => has(a));
    const triggered = filled.length > 0 && has("chinese_investment_amount");
    if (triggered) {
      const rate = num("exchange_rate");
      const parts: number[] = [];
      let unconvertible = "";
      for (const [curCode, amtCode] of filled) {
        const cur = parseCurrency(val(curCode));
        const amt = num(amtCode);
        if (cur === "美元" || cur === "USD") parts.push(amt);
        else if (cur === "人民币" || cur === "RMB" || cur === "CNY") {
          if (rate > 0) parts.push(amt / rate);
          else unconvertible = `「${val(curCode)}」金额需折算汇率`;
        } else unconvertible = `币种「${val(curCode) || "未填写"}」暂不支持折算`;
      }
      if (unconvertible) {
        checks.push(nt("rule-currency-breakdown", "商务委", "出资币种折算(合计=中方投资额)", `缺少可用的折算口径:${unconvertible}。`));
      } else {
        const sum = parts.reduce((a, b) => a + b, 0);
        const cia = num("chinese_investment_amount");
        const ok = Math.abs(sum - cia) < 1;
        checks.push({
          id: "rule-currency-breakdown", domain: "商务委", field: "出资币种折算(合计=中方投资额)",
          status: ok ? "通过" : "不通过",
          evidence: `币种金额折算合计=${sum.toFixed(1)}万美元 · 中方投资额=${cia}`,
          suggestion: ok ? undefined : "中方出资各币种金额折算后合计应与中方投资额一致(请核对币种、金额与汇率)。",
        });
      }
    } else {
      checks.push(nt("rule-currency-breakdown", "商务委", "出资币种折算(合计=中方投资额)", "中方出资金额或中方投资额未填写。"));
    }
  }

  // 7) 现金出资_境内 = 自有资金_境内 + 银行贷款_境内(#6,现金出资为合计项)。商务委。
  {
    const triggered = has("cash_domestic") && (has("self_funds_domestic") || has("bank_loan_domestic"));
    if (triggered) {
      const cash = num("cash_domestic");
      const sub = num("self_funds_domestic") + num("bank_loan_domestic");
      const ok = Math.abs(cash - sub) < 1;
      checks.push({
        id: "rule-cash-breakdown", domain: "商务委", field: "现金出资构成(现金=自有+贷款)",
        status: ok ? "通过" : "不通过",
        evidence: `现金出资=${cash} · 自有资金+银行贷款=${sub}`,
        suggestion: ok ? undefined : "境内现金出资(合计项)应等于自有资金与银行贷款之和,请勿重复或遗漏计入。",
      });
    } else {
      checks.push(nt("rule-cash-breakdown", "商务委", "现金出资构成(现金=自有+贷款)", "现金出资与其子项(自有资金/银行贷款)均未填写。"));
    }
  }

  // 8) 境外注册资本 ≤ 投资总额(仅同币种可比;不同币种 → 未触发,避免跨币种误报)(#1)。商务委。
  {
    const triggered = has("overseas_registered_capital") && has("investment_total");
    if (triggered) {
      const regRaw = val("overseas_registered_capital"), totalRaw = val("investment_total");
      const rc = parseCurrency(regRaw), tc = parseCurrency(totalRaw);
      if (rc && tc && rc === tc) {
        const reg = parseNum(regRaw), total = parseNum(totalRaw);
        const ok = reg <= total;
        checks.push({
          id: "rule-regcap-vs-total", domain: "商务委", field: "注册资本与投资总额",
          status: ok ? "通过" : "不通过",
          evidence: `注册资本=${reg} · 投资总额=${total}(${rc})`,
          suggestion: ok ? undefined : "境外企业注册资本通常不应大于投资总额,请核实。",
        });
      } else {
        checks.push(nt("rule-regcap-vs-total", "商务委", "注册资本与投资总额", `币种不同或未识别(注册资本=${rc || "?"} · 总额=${tc || "?"}),无法直接比较。`));
      }
    } else {
      checks.push(nt("rule-regcap-vs-total", "商务委", "注册资本与投资总额", "注册资本或投资总额未填写。"));
    }
  }

  // 9) 出资构成:子项合计 = 中方投资额(#7)。现金出资是合计项(=自有+贷款),不重复计入。商务委。
  const contribCodes = [
    "self_funds_domestic", "bank_loan_domestic", "inkind_domestic",
    "intangible_domestic", "equity_domestic", "other_domestic",
    "self_funds_overseas", "bank_loan_overseas", "other_overseas",
  ];
  {
    const triggered = contribCodes.some(has) && has("chinese_investment_amount");
    if (triggered) {
      const sum = contribCodes.reduce((a, c) => a + num(c), 0);
      const cia = num("chinese_investment_amount");
      const ok = Math.abs(sum - cia) < 1;
      checks.push({
        id: "rule-contribution", domain: "商务委", field: "出资构成(子项合计=中方投资额)",
        status: ok ? "通过" : "不通过",
        evidence: `出资子项合计=${sum} · 中方投资额=${cia}`,
        suggestion: ok ? undefined : "各项出资子项合计应与中方投资额一致(现金出资为合计项,不计入子项求和)。",
      });
    } else {
      checks.push(nt("rule-contribution", "商务委", "出资构成(子项合计=中方投资额)", "出资子项或中方投资额未填写。"));
    }
  }

  // 10) 直接/最终目的地已填且非占位词(#10;#11 两档分别保存)。跨业务。
  {
    const dDirect = val("direct_destination").trim();
    const dFinal = val("final_destination").trim();
    if (!dDirect && !dFinal) {
      checks.push(nt("rule-destination", "跨业务", "投资目的地(直接/最终)", "两档目的地均未填写(由必填项报缺失)。"));
    } else {
      const bad = [
        dDirect && isPlaceholderDestination(dDirect) ? "直接目的地" : "",
        dFinal && isPlaceholderDestination(dFinal) ? "最终目的地" : "",
      ].filter(Boolean);
      checks.push({
        id: "rule-destination", domain: "跨业务", field: "投资目的地(直接/最终)",
        status: bad.length ? "缺失" : "通过",
        evidence: `直接=${dDirect || "未填"} · 最终=${dFinal || "未填"}`,
        suggestion: bad.length ? `${bad.join("、")}为占位内容,请填写具体国家或地区。` : undefined,
      });
    }
  }

  // ── 风险提示(只提示人工确认,不计入三态) ──────────────────
  const countryTexts = [val("investment_country"), val("direct_destination"), val("final_destination")].join(" ");
  const hitCountry = SENSITIVE_COUNTRIES.find(sc => countryTexts.includes(sc));
  if (hitCountry) {
    hints.push({
      id: "hint-sensitive-country", domain: "跨业务", field: "投资目的地",
      text: `投资目的地涉及敏感国家/地区「${hitCountry}」,可能适用核准管理而非备案。请人工确认,本提示不影响校验结论。`,
    });
  }
  const ind = val("industry");
  if (SENSITIVE_INDUSTRIES.some(s => ind.includes(s))) {
    hints.push({
      id: "hint-sensitive-industry", domain: "跨业务", field: "所属行业",
      text: `所属行业「${ind}」涉及敏感行业,需要重点核查(限制出口产品技术/影响多国利益等)。请人工确认,本提示不影响校验结论。`,
    });
  }
  {
    const ciaCur = parseCurrency(val("chinese_investment_amount"));
    const cia = parseNum(val("chinese_investment_amount"));
    const isUsd = !ciaCur || ciaCur === "美元" || ciaCur === "USD";
    if (isUsd && !Number.isNaN(cia) && cia >= LARGE_INVESTMENT_USD_10K) {
      hints.push({
        id: "hint-large-investment", domain: "跨业务", field: "中方投资额",
        text: `中方投资额达 3 亿美元以上,进入金额风险提示场景(地方企业 3 亿美元及以上项目可能涉及国家层面办理)。请人工确认,本提示不影响校验结论。`,
      });
    }
  }
  {
    const dDirect = val("direct_destination").trim(), dFinal = val("final_destination").trim();
    if (dDirect && dFinal && countrySegment(dDirect) !== countrySegment(dFinal)) {
      hints.push({
        id: "hint-multi-layer-path", domain: "跨业务", field: "投资路径",
        text: `直接目的地(${countrySegment(dDirect)})与最终目的地(${countrySegment(dFinal)})不同,属多层级投资路径:直接目的地应为第一层级境外企业所在地,最终目的地为实际经营/建设/并购标的地,请确认填写无误。`,
      });
    }
  }

  const summaries: DeptSummary[] = DOMAINS.map(d => {
    const cs = checks.filter(c => c.domain === d);
    const passed = cs.filter(c => c.status === "通过").length;
    const failed = cs.filter(c => c.status === "不通过").length;
    const missing = cs.filter(c => c.status === "缺失").length;
    return {
      dept: d, passed, failed, missing,
      skipped: cs.filter(c => c.status === "未触发").length,
      blocked: cs.filter(c => c.status === "blocked").length,
      total: passed + failed + missing,
    };
  });

  return { checks, hints, summaries };
}

// 便捷:只取需要处理的问题(不通过 + 缺失),按 优先级(不通过 > 缺失)排序。「未触发」不算问题。
export function getIssues(result: ValidationResult): ValidationCheck[] {
  return result.checks
    .filter(c => c.status === "不通过" || c.status === "缺失")
    .sort((a, b) => (a.status === "不通过" ? -1 : 1) - (b.status === "不通过" ? -1 : 1));
}
