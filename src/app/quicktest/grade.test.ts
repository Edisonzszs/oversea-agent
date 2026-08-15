import { describe, it, expect } from "vitest";
import { worst, gradeAll } from "./grade";
import type { Answers } from "./questions";

describe("worst 就低原则", () => {
  it("取最差档,I 不参与", () => {
    expect(worst(["A", "B", "I"])).toBe("B");
    expect(worst(["A", "C", "D", "I"])).toBe("D");
    expect(worst(["I", "I"])).toBe("A");
    expect(worst([])).toBe("A");
  });
});

describe("gradeAll", () => {
  // 全 A 的新设类基线(覆盖所有必答判档题)
  const base: Answers = {
    mode: "new", p_ctry: "新加坡",
    z1: "a", z2: "a", z3: "a", z4: "a", z5: "a", z6: "a",
    n1: "a", n2: "a", n3: "a", g2: "a", g3: "qz",
    lsNone: "1",
    s1a: "n", s2a: "0", s2c: "a", s3: "0",
    q52: "one", q53: "a",
  };

  it("全 A 回答 → 总档 A,路径走备案", () => {
    const r = gradeAll(base);
    expect(r.total).toBe("A");
    expect(r.routeLine).toContain("备案");
    expect(r.pathLine).toContain("新设类");
  });

  it("触及禁止类(lsC)→ 总档 D,不予批准", () => {
    const r = gradeAll({ ...base, lsC: "1" });
    expect(r.total).toBe("D");
    expect(r.routeLine).toContain("不予批准");
  });

  it("涉敏感行业(lsA)→ 总档 C,走核准", () => {
    const r = gradeAll({ ...base, lsA: "1" });
    expect(r.total).toBe("C");
    expect(r.routeLine).toContain("核准");
  });

  it("z3=d 前置门槛 → 总档 D", () => {
    const r = gradeAll({ ...base, z3: "d" });
    expect(r.total).toBe("D");
  });

  it("出口管制涉禁止出口(s1c=ban)→ 总档 D", () => {
    const r = gradeAll({ ...base, s1a: "y", s1c: "ban" });
    expect(r.total).toBe("D");
  });

  it("并购 m1=c 缺报告 → C", () => {
    const r = gradeAll({ ...base, mode: "ma", m0a: "bg", m0b: "zr", m1: "c" });
    const m1 = r.items.find(i => i.key === "m1");
    expect(m1?.grade).toBe("C");
  });

  it("变更分支无变化 → A 且不适用", () => {
    const r = gradeAll({ ...base, mode: "chg", c1: "0" });
    const chg = r.items.find(i => i.key === "chg");
    expect(chg?.grade).toBe("A");
    expect(chg?.desc).toContain("不适用");
  });
});
