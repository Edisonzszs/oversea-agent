import type { AgentId, AgentResult } from "../../shared/orchestration/types";

export interface AgentTaskInput {
  question: string;
  instruction: string;
  conversation: Array<{ role: string; content: string }>;
}

export type AgentAdapterEvent =
  | { type: "progress"; text: string }
  | { type: "output.delta"; delta: string }
  | { type: "completed"; result: AgentResult };

export interface AgentRunContext {
  signal: AbortSignal;
}

export interface AgentAdapter {
  id: AgentId;
  name: string;
  capabilities: string[];
  run(
    input: AgentTaskInput,
    context: AgentRunContext,
  ): AsyncIterable<AgentAdapterEvent>;
}
