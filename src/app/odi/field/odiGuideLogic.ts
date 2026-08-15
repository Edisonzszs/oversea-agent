import type { OdiField } from "../data/types";

export function getVal(pool: OdiField[], code: string): string {
  return pool.find(f => f.code === code)?.value ?? "";
}
function setField(pool: OdiField[], code: string, mut: (f: OdiField) => void): OdiField[] {
  return pool.map(f => { if (f.code === code) { const c = { ...f }; mut(c); return c; } return f; });
}

export function commitField(pool: OdiField[], code: string, value: string, origin: "guide"|"upload"|"auth"|"ai"|"derived"): OdiField[] {
  return setField(pool, code, f => {
    f.value = value;
    f.status = value ? "confirmed" : "empty";
    f.sources = [...f.sources.filter(s => s.origin !== origin), { origin, evidence: value }];
    f.updatedAt = Date.now();
  });
}

export function shouldShowRound7(pool: OdiField[]): boolean {
  return getVal(pool, "investment_method") === "并购";
}

// 单一中方投资默认(spec 6.3):无外方股东时
export function applyLinkage(pool: OdiField[]): OdiField[] {
  const foreign = getVal(pool, "foreign_shareholder");
  if (foreign && foreign.trim() !== "") return pool; // 有外方,不默认
  const domestic = getVal(pool, "domestic_company_name");
  if (!domestic) return pool;
  let p = commitField(pool, "chinese_shareholder", domestic, "derived");
  p = commitField(p, "chinese_ratio", "100", "derived");
  p = commitField(p, "reg_capital_chinese_ratio", "100", "derived");
  return p;
}

// 派生:金额人民币 = 原币 × 汇率(spec 6.3)
export function computeDerived(pool: OdiField[]): OdiField[] {
  const rate = parseFloat(getVal(pool, "exchange_rate")) || 0;
  const cn = parseFloat(getVal(pool, "chinese_investment_amount")) || 0;
  const fn = parseFloat(getVal(pool, "foreign_investment_amount")) || 0;
  const cnRmb = rate ? Math.round(cn * rate) : 0;
  const fnRmb = rate ? Math.round(fn * rate) : 0;
  let p = setField(pool, "chinese_investment_rmb", f => { f.value = String(cnRmb); f.status = cnRmb ? "confirmed" : "empty"; f.derived = true; f.sources = [{ origin: "derived" }]; });
  p = setField(p, "foreign_investment_rmb", f => { f.value = String(fnRmb); f.status = fnRmb ? "confirmed" : "empty"; f.derived = true; f.sources = [{ origin: "derived" }]; });
  p = setField(p, "investment_total_rmb", f => { f.value = String(cnRmb + fnRmb); f.status = (cnRmb+fnRmb) ? "confirmed" : "empty"; f.derived = true; f.sources = [{ origin: "derived" }]; });
  return p;
}
