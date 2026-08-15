// 速测 → 完整版 作答灌入(prefillFromQuickAnswers)单测。
// 速测 Answers:扁平 Record<string,string>,multi 逗号拼接;完整版 {single,multi} 分仓 + 顶层 mode/lsNone。
import { describe, it, expect, beforeAll } from "vitest";
import { createInitialState, prefillFromQuickAnswers, takeQuickAnswersFromSession } from "./wizardModel";

// node 环境无 sessionStorage,用最小 mock(jsdom 未配)
beforeAll(() => {
  if (typeof sessionStorage === "undefined") {
    const store = new Map<string, string>();
    (globalThis as any).sessionStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => void store.clear(),
    };
  }
});

describe("prefillFromQuickAnswers", () => {
  it("mode 映射到顶层 state.mode", () => {
    const r = prefillFromQuickAnswers(createInitialState(), { mode: "new" });
    expect(r.state.mode).toBe("new");
    expect(r.filled).toBe(0); // mode 不计入题数
  });

  it("single/text/select 按题号进 single 分仓", () => {
    const r = prefillFromQuickAnswers(createInitialState(), {
      p_name: "上海三一集团",
      p_own: "民营",
      z1: "a",
      m1na_reason: "理由说明",
    });
    expect(r.state.answers.single.p_name).toBe("上海三一集团");
    expect(r.state.answers.single.p_own).toBe("民营");
    expect(r.state.answers.single.z1).toBe("a");
    expect(r.state.answers.single.m1na_reason).toBe("理由说明");
    expect(r.filled).toBe(4);
  });

  it("multi 键(逗号拼接)拆回数组进 multi 分仓", () => {
    const r = prefillFromQuickAnswers(createInitialState(), {
      p_arch: "vie,hk",
      lsC: "lsC1，lsC2", // 中文逗号也兼容
    });
    expect(r.state.answers.multi.p_arch).toEqual(["vie", "hk"]);
    expect(r.state.answers.multi.lsC).toEqual(["lsC1", "lsC2"]);
  });

  it("lsNone 兼容多形态('1'/'true'/'是')进顶层", () => {
    expect(prefillFromQuickAnswers(createInitialState(), { lsNone: "1" }).state.lsNone).toBe(true);
    expect(prefillFromQuickAnswers(createInitialState(), { lsNone: "true" }).state.lsNone).toBe(true);
    expect(prefillFromQuickAnswers(createInitialState(), { lsNone: "是" }).state.lsNone).toBe(true);
    expect(prefillFromQuickAnswers(createInitialState(), { lsNone: "" }).state.lsNone).toBe(false);
  });

  it("完整版没有的速测字段(p_org)自动跳过不报错", () => {
    const r = prefillFromQuickAnswers(createInitialState(), { p_org: "shanghai" });
    expect(r.state.answers.single.p_org).toBeUndefined();
    expect(r.filled).toBe(0);
  });

  it("空值/空白串不写入", () => {
    const r = prefillFromQuickAnswers(createInitialState(), { z1: "", z2: "  ", z3: "a" });
    expect(r.state.answers.single.z1).toBeUndefined();
    expect(r.state.answers.single.z2).toBeUndefined();
    expect(r.state.answers.single.z3).toBe("a");
    expect(r.filled).toBe(1);
  });

  it("不覆盖已有快照作答(预填叠加在 base 之上)", () => {
    const base = createInitialState();
    base.answers.single.z1 = "b"; // 快照已有
    const r = prefillFromQuickAnswers(base, { z1: "a", z2: "a" });
    expect(r.state.answers.single.z1).toBe("a"); // 速测值覆盖(用户刚答的更新)
    expect(r.state.answers.single.z2).toBe("a");
  });
});

describe("takeQuickAnswersFromSession", () => {
  it("无存储返回 null;有则解析并在第二次取时为 null(一次性消费)", () => {
    sessionStorage.clear();
    expect(takeQuickAnswersFromSession()).toBeNull();
    sessionStorage.setItem("chuhai_quick_answers", JSON.stringify({ z1: "a", mode: "new" }));
    const first = takeQuickAnswersFromSession();
    expect(first).toEqual({ z1: "a", mode: "new" });
    expect(takeQuickAnswersFromSession()).toBeNull(); // 已消费
  });

  it("坏 JSON 返回 null 不抛异常", () => {
    sessionStorage.clear();
    sessionStorage.setItem("chuhai_quick_answers", "{broken");
    expect(takeQuickAnswersFromSession()).toBeNull();
  });
});
