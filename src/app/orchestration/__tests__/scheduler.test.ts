import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentAdapter, AgentAdapterEvent } from "../../agents/types";
import type { AgentId, ExecutionPlan, OrchestrationEvent } from "../types";
import { createRunState, orchestrationReducer } from "../reducer";
import { runScheduledTasks } from "../scheduler";

const compoundPlan: ExecutionPlan = {
  intent: "compound",
  directAnswerAllowed: false,
  aggregationRequired: true,
  rationaleSummary: "税务与备案问题需要并行处理",
  tasks: [
    {
      agentId: "taxiq",
      title: "国别税务",
      instruction: "分析税务要求",
      expectedOutput: "税务结论",
    },
    {
      agentId: "odi",
      title: "ODI 办理",
      instruction: "分析备案流程",
      expectedOutput: "办理结论",
    },
  ],
};

const input = {
  question: "去越南投资涉及哪些税务和 ODI 手续？",
  instruction: "",
  conversation: [],
};

function adapter(id: AgentId, onStart: () => void): AgentAdapter {
  return {
    id,
    name: id,
    capabilities: [],
    async *run() {
      onStart();
      yield {
        type: "completed",
        result: { output: `${id} result`, summary: id, sources: [] },
      };
    },
  };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe("runScheduledTasks", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts each initial task timeout only when execution starts", async () => {
    const events: OrchestrationEvent[] = [];
    const release = deferred();
    const waitingAdapter = (id: AgentId): AgentAdapter => ({
      id,
      name: id,
      capabilities: [],
      async *run() {
        await release.promise;
        yield {
          type: "completed",
          result: { output: "done", summary: "done", sources: [] },
        };
      },
    });
    const execution = runScheduledTasks({
      runId: "run-timer-start",
      plan: compoundPlan,
      registry: new Map([
        ["taxiq", waitingAdapter("taxiq")],
        ["odi", waitingAdapter("odi")],
      ]),
      input,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      createTaskId: (agentId) => `${agentId}-1`,
    });

    try {
      expect(events.every((event) => event.type === "task.pending")).toBe(true);
      expect(vi.getTimerCount()).toBe(0);

      await vi.advanceTimersByTimeAsync(0);

      expect(events.some((event) => event.type === "task.started")).toBe(true);
      expect(vi.getTimerCount()).toBe(2);
    } finally {
      release.resolve();
      await execution.allSettled;
    }
  });

  it("registers every pending task synchronously before starting any adapter", async () => {
    const started: AgentId[] = [];
    const events: OrchestrationEvent[] = [];
    const registry = new Map<AgentId, AgentAdapter>([
      ["taxiq", adapter("taxiq", () => started.push("taxiq"))],
      ["odi", adapter("odi", () => started.push("odi"))],
    ]);

    const execution = runScheduledTasks({
      runId: "run-1",
      plan: compoundPlan,
      registry,
      input,
      signal: new AbortController().signal,
      timeoutMs: 30_000,
      emit: (event) => events.push(event),
      now: () => 1_000,
      createTaskId: (agentId, attempt) => `${agentId}-${attempt}`,
    });

    expect(started).toEqual([]);
    expect(events.map((event) => event.type)).toEqual([
      "task.pending",
      "task.pending",
    ]);
    expect(events.map((event) => event.type === "task.pending" && event.task.id)).toEqual([
      "taxiq-1",
      "odi-1",
    ]);

    await execution.allSettled;

    expect(started).toEqual(["taxiq", "odi"]);
    expect(events.filter((event) => event.type === "task.started")).toHaveLength(2);
    const eventTypes = events.map((event) => event.type);
    expect(eventTypes.lastIndexOf("task.started")).toBeLessThan(
      eventTypes.indexOf("task.completed"),
    );
    expect(events.every((event) => event.runId === "run-1" && event.at === 1_000)).toBe(true);
    await expect(execution.readyForAggregation).resolves.toEqual([
      "taxiq-1",
      "odi-1",
    ]);
  });

  it("aborts unfinished work at its deadline and ignores a late result", async () => {
    const release = deferred();
    const events: OrchestrationEvent[] = [];
    let adapterSignal: AbortSignal | undefined;
    const slowTaxiq: AgentAdapter = {
      id: "taxiq",
      name: "TaxIQ",
      capabilities: [],
      async *run(_input, context) {
        adapterSignal = context.signal;
        await release.promise;
        yield { type: "output.delta", delta: "late stream" };
        yield {
          type: "completed",
          result: { output: "late result", summary: "late", sources: [] },
        };
      },
    };
    const slowPlan: ExecutionPlan = {
      ...compoundPlan,
      intent: "single",
      aggregationRequired: false,
      tasks: [compoundPlan.tasks[0]!],
    };

    const execution = runScheduledTasks({
      runId: "run-timeout",
      plan: slowPlan,
      registry: new Map([["taxiq", slowTaxiq]]),
      input,
      signal: new AbortController().signal,
      timeoutMs: 30_000,
      emit: (event) => events.push(event),
      now: () => Date.now(),
      createTaskId: () => "taxiq-1",
    });

    try {
      await vi.advanceTimersByTimeAsync(30_000);

      expect(events).toContainEqual(
        expect.objectContaining({ type: "task.timeout", taskId: "taxiq-1" }),
      );
      await expect(execution.readyForAggregation).resolves.toEqual([]);
      expect(adapterSignal?.aborted).toBe(true);
    } finally {
      release.resolve();
      await execution.allSettled;
    }

    expect(events.some((event) => event.type === "task.output.delta")).toBe(false);
    expect(events.some((event) => event.type === "task.completed")).toBe(false);
  });

  it("allows TaxIQ 75 seconds by default so its stale-session retry can finish", async () => {
    const release = deferred();
    const events: OrchestrationEvent[] = [];
    const slowTaxiq: AgentAdapter = {
      id: "taxiq",
      name: "TaxIQ",
      capabilities: [],
      async *run() {
        await release.promise;
        yield {
          type: "completed",
          result: { output: "recovered", summary: "recovered", sources: [] },
        };
      },
    };
    const singlePlan: ExecutionPlan = {
      ...compoundPlan,
      intent: "single",
      aggregationRequired: false,
      tasks: [compoundPlan.tasks[0]!],
    };
    const execution = runScheduledTasks({
      runId: "run-taxiq-recovery-window",
      plan: singlePlan,
      registry: new Map([["taxiq", slowTaxiq]]),
      input,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      createTaskId: () => "taxiq-1",
    });

    try {
      await vi.advanceTimersByTimeAsync(30_000);
      expect(events.some((event) => event.type === "task.timeout")).toBe(false);

      release.resolve();
      await execution.allSettled;
    } finally {
      release.resolve();
    }

    expect(events).toContainEqual(
      expect.objectContaining({ type: "task.completed", taskId: "taxiq-1" }),
    );
    await expect(execution.readyForAggregation).resolves.toEqual(["taxiq-1"]);
  });

  it("isolates a structured agent failure and aggregates the successful task", async () => {
    const events: OrchestrationEvent[] = [];
    const failingTaxiq: AgentAdapter = {
      id: "taxiq",
      name: "TaxIQ",
      capabilities: [],
      async *run() {
        throw {
          code: "taxiq_unavailable",
          message: "TaxIQ 暂时不可用",
          detail: "HTTP 503",
        };
      },
    };
    const registry = new Map<AgentId, AgentAdapter>([
      ["taxiq", failingTaxiq],
      ["odi", adapter("odi", () => undefined)],
    ]);

    const execution = runScheduledTasks({
      runId: "run-partial-failure",
      plan: compoundPlan,
      registry,
      input,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      createTaskId: (agentId) => `${agentId}-1`,
    });

    await execution.allSettled;

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "task.failed",
        taskId: "taxiq-1",
        error: {
          code: "taxiq_unavailable",
          message: "TaxIQ 暂时不可用",
          detail: "HTTP 503",
        },
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: "task.completed", taskId: "odi-1" }),
    );
    await expect(execution.readyForAggregation).resolves.toEqual(["odi-1"]);
  });

  it("cancels every active task and settles both lifecycle promises on parent abort", async () => {
    const controller = new AbortController();
    const events: OrchestrationEvent[] = [];
    const abortableAdapter = (id: AgentId): AgentAdapter => ({
      id,
      name: id,
      capabilities: [],
      async *run(_input, context) {
        await new Promise<void>((_resolve, reject) => {
          context.signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        });
      },
    });

    const execution = runScheduledTasks({
      runId: "run-abort",
      plan: compoundPlan,
      registry: new Map([
        ["taxiq", abortableAdapter("taxiq")],
        ["odi", abortableAdapter("odi")],
      ]),
      input,
      signal: controller.signal,
      emit: (event) => events.push(event),
      createTaskId: (agentId) => `${agentId}-1`,
    });

    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await execution.allSettled;

    expect(events.filter((event) => event.type === "task.cancelled")).toHaveLength(2);
    expect(events.some((event) => event.type === "task.failed")).toBe(false);
    await expect(execution.readyForAggregation).resolves.toEqual([]);
  });

  it("retries into a new task id while preserving the failed attempt", async () => {
    const events: OrchestrationEvent[] = [];
    let invocation = 0;
    const flakyTaxiq: AgentAdapter = {
      id: "taxiq",
      name: "TaxIQ",
      capabilities: [],
      async *run() {
        invocation += 1;
        if (invocation === 1) throw new Error("temporary failure");
        yield {
          type: "completed",
          result: { output: "retry result", summary: "retry", sources: [] },
        };
      },
    };
    const singlePlan: ExecutionPlan = {
      ...compoundPlan,
      intent: "single",
      aggregationRequired: false,
      tasks: [compoundPlan.tasks[0]!],
    };
    const execution = runScheduledTasks({
      runId: "run-retry",
      plan: singlePlan,
      registry: new Map([["taxiq", flakyTaxiq]]),
      input,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      createTaskId: (agentId, attempt) => `${agentId}-${attempt}`,
    });
    await execution.allSettled;

    const retryId = await execution.retry("taxiq-1");
    await vi.advanceTimersByTimeAsync(0);

    expect(retryId).toBe("taxiq-2");
    expect(
      events
        .filter((event) => event.type === "task.pending")
        .map((event) => event.task.id),
    ).toEqual(["taxiq-1", "taxiq-2"]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "task.failed", taskId: "taxiq-1" }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: "task.completed", taskId: "taxiq-2" }),
    );
  });

  it("projects a retry into a run that was already completed", async () => {
    let taxiqInvocation = 0;
    const flakyTaxiq: AgentAdapter = {
      id: "taxiq",
      name: "TaxIQ",
      capabilities: [],
      async *run() {
        taxiqInvocation += 1;
        if (taxiqInvocation === 1) throw new Error("temporary failure");
        yield {
          type: "completed",
          result: { output: "retry result", summary: "retry", sources: [] },
        };
      },
    };
    let state = createRunState("run-reopen", "message-1", 1_000);
    state = orchestrationReducer(state, {
      type: "plan.completed",
      runId: "run-reopen",
      at: 1_001,
      plan: compoundPlan,
    });
    const execution = runScheduledTasks({
      runId: "run-reopen",
      plan: compoundPlan,
      registry: new Map([
        ["taxiq", flakyTaxiq],
        ["odi", adapter("odi", () => undefined)],
      ]),
      input,
      signal: new AbortController().signal,
      emit: (event) => {
        state = orchestrationReducer(state, event);
      },
      createTaskId: (agentId, attempt) => `${agentId}-${attempt}`,
    });
    await execution.allSettled;
    state = orchestrationReducer(state, {
      type: "aggregation.started",
      runId: "run-reopen",
      at: 1_010,
      usedTaskIds: ["odi-1"],
    });
    state = orchestrationReducer(state, {
      type: "aggregation.completed",
      runId: "run-reopen",
      at: 1_011,
      output: "previous aggregate",
    });
    state = orchestrationReducer(state, {
      type: "run.completed",
      runId: "run-reopen",
      at: 1_012,
    });

    const retryPromise = execution.retry("taxiq-1");

    expect(state.status).toBe("running");
    expect(state.tasks["taxiq-1"]?.status).toBe("error");
    expect(state.tasks["taxiq-2"]?.status).toBe("pending");
    expect(state.aggregation.status).toBe("waiting");
    expect(state.aggregation.output).toBe("previous aggregate");

    await retryPromise;
    await vi.advanceTimersByTimeAsync(0);

    expect(state.tasks["taxiq-2"]?.status).toBe("done");
    expect(state.tasks["taxiq-2"]?.output).toBe("retry result");
    expect(state.tasks["taxiq-1"]?.status).toBe("error");
  });

  it("rejects retry after parent abort without registering an orphan task", async () => {
    const controller = new AbortController();
    controller.abort();
    const events: OrchestrationEvent[] = [];
    const singlePlan: ExecutionPlan = {
      ...compoundPlan,
      intent: "single",
      aggregationRequired: false,
      tasks: [compoundPlan.tasks[0]!],
    };
    const execution = runScheduledTasks({
      runId: "run-pre-aborted",
      plan: singlePlan,
      registry: new Map([["taxiq", adapter("taxiq", () => undefined)]]),
      input,
      signal: controller.signal,
      emit: (event) => events.push(event),
      createTaskId: (agentId, attempt) => `${agentId}-${attempt}`,
    });
    await execution.allSettled;

    expect(vi.getTimerCount()).toBe(0);
    await expect(execution.retry("taxiq-1")).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(events.filter((event) => event.type === "task.pending")).toHaveLength(1);
  });

  it("settles an empty plan without starting a timeout", async () => {
    const execution = runScheduledTasks({
      runId: "run-empty",
      plan: { ...compoundPlan, tasks: [] },
      registry: new Map(),
      input,
      signal: new AbortController().signal,
      emit: vi.fn(),
    });

    expect(vi.getTimerCount()).toBe(0);
    await expect(execution.readyForAggregation).resolves.toEqual([]);
    await execution.allSettled;
  });

  it("gives a retry its own timeout, aborts it, and ignores its late stream", async () => {
    const releaseRetry = deferred();
    const events: OrchestrationEvent[] = [];
    let invocation = 0;
    let retrySignal: AbortSignal | undefined;
    const taxiq: AgentAdapter = {
      id: "taxiq",
      name: "TaxIQ",
      capabilities: [],
      async *run(_input, context) {
        invocation += 1;
        if (invocation === 2) {
          retrySignal = context.signal;
          await releaseRetry.promise;
        }
        yield {
          type: "completed",
          result: { output: `result ${invocation}`, summary: "done", sources: [] },
        };
      },
    };
    const singlePlan: ExecutionPlan = {
      ...compoundPlan,
      intent: "single",
      aggregationRequired: false,
      tasks: [compoundPlan.tasks[0]!],
    };
    const execution = runScheduledTasks({
      runId: "run-retry-timeout",
      plan: singlePlan,
      registry: new Map([["taxiq", taxiq]]),
      input,
      signal: new AbortController().signal,
      timeoutMs: 30_000,
      emit: (event) => events.push(event),
      createTaskId: (agentId, attempt) => `${agentId}-${attempt}`,
    });
    await execution.allSettled;
    const retryId = await execution.retry("taxiq-1");

    try {
      await vi.advanceTimersByTimeAsync(30_000);
      expect(events).toContainEqual(
        expect.objectContaining({ type: "task.timeout", taskId: retryId }),
      );
      expect(retrySignal?.aborted).toBe(true);
    } finally {
      releaseRetry.resolve();
      await vi.advanceTimersByTimeAsync(0);
    }

    expect(
      events.some(
        (event) => event.type === "task.completed" && event.taskId === retryId,
      ),
    ).toBe(false);
  });

  it("starts a retry timeout only when that retry execution starts", async () => {
    const releaseRetry = deferred();
    const events: OrchestrationEvent[] = [];
    let invocation = 0;
    const taxiq: AgentAdapter = {
      id: "taxiq",
      name: "TaxIQ",
      capabilities: [],
      async *run() {
        invocation += 1;
        if (invocation === 2) await releaseRetry.promise;
        yield {
          type: "completed",
          result: { output: "done", summary: "done", sources: [] },
        };
      },
    };
    const singlePlan: ExecutionPlan = {
      ...compoundPlan,
      intent: "single",
      aggregationRequired: false,
      tasks: [compoundPlan.tasks[0]!],
    };
    const execution = runScheduledTasks({
      runId: "run-retry-timer-start",
      plan: singlePlan,
      registry: new Map([["taxiq", taxiq]]),
      input,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      createTaskId: (agentId, attempt) => `${agentId}-${attempt}`,
    });
    await execution.allSettled;
    expect(vi.getTimerCount()).toBe(0);

    try {
      const retryPromise = execution.retry("taxiq-1");
      expect(events.at(-1)).toEqual(
        expect.objectContaining({
          type: "task.pending",
          task: expect.objectContaining({ id: "taxiq-2" }),
        }),
      );
      expect(vi.getTimerCount()).toBe(0);

      const retryId = await retryPromise;
      expect(events).toContainEqual(
        expect.objectContaining({ type: "task.started", taskId: retryId }),
      );
      expect(vi.getTimerCount()).toBe(1);
    } finally {
      releaseRetry.resolve();
      await vi.advanceTimersByTimeAsync(0);
    }
  });

  it("returns completed ids at the gate while timing out only unfinished tasks", async () => {
    const releaseOdi = deferred();
    const events: OrchestrationEvent[] = [];
    const slowOdi: AgentAdapter = {
      id: "odi",
      name: "ODI",
      capabilities: [],
      async *run() {
        await releaseOdi.promise;
        yield {
          type: "completed",
          result: { output: "odi late", summary: "odi", sources: [] },
        };
      },
    };
    const execution = runScheduledTasks({
      runId: "run-partial-timeout",
      plan: compoundPlan,
      registry: new Map([
        ["taxiq", adapter("taxiq", () => undefined)],
        ["odi", slowOdi],
      ]),
      input,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      createTaskId: (agentId) => `${agentId}-1`,
    });

    try {
      await vi.advanceTimersByTimeAsync(30_000);
      await expect(execution.readyForAggregation).resolves.toEqual(["taxiq-1"]);
      expect(
        events
          .filter((event) => event.type === "task.timeout")
          .map((event) => event.taskId),
      ).toEqual(["odi-1"]);
    } finally {
      releaseOdi.resolve();
      await execution.allSettled;
    }
  });

  it("settles an all-failure run before the timeout with no aggregation ids", async () => {
    const events: OrchestrationEvent[] = [];
    const failingAdapter = (id: AgentId): AgentAdapter => ({
      id,
      name: id,
      capabilities: [],
      async *run() {
        throw new Error(`${id} failed`);
      },
    });
    const execution = runScheduledTasks({
      runId: "run-all-failed",
      plan: compoundPlan,
      registry: new Map([
        ["taxiq", failingAdapter("taxiq")],
        ["odi", failingAdapter("odi")],
      ]),
      input,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      createTaskId: (agentId) => `${agentId}-1`,
    });

    await execution.allSettled;

    expect(events.filter((event) => event.type === "task.failed")).toHaveLength(2);
    expect(events.some((event) => event.type === "task.timeout")).toBe(false);
    await expect(execution.readyForAggregation).resolves.toEqual([]);
  });

  it("settles abort even when an adapter ignores its signal", async () => {
    const controller = new AbortController();
    const events: OrchestrationEvent[] = [];
    const ignoringAdapter: AgentAdapter = {
      id: "taxiq",
      name: "TaxIQ",
      capabilities: [],
      async *run() {
        await new Promise<void>(() => undefined);
      },
    };
    const singlePlan: ExecutionPlan = {
      ...compoundPlan,
      intent: "single",
      aggregationRequired: false,
      tasks: [compoundPlan.tasks[0]!],
    };
    const execution = runScheduledTasks({
      runId: "run-ignore-abort",
      plan: singlePlan,
      registry: new Map([["taxiq", ignoringAdapter]]),
      input,
      signal: controller.signal,
      emit: (event) => events.push(event),
      createTaskId: () => "taxiq-1",
    });

    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await execution.allSettled;

    expect(events).toContainEqual(
      expect.objectContaining({ type: "task.cancelled", taskId: "taxiq-1" }),
    );
    await expect(execution.readyForAggregation).resolves.toEqual([]);
  });

  it("rejects an unknown retry id without registering a task", async () => {
    const events: OrchestrationEvent[] = [];
    const execution = runScheduledTasks({
      runId: "run-unknown-retry",
      plan: compoundPlan,
      registry: new Map([
        ["taxiq", adapter("taxiq", () => undefined)],
        ["odi", adapter("odi", () => undefined)],
      ]),
      input,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      createTaskId: (agentId) => `${agentId}-1`,
    });
    await execution.allSettled;
    const pendingBeforeRetry = events.filter(
      (event) => event.type === "task.pending",
    ).length;

    await expect(execution.retry("missing-task")).rejects.toThrow(
      "未找到待重试任务: missing-task",
    );
    expect(events.filter((event) => event.type === "task.pending")).toHaveLength(
      pendingBeforeRetry,
    );
  });

  it("removes the per-task abort listener after normal completion", async () => {
    let removeListener: ReturnType<typeof vi.spyOn> | undefined;
    const observingAdapter: AgentAdapter = {
      id: "taxiq",
      name: "TaxIQ",
      capabilities: [],
      async *run(_input, context) {
        removeListener = vi.spyOn(context.signal, "removeEventListener");
        yield {
          type: "completed",
          result: { output: "done", summary: "done", sources: [] },
        };
      },
    };
    const singlePlan: ExecutionPlan = {
      ...compoundPlan,
      intent: "single",
      aggregationRequired: false,
      tasks: [compoundPlan.tasks[0]!],
    };
    const execution = runScheduledTasks({
      runId: "run-listener-cleanup",
      plan: singlePlan,
      registry: new Map([["taxiq", observingAdapter]]),
      input,
      signal: new AbortController().signal,
      emit: vi.fn(),
      createTaskId: () => "taxiq-1",
    });

    await execution.allSettled;

    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("keeps completed as the only terminal event when iterator cleanup throws", async () => {
    const events: OrchestrationEvent[] = [];
    const cleanupFailureAdapter: AgentAdapter = {
      id: "taxiq",
      name: "TaxIQ",
      capabilities: [],
      run() {
        let delivered = false;
        return {
          [Symbol.asyncIterator]() {
            return {
              async next(): Promise<IteratorResult<AgentAdapterEvent>> {
                if (delivered) return { done: true, value: undefined };
                delivered = true;
                return {
                  done: false,
                  value: {
                    type: "completed",
                    result: { output: "done", summary: "done", sources: [] },
                  },
                };
              },
              async return(): Promise<IteratorResult<AgentAdapterEvent>> {
                throw new Error("iterator cleanup failed");
              },
            };
          },
        };
      },
    };
    const singlePlan: ExecutionPlan = {
      ...compoundPlan,
      intent: "single",
      aggregationRequired: false,
      tasks: [compoundPlan.tasks[0]!],
    };
    const execution = runScheduledTasks({
      runId: "run-cleanup-failure",
      plan: singlePlan,
      registry: new Map([["taxiq", cleanupFailureAdapter]]),
      input,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      createTaskId: () => "taxiq-1",
    });

    await execution.allSettled;

    expect(events.filter((event) => event.type === "task.completed")).toHaveLength(1);
    expect(events.some((event) => event.type === "task.failed")).toBe(false);
    await expect(execution.readyForAggregation).resolves.toEqual(["taxiq-1"]);
  });

  it("isolates observer errors from agent execution and completion", async () => {
    const events: OrchestrationEvent[] = [];
    let threwOnce = false;
    const singlePlan: ExecutionPlan = {
      ...compoundPlan,
      intent: "single",
      aggregationRequired: false,
      tasks: [compoundPlan.tasks[0]!],
    };
    const execution = runScheduledTasks({
      runId: "run-observer-error",
      plan: singlePlan,
      registry: new Map([["taxiq", successfulStreamingAdapter("taxiq")]]),
      input,
      signal: new AbortController().signal,
      emit: (event) => {
        events.push(event);
        if (event.type === "task.progress" && !threwOnce) {
          threwOnce = true;
          throw new Error("observer render failed");
        }
      },
      createTaskId: () => "taxiq-1",
    });

    await execution.allSettled;

    expect(events.some((event) => event.type === "task.completed")).toBe(true);
    expect(events.some((event) => event.type === "task.failed")).toBe(false);
    await expect(execution.readyForAggregation).resolves.toEqual(["taxiq-1"]);
  });
});

function successfulStreamingAdapter(id: AgentId): AgentAdapter {
  return {
    id,
    name: id,
    capabilities: [],
    async *run() {
      yield { type: "progress", text: "working" };
      yield { type: "output.delta", delta: "result" };
      yield {
        type: "completed",
        result: { output: "result", summary: "done", sources: [] },
      };
    },
  };
}
