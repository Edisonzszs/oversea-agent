export type AgentId = "consulting" | "taxiq" | "odi";

export type TaskStatus =
  | "pending"
  | "running"
  | "done"
  | "timeout"
  | "error"
  | "cancelled";

export type RunStatus =
  | "planning"
  | "running"
  | "aggregating"
  | "completed"
  | "cancelled"
  | "error";

export interface PlannedTask {
  agentId: AgentId;
  title: string;
  instruction: string;
  expectedOutput: string;
}

export interface ExecutionPlan {
  intent: "direct" | "single" | "compound" | "irrelevant" | "sensitive";
  directAnswerAllowed: boolean;
  tasks: PlannedTask[];
  aggregationRequired: boolean;
  rationaleSummary: string;
  directAnswer?: string;
}

export interface AgentSource {
  title: string;
  url?: string;
}

export interface AgentResult {
  output: string;
  summary: string;
  sources: AgentSource[];
}

export interface AgentError {
  code: string;
  message: string;
  detail?: string;
}

export interface AgentTaskState extends PlannedTask {
  id: string;
  status: TaskStatus;
  output: string;
  progress: string[];
  sources: AgentSource[];
  summary?: string;
  error?: AgentError;
  startedAt?: number;
  completedAt?: number;
  timedOutAt?: number;
}

export interface AggregationState {
  status: "idle" | "waiting" | "streaming" | "done" | "error";
  output: string;
  usedTaskIds: string[];
  error?: AgentError;
}

export interface AgentRunState {
  runId: string;
  messageId: string;
  status: RunStatus;
  tasks: Record<string, AgentTaskState>;
  taskOrder: string[];
  plan?: ExecutionPlan;
  aggregation: AggregationState;
  startedAt: number;
  completedAt?: number;
}

type RunEvent<T extends string, TPayload extends object = Record<never, never>> = {
  type: T;
  runId: string;
  at: number;
} & TPayload;

export type OrchestrationEvent =
  | RunEvent<"run.started", { messageId: string }>
  | RunEvent<"plan.started">
  | RunEvent<"plan.completed", { plan: ExecutionPlan }>
  | RunEvent<"task.pending", { task: AgentTaskState }>
  | RunEvent<"task.started", { taskId: string }>
  | RunEvent<"task.progress", { taskId: string; text: string }>
  | RunEvent<"task.output.delta", { taskId: string; delta: string }>
  | RunEvent<"task.completed", { taskId: string; result: AgentResult }>
  | RunEvent<"task.timeout", { taskId: string }>
  | RunEvent<"task.failed", { taskId: string; error: AgentError }>
  | RunEvent<"task.cancelled", { taskId: string }>
  | RunEvent<"aggregation.started", { usedTaskIds: string[] }>
  | RunEvent<"aggregation.output.delta", { delta: string }>
  | RunEvent<"aggregation.completed", { output: string }>
  | RunEvent<"aggregation.failed", { error: AgentError }>
  | RunEvent<"run.completed">
  | RunEvent<"run.cancelled">
  | RunEvent<"run.failed", { error: AgentError }>;
