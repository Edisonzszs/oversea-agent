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

import type { OdiContributionRow, OdiField, OdiMaterialKey } from "../data/types";
import { getVal } from "../field/odiGuideLogic";
import { validateOdiPool, type ValidationCheck, type ValidationDomain, type ValidationHint, type ValidationResult, type DeptSummary } from "./odiValidationEngine";

// ── 枚举(正式版 rules.py:20-37) ─────────────────────────────
export const CONTRIBUTION_METHODS = ["货币", "证券", "实物", "技术", "知识产权", "股权", "债权", "提供融资", "提供担保", "其他"] as const;
export const FUNDING_SOURCES = ["境内自有", "境内其他", "境外自有", "境外其他"] as const;
const SELF_SOURCES = ["境内自有", "境外自有"]; // 自有 = {境内自有, 境外自有}

/** 差值量化到 0.01 再比较(对齐正式版 Decimal quantize,避免浮点尾差) */
function q2(n: number): number { return Math.round(n * 100) / 100; }
/** 覆盖判定(正式版 rules.py:338-345):actual + 0.01 ≥ expected */
function covers(actual: number, expected: number): boolean { return q2(actual + 0.01 - expected) >= 0; }

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
 * 发改委通道规则(P2 首批+第二批)。全部为确定性比较,无副作用。
 * 触发前提:对应字段存在 materialValues/有值(即材料已解析);否则未触发。
 * extras.contributionRows:中方投资额构成明细行(项目级,A-034~039)。
 */
