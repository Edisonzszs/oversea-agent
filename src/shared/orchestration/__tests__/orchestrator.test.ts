import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentAdapter } from "../../../app/agents/types";
import type { AggregateResultsOptions } from "../aggregator";
import { retryOrchestrationTask, runOrchestration } from "../orchestrator";
import type { AgentId, ExecutionPlan, OrchestrationEvent } from "../types";

const directPlan = (intent: "direct" | "irrelevant" | "sensitive" = "direct"): ExecutionPlan => ({
  intent,
  directAnswerAllowed: true,
  tasks: [],
  aggregationRequired: false,
  rationaleSummary: "可直接回答",
  directAnswer: intent === "direct" ? "您好，请告诉我您的出海需求。" : "当前问题不在服务范围。",
});

const compoundPlan: ExecutionPlan = {
  intent: "compound",
  directAnswerAllowed: false,
  aggregationRequired: true,
  rationaleSummary: "并行调用税务与 ODI 智能体",
  tasks: [
    { agentId: "taxiq", title: "国别税务", instruction: "分析税务", expectedOutput: "税务结论" },
    { agentId: "odi", title: "ODI 办理", instruction: "分析备案", expectedOutput: "办理结论" },
  ],
};

function successfulAdapter(id: AgentId, output = `${id} result`): AgentAdapter {
  return {
    id,
    name: id === "taxiq" ? "TaxIQ" : "ODI 智能体",
    capabilities: [],
    async *run() {
      yield { type: "progress", text: `${id} running` };
      yield { type: "output.delta", delta: `${id} delta` };
      yield { type: "completed", result: { output, summary: `${id} summary`, sources: [] } };
    },
  };
}

function eventTypes(events: OrchestrationEvent[]): string[] {
  return events.map((event) => event.type);
}

