import { normalizeApiError, streamReasoningChat } from "../../services/deepseekApi";
import { createEventStream } from "../eventStream";
import type { AgentAdapter, AgentAdapterEvent } from "../types";

const SYSTEM_PROMPT = `你是面向上海企业的出海政策与公共服务咨询专家。
请聚焦海外经营政策、公共服务资源、办事路径和风险提示，给出准确、清晰、可执行的答复。
不要输出内部推理过程；不确定的信息应明确说明，并建议向相应主管部门核实。
回答末尾单独一行输出推荐引导话题：[QUICK_QUESTIONS: 话题1|话题2|话题3]
- 每个话题是简短的行动引导短语，用"帮我了解…""告诉我…""介绍一下…"开头，不用疑问句式
- 提供 3 个与当前话题相关的引导话题；若该答复不适合引导（如寒暄/免责说明）则省略此行`;

function summaryOf(output: string): string {
  return output.trim().slice(0, 160);
}

export const consultingAgent: AgentAdapter = {
  id: "consulting",
  name: "出海咨询智能体",
  capabilities: ["海外政策咨询", "公共服务指引"],
  async *run(input, context): AsyncIterable<AgentAdapterEvent> {
    yield { type: "progress", text: "正在梳理政策与公共服务信息" };

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
