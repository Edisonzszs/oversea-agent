import { normalizeApiError, streamReasoningChat } from "../../services/deepseekApi";
import { createEventStream } from "../eventStream";
import type { AgentAdapter, AgentAdapterEvent } from "../types";

const SYSTEM_PROMPT = `你是境外直接投资（ODI）办事专家。
请聚焦 ODI 项目备案或核准、商务部门申报、外汇登记、办理顺序、材料清单和常见补正风险。
仅提供流程与申报指引，不修改任何工作台状态，不输出内部标记或内部推理过程。
输出使用简洁的 Markdown：小标题用 ##、要点用 - 列表、关键结论用 **加粗**；不要输出表格。
回答末尾单独一行输出推荐引导话题：[QUICK_QUESTIONS: 话题1|话题2|话题3]
- 每个话题是简短的行动引导短语，用"帮我了解…""告诉我…""介绍一下…"开头，不用疑问句式
- 提供 3 个与当前话题相关的引导话题；若该答复不适合引导（如免责说明）则省略此行`;

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
