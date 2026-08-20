import { createAgentRegistry } from "../../app/agents/registry";
import type { AgentAdapter } from "../../app/agents/types";
import { normalizeApiError } from "../../app/services/deepseekApi";
import {
  aggregateResults,
  type AggregateResultsOptions,
  type CompletedAgentResult,
  type UnavailableAgentResult,
} from "./aggregator";
import {
  createExecutionPlan,
  deepseekPlannerDeps,
} from "./planner";
import { runScheduledTasks, type ScheduledExecution } from "./scheduler";
import type {
  AgentError,
  AgentId,
  AgentResult,
  ExecutionPlan,
  OrchestrationEvent,
} from "./types";

type Planner = (
  question: string,
  signal: AbortSignal,
) => Promise<ExecutionPlan>;
type Aggregator = (options: AggregateResultsOptions) => Promise<string>;

export interface OrchestratorDeps {
  planner?: Planner;
  registry?: Map<AgentId, AgentAdapter>;
  aggregate?: Aggregator;
  runId?: () => string;
  now?: () => number;
  timeoutMs?: number;
  createTaskId?: (agentId: AgentId, attempt: number) => string;
}

export interface RunOrchestrationOptions {
  question: string;
  messageId: string;
  conversation: Array<{ role: string; content: string }>;
  signal: AbortSignal;
  onEvent(event: OrchestrationEvent): void;
  deps?: OrchestratorDeps;
}

interface TrackedTask {
  agentId: AgentId;
  agentName: string;
  result?: AgentResult;
  unavailableReason?: string;
}

interface RuntimeExecution {
  scheduled: ScheduledExecution;
  initialTaskIds: Set<string>;
  activeRetryTaskIds: Set<string>;
}

const MAX_RUNTIME_EXECUTIONS = 50;
const runtimeExecutions = new Map<string, RuntimeExecution>();

export async function retryOrchestrationTask(
  runId: string,
  taskId: string,
): Promise<string> {
  const runtime = runtimeExecutions.get(runId);
  if (!runtime) throw new Error(`未找到可重试的智能体运行: ${runId}`);
  return runtime.scheduled.retry(taskId);
}

