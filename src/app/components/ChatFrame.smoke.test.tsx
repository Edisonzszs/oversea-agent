import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { ChatFrame } from "./ChatFrame";
import type { ChatMessage } from "./conversationData";
import type { AgentRunState } from "../orchestration/types";

// 编排融合后的气泡渲染冒烟：轨迹（状态/标题/来源）+ 引导话题 chips + 历史思考块兼容。
// SSR 渲染不执行 effects，零 AI 调用。

const doneRun: AgentRunState = {
  runId: "run-1",
  messageId: "m1",
  status: "completed",
  tasks: {
    "t1": {
      id: "t1", agentId: "taxiq", title: "国别税策分析", instruction: "分析税制", expectedOutput: "要点",
      status: "done", output: "TaxIQ 完整输出", progress: [], summary: "已完成税务要点核验",
      sources: [{ title: "税务机关", url: "https://example.com/tax" }],
      startedAt: 1000, completedAt: 3000,
    },
    "t2": {
      id: "t2", agentId: "odi", title: "ODI办理指引", instruction: "说明流程", expectedOutput: "路径",
      status: "done", output: "ODI 完整输出", progress: [], summary: "已完成 ODI 路径核验",
      sources: [], startedAt: 1000, completedAt: 4000,
    },
  },
  taskOrder: ["t1", "t2"],
  plan: {
    intent: "compound", directAnswerAllowed: false,
    tasks: [
      { agentId: "taxiq", title: "国别税策分析", instruction: "分析税制", expectedOutput: "要点" },
      { agentId: "odi", title: "ODI办理指引", instruction: "说明流程", expectedOutput: "路径" },
    ],
    aggregationRequired: true, rationaleSummary: "多领域并行",
  },
  aggregation: { status: "done", output: "综合答复", usedTaskIds: ["t1", "t2"] },
  startedAt: 1000, completedAt: 5000,
};

const messages: ChatMessage[] = [
  { role: "user", text: "越南投资涉及税和备案，帮我梳理" },
  { role: "assistant", text: "综合答复正文", run: doneRun, quickQuestions: ["帮我了解越南税制", "告诉我ODI备案材料"] },
];

// React SSR 会在文本插值两侧插入 <!-- --> 注释，剥掉后再断言（项目 smoke 惯例）
const stripSsrComments = (html: string) => html.replace(/<!--\s*-->/g, "");

describe("ChatFrame 编排融合渲染", () => {
  it("历史消息渲染轨迹、来源与引导话题 chips", () => {
    const html = stripSsrComments(renderToString(<ChatFrame messages={messages} onMessagesChange={() => {}} />));
    // 轨迹：任务标题 + 完成态 + 摘要 + 来源
    expect(html).toContain("调用 TaxIQ");
    expect(html).toContain("调用 ODI智能体");
    expect(html).toContain("已完成税务要点核验");
    expect(html).toContain("1 个来源");
    expect(html).toContain("已调用 2 个专业智能体");
    // 聚合正文与 chips
    expect(html).toContain("综合答复正文");
    expect(html).toContain("帮我了解越南税制");
    expect(html).toContain("告诉我ODI备案材料");
    expect(html).toContain("并行调用 2 个专业智能体");
  });

  it("旧版 think 消息与无轨迹消息不受影响", () => {
    const html = stripSsrComments(renderToString(
      <ChatFrame
        messages={[
          { role: "assistant", text: "旧回复", think: "旧思考过程" },
        ]}
        onMessagesChange={() => {}}
      />,
    ));
    expect(html).toContain("旧回复");
    expect(html).toContain("已深度思考");
    expect(html).not.toContain("专业智能体调用轨迹");
  });
});
