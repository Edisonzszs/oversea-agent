import { describe, expect, it } from "vitest";

import { createRunState, orchestrationReducer } from "../reducer";
import type {
  AgentTaskState,
  ExecutionPlan,
  OrchestrationEvent,
  TaskStatus,
} from "../types";

const runId = "run-1";

const plan: ExecutionPlan = {
  intent: "compound",
  directAnswerAllowed: false,
  tasks: [
    {
      agentId: "consulting",
      title: "Market entry",
      instruction: "Analyze market entry",
      expectedOutput: "A market-entry analysis",
    },
    {
      agentId: "taxiq",
      title: "Tax exposure",
      instruction: "Analyze tax exposure",
      expectedOutput: "A tax-risk analysis",
    },
  ],
  aggregationRequired: true,
  rationaleSummary: "The request spans consulting and tax.",
};

function pendingTask(id: string, index = 0): AgentTaskState {
  const plannedTask = plan.tasks[index];
  if (!plannedTask) throw new Error(`Missing planned task at index ${index}`);

  return {
    ...plannedTask,
    id,
    status: "pending",
    output: "",
    progress: [],
    sources: [],
  };
}

function reduce(events: OrchestrationEvent[]) {
  return events.reduce(
    orchestrationReducer,
    createRunState(runId, "message-1", 1_000),
  );
}

function plannedEvents(): OrchestrationEvent[] {
  return [
    { type: "plan.started", runId, at: 1_001 },
    { type: "plan.completed", runId, at: 1_002, plan },
  ];
}

function pendingEvents(): OrchestrationEvent[] {
  return [
    ...plannedEvents(),
    { type: "task.pending", runId, at: 1_003, task: pendingTask("task-consulting") },
    { type: "task.pending", runId, at: 1_004, task: pendingTask("task-taxiq", 1) },
  ];
}

