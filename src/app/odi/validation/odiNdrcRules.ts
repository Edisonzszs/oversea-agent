// ODI 发改委通道规则引擎(P2:从正式版 ndrc-rules-2026-07-23.v2 移植的首批家族,见
// docs/odi-assist-rules.md §二)。输入统一字段池(含 materialValues 多来源材料值),
// 输出 ValidationResult(与商务线引擎同构),规则域归「发改委」。
//
// 移植范围(POC 首批,规则 id 镜像正式版):
//   主体一致性组: A-002(企业名⊆项目名) / A-003(项目名跨材料一致) /
//                A-004(主体名跨材料一致) / A-006(USCC 格式+备案表↔执照一致)
//   财务映射组:   E-011~E-014(总资产/净资产/主营收入/净利润 备案表↔审计,±0.01 万元)
//
// 实现语义对齐正式版:
//   - 归一化双口径:企业名 NFKC+去空白(不放宽逐字一致);项目名 NFKC+去空白+去全部中英文标点
//   - USCC 正则 ^[0-9A-Z]{18}$,任一材料格式非法即不通过;备案表↔执照逐字相等
//   - 金额容差 ±0.01(万元);条件不满足 → 「未触发」(材料未上传/值未识别),不计三态
//   - 无材料解析的池(如模拟演示)全部未触发,不产生缺失噪音

import type { OdiField, OdiMaterialKey } from "../data/types";
import { getVal } from "../field/odiGuideLogic";
import { validateOdiPool, type ValidationCheck, type ValidationDomain, type ValidationHint, type ValidationResult, type DeptSummary } from "./odiValidationEngine";

// ── 归一化(正式版 rules.py:68-85 口径) ─────────────────────
/** 企业名归一化:NFKC + 去全部空白。不放宽逐字一致(多一字仍算冲突)。 */
export function normalizeEntity(s: string): string {
  return (s || "").normalize("NFKC").replace(/\s+/g, "");
}
/** 项目名/地址/日期归一化:NFKC + 去空白 + 去全部中英文标点(\p{P} 标点 + \p{S} 符号)。 */
export function normalizeProject(s: string): string {
  return (s || "").normalize("NFKC").replace(/\s+/g, "").replace(/[\p{P}\p{S}]/gu, "");
}
/** USCC 格式:18 位数字或大写字母(正式版 D-002/A-006)。 */
export function isValidUscc(s: string): boolean {
  return /^[0-9A-Z]{18}$/.test((s || "").trim());
}

// 数值解析(与商务线引擎同规则:前导数字,千分位剥离)
function parseNum(s: string): number {
  if (!s) return NaN;
  const cleaned = s.replace(/[,，\s]/g, "");
  const m = cleaned.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}

// ── 多来源材料值读取 ────────────────────────────────────────
function mvals(pool: OdiField[], code: string): { material: OdiMaterialKey; value: string }[] {
  return (pool.find(f => f.code === code)?.materialValues ?? []).filter(m => m.value && m.value.trim());
}
/** 主值:优先备案表材料值,其次字段主值(与正式版"备案表是事实基准"一致)。 */
function primaryVal(pool: OdiField[], code: string): string {
  const fromFiling = mvals(pool, code).find(m => m.material === "备案表");
  return fromFiling?.value ?? getVal(pool, code);
}

const nt = (id: string, field: string, reason: string): ValidationCheck =>
  ({ id, domain: "发改委", field, status: "未触发", evidence: reason, suggestion: "材料识别后自动执行。" });

/**
 * 发改委通道规则(首批)。全部为确定性比较,无副作用。
 * 触发前提:对应字段存在 materialValues(即材料已解析);否则未触发。
 */
