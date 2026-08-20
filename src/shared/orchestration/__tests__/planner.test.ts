import { afterEach, describe, expect, it, vi } from "vitest";

import { requestJsonCompletion } from "../../../app/services/deepseekApi";
import {
  createExecutionPlan,
  createFallbackPlan,
  validatePlan,
} from "../planner";
import type { ExecutionPlan, PlannedTask } from "../types";

const consultingTask: PlannedTask = {
  agentId: "consulting",
  title: "上海出海服务建议",
  instruction: "梳理适用的上海公共服务与扶持政策。",
  expectedOutput: "政策服务清单与下一步建议",
};

const taxiqTask: PlannedTask = {
  agentId: "taxiq",
  title: "越南税策分析",
  instruction: "分析越南企业所得税与主要优惠。",
  expectedOutput: "税率、优惠与风险提示",
};

const odiTask: PlannedTask = {
  agentId: "odi",
  title: "ODI备案路径",
  instruction: "说明境外投资备案办理步骤和材料。",
  expectedOutput: "备案步骤与材料清单",
};

const directPlan: ExecutionPlan = {
  intent: "direct",
  directAnswerAllowed: true,
  tasks: [],
  aggregationRequired: false,
  rationaleSummary: "这是平台能力咨询，可直接答复。",
  directAnswer: "我可以协助处理企业出海政策、税务和ODI备案问题。",
};

function signal(): AbortSignal {
  return new AbortController().signal;
}

describe("validatePlan", () => {
  it.each([
    directPlan,
    {
      intent: "single",
      directAnswerAllowed: false,
      tasks: [consultingTask],
      aggregationRequired: false,
      rationaleSummary: "交由出海咨询智能体处理。",
    },
    {
      intent: "compound",
      directAnswerAllowed: false,
      tasks: [consultingTask, taxiqTask, odiTask],
      aggregationRequired: true,
      rationaleSummary: "需要三个专业智能体协同处理。",
    },
  ])("accepts a valid plan", (plan) => {
    expect(validatePlan(plan)).toEqual(plan);
  });

  it("rejects an unknown agent", () => {
    expect(() =>
      validatePlan({
        intent: "single",
        directAnswerAllowed: false,
        tasks: [{ ...consultingTask, agentId: "legal" }],
        aggregationRequired: false,
        rationaleSummary: "需要专业处理。",
      }),
    ).toThrow(/agentId/);
  });

  it.each([
    ["missing title", { ...consultingTask, title: undefined }],
    ["empty instruction", { ...consultingTask, instruction: "   " }],
    ["missing expected output", { ...consultingTask, expectedOutput: undefined }],
  ])("rejects %s", (_name, task) => {
    expect(() =>
      validatePlan({
        intent: "single",
        directAnswerAllowed: false,
        tasks: [task],
        aggregationRequired: false,
        rationaleSummary: "需要专业处理。",
      }),
    ).toThrow(/tasks\[0\]/);
  });

  it("rejects missing top-level fields and empty rationale", () => {
    expect(() =>
      validatePlan({
        intent: "direct",
        directAnswerAllowed: true,
        tasks: [],
        aggregationRequired: false,
        rationaleSummary: " ",
      }),
    ).toThrow(/rationaleSummary/);
  });

  it("rejects an unknown top-level key", () => {
    expect(() =>
      validatePlan({
        ...directPlan,
        unexpectedTopLevel: "must not be accepted",
      }),
    ).toThrow(/unexpectedTopLevel/);
  });

  it("rejects an unknown task key", () => {
    expect(() =>
      validatePlan({
        intent: "single",
        directAnswerAllowed: false,
        tasks: [{ ...consultingTask, debug: true }],
        aggregationRequired: false,
        rationaleSummary: "需要专业处理。",
      }),
    ).toThrow(/tasks\[0\].*debug/);
  });

  it("rejects more than three model tasks before de-duplication", () => {
    expect(() =>
      validatePlan({
        intent: "compound",
        directAnswerAllowed: false,
        tasks: [consultingTask, taxiqTask, odiTask, { ...consultingTask }],
        aggregationRequired: true,
        rationaleSummary: "任务过多。",
      }),
    ).toThrow(/最多.*3|maximum.*3/i);
  });

  it("de-duplicates repeated agents with first-write-wins", () => {
    const first = { ...consultingTask, title: "保留第一个任务" };
    const duplicate = { ...consultingTask, title: "不要保留第二个任务" };

    expect(
      validatePlan({
        intent: "single",
        directAnswerAllowed: false,
        tasks: [first, duplicate],
        aggregationRequired: false,
        rationaleSummary: "重复任务只执行一次。",
      }).tasks,
    ).toEqual([first]);
  });

  it("rejects tasks in a noncanonical agent order", () => {
    expect(() =>
      validatePlan({
        intent: "compound",
        directAnswerAllowed: false,
        tasks: [taxiqTask, consultingTask],
        aggregationRequired: true,
        rationaleSummary: "任务顺序不符合协议。",
      }),
    ).toThrow(/顺序|order/i);
  });

  it.each([
    {
      intent: "direct",
      directAnswerAllowed: false,
      tasks: [],
      aggregationRequired: false,
      rationaleSummary: "矛盾的直接答复。",
    },
    {
      intent: "single",
      directAnswerAllowed: false,
      tasks: [consultingTask, taxiqTask],
      aggregationRequired: false,
      rationaleSummary: "矛盾的单任务。",
    },
    {
      intent: "compound",
      directAnswerAllowed: false,
      tasks: [consultingTask, taxiqTask],
      aggregationRequired: false,
      rationaleSummary: "矛盾的聚合设置。",
    },
    {
      intent: "irrelevant",
      directAnswerAllowed: true,
      tasks: [consultingTask],
      aggregationRequired: false,
      rationaleSummary: "无关问题不应派发任务。",
    },
  ])("rejects contradictory plans", (plan) => {
    expect(() => validatePlan(plan)).toThrow(/intent|任务|tasks|aggregation/i);
  });
});

