// ODI 跨业务核心字段校验(P3:流程文档 §14 15 组矩阵首批 —— D 直接共用高价值组)。
// 触发条件(流程文档):同时识别到两侧部门材料。POC 语义:字段同时存在
// 「商务备案表」材料值(商务侧)与发改侧值(备案表材料值或字段主值)才执行,否则未触发。
//
// 首批 7 组(D 编号对应共性字段对照表):
//   D-001 境内投资主体名称(归一化精确比对)   D-005 投资/设立方式(场景兼容枚举映射)
//   D-006 最终目的地(国别段比对,不混用直接目的地)  D-008 投资总额(万美元精确,±0.01)
//   D-009 中方投资额(精确 + 不大于总投资)    D-014 手机(一致)  D-015 电子邮件(小写比对)
//
// 禁止混用口径(R-001/R-004)在规则 evidence/hints 中透出:
//   R-004 ±5% 容差仅商务侧预警用,发改侧不采用 → 差异≤5% 仍判不通过并注明口径;
//   R-001 注册资本同名异义 → hint 提醒禁止同名自动映射。

import type { OdiField } from "../data/types";
import { getVal } from "../field/odiGuideLogic";
import { normalizeEntity } from "./odiNdrcRules";
import type { ValidationCheck, ValidationHint } from "./odiValidationEngine";

function parseNum(s: string): number {
  if (!s) return NaN;
  const cleaned = s.replace(/[,，\s]/g, "");
  const m = cleaned.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}
function q2(n: number): number { return Math.round(n * 100) / 100; }

/** 商务侧(商务备案表)材料值 */
function commerceVal(pool: OdiField[], code: string): string {
  const mv = (pool.find(f => f.code === code)?.materialValues ?? []).find(m => m.material === "商务备案表");
  return mv?.value ?? "";
}
/** 发改侧值:备案表材料值优先,回退字段主值 */
function ndrcVal(pool: OdiField[], code: string): string {
  const mv = (pool.find(f => f.code === code)?.materialValues ?? []).find(m => m.material === "备案表");
  return mv?.value ?? getVal(pool, code);
}

/** 商务→发改 投资方式枚举映射(D-005;子公司/分公司等设立组织形态不参与该映射 —— R-010) */
const METHOD_MAP: Record<string, string> = { "新设": "新建", "并购": "并购", "增资": "增资", "变更": "其他", "新建": "新建", "其他": "其他" };

const nt = (id: string, field: string, reason: string): ValidationCheck =>
  ({ id, domain: "跨业务", field, status: "未触发", evidence: reason, suggestion: "同时识别到两侧部门材料后自动执行。" });