export function validateNdrcRules(pool: OdiField[]): ValidationResult {
  const checks: ValidationCheck[] = [];
  const hints: ValidationHint[] = [];

  // A-002 项目名称中应包含投资主体名称(归一化子串;正式版 ENTITY_NAME_CONFLICT)
  {
    const entity = primaryVal(pool, "domestic_company_name");
    const project = primaryVal(pool, "project_name");
    if (entity.trim() && project.trim()) {
      const ok = normalizeProject(project).includes(normalizeEntity(entity));
      checks.push({
        id: "NDRC-A-002", domain: "发改委", field: "项目名称包含投资主体名称",
        status: ok ? "通过" : "不通过",
        evidence: `项目名称=${project} · 投资主体=${entity}`,
        suggestion: ok ? undefined : "投资主体名称与营业执照或其他申报材料不一致，请核验企业全称。",
      });
    } else {
      checks.push(nt("NDRC-A-002", "项目名称包含投资主体名称", "项目名称或投资主体名称未识别。"));
    }
  }

  // A-003(+B-002/C-002/X-002) 备案表、请示和承诺书中的项目名称一致
  {
    const mvs = mvals(pool, "project_name");
    if (mvs.length >= 2) {
      const first = normalizeProject(mvs[0].value);
      const bad = mvs.filter(m => normalizeProject(m.value) !== first).map(m => m.material);
      checks.push({
        id: "NDRC-A-003", domain: "发改委", field: "项目名称跨材料一致",
        status: bad.length ? "不通过" : "通过",
        evidence: mvs.map(m => `${m.material}:${m.value}`).join(" · "),
        suggestion: bad.length ? `备案表、请示和真实性承诺书中的项目名称不一致，请统一（不一致来源：${bad.join("、")}）。` : undefined,
      });
    } else {
      checks.push(nt("NDRC-A-003", "项目名称跨材料一致", "项目名称的跨材料值不足两份（需备案表/请示/承诺书中至少两份）。"));
    }
  }

  // A-004(+X-001) 投资主体名称跨材料一致(备案表/营业执照/审计报告/承诺书/请示)
  {
    const mvs = mvals(pool, "domestic_company_name");
    if (mvs.length >= 2) {
      const first = normalizeEntity(mvs[0].value);
      const bad = mvs.filter(m => normalizeEntity(m.value) !== first).map(m => m.material);
      checks.push({
        id: "NDRC-A-004", domain: "发改委", field: "投资主体名称跨材料一致",
        status: bad.length ? "不通过" : "通过",
        evidence: mvs.map(m => `${m.material}:${m.value}`).join(" · "),
        suggestion: bad.length ? `投资主体名称与营业执照或其他申报材料不一致，请核验企业全称（不一致来源：${bad.join("、")}）。` : undefined,
      });
    } else {
      checks.push(nt("NDRC-A-004", "投资主体名称跨材料一致", "投资主体名称的跨材料值不足两份（需至少两份材料识别出主体名）。"));
    }
  }

  // A-006(+D-002/X-004) USCC 18位格式 + 备案表↔营业执照逐字一致
  {
    const mvs = mvals(pool, "uscc");
    if (mvs.length >= 1) {
      const badFormat = mvs.filter(m => !isValidUscc(m.value)).map(m => m.material);
      if (badFormat.length) {
        checks.push({
          id: "NDRC-A-006", domain: "发改委", field: "统一社会信用代码(格式与一致)",
          status: "不通过",
          evidence: mvs.map(m => `${m.material}:${m.value}`).join(" · "),
          suggestion: `统一社会信用代码应为 18 位数字或大写字母（格式异常来源：${badFormat.join("、")}）。`,
        });
      } else {
        const filing = mvs.find(m => m.material === "备案表");
        const license = mvs.find(m => m.material === "营业执照");
        if (filing && license) {
          const ok = filing.value.trim() === license.value.trim();
          checks.push({
            id: "NDRC-A-006", domain: "发改委", field: "统一社会信用代码(格式与一致)",
            status: ok ? "通过" : "不通过",
            evidence: `备案表:${filing.value} · 营业执照:${license.value}`,
            suggestion: ok ? undefined : "备案表主体信息与营业执照登记信息不一致，请核验。",
          });
        } else {
          checks.push({
            id: "NDRC-A-006", domain: "发改委", field: "统一社会信用代码(格式与一致)",
            status: "通过",
            evidence: mvs.map(m => `${m.material}:${m.value}`).join(" · "),
            suggestion: undefined,
          });
        }
      }
    } else {
      checks.push(nt("NDRC-A-006", "统一社会信用代码(格式与一致)", "未从材料识别到统一社会信用代码。"));
    }
  }

  // E-011~E-014 备案表财务数据与经审计财务报表对应科目一致(±0.01 万元)
  // 取数口径(正式版 E-005~008):总资产=资产负债表"负债和所有者权益合计";净资产="所有者权益合计";
  // 主营业务收入=利润表"营业收入";净利润="净利润"(负数保留原值)。
  const finFields: { code: string; name: string; rule: string }[] = [
    { code: "total_assets", name: "总资产", rule: "NDRC-E-011" },
    { code: "net_assets", name: "净资产", rule: "NDRC-E-012" },
    { code: "main_business_revenue", name: "主营业务收入", rule: "NDRC-E-013" },
    { code: "net_profit", name: "净利润", rule: "NDRC-E-014" },
  ];
  for (const f of finFields) {
    const mvs = mvals(pool, f.code);
    const filing = mvs.find(m => m.material === "备案表");
    const audit = mvs.find(m => m.material === "审计报告");
    if (filing && audit) {
      const a = parseNum(filing.value), b = parseNum(audit.value);
      // 容差 ±0.01 万元:差值先量化到 0.01 再比(对齐正式版 Decimal quantize 语义,避免浮点尾差误判)
      const ok = !Number.isNaN(a) && !Number.isNaN(b) && Math.round(Math.abs(a - b) * 100) / 100 <= 0.01;
      checks.push({
        id: f.rule, domain: "发改委", field: `${f.name}(备案表↔审计)`,
        status: ok ? "通过" : "不通过",
        evidence: `备案表:${filing.value} · 审计报告:${audit.value}（万元人民币）`,
        suggestion: ok ? undefined : "备案表财务数据与经审计财务报表对应科目不一致，请核验。",
      });
    } else {
      checks.push(nt(f.rule, `${f.name}(备案表↔审计)`, "备案表与审计报告未同时识别到该科目。"));
    }
  }

  const byStatus = (s: ValidationCheck["status"]) => checks.filter(c => c.status === s).length;
  const summary: DeptSummary = {
    dept: "发改委", passed: byStatus("通过"), failed: byStatus("不通过"),
    missing: byStatus("缺失"), skipped: byStatus("未触发"), total: byStatus("通过") + byStatus("不通过") + byStatus("缺失"),
  };
  return { checks, hints, summaries: [summary] };
}

/** 组合校验:商务线 13 条即时校验 + 发改委首批规则,按三域重算汇总。 */
export function validateOdiFull(pool: OdiField[]): ValidationResult {
  const commerce = validateOdiPool(pool);
  const ndrc = validateNdrcRules(pool);
  const checks = [...commerce.checks, ...ndrc.checks];
  const hints = [...commerce.hints, ...ndrc.hints];
  const domains: ValidationDomain[] = ["商务委", "发改委", "跨业务"];
  const summaries: DeptSummary[] = domains.map(d => {
    const cs = checks.filter(c => c.domain === d);
    const passed = cs.filter(c => c.status === "通过").length;
    const failed = cs.filter(c => c.status === "不通过").length;
    const missing = cs.filter(c => c.status === "缺失").length;
    return { dept: d, passed, failed, missing, skipped: cs.filter(c => c.status === "未触发").length, total: passed + failed + missing };
  });
  return { checks, hints, summaries };
}