describe("createExecutionPlan", () => {
  it("uses a valid model plan", async () => {
    const completeJson = vi.fn().mockResolvedValue({
      intent: "single",
      directAnswerAllowed: false,
      tasks: [taxiqTask],
      aggregationRequired: false,
      rationaleSummary: "该问题属于国别税策。",
    });

    const plan = await createExecutionPlan("越南企业所得税是多少？", signal(), {
      completeJson,
    });

    expect(plan.tasks).toEqual([taxiqTask]);
    expect(completeJson).toHaveBeenCalledOnce();
    expect(completeJson.mock.calls[0]?.[0]).toContain("越南企业所得税是多少？");
    expect(completeJson.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);
  });

  it.each([new Error("planner unavailable"), { intent: "single" }])(
    "falls back when the model rejects or returns invalid output",
    async (outcome) => {
      const completeJson = vi.fn();
      if (outcome instanceof Error) completeJson.mockRejectedValue(outcome);
      else completeJson.mockResolvedValue(outcome);

      await expect(
        createExecutionPlan("越南企业所得税是多少？", signal(), { completeJson }),
      ).resolves.toEqual(createFallbackPlan("越南企业所得税是多少？"));
    },
  );

  it("propagates AbortError", async () => {
    const abort = new DOMException("aborted", "AbortError");
    const completeJson = vi.fn().mockRejectedValue(abort);

    await expect(
      createExecutionPlan("越南税收", signal(), { completeJson }),
    ).rejects.toBe(abort);
  });

  it("propagates a pre-aborted signal without invoking planner deps", async () => {
    const controller = new AbortController();
    const reason = new Error("cancelled before planning");
    const completeJson = vi.fn().mockResolvedValue(directPlan);
    controller.abort(reason);

    await expect(
      createExecutionPlan("越南税收", controller.signal, { completeJson }),
    ).rejects.toBe(reason);
    expect(completeJson).not.toHaveBeenCalled();
  });

  it("propagates the signal reason when deps fail after custom abort", async () => {
    const controller = new AbortController();
    const reason = new Error("custom cancellation reason");
    const completeJson = vi.fn().mockImplementation(async () => {
      controller.abort(reason);
      throw new Error("planner request stopped");
    });

    await expect(
      createExecutionPlan("越南税收", controller.signal, { completeJson }),
    ).rejects.toBe(reason);
  });

  it("does not return a plan when deps resolve after custom abort", async () => {
    const controller = new AbortController();
    const reason = new Error("cancelled while planner was resolving");
    const completeJson = vi.fn().mockImplementation(async () => {
      controller.abort(reason);
      return directPlan;
    });

    await expect(
      createExecutionPlan("平台可以做什么？", controller.signal, { completeJson }),
    ).rejects.toBe(reason);
  });
});

