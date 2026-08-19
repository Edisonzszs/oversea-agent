import type {
  AgentRunState,
  AgentTaskState,
  OrchestrationEvent,
  TaskStatus,
} from "./types";

const IMMUTABLE_TERMINAL_TASK_STATUSES = new Set<TaskStatus>([
  "done",
  "error",
  "cancelled",
]);

export function createRunState(
  runId: string,
  messageId: string,
  startedAt: number,
): AgentRunState {
  return {
    runId,
    messageId,
    status: "planning",
    tasks: {},
    taskOrder: [],
    aggregation: {
      status: "idle",
      output: "",
      usedTaskIds: [],
    },
    startedAt,
  };
}

function updateTask(
  state: AgentRunState,
  taskId: string,
  update: (task: AgentTaskState) => AgentTaskState,
): AgentRunState {
  const task = state.tasks[taskId];
  // Scheduler protocol requires task.pending to synchronously register metadata
  // before async lifecycle events. Unknown tasks are ignored, never buffered.
  if (!task) return state;
  const updatedTask = update(task);
  if (updatedTask === task) return state;

  return {
    ...state,
    tasks: {
      ...state.tasks,
      [taskId]: updatedTask,
    },
  };
}

function isImmutableTerminal(task: AgentTaskState): boolean {
  return IMMUTABLE_TERMINAL_TASK_STATUSES.has(task.status);
}

export function orchestrationReducer(
  state: AgentRunState,
  event: OrchestrationEvent,
): AgentRunState {
  if (event.runId !== state.runId) return state;
  if (state.status === "cancelled" || state.status === "error") return state;
  if (state.status === "completed") {
    const isNewRetry =
      event.type === "task.pending" && !state.tasks[event.task.id];
    if (!isNewRetry) {
      if (event.type !== "task.output.delta" && event.type !== "task.completed") {
        return state;
      }
      if (state.tasks[event.taskId]?.status !== "timeout") return state;
    }
  }

  switch (event.type) {
    case "run.started":
      return {
        ...state,
        messageId: event.messageId,
        status: "planning",
        startedAt: event.at,
      };

    case "plan.started":
      return { ...state, status: "planning" };

    case "plan.completed":
      return {
        ...state,
        status: "running",
        plan: event.plan,
        aggregation: {
          ...state.aggregation,
          status: event.plan.aggregationRequired ? "waiting" : "idle",
        },
      };

    case "task.pending":
      if (state.tasks[event.task.id]) return state;
      if (state.status === "completed") {
        const { completedAt: _completedAt, ...reopenedState } = state;
        return {
          ...reopenedState,
          status: "running",
          tasks: {
            ...state.tasks,
            [event.task.id]: event.task,
          },
          taskOrder: [...state.taskOrder, event.task.id],
          aggregation: state.plan?.aggregationRequired
            ? { ...state.aggregation, status: "waiting" }
            : state.aggregation,
        };
      }
      return {
        ...state,
        tasks: {
          ...state.tasks,
          [event.task.id]: event.task,
        },
        taskOrder: [...state.taskOrder, event.task.id],
      };

    case "task.started":
      return updateTask(state, event.taskId, (task) =>
        isImmutableTerminal(task) || task.status === "timeout"
          ? task
          : { ...task, status: "running", startedAt: event.at },
      );

    case "task.progress":
      return updateTask(state, event.taskId, (task) =>
        isImmutableTerminal(task) || task.status === "timeout"
          ? task
          : {
              ...task,
              status: "running",
              progress: [...task.progress, event.text],
            },
      );

    case "task.output.delta":
      return updateTask(state, event.taskId, (task) =>
        task.status === "running" || task.status === "timeout"
          ? { ...task, output: task.output + event.delta }
          : task,
      );

    case "task.completed":
      return updateTask(state, event.taskId, (task) =>
        isImmutableTerminal(task)
          ? task
          : {
              ...task,
              status: "done",
              output: event.result.output,
              summary: event.result.summary,
              sources: event.result.sources,
              completedAt: event.at,
            },
      );

    case "task.timeout":
      return updateTask(state, event.taskId, (task) =>
        isImmutableTerminal(task)
          ? task
          : { ...task, status: "timeout", timedOutAt: event.at },
      );

    case "task.failed":
      return updateTask(state, event.taskId, (task) =>
        isImmutableTerminal(task)
          ? task
          : {
              ...task,
              status: "error",
              error: event.error,
              completedAt: event.at,
            },
      );

    case "task.cancelled":
      return updateTask(state, event.taskId, (task) =>
        isImmutableTerminal(task)
          ? task
          : { ...task, status: "cancelled", completedAt: event.at },
      );

    case "aggregation.started":
      return {
        ...state,
        status: "aggregating",
        aggregation: {
          status: "streaming",
          output: "",
          usedTaskIds: event.usedTaskIds,
        },
      };

    case "aggregation.output.delta":
      return {
        ...state,
        aggregation: {
          ...state.aggregation,
          status: "streaming",
          output: state.aggregation.output + event.delta,
        },
      };

    case "aggregation.completed":
      return {
        ...state,
        aggregation: {
          ...state.aggregation,
          status: "done",
          output: event.output,
        },
      };

    case "aggregation.failed":
      return {
        ...state,
        status: "error",
        aggregation: {
          ...state.aggregation,
          status: "error",
          error: event.error,
        },
      };

    case "run.completed":
      return { ...state, status: "completed", completedAt: event.at };

    case "run.cancelled":
      return { ...state, status: "cancelled" };

    case "run.failed":
      return { ...state, status: "error" };
  }
}
