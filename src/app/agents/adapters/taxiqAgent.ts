import { normalizeApiError } from "../../services/deepseekApi";
import { streamTaxiqChat } from "../../services/taxiqApi";
import type { AgentSource } from "../../orchestration/types";
import { createEventStream } from "../eventStream";
import type { AgentAdapter, AgentAdapterEvent } from "../types";

function summaryOf(output: string): string {
  return output.trim().slice(0, 160);
}

function sourcesFrom(refers: unknown): AgentSource[] {
  const sources: AgentSource[] = [];
  if (!Array.isArray(refers)) return sources;
  for (const refer of refers) {
    let url = "";
    let title = "";
    if (typeof refer === "string") {
      url = refer.trim();
    } else if (typeof refer === "object" && refer !== null) {
      const record = refer as Record<string, unknown>;
      if (typeof record.url !== "string") continue;
      url = record.url.trim();
      if (typeof record.title === "string") title = record.title.trim();
    } else {
      continue;
    }
    if (!url) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      sources.push({ title: title || url, url });
    } catch {
      continue;
    }
  }
  return sources;
}

export const taxiqAgent: AgentAdapter = {
  id: "taxiq",
  name: "国别税策智能体",
  capabilities: ["国别税制查询", "跨境税务风险"],
  async *run(input, context): AsyncIterable<AgentAdapterEvent> {
    yield { type: "progress", text: "正在查询国别税收政策" };

    try {
      let answer = "";
      let sources: AgentSource[] = [];
      const content = createEventStream<string>(async (emit, streamSignal) => {
        const result = await streamTaxiqChat({
          question: input.question,
          onChunk: emit,
          signal: streamSignal,
        });
        answer = result.answer;
        sources = sourcesFrom(result.refers);
      }, context.signal);

      for await (const delta of content) {
        if (delta) yield { type: "output.delta", delta };
      }

      yield {
        type: "completed",
        result: { output: answer, summary: summaryOf(answer), sources },
      };
    } catch (error) {
      throw normalizeApiError(error);
    }
  },
};
