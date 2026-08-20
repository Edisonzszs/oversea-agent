import { ORCHESTRATOR_AGGREGATION_PROMPT } from "../../app/prompts/systemPrompts";
import { streamChatCompletion } from "../../app/services/deepseekApi";
import type { AgentId, AgentResult, AgentSource } from "./types";

export interface CompletedAgentResult {
  taskId: string;
  agentId: AgentId;
  agentName: string;
  result: AgentResult;
}

export interface UnavailableAgentResult {
  agentId: AgentId;
  agentName: string;
  reason: string;
}

export type AggregateCompletion = (
  prompt: string,
  signal: AbortSignal,
  onDelta: (delta: string) => void,
) => Promise<string>;

export interface AggregateResultsOptions {
  question: string;
  completed: CompletedAgentResult[];
  unavailable: UnavailableAgentResult[];
  signal: AbortSignal;
  onDelta: (delta: string) => void;
  complete?: AggregateCompletion;
}

const defaultCompletion: AggregateCompletion = (prompt, signal, onDelta) =>
  streamChatCompletion({
    messages: [{ role: "user", content: prompt }],
    systemPrompt: ORCHESTRATOR_AGGREGATION_PROMPT,
    temperature: 0.2,
    maxTokens: 3000,
    onChunk: onDelta,
    signal,
  });

export async function aggregateResults(
  options: AggregateResultsOptions,
): Promise<string> {
  throwIfAborted(options.signal);

  const usable = options.completed.filter(({ result }) => result.output.trim());
  const emptyResults = options.completed
    .filter(({ result }) => !result.output.trim())
    .map(({ agentId, agentName }) => ({
      agentId,
      agentName,
      reason: "未返回有效内容",
    }));
  const unavailable = [...options.unavailable, ...emptyResults];

  if (usable.length === 0) {
    const output = buildNoResultMessage(unavailable);
    options.onDelta(output);
    return output;
  }

  if (usable.length === 1) {
    const output = buildSingleResult(usable[0]!, unavailable);
    options.onDelta(output);
    return output;
  }

  const prompt = buildAggregationInput(options.question, usable, unavailable);
  let streamedOutput = "";
  const output = await (options.complete ?? defaultCompletion)(
    prompt,
    options.signal,
    (delta) => {
      streamedOutput += delta;
      options.onDelta(delta);
    },
  );
  throwIfAborted(options.signal);
  if (output.trim()) return output;
  if (streamedOutput.trim()) return streamedOutput;

  const fallback = buildEmptyAggregationFallback(usable, unavailable);
  options.onDelta(fallback);
  return fallback;
}

function buildNoResultMessage(unavailable: UnavailableAgentResult[]): string {
  const list = unavailable.length
    ? unavailable
        .map(({ agentName, reason }) => `- ${agentName}（${reason}）`)
        .join("\n")
    : "- 本次未收到专业智能体的有效返回";
  return `暂时未获得可用的专业结果，本次不生成专业答复。\n\n不可用能力：\n${list}\n\n建议稍后重试全部任务，或单独重试失败的专业智能体。`;
}

function buildSingleResult(
  completed: CompletedAgentResult,
  unavailable: UnavailableAgentResult[],
): string {
  const sources = formatSources(completed.result.sources);
  const gap = formatUnavailableGap(unavailable);
  return [
    completed.result.output.trim(),
    sources ? `\n\n来源（${completed.agentName}）：\n${sources}` : "",
    gap,
  ].join("");
}

function buildAggregationInput(
  question: string,
  completed: CompletedAgentResult[],
  unavailable: UnavailableAgentResult[],
): string {
  return JSON.stringify({
    policy: ORCHESTRATOR_AGGREGATION_PROMPT,
    question,
    completed,
    unavailable,
  });
}

function buildEmptyAggregationFallback(
  completed: CompletedAgentResult[],
  unavailable: UnavailableAgentResult[],
): string {
  const evidence = completed
    .map(
      ({ agentName, result }) =>
        `### ${agentName}\n${result.output.trim()}${
          result.sources.length ? `\n\n来源：\n${formatSources(result.sources)}` : ""
        }`,
    )
    .join("\n\n");
  return `聚合服务暂时未返回有效内容。下面保留各专业智能体的原始结果，请在重新整合前核对它们之间可能存在的差异。\n\n${evidence}${formatUnavailableGap(unavailable)}`;
}

function formatUnavailableGap(unavailable: UnavailableAgentResult[]): string {
  if (!unavailable.length) return "";
  return `\n\n信息缺口：${unavailable
    .map(({ agentName, reason }) => `${agentName}（${reason}）`)
    .join("、")}未能提供结果，当前答复可能不完整。`;
}

function formatSources(sources: AgentSource[]): string {
  return sources.map(formatSource).join("\n");
}

function formatSource(source: AgentSource): string {
  return source.url ? `- ${source.title}: ${source.url}` : `- ${source.title}`;
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  if (signal.reason !== undefined) throw signal.reason;
  throw new DOMException("The operation was aborted", "AbortError");
}
