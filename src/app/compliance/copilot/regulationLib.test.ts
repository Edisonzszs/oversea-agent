import { describe, it, expect } from "vitest";
import { regulationLib, QUESTION_LIST, buildRegulationContext } from "./regulationLib";
import { copilotApi } from "./api";

describe("regulationLib", () => {
  it("QUESTION_LIST non-empty with expected ids", () => {
    expect(QUESTION_LIST.length).toBeGreaterThan(0);
    expect(QUESTION_LIST.map(q => q.questionId)).toEqual(expect.arrayContaining(["z1", "z3", "ls", "s1a"]));
  });
  it("buildRegulationContext returns prompt for known id", () => {
    const ctx = buildRegulationContext("z1");
    expect(ctx).toContain("股权架构");
    expect(ctx).toContain("可参考的法规依据");
  });
  it("buildRegulationContext returns empty for unknown id", () => {
    expect(buildRegulationContext("nope")).toBe("");
  });
  it("regulationLib has entries for all QUESTION_LIST ids", () => {
    for (const q of QUESTION_LIST) expect(regulationLib[q.questionId]).toBeDefined();
  });
});

describe("copilotApi", () => {
  it("exposes extract + regulation functions", () => {
    expect(typeof copilotApi.extract).toBe("function");
    expect(typeof copilotApi.regulation).toBe("function");
  });
});