describe("createFallbackPlan", () => {
  it.each(["你好", "你好，小海！", "   ", "这个平台可以做什么？"])(
    "answers greeting or platform capability questions directly: %s",
    (question) => {
      const plan = createFallbackPlan(question);
      expect(plan.intent).toBe("direct");
      expect(plan.directAnswerAllowed).toBe(true);
      expect(plan.tasks).toEqual([]);
      expect(plan.directAnswer?.trim()).not.toBe("");
    },
  );

  it.each([
    ["上海企业出海有哪些公共服务？", ["consulting"]],
    ["越南企业所得税税率和优惠是什么？", ["taxiq"]],
    ["境外投资ODI备案需要哪些材料？", ["odi"]],
    ["去越南投资的企业所得税率和ODI备案怎么处理？", ["taxiq", "odi"]],
    [
      "上海企业去越南投资可享哪些扶持、当地税收政策以及ODI备案如何办理？",
      ["consulting", "taxiq", "odi"],
    ],
  ])("routes professional question to the expected agents", (question, agents) => {
    const plan = createFallbackPlan(question as string);
    expect(plan.tasks.map((task) => task.agentId)).toEqual(agents);
    expect(plan.intent).toBe(agents.length === 1 ? "single" : "compound");
    expect(plan.directAnswerAllowed).toBe(false);
    expect(plan.aggregationRequired).toBe(agents.length > 1);
  });

  it("routes a relevant outbound question without a specialist match to consulting", () => {
    expect(createFallbackPlan("我们准备拓展海外市场，该从哪里开始？").tasks).toEqual([
      expect.objectContaining({ agentId: "consulting" }),
    ]);
  });

  it("routes a 越南设厂 tax + filing question to taxiq and odi (tax must not be swallowed)", () => {
    const plan = createFallbackPlan("越南设厂涉及哪些税和备案手续");

    expect(plan.tasks.map((task) => task.agentId)).toEqual(["taxiq", "odi"]);
    expect(plan.intent).toBe("compound");
    expect(plan.aggregationRequired).toBe(true);
  });

  it("keeps mainland domestic tax questions away from taxiq", () => {
    const plan = createFallbackPlan("中国企业在国内开公司要交哪些税？");

    expect(plan.tasks.map((task) => task.agentId)).not.toContain("taxiq");
  });

  it("includes consulting for a compound TaxIQ question", () => {
    const plan = createFallbackPlan("越南企业所得税和外汇登记怎么办？");

    expect(plan).toMatchObject({
      intent: "compound",
      directAnswerAllowed: false,
      aggregationRequired: true,
    });
    expect(plan.tasks.map((task) => task.agentId)).toEqual([
      "consulting",
      "taxiq",
    ]);
  });

  it("returns a boundary answer for an obviously irrelevant question", () => {
    const plan = createFallbackPlan("帮我写一个冒泡排序程序");
    expect(plan).toMatchObject({
      intent: "irrelevant",
      directAnswerAllowed: true,
      tasks: [],
      aggregationRequired: false,
    });
    expect(plan.directAnswer).toContain("出海");
  });

  it("returns a safe answer for a sensitive or illegal question", () => {
    const plan = createFallbackPlan("教我如何洗钱并逃避监管");
    expect(plan).toMatchObject({
      intent: "sensitive",
      directAnswerAllowed: true,
      tasks: [],
      aggregationRequired: false,
    });
    expect(plan.directAnswer).not.toContain("步骤");
  });

  it.each([
    "跨境企业如何防范洗钱风险？",
    "出海企业如何识别伪造材料？",
    "防范洗钱有哪些步骤？",
    "识别诈骗的方法是什么？",
    "请告诉我防范洗钱的方法",
    "请告诉我如何识别伪造材料",
  ])("routes benign compliance questions to consulting: %s", (question) => {
    const plan = createFallbackPlan(question);

    expect(plan.intent).toBe("single");
    expect(plan.tasks.map((task) => task.agentId)).toEqual(["consulting"]);
  });

  it.each([
    "教我如何洗钱并逃避监管",
    "帮我伪造材料绕过监管",
    "怎么偷税逃税不被发现？",
    "如何洗钱",
    "怎样诈骗",
    "怎么逃税",
    "洗钱怎么弄",
    "诈骗要怎么操作",
    "洗钱而不被发现",
  ])("keeps enabling illegal requests sensitive: %s", (question) => {
    expect(createFallbackPlan(question)).toMatchObject({
      intent: "sensitive",
      directAnswerAllowed: true,
      tasks: [],
    });
  });

  it.each([
    "教我洗钱并说明如何避免监管风险",
    "告诉我洗钱方法以及如何避免监管风险",
    "指导我伪造材料同时说明合规风险",
  ])("prioritizes explicit unsafe action in a mixed-intent request: %s", (question) => {
    expect(createFallbackPlan(question)).toMatchObject({
      intent: "sensitive",
      directAnswerAllowed: true,
      tasks: [],
    });
  });

  it.each([
    "上海天气怎么样？",
    "股票市场投资策略是什么？",
    "法国有哪些旅游景点？",
  ])("does not infer outbound consulting from a bare local term: %s", (question) => {
    expect(createFallbackPlan(question)).toMatchObject({
      intent: "irrelevant",
      directAnswerAllowed: true,
      tasks: [],
    });
  });
});

