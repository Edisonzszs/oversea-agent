import { describe, it, expect } from "vitest";
import { parseChatResponse } from "./chatPrompt";
import { getFieldsForStep } from "./fieldCatalog";

describe("chatPrompt.parseChatResponse", () => {
  it("splits + validates multi-select codes, drops unknown codes", () => {
    const fields = getFieldsForStep(5, null); // 模块四 含 multi：s1b / s2a / s3
    const raw = JSON.stringify({
      answer: null,
      candidates: [{ key: "s1b", value: "sc, ai , BOGUS，re", confidence: 0.9, evidence: "半导体、稀土" }],
      clauses: [],
    });
    const { candidates } = parseChatResponse(raw, fields);
    expect(candidates.length).toBe(1);
    expect(candidates[0].field.key).toBe("s1b");
    expect(candidates[0].value).toBe("sc,ai,re"); // BOGUS 被丢弃；中英文逗号/空格均能拆分
  });

  it("drops a multi candidate when all codes are invalid", () => {
    const fields = getFieldsForStep(5, null);
    const raw = JSON.stringify({ answer: null, candidates: [{ key: "s1b", value: "乱填,也不是", confidence: 0.9, evidence: "" }], clauses: [] });
    expect(parseChatResponse(raw, fields).candidates).toEqual([]);
  });

  it("returns answer text and keeps valid single-select candidates", () => {
    const fields = getFieldsForStep(2, null);
    const raw = JSON.stringify({
      answer: "股权架构指上穿至最终实际控制人的持股链路。",
      candidates: [{ key: "z1", value: "a", confidence: 0.95, evidence: "架构清晰" }],
      clauses: [],
    });
    const { answer, candidates } = parseChatResponse(raw, fields);
    expect(answer).toBe("股权架构指上穿至最终实际控制人的持股链路。");
    expect(candidates[0].field.key).toBe("z1");
    expect(candidates[0].value).toBe("a");
    expect(candidates[0].lowConf).toBe(false);
  });

  it("maps cited clause ids to registry quotes and ignores unknown ids", () => {
    const fields = getFieldsForStep(2, null);
    const raw = JSON.stringify({
      answer: "依商务部令。",
      candidates: [],
      clauses: [{ id: "商务部令2014年第3号 第九条、第十条" }, { id: "不存在的文号" }],
    });
    const { clauses } = parseChatResponse(raw, fields);
    expect(clauses.length).toBe(1);
    expect(clauses[0].id).toBe("商务部令2014年第3号 第九条、第十条");
    expect(typeof clauses[0].point).toBe("string");
  });

  // 识别准度:模型回 label/主干也能映射到 code(去写死 value=code 的单一假设)
  it("maps label-valued select candidates to codes", () => {
    const fields = getFieldsForStep(1, null);
    const raw = JSON.stringify({
      answer: null,
      candidates: [
        { key: "investMode", value: "新设类", confidence: 0.92, evidence: "我们准备新设" },
        { key: "ownership", value: "民营", confidence: 0.9, evidence: "民营企业" },
      ],
      clauses: [],
    });
    const { candidates } = parseChatResponse(raw, fields);
    expect(candidates.map(c => c.field.key).sort()).toEqual(["investMode", "ownership"]);
    expect(candidates.find(c => c.field.key === "investMode")!.value).toBe("new");
  });

  it("multi accepts label tokens mixed with codes and dedupes", () => {
    const fields = getFieldsForStep(5, null);
    const raw = JSON.stringify({
      answer: null,
      candidates: [{ key: "s1b", value: "半导体/集成电路制造,稀土提炼/永磁体,sc", confidence: 0.9, evidence: "半导体和稀土" }],
      clauses: [],
    });
    const { candidates } = parseChatResponse(raw, fields);
    expect(candidates.length).toBe(1);
    expect(candidates[0].value).toBe("sc,re"); // label 映射 + 与 code 去重
  });

  it("drops select candidates with ambiguous label (matches two options)", () => {
    const fields = getFieldsForStep(3, "new");
    const raw = JSON.stringify({
      answer: null,
      candidates: [{ key: "g2", value: "涉及关联方", confidence: 0.9, evidence: "有关联交易" }],
      clauses: [],
    });
    expect(parseChatResponse(raw, fields).candidates).toEqual([]);
  });
});
