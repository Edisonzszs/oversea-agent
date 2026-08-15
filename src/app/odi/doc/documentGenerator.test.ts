import { describe, it, expect } from "vitest";
import {
  genOdiFormBlob,
  genCommitmentLetterBlob,
  genFeasibilityReportBlob,
  buildCommitmentLetterDocument,
} from "./documentGenerator";
import { Packer } from "docx";
import { allFieldDefs } from "../field/odiFieldCatalog";
import { emptyField } from "../data/types";
import { commitField } from "../field/odiGuideLogic";

// vitest 默认 node 环境;Node 18+ 提供全局 Blob,docx 的 Packer.toBlob 可直接产出非空 Blob,
// 因此无需 jsdom 即可断言 Blob.size > 0。

const buildPool = () => {
  let p = allFieldDefs().map((d) => emptyField(d.code, d.name, d.round, d.dept));
  p = commitField(p, "domestic_company_name", "上海XX公司", "guide");
  p = commitField(p, "investment_country", "越南", "guide");
  p = commitField(p, "investment_total", "800万美元", "guide");
  p = commitField(p, "establishment_method", "新设独资", "guide");
  return p;
};

describe("ODI documentGenerator", () => {
  it("genOdiFormBlob 产出非空 docx Blob", async () => {
    const blob = await genOdiFormBlob(buildPool());
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("genCommitmentLetterBlob 产出非空 Blob", async () => {
    const blob = await genCommitmentLetterBlob(buildPool());
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("genFeasibilityReportBlob 产出非空 Blob", async () => {
    const blob = await genFeasibilityReportBlob(buildPool());
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("承诺书按 establishment_method 分版本:新设独资 vs 并购产出不同的承诺书", async () => {
    // 新设独资版(docx 为 zip 压缩格式,无法直接 grep 文本,故通过解压后的 document.xml 比较文案)
    const JSZip = (await import("jszip")).default;
    const wofePool = buildPool();
    const wofeBuf = await Packer.toBuffer(buildCommitmentLetterDocument(wofePool));
    // 并购 → 通用版
    let otherPool = allFieldDefs().map((d) => emptyField(d.code, d.name, d.round, d.dept));
    otherPool = commitField(otherPool, "domestic_company_name", "上海XX公司", "guide");
    otherPool = commitField(otherPool, "investment_country", "德国", "guide");
    otherPool = commitField(otherPool, "establishment_method", "并购", "guide");
    const otherBuf = await Packer.toBuffer(buildCommitmentLetterDocument(otherPool));

    // 两版本均为非空 docx
    expect(wofeBuf.byteLength).toBeGreaterThan(0);
    expect(otherBuf.byteLength).toBeGreaterThan(0);

    // 解压 docx 取 word/document.xml 比较文案
    const wofeXml = await (await JSZip.loadAsync(wofeBuf)).file("word/document.xml")!.async("string");
    const otherXml = await (await JSZip.loadAsync(otherBuf)).file("word/document.xml")!.async("string");
    // 新设独资版含标志性措辞;通用版(并购)不含
    expect(wofeXml).toContain("持股比例 100%");
    expect(otherXml).not.toContain("持股比例 100%");
    // 通用版含"并购"设立方式
    expect(otherXml).toContain("并购");
  });
});
