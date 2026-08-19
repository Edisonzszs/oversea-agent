import { normalizeApiError, streamReasoningChat } from "../../services/deepseekApi";
import { createEventStream } from "../eventStream";
import type { AgentAdapter, AgentAdapterEvent } from "../types";

const SYSTEM_PROMPT = `你是境外直接投资（ODI）办事专家。
请聚焦 ODI 项目备案或核准、商务部门申报、外汇登记、办理顺序、材料清单和常见补正风险。
仅提供流程与申报指引，不修改任何工作台状态，不输出内部标记或内部推理过程。`;

function summaryOf(output: string): string {
  return output.trim().slice(0, 160);
}

export const odiAgent: AgentAdapter = {
  id: "odi",
  name: "ODI 办事智能体",
  capabilities: ["ODI 流程指引", "申报材料清单"],
  async *run(input, context): AsyncIterable<AgentAdapterEvent> {
    yield { type: "progress", text: "正在梳理 ODI 流程与申报材料" };

    try {
      let output = "";
      const content = createEventStream<string>(async (emit, streamSignal) => {
        const result = await streamReasoningChat({
          messages: [
            ...input.conversation,
            {
              role: "user",
              content: `任务指令：${input.instruction}\n用户问题：${input.question}`,
            },
          ],
          systemPrompt: SYSTEM_PROMPT,
          onContent: emit,
          signal: streamSignal,
        });
        output = result.content;
      }, context.signal);

      for await (const delta of content) {
        if (delta) yield { type: "output.delta", delta };
      }

      yield {
        type: "completed",
        result: { output, summary: summaryOf(output), sources: [] },
      };
    } catch (error) {
      throw normalizeApiError(error);
    }
  },
};