export function validateNdrcRules(pool: OdiField[], extras: { contributionRows?: OdiContributionRow[] } = {}): ValidationResult {
  const rows = extras.contributionRows ?? [];
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

  // ── 构成行明细组(A-034~039 + R-005/006 口径;输入 extras.contributionRows) ──
  {
    const numRow = (r: OdiContributionRow) => { const n = parseNum(r.amountUsdWan); return Number.isNaN(n) ? 0 : n; };
    if (rows.length > 0) {
      // A-034 每行出资企业非空(空行 → 缺失,列出缺行)
      const emptyContrib = rows.map((r, i) => (!r.contributor || !r.contributor.trim() ? `第${i + 1}行` : "")).filter(Boolean);
      const contributorsPreview = rows.map(r => r.contributor).join("、").slice(0, 40);
      checks.push({
        id: "NDRC-A-034", domain: "发改委", field: "构成明细·出资企业",
        status: emptyContrib.length ? "缺失" : "通过",
        evidence: `${rows.length} 行(${contributorsPreview})`,
        suggestion: emptyContrib.length ? `请填写出资企业（缺失：${emptyContrib.join("、")}）。` : undefined,
      });
      // A-035 出资方式 ∈ 10 枚举
      const badMethod = rows.map((r, i) => (!(CONTRIBUTION_METHODS as readonly string[]).includes(r.method) ? `第${i + 1}行(${r.method || "空"})` : "")).filter(Boolean);
      checks.push({
        id: "NDRC-A-035", domain: "发改委", field: "构成明细·出资方式枚举",
        status: badMethod.length ? "不通过" : "通过",
        evidence: [...new Set(rows.map(r => r.method))].join("/"),
        suggestion: badMethod.length ? `出资方式必须是：${CONTRIBUTION_METHODS.join("/")}（非法：${badMethod.join("、")}）。` : undefined,
      });
      // A-036 资金来源 ∈ 4 枚举
      const badSource = rows.map((r, i) => (!(FUNDING_SOURCES as readonly string[]).includes(r.source) ? `第${i + 1}行(${r.source || "空"})` : "")).filter(Boolean);
      checks.push({
        id: "NDRC-A-036", domain: "发改委", field: "构成明细·资金来源枚举",
        status: badSource.length ? "不通过" : "通过",
        evidence: [...new Set(rows.map(r => r.source))].join("/"),
        suggestion: badSource.length ? `资金来源必须是：${FUNDING_SOURCES.join("/")}（非法：${badSource.join("、")}）。` : undefined,
      });
      // A-037 行内折算冲突(备注「人民币X万元按Y折算」重算值 ≠ 表内美元金额 → FIELD_CONFLICT,不选边)
      const conflictRows: string[] = [];
      for (let i = 0; i < rows.length; i++) {
        const m = (rows[i].note ?? "").match(/人民币\s*([\d.]+)\s*万元\s*按\s*([\d.]+)\s*折算/);
        if (m && Number(m[2]) > 0) {
          const recomputed = q2(parseFloat(m[1]) / parseFloat(m[2]));
          if (Math.abs(recomputed - numRow(rows[i])) > 0.01) conflictRows.push(`第${i + 1}行(备注折算${recomputed} ≠ 表内${numRow(rows[i])})`);
        }
      }
      checks.push({
        id: "NDRC-A-037", domain: "发改委", field: "构成明细·折算口径一致",
        status: conflictRows.length ? "不通过" : "通过",
        evidence: conflictRows.length ? `FIELD_CONFLICT：${conflictRows.join("；")}` : "行内备注折算与表内金额一致(或无折算备注)",
        suggestion: conflictRows.length ? "中方投资额构成行备注的折算金额与表内金额不一致，请核验出资明细（冲突即失败，不做自动选边）。" : undefined,
      });
      // A-038 条件备注:method=其他 或 source∈{境内其他,境外其他} 的行必须有非空备注
      const needNote = rows.map((r, i) => ((r.method === "其他" || r.source === "境内其他" || r.source === "境外其他") ? i : -1)).filter(i => i >= 0);
      if (needNote.length > 0) {
        const missingNote = needNote.map(i => (!rows[i].note || !rows[i].note.trim() ? `第${i + 1}行` : "")).filter(Boolean);
        checks.push({
          id: "NDRC-A-038", domain: "发改委", field: "构成明细·条件备注",
          status: missingNote.length ? "缺失" : "通过",
          evidence: `触发行 ${needNote.length} 行(其他方式/其他来源须备注)`,
          suggestion: missingNote.length ? `出资方式为「其他」或来源为「境内其他/境外其他」的行必须填写备注（缺失：${missingNote.join("、")}）。` : undefined,
        });
      } else {
        checks.push(nt("NDRC-A-038", "构成明细·条件备注", "无「其他」方式/来源行,条件未触发。"));
      }
      // A-039 Σ行金额 = 中方投资额(±0.01;行冲突时先不通过)
      const cia = parseNum(primaryVal(pool, "chinese_investment_amount"));
      const sum = q2(rows.reduce((a, r) => a + numRow(r), 0));
      if (conflictRows.length) {
        checks.push({
          id: "NDRC-A-039", domain: "发改委", field: "构成明细合计=中方投资额",
          status: "不通过", evidence: `存在 ${conflictRows.length} 行折算冲突,合计不参与判定(FIELD_CONFLICT)`,
          suggestion: "中方投资额构成合计与中方投资额不一致，请核验出资明细（先解决折算冲突）。",
        });
      } else {
        const ok = !Number.isNaN(cia) && Math.abs(sum - cia) <= 0.01;
        checks.push({
          id: "NDRC-A-039", domain: "发改委", field: "构成明细合计=中方投资额",
          status: ok ? "通过" : "不通过",
          evidence: `构成合计=${sum} · 中方投资额=${cia}(万美元)`,
          suggestion: ok ? undefined : "中方投资额构成合计与中方投资额不一致，请核验出资明细。",
        });
      }
    } else {
      for (const [id, field] of [["NDRC-A-034", "构成明细·出资企业"], ["NDRC-A-035", "构成明细·出资方式枚举"], ["NDRC-A-036", "构成明细·资金来源枚举"], ["NDRC-A-037", "构成明细·折算口径一致"], ["NDRC-A-038", "构成明细·条件备注"], ["NDRC-A-039", "构成明细合计=中方投资额"]] as const) {
        checks.push(nt(id, field, "中方投资额构成明细未识别(需备案表构成表解析)。"));
      }
    }
  }

  // ── 资金覆盖组(F-006/007/011/014、R-009;输入=资金证明识别值) ──
  {
    const selfAv = parseNum(primaryVal(pool, "self_funds_available"));
    const finAv = parseNum(primaryVal(pool, "financing_available"));
    const hasSelf = !Number.isNaN(selfAv) && getVal(pool, "self_funds_available").trim() !== "";
    const hasFin = !Number.isNaN(finAv) && getVal(pool, "financing_available").trim() !== "";
    // 备案表构成口径:优先构成行(Σ自有/Σ其他),回退 R5 标量
    const selfComponent = rows.length > 0
      ? q2(rows.filter(r => (SELF_SOURCES as readonly string[]).includes(r.source)).reduce((a, r) => a + (parseNum(r.amountUsdWan) || 0), 0))
      : (parseNum(getVal(pool, "self_funds_domestic")) || 0) + (parseNum(getVal(pool, "self_funds_overseas")) || 0);
    const finComponent = rows.length > 0
      ? q2(rows.filter(r => !(SELF_SOURCES as readonly string[]).includes(r.source)).reduce((a, r) => a + (parseNum(r.amountUsdWan) || 0), 0))
      : (parseNum(getVal(pool, "bank_loan_domestic")) || 0) + (parseNum(getVal(pool, "bank_loan_overseas")) || 0);
    const cia = parseNum(primaryVal(pool, "chinese_investment_amount"));
    const rowsSum = rows.length > 0 ? q2(rows.reduce((a, r) => a + (parseNum(r.amountUsdWan) || 0), 0)) : cia;

    // F-007(同 X-017/R-008):自有余额覆盖备案表自有构成
    if (hasSelf && (rows.length > 0 || getVal(pool, "self_funds_domestic").trim() !== "" || getVal(pool, "self_funds_overseas").trim() !== "")) {
      const ok = covers(selfAv, selfComponent);
      checks.push({
        id: "NDRC-F-007", domain: "发改委", field: "自有资金覆盖(余额≥自有构成)",
        status: ok ? "通过" : "不通过",
        evidence: `资金证明自有余额=${selfAv} · 备案表自有构成=${selfComponent}(万美元)`,
        suggestion: ok ? undefined : "自有资金证明余额低于对应自有资金出资金额，请补充或核验资金证明。",
      });
    } else {
      checks.push(nt("NDRC-F-007", "自有资金覆盖(余额≥自有构成)", "资金证明自有余额或备案表自有构成未识别。"));
    }

    // F-011 银行融资与备案表融资构成精确一致(±0.01)
    if (hasFin && (rows.length > 0 || getVal(pool, "bank_loan_domestic").trim() !== "" || getVal(pool, "bank_loan_overseas").trim() !== "")) {
      const ok = Math.abs(q2(finAv - finComponent)) <= 0.01;
      checks.push({
        id: "NDRC-F-011", domain: "发改委", field: "银行融资匹配(=备案表融资构成)",
        status: ok ? "通过" : "不通过",
        evidence: `资金证明融资可用=${finAv} · 备案表融资构成=${finComponent}(万美元)`,
        suggestion: ok ? undefined : "资金来源支持文件与备案表中方投资额构成不匹配，请核验。",
      });
    } else {
      checks.push(nt("NDRC-F-011", "银行融资匹配(=备案表融资构成)", "资金证明融资可用或备案表融资构成未识别。"));
    }

    // F-014 (自有余额+融资可用) 覆盖 Σ构成
    if (hasSelf && hasFin && rows.length > 0) {
      const ok = covers(q2(selfAv + finAv), rowsSum);
      checks.push({
        id: "NDRC-F-014", domain: "发改委", field: "资金来源覆盖(自有+融资≥构成合计)",
        status: ok ? "通过" : "不通过",
        evidence: `自有+融资=${q2(selfAv + finAv)} · 构成合计=${rowsSum}(万美元)`,
        suggestion: ok ? undefined : "资金来源支持文件与备案表中方投资额构成不匹配，请核验。",
      });
    } else {
      checks.push(nt("NDRC-F-014", "资金来源覆盖(自有+融资≥构成合计)", "资金证明两科目或构成明细未识别。"));
    }

    // F-006(同 R-007) 全部自有资金场景:构成全部为自有 → 余额须覆盖中方投资额
    if (rows.length > 0 && rows.every(r => (SELF_SOURCES as readonly string[]).includes(r.source))) {
      const ok = covers(selfAv, cia);
      checks.push({
        id: "NDRC-F-006", domain: "发改委", field: "全部自有场景(余额≥中方投资额)",
        status: ok ? "通过" : "不通过",
        evidence: `构成全部为自有资金 · 余额=${selfAv} · 中方投资额=${cia}(万美元)`,
        suggestion: ok ? undefined : "全部自有资金场景下,资金证明余额应覆盖中方投资额，请补充资金证明。",
      });
    } else {
      checks.push(nt("NDRC-F-006", "全部自有场景(余额≥中方投资额)", rows.length === 0 ? "构成明细未识别,场景无法判定。" : "构成含非自有来源,非全部自有场景。"));
    }

    // R-009 人民币余额折算核对:折算美元 = 人民币余额 ÷ 汇率(quantize 0.01;缺汇率 → 未触发)
    {
      const cnyRaw = getVal(pool, "cny_balance").trim();
      const usdRaw = getVal(pool, "cny_balance_usd").trim();
      const rate = parseNum(getVal(pool, "exchange_rate"));
      if (cnyRaw && usdRaw) {
        if (!Number.isNaN(rate) && rate > 0) {
          const cny = parseNum(cnyRaw), usd = parseNum(usdRaw);
          const expected = q2(cny / rate);
          const ok = Math.abs(expected - usd) <= 0.01;
          checks.push({
            id: "NDRC-R-009", domain: "发改委", field: "人民币余额折算核对",
            status: ok ? "通过" : "不通过",
            evidence: `${cny}万人民币 ÷ 汇率${rate} = ${expected} · 填报折算=${usd}(万美元)`,
            suggestion: ok ? undefined : "人民币余额折算美元金额与按汇率重算值不一致，请核验折算口径。",
          });
        } else {
          checks.push(nt("NDRC-R-009", "人民币余额折算核对", "折算汇率缺失,无法折算(缺汇率不计算)。"));
        }
      } else {
        checks.push(nt("NDRC-R-009", "人民币余额折算核对", "人民币余额或其折算美元值未识别。"));
      }
    }
  }

  // ── 承诺书/请示组(M-003 四要件、C-009 责任表述、B-012 五要素) ──
  {
    const body = getVal(pool, "commitment_body");
    if (body.trim()) {
      // M-003 核心承诺四要件(正式版 materials.py:737 正则;正文=「特此承诺如下」至「此致」区段的简化口径)
      const missing: string[] = [];
      if (!/真实、合法、有效|材料(?:均)?真实|真实性、合法性/.test(body)) missing.push("材料真实合法有效承诺");
      if (!/本项(?:目|投资)(?:是)?[^。；;]{0,12}真实存在/.test(body)) missing.push("投资真实存在承诺");
      if (!/真实商业需求/.test(body)) missing.push("真实商业需求承诺");
      if (!/不存在[^。；;]{0,30}虚假投资/.test(body)) missing.push("不存在虚假投资表述");
      checks.push({
        id: "NDRC-M-003", domain: "发改委", field: "承诺书核心承诺四要件",
        status: missing.length ? "不通过" : "通过",
        evidence: missing.length ? `缺失要件：${missing.join("；")}` : "四要件齐备(材料真实/投资真实存在/真实商业需求/无虚假投资)",
        suggestion: missing.length ? "真实性承诺书缺少核心承诺表述，请按官方格式文本补全。" : undefined,
      });
      // C-009 法律责任表述
      const ok = /承担.{0,30}法律责任/.test(body);
      checks.push({
        id: "NDRC-C-009", domain: "发改委", field: "承诺书法律责任表述",
        status: ok ? "通过" : "不通过",
        evidence: ok ? "包含「承担…法律责任」表述" : "未识别到法律责任表述",
        suggestion: ok ? undefined : "未识别到【是否包含法律责任表述】，该项校验结果为缺失，请补全承诺书违诺责任条款。",
      });
    } else {
      checks.push(nt("NDRC-M-003", "承诺书核心承诺四要件", "未上传或未识别到【境外投资真实性承诺书】。"));
      checks.push(nt("NDRC-C-009", "承诺书法律责任表述", "承诺书正文未识别。"));
    }

    // B-012 请示五要素(标题/主送机关/正文依据/申报单位/附件说明)
    const petition = getVal(pool, "petition_body");
    if (petition.trim()) {
      const entity = primaryVal(pool, "domestic_company_name");
      const missing: string[] = [];
      if (!/关于.+申请备案的请示/.test(petition)) missing.push("标题(关于…申请备案的请示)");
      if (!/发展和改革委员会|发改委/.test(petition)) missing.push("主送机关(发展改革部门)");
      if (!/《企业境外投资管理办法》/.test(petition)) missing.push("正文申报依据(11号令)");
      if (!entity || !petition.includes(entity)) missing.push("申报单位(与投资主体一致)");
      if (!/附件[:：]/.test(petition)) missing.push("附件说明");
      checks.push({
        id: "NDRC-B-012", domain: "发改委", field: "请示五要素完备",
        status: missing.length ? "缺失" : "通过",
        evidence: missing.length ? `缺失要素：${missing.join("；")}` : "标题/主送/正文依据/申报单位/附件齐备",
        suggestion: missing.length ? `企业项目申请备案的请示缺少：${missing.join("；")}。` : undefined,
      });
    } else {
      checks.push(nt("NDRC-B-012", "请示五要素完备", "未上传或未识别到【企业项目申请备案的请示】。"));
    }
  }

  // ── blocked 三条(正式版 rule_decisions.json:业务口径待确认,本轮不执行) ──
  for (const [id, field, reason] of [
    ["NDRC-A-033", "自有资金余额vs中方投资额(全额)", "与 F-007/R-008 部分覆盖口径冲突,业务口径待确认。"],
    ["NDRC-C-010", "承诺书材料完整性(责任表述关联)", "核心承诺是否须含 C-009 责任表述未定义。"],
    ["NDRC-X-019", "汇率口径", "业务真值标注「待定」。"],
  ] as const) {
    checks.push({ id, domain: "发改委", field, status: "blocked", evidence: reason, suggestion: "该项业务口径待确认，本轮未执行。" });
  }

  const byStatus = (s: ValidationCheck["status"]) => checks.filter(c => c.status === s).length;
  const summary: DeptSummary = {
    dept: "发改委", passed: byStatus("通过"), failed: byStatus("不通过"),
    missing: byStatus("缺失"), skipped: byStatus("未触发"), blocked: byStatus("blocked"),
    total: byStatus("通过") + byStatus("不通过") + byStatus("缺失"),
  };
  return { checks, hints, summaries: [summary] };
}

/** 组合校验:商务线 13 条即时校验 + 发改委规则族,按三域重算汇总。
 *  extras.contributionRows:中方投资额构成明细行(项目级)。 */
export function validateOdiFull(pool: OdiField[], extras: { contributionRows?: OdiContributionRow[] } = {}): ValidationResult {
  const commerce = validateOdiPool(pool);
  const ndrc = validateNdrcRules(pool, extras);
  const checks = [...commerce.checks, ...ndrc.checks];
  const hints = [...commerce.hints, ...ndrc.hints];
  const domains: ValidationDomain[] = ["商务委", "发改委", "跨业务"];
  const summaries: DeptSummary[] = domains.map(d => {
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
