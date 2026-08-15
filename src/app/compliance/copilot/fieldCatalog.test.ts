import { describe, it, expect } from "vitest";
import { getFieldsForStep, buildExtractSystemPrompt, parseExtractResponse } from "./fieldCatalog";
import type { WizardApi } from "../components/fields";

function fakeApi(): { api: WizardApi; calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = {};
  const mk = (k: string) => (...args: unknown[]) => { (calls[k] ||= []).push(args); };
  const api = {
    state: { mode: null, answers: { single: {}, multi: {} }, uploads: {}, ctryAck: null, lsNone: false, curStep: 0, maxSeen: 0, generated: false },
    setSingle: mk("setSingle"), toggleMulti: mk("toggleMulti"), setMulti: mk("setMulti"), setMode: mk("setMode"),
    setLsNone: mk("setLsNone"), uploadFile: mk("uploadFile"), toggleMask: mk("toggleMask"), pickCountry: mk("pickCountry"),
  } as unknown as WizardApi;
  return { api, calls };
}

describe("fieldCatalog", () => {
  it("step 1 has objective profile fields", () => {
    expect(getFieldsForStep(1, null).map(f => f.key)).toEqual(expect.arrayContaining(["investMode","country","amount","ownership","industry","path"]));
  });
  it("step 3 returns branch fields by mode + common items", () => {
    expect(getFieldsForStep(3, "ma").map(f => f.key)).toEqual(expect.arrayContaining(["m0a","m0b","m1","g1","g3"]));
    expect(getFieldsForStep(3, "new").map(f => f.key)).toEqual(expect.arrayContaining(["n1","n2","n3","g1"]));
    expect(getFieldsForStep(3, "chg").map(f => f.key)).toEqual(expect.arrayContaining(["c1","c2","g1"]));
    expect(getFieldsForStep(3, "new").some(f => f.key === "m0a")).toBe(false);
  });
  it("every content module 1-6 exposes fields; only intro/unknown return []", () => {
    for (const step of [1,2,3,4,5,6]) {
      expect(getFieldsForStep(step, step === 3 ? "new" : null).length).toBeGreaterThan(0);
    }
    expect(getFieldsForStep(0, null)).toEqual([]);
    expect(getFieldsForStep(99, null)).toEqual([]);
  });
  it("buildExtractSystemPrompt includes allowed codes + definitions", () => {
    const s = buildExtractSystemPrompt(1, null);
    expect(s).toContain("investMode"); expect(s).toContain("new"); expect(s).toContain("绿地投资");
  });
  it("writeBack calls the right setter", () => {
    const { api, calls } = fakeApi();
    const f = getFieldsForStep(1, null).find(x => x.key === "investMode")!;
    f.write(api, "new");
    expect(calls["setMode"]?.[0]?.[0]).toBe("new");
  });
  it("parseExtractResponse parses + flags low confidence + drops invalid", () => {
    const fields = getFieldsForStep(1, null);
    const raw = JSON.stringify({
      investMode: { value: "new", confidence: 0.9, evidence: "设个生产基地" },
      country: { value: "越南", confidence: 0.6, evidence: "在越南" },
      notAField: { value: "x", confidence: 1, evidence: "" },
    });
    const out = parseExtractResponse(raw, fields);
    expect(out.map(o => o.field.key).sort()).toEqual(["country","investMode"]);
    expect(out.find(o => o.field.key === "investMode")!.lowConf).toBe(false);
    expect(out.find(o => o.field.key === "country")!.lowConf).toBe(true);
  });
  it("parseExtractResponse returns [] on bad JSON", () => {
    expect(parseExtractResponse("not json", getFieldsForStep(1, null))).toEqual([]);
  });
});