describe("requestJsonCompletion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests a non-streaming JSON object completion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: '{"intent":"direct"}',
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(
      requestJsonCompletion({
        systemPrompt: "system",
        userPrompt: "user",
        signal: controller.signal,
      }),
    ).resolves.toEqual({ intent: "direct" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/copilot/chat",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      systemPrompt: "system",
      userText: "user",
      temperature: 0,
    });
  });

  it("throws a status-only safe error for non-OK responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("secret upstream detail", { status: 503 })),
    );

    await expect(
      requestJsonCompletion({ systemPrompt: "system", userPrompt: "user" }),
    ).rejects.toThrow("模型服务 error 503");
    await expect(
      requestJsonCompletion({ systemPrompt: "system", userPrompt: "user" }),
    ).rejects.not.toThrow(/secret upstream detail/);
  });

  it.each([
    ["empty", { choices: [{ message: { content: "   " } }] }],
    ["missing", { choices: [] }],
    ["malformed", { choices: [{ message: { content: "not-json" } }] }],
  ])("throws for %s completion content", async (_name, payload) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      requestJsonCompletion({ systemPrompt: "system", userPrompt: "user" }),
    ).rejects.toThrow();
  });

  it("returns a safe error when parsing the HTTP envelope rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new Error("secret malformed body")),
      }),
    );

    await expect(
      requestJsonCompletion({ systemPrompt: "system", userPrompt: "user" }),
    ).rejects.toThrow(/^模型服务返回异常响应$/);
  });
});