export async function runOrchestration(
  options: RunOrchestrationOptions,
): Promise<{ runId: string; output: string }> {
  const deps = options.deps ?? {};
  const runId = (deps.runId ?? defaultRunId)();
  const now = deps.now ?? Date.now;
  const registry = deps.registry ?? createAgentRegistry();
  const planner =
    deps.planner ??
    ((question, signal) =>
      createExecutionPlan(question, signal, deepseekPlannerDeps));
  const aggregate = deps.aggregate ?? aggregateResults;
  const emit = <Event extends OrchestrationEvent>(
    event: Omit<Event, "runId" | "at">,
  ) => {
    try {
      options.onEvent({ ...event, runId, at: now() } as Event);
    } catch {
      // UI/event observers cannot determine orchestration success or failure.
    }
  };

  emit<Extract<OrchestrationEvent, { type: "run.started" }>>({
    type: "run.started",
    messageId: options.messageId,
  });

  try {
    throwIfAborted(options.signal);
    emit<Extract<OrchestrationEvent, { type: "plan.started" }>>({
      type: "plan.started",
    });
    const plan = await planner(options.question, options.signal);
    throwIfAborted(options.signal);
    emit<Extract<OrchestrationEvent, { type: "plan.completed" }>>({
      type: "plan.completed",
      plan,
    });

    if (isDirectPlan(plan)) {
      const output = plan.directAnswer ?? defaultDirectAnswer(plan.intent);
      emit<Extract<OrchestrationEvent, { type: "run.completed" }>>({
        type: "run.completed",
      });
      return { runId, output };
    }

    const tracked = new Map<string, TrackedTask>();
    let runtime: RuntimeExecution | undefined;
    const forwardSchedulerEvent = (event: OrchestrationEvent) => {
      if (event.type === "task.pending") {
        tracked.set(event.task.id, {
          agentId: event.task.agentId,
          agentName:
            registry.get(event.task.agentId)?.name ?? event.task.agentId,
        });
      } else if (event.type === "task.completed") {
        const task = tracked.get(event.taskId);
        if (task) {
          task.result = event.result;
          delete task.unavailableReason;
        }
      } else if (event.type === "task.timeout") {
        const task = tracked.get(event.taskId);
        if (task) task.unavailableReason = "等待超时";
      } else if (event.type === "task.failed") {
        const task = tracked.get(event.taskId);
        if (task) task.unavailableReason = event.error.message;
      } else if (event.type === "task.cancelled") {
        const task = tracked.get(event.taskId);
        if (task) task.unavailableReason = "已取消";
      }
      let shouldCompleteRetryRun = false;
      if (runtime) {
        if (
          event.type === "task.pending" &&
          !runtime.initialTaskIds.has(event.task.id)
        ) {
          runtime.activeRetryTaskIds.add(event.task.id);
        } else if (
          (event.type === "task.completed" ||
            event.type === "task.failed" ||
            event.type === "task.timeout" ||
            event.type === "task.cancelled") &&
          runtime.activeRetryTaskIds.delete(event.taskId) &&
          runtime.activeRetryTaskIds.size === 0
        ) shouldCompleteRetryRun = true;
      }
      try {
        options.onEvent(event);
      } catch {
        // Scheduler observers are presentation-side effects.
      }
      if (shouldCompleteRetryRun) {
        emit<Extract<OrchestrationEvent, { type: "run.completed" }>>({
          type: "run.completed",
        });
      }
    };

    const scheduled = runScheduledTasks({
      runId,
      plan,
      registry,
      input: {
        question: options.question,
        instruction: "",
        conversation: options.conversation,
      },
      signal: options.signal,
      emit: forwardSchedulerEvent,
      ...(deps.timeoutMs !== undefined ? { timeoutMs: deps.timeoutMs } : {}),
      now,
      ...(deps.createTaskId ? { createTaskId: deps.createTaskId } : {}),
    });
    runtime = {
      scheduled,
      initialTaskIds: new Set(tracked.keys()),
      activeRetryTaskIds: new Set(),
    };
    registerRuntimeExecution(runId, runtime);

    const usedTaskIds = await scheduled.readyForAggregation;
    throwIfAborted(options.signal);
    const used = new Set(usedTaskIds);
    const completed: CompletedAgentResult[] = [];
    const unavailable: UnavailableAgentResult[] = [];
    for (const [taskId, task] of tracked) {
      if (used.has(taskId) && task.result?.output.trim()) {
        completed.push({
          taskId,
          agentId: task.agentId,
          agentName: task.agentName,
          result: task.result,
        });
      } else {
        unavailable.push({
          agentId: task.agentId,
          agentName: task.agentName,
          reason:
            task.unavailableReason ??
            (task.result ? "未返回有效内容" : "未按时返回"),
        });
      }
    }

    emit<Extract<OrchestrationEvent, { type: "aggregation.started" }>>({
      type: "aggregation.started",
      usedTaskIds,
    });
    let output: string;
    try {
      output = await aggregate({
        question: options.question,
        completed,
        unavailable,
        signal: options.signal,
        onDelta(delta) {
          emit<Extract<OrchestrationEvent, { type: "aggregation.output.delta" }>>({
            type: "aggregation.output.delta",
            delta,
          });
        },
      });
      throwIfAborted(options.signal);
    } catch (error) {
      if (options.signal.aborted || isAbortError(error)) throw error;
      emit<Extract<OrchestrationEvent, { type: "aggregation.failed" }>>({
        type: "aggregation.failed",
        error: toAggregationError(error),
      });
      throw error;
    }
    emit<Extract<OrchestrationEvent, { type: "aggregation.completed" }>>({
      type: "aggregation.completed",
      output,
    });
    emit<Extract<OrchestrationEvent, { type: "run.completed" }>>({
      type: "run.completed",
    });
    return { runId, output };
  } catch (error) {
    if (options.signal.aborted || isAbortError(error)) {
      emit<Extract<OrchestrationEvent, { type: "run.cancelled" }>>({
        type: "run.cancelled",
      });
      throw abortReason(options.signal, error);
    }
    emit<Extract<OrchestrationEvent, { type: "run.failed" }>>({
      type: "run.failed",
      error: toOrchestrationError(error),
    });
    throw error;
  }
}

function registerRuntimeExecution(
  runId: string,
  runtime: RuntimeExecution,
): void {
  runtimeExecutions.delete(runId);
  runtimeExecutions.set(runId, runtime);
  while (runtimeExecutions.size > MAX_RUNTIME_EXECUTIONS) {
    const oldestRunId = runtimeExecutions.keys().next().value as string | undefined;
    if (!oldestRunId) break;
    runtimeExecutions.delete(oldestRunId);
  }
}

function isDirectPlan(plan: ExecutionPlan): boolean {
  return (
    plan.tasks.length === 0 &&
    (plan.intent === "direct" ||
      plan.intent === "irrelevant" ||
      plan.intent === "sensitive")
  );
}

function defaultDirectAnswer(intent: ExecutionPlan["intent"]): string {
  return intent === "direct"
    ? "您好，我是出海协同智能体。请告诉我您的企业出海需求。"
    : "抱歉，您咨询的内容暂不属于本平台当前智能问答服务范围。";
}

function defaultRunId(): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `run-${suffix}`;
}

function toAggregationError(error: unknown): AgentError {
  const normalized = normalizeApiError(error);
  return {
    ...normalized,
    code: "aggregation_failed",
    message: "专业结果暂时无法整合",
  };
}

function toOrchestrationError(error: unknown): AgentError {
  const normalized = normalizeApiError(error);
  return {
    ...normalized,
    code: "orchestration_failed",
    message: "出海协同智能体暂时无法完成本次任务",
  };
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortReason(signal);
}

function abortReason(signal: AbortSignal, fallback?: unknown): unknown {
  if (signal.reason instanceof Error) return signal.reason;
  if (isAbortError(fallback)) return fallback;
  return new DOMException("The operation was aborted", "AbortError");
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === "AbortError"
  ) || (error instanceof Error && error.name === "AbortError");
}