export function validateXbRules(pool: OdiField[]): { checks: ValidationCheck[]; hints: ValidationHint[] } {
  const checks: ValidationCheck[] = [];
  const hints: ValidationHint[] = [];

  // D-001 境内投资主体名称:归一化精确比对(以营业执照为主来源)
  {
    const a = commerceVal(pool, "domestic_company_name"), b = ndrcVal(pool, "domestic_company_name");
    if (a.trim() && b.trim()) {
      const ok = normalizeEntity(a) === normalizeEntity(b);
      checks.push({
        id: "XB-D001", domain: "跨业务", field: "跨业务·境内投资主体名称",
        status: ok ? "通过" : "不通过",
        evidence: `商务备案表:${a} · 发改:${b}`,
        suggestion: ok ? undefined : "两侧备案表的投资主体名称不一致，请核验企业全称（以营业执照为准）。",
      });
    } else checks.push(nt("XB-D001", "跨业务·境内投资主体名称", "未同时识别到两侧主体名称。"));
  }

  // D-005 投资/设立方式:场景兼容枚举映射(新设↔新建、并购↔并购、增资↔增资)
  {
    const a = commerceVal(pool, "investment_method"), b = ndrcVal(pool, "investment_method");
    if (a.trim() && b.trim()) {
      const ma = METHOD_MAP[a] ?? a, mb = METHOD_MAP[b] ?? b;
      const ok = ma === mb;
      checks.push({
        id: "XB-D005", domain: "跨业务", field: "跨业务·投资方式(枚举映射)",
        status: ok ? "通过" : "不通过",
        evidence: `商务:${a}→${ma} · 发改:${b}→${mb}`,
        suggestion: ok ? undefined : "两侧投资方式经枚举映射后应一致（新设↔新建、并购↔并购、增资↔增资）。",
      });
    } else checks.push(nt("XB-D005", "跨业务·投资方式(枚举映射)", "未同时识别到两侧投资方式。"));
  }

  // D-006 最终目的地:国别段比对(最终目的地只与实际经营/建设/并购标的地比,不得与直接目的地混用 —— R-003)
  {
    const a = commerceVal(pool, "final_destination"), b = ndrcVal(pool, "final_destination");
    if (a.trim() && b.trim()) {
      const ca = a.split(/[·•・(（,，]/)[0].trim(), cb = b.split(/[·•・(（,，]/)[0].trim();
      const ok = ca === cb;
      checks.push({
        id: "XB-D006", domain: "跨业务", field: "跨业务·最终目的地(国别)",
        status: ok ? "通过" : "不通过",
        evidence: `商务:${ca} · 发改:${cb}`,
        suggestion: ok ? undefined : "两侧最终目的地国别不一致，请核验（直接目的地不参与本比对）。",
      });
    } else checks.push(nt("XB-D006", "跨业务·最终目的地(国别)", "未同时识别到两侧最终目的地。"));
  }

  // D-008 投资总额:统一万美元精确比对(±0.01;R-004:±5% 容差仅商务侧预警,发改侧不采用)
  {
    const a = commerceVal(pool, "investment_total"), b = ndrcVal(pool, "investment_total");
    if (a.trim() && b.trim()) {
      const na = parseNum(a), nb = parseNum(b);
      const diff = Math.abs(q2(na - nb));
      const ok = diff <= 0.01;
      const within5 = nb !== 0 && diff <= Math.abs(nb) * 0.05;
      checks.push({
        id: "XB-D008", domain: "跨业务", field: "跨业务·投资总额(万美元)",
        status: ok ? "通过" : "不通过",
        evidence: `商务:${na} · 发改:${nb} · 差异${diff}${ok ? "" : within5 ? "（在±5%内：该容差仅商务侧预警口径，发改侧不采用，仍判不通过）" : "（超出±5%预警区间）"}`,
        suggestion: ok ? undefined : "两侧投资总额应统一为万美元后精确一致，请核验金额、币种和单位。",
      });
    } else checks.push(nt("XB-D008", "跨业务·投资总额(万美元)", "未同时识别到两侧投资总额。"));
  }

  // D-009 中方投资额:精确比对 + 不大于投资总额
  {
    const a = commerceVal(pool, "chinese_investment_amount"), b = ndrcVal(pool, "chinese_investment_amount");
    if (a.trim() && b.trim()) {
      const na = parseNum(a), nb = parseNum(b);
      const diff = q2(Math.abs(na - nb));
      const total = parseNum(ndrcVal(pool, "investment_total"));
      const ok = diff <= 0.01 && !(total > 0 && nb > total);
      checks.push({
        id: "XB-D009", domain: "跨业务", field: "跨业务·中方投资额(万美元)",
        status: ok ? "通过" : "不通过",
        evidence: `商务:${na} · 发改:${nb}${diff > 0.01 ? ` · 差异${diff}` : ""}${total > 0 && nb > total ? " · 发改侧中方投资额>投资总额" : ""}`,
        suggestion: ok ? undefined : "两侧中方投资额应精确一致，且不得大于项目总投资额。",
      });
    } else checks.push(nt("XB-D009", "跨业务·中方投资额(万美元)", "未同时识别到两侧中方投资额。"));
  }

  // D-014 手机一致 / D-015 电子邮件一致(交集字段,小写去空格比对)
  {
    const a = commerceVal(pool, "contact_phone"), b = ndrcVal(pool, "contact_phone");
    if (a.trim() && b.trim()) {
      const ok = a.trim() === b.trim();
      checks.push({
        id: "XB-D014", domain: "跨业务", field: "跨业务·联系人手机",
        status: ok ? "通过" : "不通过",
        evidence: `商务:${a} · 发改:${b}`,
        suggestion: ok ? undefined : "两侧联系人手机号不一致，请统一联系人信息。",
      });
    } else checks.push(nt("XB-D014", "跨业务·联系人手机", "未同时识别到两侧联系人手机。"));
  }
  {
    const a = commerceVal(pool, "contact_email"), b = ndrcVal(pool, "contact_email");
    if (a.trim() && b.trim()) {
      const ok = a.trim().toLowerCase() === b.trim().toLowerCase();
      checks.push({
        id: "XB-D015", domain: "跨业务", field: "跨业务·联系人电子邮件",
        status: ok ? "通过" : "不通过",
        evidence: `商务:${a} · 发改:${b}`,
        suggestion: ok ? undefined : "两侧联系人电子邮件不一致，请统一联系人信息。",
      });
    } else checks.push(nt("XB-D015", "跨业务·联系人电子邮件", "未同时识别到两侧电子邮件。"));
  }

  // R-001 注册资本同名异义提示(禁止同名自动映射,仅在有两侧材料语境时提示)
  if (commerceVal(pool, "domestic_company_name") && getVal(pool, "overseas_registered_capital").trim()) {
    hints.push({
      id: "hint-xb-regcap-scope", domain: "跨业务", field: "注册资本",
      text: "口径提醒：「注册资本」两侧含义不同 —— 商务侧为境外目标企业注册资本（万美元），发改侧为境内投资主体注册资本（万元人民币）。禁止同名自动映射，仅商务侧「注册资本_主体」可在并购场景映射。",
    });
  }

  return { checks, hints };
}