describe("runOrchestration", () => {
  afterEach(() => vi.useRealTimers());

  it.each(["direct", "irrelevant", "sensitive"] as const)(
    "completes the %s path without task or aggregation events",
    async (intent) => {
      const events: OrchestrationEvent[] = [];
      const aggregate = vi.fn();
      const result = await runOrchestration({
        question: "hello",
        messageId: "message-1",
        conversation: [],
        signal: new AbortController().signal,
        onEvent: (event) => events.push(event),
        deps: {
          planner: vi.fn().mockResolvedValue(directPlan(intent)),
          registry: new Map(),
          aggregate,
          runId: () => "run-direct",
          now: () => 10,
        },
      });

      expect(result).toEqual({ runId: "run-direct", output: directPlan(intent).directAnswer });
      expect(eventTypes(events)).toEqual([
        "run.started",
        "plan.started",
        "plan.completed",
        "run.completed",
      ]);
      expect(aggregate).not.toHaveBeenCalled();
    },
  );

  it("isolates a run event observer error from a direct run", async () => {
    const observed: string[] = [];
    let threwOnce = false;
    const result = await runOrchestration({
      question: "hello",
      messageId: "message-observer-error",
      conversation: [],
      signal: new AbortController().signal,
      onEvent: (event) => {
        observed.push(event.type);
        if (event.type === "run.started" && !threwOnce) {
          threwOnce = true;
          throw new Error("observer render failed");
        }
      },
      deps: {
        planner: vi.fn().mockResolvedValue(directPlan()),
        registry: new Map(),
        aggregate: vi.fn(),
        runId: () => "run-observer-error",
        now: () => 10,
      },
    });

    expect(result.output).toBe(directPlan().directAnswer);
    expect(observed).toEqual([
      "run.started",
      "plan.started",
      "plan.completed",
      "run.completed",
    ]);
  });

  it("runs professional agents in parallel and keeps task deltas separate from aggregation deltas", async () => {
    const events: OrchestrationEvent[] = [];
    const started = new Set<AgentId>();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const waitingAdapter = (id: AgentId): AgentAdapter => ({
      id,
      name: id,
      capabilities: [],
      async *run() {
        started.add(id);
        if (started.size === 2) release();
        await gate;
        yield { type: "output.delta", delta: `${id}-task` };
        yield { type: "completed", result: { output: `${id} result`, summary: id, sources: [] } };
      },
    });
    const aggregate = vi.fn(async (options: AggregateResultsOptions) => {
      options.onDelta("final-");
      options.onDelta("answer");
      return "final-answer";
    });

    const result = await runOrchestration({
      question: "复合问题",
      messageId: "message-2",
      conversation: [],
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event),
      deps: {
        planner: vi.fn().mockResolvedValue(compoundPlan),
        registry: new Map([
          ["taxiq", waitingAdapter("taxiq")],
          ["odi", waitingAdapter("odi")],
        ]),
        aggregate,
        runId: () => "run-professional",
        now: () => 20,
        createTaskId: (agentId) => `${agentId}-1`,
      },
    });

    expect(started).toEqual(new Set(["taxiq", "odi"]));
    expect(result.output).toBe("final-answer");
    const types = eventTypes(events);
    expect(types.slice(0, 5)).toEqual([
      "run.started",
      "plan.started",
      "plan.completed",
      "task.pending",
      "task.pending",
    ]);
    expect(types.indexOf("aggregation.started")).toBeGreaterThan(types.lastIndexOf("task.completed"));
    expect(types.slice(-4)).toEqual([
      "aggregation.output.delta",
      "aggregation.output.delta",
      "aggregation.completed",
      "run.completed",
    ]);
    expect(events.filter((event) => event.type === "task.output.delta").map((event) => event.delta)).toEqual([
      "taxiq-task",
      "odi-task",
    ]);
    expect(events.filter((event) => event.type === "aggregation.output.delta").map((event) => event.delta)).toEqual([
      "final-",
      "answer",
    ]);
  });

  it("passes failed agents as unavailable and still aggregates successful results", async () => {
    const failed: AgentAdapter = {
      id: "odi",
      name: "ODI 智能体",
      capabilities: [],
      async *run() { throw new Error("odi down"); },
    };
    const aggregate = vi.fn().mockResolvedValue("部分结果");
    const events: OrchestrationEvent[] = [];

    await runOrchestration({
      question: "复合问题",
      messageId: "message-3",
      conversation: [],
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event),
      deps: {
        planner: vi.fn().mockResolvedValue(compoundPlan),
        registry: new Map([
          ["taxiq", successfulAdapter("taxiq")],
          ["odi", failed],
        ]),
        aggregate,
        runId: () => "run-partial",
        now: () => 30,
        createTaskId: (agentId) => `${agentId}-1`,
      },
    });

    const options = aggregate.mock.calls[0]?.[0] as AggregateResultsOptions;
    expect(options.completed.map((item) => item.agentId)).toEqual(["taxiq"]);
    expect(options.unavailable).toEqual([
      expect.objectContaining({ agentId: "odi", agentName: "ODI 智能体", reason: expect.stringContaining("暂时不可用") }),
    ]);
    expect(eventTypes(events)).toContain("task.failed");
    expect(eventTypes(events).at(-1)).toBe("run.completed");
  });

  it("does not call the model when every agent fails", async () => {
    const failing = (id: AgentId): AgentAdapter => ({
      id,
      name: id,
      capabilities: [],
      async *run() { throw new Error(`${id} failed`); },
    });
    const modelComplete = vi.fn();

    const result = await runOrchestration({
      question: "复合问题",
      messageId: "message-4",
      conversation: [],
      signal: new AbortController().signal,
      onEvent: vi.fn(),
      deps: {
        planner: vi.fn().mockResolvedValue(compoundPlan),
        registry: new Map([
          ["taxiq", failing("taxiq")],
          ["odi", failing("odi")],
        ]),
        aggregate: (options) => aggregateResultsForTest(options, modelComplete),
        runId: () => "run-failed",
        now: () => 40,
        createTaskId: (agentId) => `${agentId}-1`,
      },
    });

    expect(modelComplete).not.toHaveBeenCalled();
    expect(result.output).toContain("暂时未获得可用的专业结果");
  });

  it("opens aggregation at 30 seconds and late completion only updates the task trace", async () => {
    vi.useFakeTimers();
    let releaseLate!: () => void;
    const lateGate = new Promise<void>((resolve) => { releaseLate = resolve; });
    const late: AgentAdapter = {
      id: "odi",
      name: "ODI 智能体",
      capabilities: [],
      async *run() {
        await lateGate;
        yield { type: "output.delta", delta: "late delta" };
        yield { type: "completed", result: { output: "late result", summary: "late", sources: [] } };
      },
    };
    const events: OrchestrationEvent[] = [];
    const aggregate = vi.fn(async (options: AggregateResultsOptions) => {
      options.onDelta("first answer");
      return "first answer";
    });
    const runPromise = runOrchestration({
      question: "复合问题",
      messageId: "message-5",
      conversation: [],
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event),
      deps: {
        planner: vi.fn().mockResolvedValue(compoundPlan),
        registry: new Map([
          ["taxiq", successfulAdapter("taxiq")],
          ["odi", late],
        ]),
        aggregate,
        runId: () => "run-timeout",
        now: () => Date.now(),
        createTaskId: (agentId) => `${agentId}-1`,
        timeoutMs: 30_000,
      },
    });

    await vi.advanceTimersByTimeAsync(30_000);
    await expect(runPromise).resolves.toEqual({ runId: "run-timeout", output: "first answer" });
    expect((aggregate.mock.calls[0]?.[0] as AggregateResultsOptions).completed.map((item) => item.agentId)).toEqual(["taxiq"]);
    expect((aggregate.mock.calls[0]?.[0] as AggregateResultsOptions).unavailable).toEqual([
      expect.objectContaining({ agentId: "odi", reason: "等待超时" }),
    ]);
    const aggregationCount = eventTypes(events).filter((type) => type === "aggregation.started").length;

    releaseLate();
    await vi.runAllTimersAsync();
    await Promise.resolve();
    expect(eventTypes(events)).toContain("task.completed");
    expect(eventTypes(events).filter((type) => type === "aggregation.started")).toHaveLength(aggregationCount);
    expect(aggregate).toHaveBeenCalledOnce();
  });

  it("emits run.cancelled rather than run.failed on parent abort", async () => {
    const controller = new AbortController();
    const events: OrchestrationEvent[] = [];
    const hanging: AgentAdapter = {
      id: "taxiq",
      name: "TaxIQ",
      capabilities: [],
      async *run(_input, context) {
        await new Promise<void>((resolve) => context.signal.addEventListener("abort", () => resolve(), { once: true }));
      },
    };
    const singlePlan: ExecutionPlan = { ...compoundPlan, intent: "single", aggregationRequired: false, tasks: [compoundPlan.tasks[0]!] };
    const promise = runOrchestration({
      question: "税务问题",
      messageId: "message-6",
      conversation: [],
      signal: controller.signal,
      onEvent: (event) => events.push(event),
      deps: {
        planner: vi.fn().mockResolvedValue(singlePlan),
        registry: new Map([["taxiq", hanging]]),
        aggregate: vi.fn(),
        runId: () => "run-abort",
        now: () => 60,
        createTaskId: () => "taxiq-1",
      },
    });
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(eventTypes(events).at(-1)).toBe("run.cancelled");
    expect(eventTypes(events)).not.toContain("run.failed");
  });

  it("emits a structured run.failed event for planner failures", async () => {
    const events: OrchestrationEvent[] = [];
    await expect(runOrchestration({
      question: "问题",
      messageId: "message-7",
      conversation: [],
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event),
      deps: {
        planner: vi.fn().mockRejectedValue(new Error("planner secret")),
        registry: new Map(),
        aggregate: vi.fn(),
        runId: () => "run-planner-error",
        now: () => 70,
      },
    })).rejects.toThrow("planner secret");

    expect(events.at(-1)).toMatchObject({
      type: "run.failed",
      error: { code: "orchestration_failed", message: "出海协同智能体暂时无法完成本次任务" },
    });
  });

  it("emits aggregation.failed and run.failed when aggregation throws", async () => {
    const events: OrchestrationEvent[] = [];
    await expect(runOrchestration({
      question: "复合问题",
      messageId: "message-8",
      conversation: [],
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event),
      deps: {
        planner: vi.fn().mockResolvedValue(compoundPlan),
        registry: new Map([
          ["taxiq", successfulAdapter("taxiq")],
          ["odi", successfulAdapter("odi")],
        ]),
        aggregate: vi.fn().mockRejectedValue(new Error("aggregate secret")),
        runId: () => "run-aggregation-error",
        now: () => 80,
        createTaskId: (agentId) => `${agentId}-1`,
      },
    })).rejects.toThrow("aggregate secret");

    expect(eventTypes(events).slice(-2)).toEqual(["aggregation.failed", "run.failed"]);
  });

  it("retries into the same run with a new task id and completes the reopened run", async () => {
    let attempt = 0;
    const adapter: AgentAdapter = {
      id: "taxiq",
      name: "TaxIQ",
      capabilities: [],
      async *run() {
        attempt += 1;
        if (attempt === 1) throw new Error("first failed");
        yield { type: "completed", result: { output: "retry result", summary: "retry", sources: [] } };
      },
    };
    const events: OrchestrationEvent[] = [];
    const singlePlan: ExecutionPlan = {
      ...compoundPlan,
      intent: "single",
      tasks: [compoundPlan.tasks[0]!],
    };
    await runOrchestration({
      question: "税务问题",
      messageId: "message-retry",
      conversation: [],
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event),
      deps: {
        planner: vi.fn().mockResolvedValue(singlePlan),
        registry: new Map([["taxiq", adapter]]),
        aggregate: vi.fn().mockResolvedValue("first answer"),
        runId: () => "run-retry",
        createTaskId: (_agentId, number) => `taxiq-${number}`,
      },
    });

    const completedBeforeRetry = eventTypes(events).filter((type) => type === "run.completed").length;
    await expect(retryOrchestrationTask("run-retry", "taxiq-1")).resolves.toBe("taxiq-2");
    await vi.waitFor(() => {
      expect(events).toContainEqual(expect.objectContaining({ type: "task.completed", taskId: "taxiq-2" }));
      expect(eventTypes(events).filter((type) => type === "run.completed")).toHaveLength(completedBeforeRetry + 1);
    });
    expect(events).toContainEqual(expect.objectContaining({ type: "task.pending", task: expect.objectContaining({ id: "taxiq-2" }) }));
  });

  it("waits for all concurrent retries before completing the run again", async () => {
    const releases = new Map<AgentId, () => void>();
    const attempts = new Map<AgentId, number>();
    const retryable = (id: AgentId): AgentAdapter => ({
      id,
      name: id,
      capabilities: [],
      async *run() {
        const count = (attempts.get(id) ?? 0) + 1;
        attempts.set(id, count);
        if (count === 1) throw new Error("initial failure");
        await new Promise<void>((resolve) => releases.set(id, resolve));
        yield { type: "completed", result: { output: `${id} retry`, summary: id, sources: [] } };
      },
    });
    const events: OrchestrationEvent[] = [];
    await runOrchestration({
      question: "复合问题",
      messageId: "message-concurrent-retry",
      conversation: [],
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event),
      deps: {
        planner: vi.fn().mockResolvedValue(compoundPlan),
        registry: new Map([["taxiq", retryable("taxiq")], ["odi", retryable("odi")]]),
        aggregate: vi.fn().mockResolvedValue("no initial results"),
        runId: () => "run-concurrent-retry",
        createTaskId: (agentId, number) => `${agentId}-${number}`,
      },
    });
    const completedBefore = eventTypes(events).filter((type) => type === "run.completed").length;
    await Promise.all([
      retryOrchestrationTask("run-concurrent-retry", "taxiq-1"),
      retryOrchestrationTask("run-concurrent-retry", "odi-1"),
    ]);
    await vi.waitFor(() => expect(releases.size).toBe(2));

    releases.get("taxiq")?.();
    await vi.waitFor(() => expect(events).toContainEqual(expect.objectContaining({ type: "task.completed", taskId: "taxiq-2" })));
    expect(eventTypes(events).filter((type) => type === "run.completed")).toHaveLength(completedBefore);

    releases.get("odi")?.();
    await vi.waitFor(() => {
      expect(eventTypes(events).filter((type) => type === "run.completed")).toHaveLength(completedBefore + 1);
    });
  });

  it("rejects retry for an unknown or evicted run", async () => {
    await expect(retryOrchestrationTask("missing-run", "missing-task")).rejects.toThrow("未找到可重试的智能体运行");
  });
});

async function aggregateResultsForTest(options: AggregateResultsOptions, complete: ReturnType<typeof vi.fn>) {
  const { aggregateResults } = await import("../aggregator");
  return aggregateResults({ ...options, complete });
}