describe("orchestrationReducer", () => {
  it("does not create task state when a plan completes", () => {
    const state = reduce(plannedEvents());

    expect(state.tasks).toEqual({});
    expect(state.taskOrder).toEqual([]);
    expect(state.plan).toEqual(plan);
  });

  it("adds pending tasks in stable order without duplicating ids", () => {
    const consulting = pendingTask("task-consulting");
    const duplicate = {
      ...consulting,
      title: "Duplicate payload must not win",
      output: "duplicate",
    };
    const state = reduce([
      ...plannedEvents(),
      { type: "task.pending", runId, at: 1_003, task: consulting },
      { type: "task.pending", runId, at: 1_004, task: duplicate },
      { type: "task.pending", runId, at: 1_005, task: pendingTask("task-taxiq", 1) },
    ]);

    expect(state.taskOrder).toEqual(["task-consulting", "task-taxiq"]);
    expect(state.tasks["task-consulting"]).toEqual(consulting);
  });

  it("isolates output deltas by taskId", () => {
    const state = reduce([
      ...pendingEvents(),
      { type: "task.started", runId, at: 1_005, taskId: "task-consulting" },
      { type: "task.started", runId, at: 1_005, taskId: "task-taxiq" },
      { type: "task.output.delta", runId, at: 1_005, taskId: "task-consulting", delta: "market " },
      { type: "task.output.delta", runId, at: 1_006, taskId: "task-taxiq", delta: "tax " },
      { type: "task.output.delta", runId, at: 1_007, taskId: "task-consulting", delta: "entry" },
    ]);

    expect(state.tasks["task-consulting"]?.output).toBe("market entry");
    expect(state.tasks["task-taxiq"]?.output).toBe("tax ");
  });

  it("appends task progress text", () => {
    const state = reduce([
      ...pendingEvents(),
      {
        type: "task.progress",
        runId,
        at: 1_005,
        taskId: "task-consulting",
        text: "Checking policy sources",
      },
    ]);

    expect(state.tasks["task-consulting"]?.progress).toEqual(["Checking policy sources"]);
  });

  it.each(["done", "error", "cancelled"] as const)(
    "does not regress a %s task on late started or progress events",
    (terminalStatus: Extract<TaskStatus, "done" | "error" | "cancelled">) => {
      const terminalEvent: OrchestrationEvent =
        terminalStatus === "done"
          ? {
              type: "task.completed",
              runId,
              at: 1_005,
              taskId: "task-consulting",
              result: { output: "complete", summary: "Complete", sources: [] },
            }
          : terminalStatus === "error"
            ? {
                type: "task.failed",
                runId,
                at: 1_005,
                taskId: "task-consulting",
                error: { code: "AGENT_FAILED", message: "failed" },
              }
            : {
                type: "task.cancelled",
                runId,
                at: 1_005,
                taskId: "task-consulting",
              };

      const state = reduce([
        ...pendingEvents(),
        terminalEvent,
        { type: "task.started", runId, at: 1_006, taskId: "task-consulting" },
        {
          type: "task.progress",
          runId,
          at: 1_007,
          taskId: "task-consulting",
          text: "late update",
        },
      ]);

      expect(state.tasks["task-consulting"]?.status).toBe(terminalStatus);
      expect(state.tasks["task-consulting"]?.progress).toEqual([]);
    },
  );

  it("allows a timed-out task to transition to done on late completion", () => {
    const state = reduce([
      ...pendingEvents(),
      { type: "task.timeout", runId, at: 1_005, taskId: "task-consulting" },
      {
        type: "task.completed",
        runId,
        at: 1_006,
        taskId: "task-consulting",
        result: {
          output: "late but useful",
          summary: "Useful late result",
          sources: [{ title: "Official source", url: "https://example.com" }],
        },
      },
    ]);

    expect(state.tasks["task-consulting"]?.status).toBe("done");
    expect(state.tasks["task-consulting"]?.output).toBe("late but useful");
    expect(state.tasks["task-consulting"]?.summary).toBe("Useful late result");
  });

  it.each(["done", "error", "cancelled"] as const)(
    "ignores output deltas for a %s task",
    (terminalStatus) => {
      const terminalEvent: OrchestrationEvent =
        terminalStatus === "done"
          ? {
              type: "task.completed",
              runId,
              at: 1_006,
              taskId: "task-consulting",
              result: { output: "complete", summary: "Complete", sources: [] },
            }
          : terminalStatus === "error"
            ? {
                type: "task.failed",
                runId,
                at: 1_006,
                taskId: "task-consulting",
                error: { code: "AGENT_FAILED", message: "failed" },
              }
            : {
                type: "task.cancelled",
                runId,
                at: 1_006,
                taskId: "task-consulting",
              };
      const terminalState = reduce([
        ...pendingEvents(),
        { type: "task.started", runId, at: 1_005, taskId: "task-consulting" },
        terminalEvent,
      ]);
      const state = orchestrationReducer(terminalState, {
        type: "task.output.delta",
        runId,
        at: 1_007,
        taskId: "task-consulting",
        delta: "late delta",
      });

      expect(state).toBe(terminalState);
      expect(state.tasks["task-consulting"]?.output).toBe(
        terminalStatus === "done" ? "complete" : "",
      );
    },
  );

  it("accepts output deltas for a timed-out task but not a pending task", () => {
    const state = reduce([
      ...pendingEvents(),
      { type: "task.timeout", runId, at: 1_005, taskId: "task-consulting" },
      {
        type: "task.output.delta",
        runId,
        at: 1_006,
        taskId: "task-consulting",
        delta: "late timeout output",
      },
      {
        type: "task.output.delta",
        runId,
        at: 1_006,
        taskId: "task-taxiq",
        delta: "pending output",
      },
    ]);

    expect(state.tasks["task-consulting"]?.output).toBe("late timeout output");
    expect(state.tasks["task-taxiq"]?.output).toBe("");
  });

  it("keeps aggregation output separate from task output", () => {
    const state = reduce([
      ...pendingEvents(),
      { type: "task.started", runId, at: 1_005, taskId: "task-consulting" },
      { type: "task.output.delta", runId, at: 1_005, taskId: "task-consulting", delta: "agent output" },
      {
        type: "aggregation.started",
        runId,
        at: 1_006,
        usedTaskIds: ["task-consulting", "task-taxiq"],
      },
      { type: "aggregation.output.delta", runId, at: 1_007, delta: "combined " },
      { type: "aggregation.output.delta", runId, at: 1_008, delta: "answer" },
    ]);

    expect(state.tasks["task-consulting"]?.output).toBe("agent output");
    expect(state.aggregation.output).toBe("combined answer");
    expect(state.aggregation.usedTaskIds).toEqual(["task-consulting", "task-taxiq"]);
  });

  it("uses completed aggregation output as the authoritative result", () => {
    const state = reduce([
      ...pendingEvents(),
      {
        type: "aggregation.started",
        runId,
        at: 1_006,
        usedTaskIds: ["task-consulting"],
      },
      { type: "aggregation.output.delta", runId, at: 1_007, delta: "partial buffer" },
      {
        type: "aggregation.completed",
        runId,
        at: 1_008,
        output: "authoritative final answer",
      },
    ]);

    expect(state.aggregation.status).toBe("done");
    expect(state.aggregation.output).toBe("authoritative final answer");
  });

  it("does not add unrequested fields for failed or cancelled runs", () => {
    const failed = reduce([
      {
        type: "run.failed",
        runId,
        at: 1_001,
        error: { code: "RUN_FAILED", message: "failed" },
      },
    ]);
    const cancelled = reduce([{ type: "run.cancelled", runId, at: 1_001 }]);

    expect(failed.status).toBe("error");
    expect(failed).not.toHaveProperty("error");
    expect(failed).not.toHaveProperty("completedAt");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled).not.toHaveProperty("completedAt");
  });

  it.each(["completed", "cancelled", "error"] as const)(
    "protects a %s run from late non-task events",
    (terminalStatus) => {
      const terminalEvent: OrchestrationEvent =
        terminalStatus === "completed"
          ? { type: "run.completed", runId, at: 1_010 }
          : terminalStatus === "cancelled"
            ? { type: "run.cancelled", runId, at: 1_010 }
            : {
                type: "run.failed",
                runId,
                at: 1_010,
                error: { code: "RUN_FAILED", message: "failed" },
              };
      const terminalState = reduce([terminalEvent]);
      const lateEvents: OrchestrationEvent[] = [
        { type: "plan.started", runId, at: 1_011 },
        { type: "plan.completed", runId, at: 1_011, plan },
        { type: "aggregation.started", runId, at: 1_011, usedTaskIds: [] },
        { type: "aggregation.output.delta", runId, at: 1_011, delta: "late" },
        { type: "aggregation.completed", runId, at: 1_011, output: "late" },
        {
          type: "aggregation.failed",
          runId,
          at: 1_011,
          error: { code: "LATE", message: "late" },
        },
        { type: "run.completed", runId, at: 1_011 },
        { type: "run.cancelled", runId, at: 1_011 },
        {
          type: "run.failed",
          runId,
          at: 1_011,
          error: { code: "LATE", message: "late" },
        },
      ];

      for (const event of lateEvents) {
        expect(orchestrationReducer(terminalState, event)).toBe(terminalState);
      }
    },
  );

  it("allows only timeout output deltas and completion after its run completed", () => {
    const completedRun = reduce([
      ...pendingEvents(),
      { type: "task.timeout", runId, at: 1_005, taskId: "task-consulting" },
      { type: "run.completed", runId, at: 1_006 },
    ]);
    const withDelta = orchestrationReducer(completedRun, {
      type: "task.output.delta",
      runId,
      at: 1_007,
      taskId: "task-consulting",
      delta: "late stream",
    });
    const state = orchestrationReducer(withDelta, {
      type: "task.completed",
      runId,
      at: 1_008,
      taskId: "task-consulting",
      result: { output: "late result", summary: "Late result", sources: [] },
    });

    expect(withDelta.tasks["task-consulting"]?.output).toBe("late stream");
    expect(state.status).toBe("completed");
    expect(state.tasks["task-consulting"]?.status).toBe("done");
    expect(state.tasks["task-consulting"]?.output).toBe("late result");
  });

  it("rejects all other existing-task events after a run completed", () => {
    const completedRun = reduce([
      ...pendingEvents(),
      { type: "task.timeout", runId, at: 1_005, taskId: "task-consulting" },
      { type: "task.started", runId, at: 1_005, taskId: "task-taxiq" },
      { type: "run.completed", runId, at: 1_006 },
    ]);
    const forbiddenEvents: OrchestrationEvent[] = [
      { type: "task.started", runId, at: 1_007, taskId: "task-consulting" },
      {
        type: "task.progress",
        runId,
        at: 1_007,
        taskId: "task-consulting",
        text: "late progress",
      },
      {
        type: "task.failed",
        runId,
        at: 1_007,
        taskId: "task-consulting",
        error: { code: "LATE", message: "late" },
      },
      { type: "task.cancelled", runId, at: 1_007, taskId: "task-consulting" },
      { type: "task.timeout", runId, at: 1_007, taskId: "task-taxiq" },
      {
        type: "task.output.delta",
        runId,
        at: 1_007,
        taskId: "task-taxiq",
        delta: "non-timeout delta",
      },
      {
        type: "task.completed",
        runId,
        at: 1_007,
        taskId: "task-taxiq",
        result: { output: "non-timeout result", summary: "Late", sources: [] },
      },
    ];

    for (const event of forbiddenEvents) {
      expect(orchestrationReducer(completedRun, event)).toBe(completedRun);
    }
  });

  it("reopens a completed compound run when a new retry task is registered", () => {
    const completedRun = reduce([
      ...pendingEvents(),
      {
        type: "task.failed",
        runId,
        at: 1_005,
        taskId: "task-consulting",
        error: { code: "FAILED", message: "failed" },
      },
      {
        type: "task.completed",
        runId,
        at: 1_006,
        taskId: "task-taxiq",
        result: { output: "tax", summary: "tax", sources: [] },
      },
      {
        type: "aggregation.started",
        runId,
        at: 1_007,
        usedTaskIds: ["task-taxiq"],
      },
      {
        type: "aggregation.completed",
        runId,
        at: 1_008,
        output: "previous answer",
      },
      { type: "run.completed", runId, at: 1_009 },
    ]);
    const state = orchestrationReducer(completedRun, {
      type: "task.pending",
      runId,
      at: 1_010,
      task: pendingTask("task-consulting-retry"),
    });

    expect(state.status).toBe("running");
    expect(state).not.toHaveProperty("completedAt");
    expect(state.tasks["task-consulting-retry"]?.status).toBe("pending");
    expect(state.tasks["task-consulting"]?.status).toBe("error");
    expect(state.taskOrder).toEqual([
      "task-consulting",
      "task-taxiq",
      "task-consulting-retry",
    ]);
    expect(state.aggregation.status).toBe("waiting");
    expect(state.aggregation.output).toBe("previous answer");
  });

  it("does not reopen a completed run for a duplicate pending id", () => {
    const completedRun = reduce([
      ...pendingEvents(),
      { type: "run.completed", runId, at: 1_006 },
    ]);
    const state = orchestrationReducer(completedRun, {
      type: "task.pending",
      runId,
      at: 1_007,
      task: { ...pendingTask("task-consulting"), title: "duplicate retry" },
    });

    expect(state).toBe(completedRun);
    expect(state.status).toBe("completed");
  });

  it("keeps unknown lifecycle events sealed until a new pending task arrives", () => {
    const completedRun = reduce([
      ...pendingEvents(),
      { type: "run.completed", runId, at: 1_006 },
    ]);
    const unknownEvents: OrchestrationEvent[] = [
      { type: "task.started", runId, at: 1_007, taskId: "unknown-retry" },
      {
        type: "task.completed",
        runId,
        at: 1_008,
        taskId: "unknown-retry",
        result: { output: "hidden", summary: "hidden", sources: [] },
      },
    ];

    for (const event of unknownEvents) {
      expect(orchestrationReducer(completedRun, event)).toBe(completedRun);
    }
  });

  it("reopens a single-agent run without changing aggregation to waiting", () => {
    const singlePlan: ExecutionPlan = {
      ...plan,
      intent: "single",
      tasks: [plan.tasks[0]!],
      aggregationRequired: false,
    };
    const completedRun = [
      { type: "plan.completed", runId, at: 1_001, plan: singlePlan },
      { type: "task.pending", runId, at: 1_002, task: pendingTask("old-task") },
      {
        type: "aggregation.completed",
        runId,
        at: 1_003,
        output: "existing direct output",
      },
      { type: "run.completed", runId, at: 1_004 },
    ].reduce(
      orchestrationReducer,
      createRunState(runId, "message-1", 1_000),
    );
    const state = orchestrationReducer(completedRun, {
      type: "task.pending",
      runId,
      at: 1_005,
      task: pendingTask("retry-task"),
    });

    expect(state.status).toBe("running");
    expect(state.aggregation.status).toBe("done");
    expect(state.aggregation.output).toBe("existing direct output");
  });

  it.each(["cancelled", "error"] as const)(
    "ignores every later task event after a run is %s",
    (terminalStatus) => {
      const terminalEvent: OrchestrationEvent =
        terminalStatus === "cancelled"
          ? { type: "run.cancelled", runId, at: 1_006 }
          : {
              type: "run.failed",
              runId,
              at: 1_006,
              error: { code: "RUN_FAILED", message: "failed" },
            };
      const terminalRun = reduce([
        ...pendingEvents(),
        { type: "task.timeout", runId, at: 1_005, taskId: "task-consulting" },
        terminalEvent,
      ]);
      const lateEvents: OrchestrationEvent[] = [
        { type: "task.pending", runId, at: 1_007, task: pendingTask("late-task") },
        { type: "task.started", runId, at: 1_007, taskId: "task-consulting" },
        {
          type: "task.progress",
          runId,
          at: 1_007,
          taskId: "task-consulting",
          text: "late progress",
        },
        {
          type: "task.output.delta",
          runId,
          at: 1_007,
          taskId: "task-consulting",
          delta: "late delta",
        },
        {
          type: "task.completed",
          runId,
          at: 1_007,
          taskId: "task-consulting",
          result: { output: "late result", summary: "Late", sources: [] },
        },
        {
          type: "task.failed",
          runId,
          at: 1_007,
          taskId: "task-consulting",
          error: { code: "LATE", message: "late" },
        },
        { type: "task.cancelled", runId, at: 1_007, taskId: "task-consulting" },
        { type: "task.timeout", runId, at: 1_007, taskId: "task-consulting" },
      ];

      for (const event of lateEvents) {
        expect(orchestrationReducer(terminalRun, event)).toBe(terminalRun);
      }
    },
  );

  it("ignores unknown task lifecycle events instead of buffering them", () => {
    const initial = createRunState(runId, "message-1", 1_000);
    const earlyCompletion = orchestrationReducer(initial, {
      type: "task.completed",
      runId,
      at: 1_001,
      taskId: "task-consulting",
      result: { output: "too early", summary: "Too early", sources: [] },
    });
    const state = orchestrationReducer(earlyCompletion, {
      type: "task.pending",
      runId,
      at: 1_002,
      task: pendingTask("task-consulting"),
    });

    expect(earlyCompletion).toBe(initial);
    expect(state.tasks["task-consulting"]?.status).toBe("pending");
    expect(state.tasks["task-consulting"]?.output).toBe("");
  });

  it("ignores events from another run", () => {
    const initial = createRunState(runId, "message-1", 1_000);
    const state = orchestrationReducer(initial, {
      type: "task.pending",
      runId: "run-2",
      at: 1_001,
      task: pendingTask("foreign-task"),
    });

    expect(state).toBe(initial);
  });
});
