import { describe, it, expect } from "vitest";
import { buildMaterialDocs, locateInDoc, lineHitsValue } from "./materialDocs";
import { seedAssistFieldPool, DEMO_CONTRIBUTION_ROWS } from "../../components/odiProjectData";
import { RULE_EVIDENCE_REFS, defaultMaterialFor, hasEvidenceRefs } from "../validation/evidenceRefs";
import { allFieldCodes } from "../field/odiFieldCatalog";

describe("materialDocs — 材料模拟原文", () => {
  it("问题池:发改备案表含 800万美元,商务备案表投资规模行含商务侧 820万美元", () => {
    const docs = buildMaterialDocs(seedAssistFieldPool(true), DEMO_CONTRIBUTION_ROWS);
    const filing = docs.find(d => d.material === "备案表")!;
    const commerce = docs.find(d => d.material === "商务备案表")!;
    expect(filing.lines.some(l => l.includes("800万美元"))).toBe(true);
    expect(commerce.lines.some(l => l.includes("820万美元"))).toBe(true); // XB-D008 商务侧证据
    expect(commerce.lines.some(l => l.includes("900万美元"))).toBe(true); // regcap 证据(问题池注册资本)
  });

  it("七类材料齐全;审计报告按取数口径科目命名", () => {
    const docs = buildMaterialDocs(seedAssistFieldPool(false), DEMO_CONTRIBUTION_ROWS);
    expect(docs.map(d => d.material)).toEqual(["备案表", "商务备案表", "营业执照", "审计报告", "承诺书", "请示", "资金证明"]);
    const audit = docs.find(d => d.material === "审计报告")!;
    expect(audit.lines.some(l => l.includes("负债和所有者权益合计"))).toBe(true);
    expect(audit.lines.some(l => l.includes("所有者权益合计"))).toBe(true);
  });

  it("USCC 两侧材料值分别落在各自文档(备案表 A,执照 B)", () => {
    const docs = buildMaterialDocs(seedAssistFieldPool(true), DEMO_CONTRIBUTION_ROWS);
    const filing = docs.find(d => d.material === "备案表")!;
    const license = docs.find(d => d.material === "营业执照")!;
    expect(filing.lines.some(l => l.includes("91310000MA1FL2XX3A"))).toBe(true);
    expect(license.lines.some(l => l.includes("91310000MA1FL2XX3B"))).toBe(true);
  });
});

describe("定位算法", () => {
  it("整串包含命中;纯数字边界匹配(800 不命中 1800)", () => {
    expect(lineHitsValue("投资总额：800万美元", "800万美元")).toBe(true);
    expect(lineHitsValue("年末总资产：1800", "800")).toBe(false);
    expect(lineHitsValue("中方投资额：800", "800")).toBe(true);
    expect(lineHitsValue("", "800")).toBe(false);
  });
  it("locateInDoc 返回全部命中行", () => {
    const doc = { material: "备案表" as const, title: "t", lines: ["a：800", "b：900", "c：800万"] };
    expect(locateInDoc(doc, "800")).toEqual([0, 2]);
    expect(locateInDoc(doc, "999")).toEqual([]);
  });
});

describe("证据引用映射", () => {
  it("关键规则已登记(XB-D008 双材料 / regcap / USCC / 承诺书)", () => {
    expect(RULE_EVIDENCE_REFS["XB-D008"]).toEqual([{ code: "investment_total", materials: ["商务备案表", "备案表"] }]);
    expect(RULE_EVIDENCE_REFS["rule-regcap-vs-total"]?.map(r => r.code)).toEqual(["overseas_registered_capital", "investment_total"]);
    expect(RULE_EVIDENCE_REFS["NDRC-A-006"]?.[0].materials).toEqual(["备案表", "营业执照"]);
    expect(RULE_EVIDENCE_REFS["NDRC-C-009"]?.[0].materials).toEqual(["承诺书"]);
    expect(hasEvidenceRefs("XB-D008")).toBe(true);
    expect(hasEvidenceRefs("req-project_summary")).toBe(false); // 必填缺失无可定位证据
  });
  it("默认材料:商务线口径字段→商务备案表,发改侧→备案表", () => {
    expect(defaultMaterialFor("investment_total")).toBe("商务备案表");
    expect(defaultMaterialFor("overseas_registered_capital")).toBe("商务备案表");
    expect(defaultMaterialFor("project_name")).toBe("备案表");
    expect(defaultMaterialFor("contact_phone")).toBe("备案表");
  });
  it("登记的字段码都存在于字段目录(防拼写漂移)", () => {
    const codes = new Set(allFieldCodes());
    for (const refs of Object.values(RULE_EVIDENCE_REFS)) {
      for (const r of refs) expect(codes.has(r.code)).toBe(true);
    }
  });
});
