import type { AgentAdapter, AgentTaskInput } from "../agents/types";
import type {
  AgentError,
  AgentId,
  AgentTaskState,
  ExecutionPlan,
  OrchestrationEvent,
  PlannedTask,
} from "./types";

interface SchedulerOptions {
  runId: string;
  plan: ExecutionPlan;
  registry: Map<AgentId, AgentAdapter>;
  input: AgentTaskInput;
  signal: AbortSignal;
  emit: (event: OrchestrationEvent) => void;
  timeoutMs?: number;
  now?: () => number;
  createTaskId?: (agentId: AgentId, attempt: number) => string;
}

type SchedulerEvent = OrchestrationEvent extends infer Event
  ? Event extends OrchestrationEvent
    ? Omit<Event, "runId" | "at">
    : never
  : never;

export interface ScheduledExecution {
  readyForAggregation: Promise<string[]>;
  allSettled: Promise<void>;
  retry(taskId: string): Promise<string>;
}

interface TaskAttempt {
  id: string;
  plannedTask: PlannedTask;
  kind: "initial" | "retry";
  status: "active" | "done" | "error" | "timeout" | "cancelled";
  controller: AbortController;
  timeoutId?: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const TAXIQ_TIMEOUT_MS = 75_000;

function toAgentError(error: unknown): AgentError {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    const detail =
      "detail" in error && typeof error.detail === "string"
        ? error.detail
        : undefined;
    return detail
      ? { code: error.code, message: error.message, detail }
      : { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return {
      code: "agent_request_failed",
      message: "专业智能体暂时不可用",
      detail: error.message,
    };
  }
  return { code: "unknown", message: "专业智能体暂时不可用" };
}

function defaultTaskId(agentId: AgentId, attempt: number): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${agentId}-${attempt}-${suffix}`;
}

function isActive(attempt: TaskAttempt): boolean {
  return attempt.status === "active";
}

export function runScheduledTasks(options: SchedulerOptions): ScheduledExecution {
  const now = options.now ?? Date.now;
  const createTaskId = options.createTaskId ?? defaultTaskId;
  const attempts = new Map<string, TaskAttempt>();
  const initialTaskIds: string[] = [];
  const attemptNumber = new Map<AgentId, number>();

  let resolveAggregation!: (taskIds: string[]) => void;
  let aggregationReady = false;
  const readyForAggregation = new Promise<string[]>((resolve) => {
    resolveAggregation = resolve;
  });

  const emit = (event: SchedulerEvent) => {
    try {
      options.emit({ ...event, runId: options.runId, at: now() } as OrchestrationEvent);
    } catch {
      // Event observers are presentation-side effects. Their failures must not
      // change the professional task's lifecycle or create a false task.failed.
    }
  };

  const createAttempt = (
    plannedTask: PlannedTask,
    kind: TaskAttempt["kind"],
  ): TaskAttempt => {
    const attempt = (attemptNumber.get(plannedTask.agentId) ?? 0) + 1;
    attemptNumber.set(plannedTask.agentId, attempt);
    const id = createTaskId(plannedTask.agentId, attempt);
    const task: AgentTaskState = {
      ...plannedTask,
      id,
      status: "pending",
      output: "",
      progress: [],
      sources: [],
    };
    const record: TaskAttempt = {
      id,
      plannedTask,
      kind,
      status: "active",
      controller: new AbortController(),
    };
    attempts.set(id, record);
    emit({ type: "task.pending", task });
    return record;
  };

  const initialAttempts = options.plan.tasks.map((plannedTask) =>
    createAttempt(plannedTask, "initial"),
  );
  initialTaskIds.push(...initialAttempts.map((attempt) => attempt.id));

  const completedInitialIds = () =>
    initialTaskIds.filter((taskId) => attempts.get(taskId)?.status === "done");
  const openAggregationGate = () => {
    if (aggregationReady) return;
    aggregationReady = true;
    resolveAggregation(completedInitialIds());
  };
  const allInitialSettled = () =>
    initialTaskIds.every((taskId) => attempts.get(taskId)?.status !== "active");

  const timeoutFor = (attempt: TaskAttempt) =>
    options.timeoutMs ??
    (attempt.plannedTask.agentId === "taxiq"
      ? TAXIQ_TIMEOUT_MS
      : DEFAULT_TIMEOUT_MS);

  const startAttemptTimeout = (attempt: TaskAttempt) => {
    if (!isActive(attempt) || options.signal.aborted) return;
    if (attempt.timeoutId !== undefined) return;
    attempt.timeoutId = setTimeout(() => {
      if (attempt.status === "active") {
        attempt.status = "timeout";
        emit({ type: "task.timeout", taskId: attempt.id });
        attempt.controller.abort();
      }
    }, timeoutFor(attempt));
  };

  const consumeAttempt = async (attempt: TaskAttempt): Promise<void> => {
    const adapter = options.registry.get(attempt.plannedTask.agentId);
    if (attempt.status !== "active") return;
    emit({ type: "task.started", taskId: attempt.id });
    startAttemptTimeout(attempt);
    try {
      if (!adapter) throw new Error(`未找到专业智能体: ${attempt.plannedTask.agentId}`);
      const taskInput: AgentTaskInput = {
        ...options.input,
        instruction: attempt.plannedTask.instruction,
      };
      for await (const event of adapter.run(taskInput, {
        signal: attempt.controller.signal,
      })) {
        if (attempt.status !== "active") break;
        if (event.type === "progress") {
          emit({ type: "task.progress", taskId: attempt.id, text: event.text });
        } else if (event.type === "output.delta") {
          emit({ type: "task.output.delta", taskId: attempt.id, delta: event.delta });
        } else {
          attempt.status = "done";
          emit({ type: "task.completed", taskId: attempt.id, result: event.result });
          break;
        }
      }
      if (attempt.status === "active") {
        throw new Error("专业智能体未返回完成事件");
      }
    } catch (error) {
      if (!isActive(attempt)) return;
      attempt.status = "error";
      emit({
        type: "task.failed",
        taskId: attempt.id,
        error: toAgentError(error),
      });
    }
  };

  const runAttempt = async (attempt: TaskAttempt): Promise<void> => {
    if (attempt.status !== "active") return;
    let resolveCancelled!: () => void;
    const cancelled = new Promise<void>((resolve) => {
      resolveCancelled = resolve;
    });
    const onAttemptAbort = () => resolveCancelled();
    attempt.controller.signal.addEventListener("abort", onAttemptAbort, {
      once: true,
    });
    const consumed = consumeAttempt(attempt);
    try {
      await Promise.race([consumed, cancelled]);
    } finally {
      attempt.controller.signal.removeEventListener("abort", onAttemptAbort);
      if (attempt.timeoutId !== undefined) clearTimeout(attempt.timeoutId);
      if (allInitialSettled()) openAggregationGate();
    }
  };

  const onParentAbort = () => {
    const activeAttempts = [...attempts.values()].filter(
      (attempt) => attempt.status === "active",
    );
    for (const attempt of activeAttempts) {
      attempt.status = "cancelled";
      emit({ type: "task.cancelled", taskId: attempt.id });
    }
    for (const attempt of activeAttempts) attempt.controller.abort();
    for (const attempt of activeAttempts) {
      if (attempt.timeoutId !== undefined) clearTimeout(attempt.timeoutId);
    }
    openAggregationGate();
  };
  options.signal.addEventListener("abort", onParentAbort, { once: true });
  if (options.signal.aborted) {
    onParentAbort();
    options.signal.removeEventListener("abort", onParentAbort);
  }

  const allSettled = Promise.resolve()
    .then(() => Promise.allSettled(initialAttempts.map(runAttempt)))
    .then(() => {
      openAggregationGate();
    });

  if (initialAttempts.length === 0) {
    options.signal.removeEventListener("abort", onParentAbort);
    openAggregationGate();
  }

  return {
    readyForAggregation,
    allSettled,
    async retry(taskId: string) {
      if (options.signal.aborted) {
        throw new DOMException("The operation was aborted", "AbortError");
      }
      const previous = attempts.get(taskId);
      if (!previous) throw new Error(`未找到待重试任务: ${taskId}`);
      const retryAttempt = createAttempt(previous.plannedTask, "retry");
      void Promise.resolve().then(() => runAttempt(retryAttempt));
      return retryAttempt.id;
    },
  };
}
