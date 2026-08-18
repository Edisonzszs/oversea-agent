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

  it("模板版式:发改备案表按十九大项格式文本(一、项目名称 → 十九、附件清单)", () => {
    const docs = buildMaterialDocs(seedAssistFieldPool(false), DEMO_CONTRIBUTION_ROWS);
    const filing = docs.find(d => d.material === "备案表")!;
    const text = filing.lines.join("\n");
    for (const sec of ["一、项目名称", "二、投资主体情况", "四、投资地点", "八、项目主要内容和规模",
      "九、项目总投资额", "十、中方投资额", "十一、中方投资额构成", "十九、附件清单", "项目代码：（网络系统自动赋码）"]) {
      expect(text.includes(sec)).toBe(true);
    }
    expect(text.includes("（七）境外投资真实性承诺书")).toBe(true); // 附件清单七项
    expect(filing.lines.some(l => l.includes("手机：13800138000"))).toBe(true); // 申报联系人
  });

  it("模板版式:商务备案表按商务部门栏目(基本事由→设立方式→投资规模→承诺段→审批栏)", () => {
    const docs = buildMaterialDocs(seedAssistFieldPool(false), DEMO_CONTRIBUTION_ROWS);
    const commerce = docs.find(d => d.material === "商务备案表")!;
    const text = commerce.lines.join("\n");
    for (const sec of ["基本事由", "境内投资主体", "投资路径（仅限第一层级境外企业）", "境外企业名称（最终目的地）",
      "股权结构", "设立方式", "注册资本", "投资规模", "中方出资币种和金额", "中方投资的构成", "投资具体情况",
      "本单位承诺本表中涉及的投资无以下情形", "以下由商务部或省级商务主管机关填写"]) {
      expect(text.includes(sec)).toBe(true);
    }
    expect(commerce.lines.some(l => l.includes("●新设"))).toBe(true); // 设立方式选中态
  });

  it("模板版式:承诺书按 4-1 商务模板(致委→引言→正文→落款→附签字单);请示按公文版式(标题→文号→落款)", () => {
    const docs = buildMaterialDocs(seedAssistFieldPool(false), DEMO_CONTRIBUTION_ROWS);
    const commit = docs.find(d => d.material === "承诺书")!;
    const petition = docs.find(d => d.material === "请示")!;
    expect(commit.lines.some(l => l.includes("上海市商务委员会："))).toBe(true);
    expect(commit.lines.some(l => l.includes("此致。"))).toBe(true);
    expect(commit.lines.some(l => l.includes("附：本项投资决策人员签字单"))).toBe(true);
    expect(petition.lines.some(l => l.includes("〔2026〕X号"))).toBe(true); // 文号行
    expect(petition.lines.some(l => l.includes("（加盖单位公章或本人签名）"))).toBe(true);
  });

  it("目的地组合值分栏:备案表/商务备案表按 国+省(州、市) 拆开渲染(整串不落文档,定位按段)", () => {
    const docs = buildMaterialDocs(seedAssistFieldPool(false), DEMO_CONTRIBUTION_ROWS);
    const filing = docs.find(d => d.material === "备案表")!;
    const commerce = docs.find(d => d.material === "商务备案表")!;
    const fdLine = filing.lines.find(l => l.includes("最终目的地"))!;
    expect(fdLine.includes("越南")).toBe(true);
    expect(fdLine.includes("胡志明市")).toBe(true);
    expect(fdLine.includes("越南·胡志明市")).toBe(false); // 分栏后不再连续
    expect(commerce.lines.some(l => l.includes("国家（地区）：越南"))).toBe(true);
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
