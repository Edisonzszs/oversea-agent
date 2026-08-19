// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TaxiqNoDirectSupportError,
  resetTaxiqState,
  streamTaxiqChat,
} from "../taxiqApi";

/**
 * TaxIQ 两步 SSE 客户端的流完整性与未覆盖契约测试（fetch 全程 mock，零真实网络）。
 * 对齐生产 taxiq_api.py：MESSAGE_FINISH 必须收到、finish 载荷正文一致性、
 * 固定未覆盖答复抛 TaxiqNoDirectSupportError。
 */

interface SseEvent {
  eventType?: string
  answer?: string
  sessionId?: string
  refers?: unknown[]
}

function sseResponse(events: SseEvent[]): Response {
  const body = events
    .map((event) => `data:${JSON.stringify(event)}\n`)
    .join("");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function okJson(data: unknown): Response {
  return new Response(JSON.stringify({ status: 200, success: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** 按 URL 分派：generate-globe 建会话；messages-globe 逐次返回预设 SSE 流 */
function mockFetch(script: {
  conversations: string[];
  attempts: Response[];
}): ReturnType<typeof vi.fn> {
  const conversations = [...script.conversations];
  const attempts = [...script.attempts];
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/v1/chat/generate-globe")) {
      const next = conversations.shift();
      return next ? okJson(next) : Promise.reject(new Error("no conversation left"));
    }
    const attempt = attempts.shift();
    return attempt ?? Promise.reject(new Error("no attempt left"));
  });
}

const chunks: string[] = [];

async function run(question = "越南企业所得税是多少？"): Promise<ReturnType<typeof streamTaxiqChat>> {
  return streamTaxiqChat({
    question,
    onChunk: (chunk) => chunks.push(chunk),
  });
}

beforeEach(() => {
  resetTaxiqState();
  chunks.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamTaxiqChat 流完整性", () => {
  it("完整流：拼接 MESSAGE、取 sessionId/refers 并复用会话", async () => {
    const fetchMock = mockFetch({
      conversations: ["conv-1"],
      attempts: [
        sseResponse([
          { eventType: "MESSAGE", answer: "越南企业所得税" },
          { eventType: "MESSAGE", answer: "标准税率为20%。" },
          { eventType: "MESSAGE_FINISH", sessionId: "session-1", refers: [{ title: "越南税局", url: "https://example.vn" }] },
        ]),
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await run();

    expect(result.answer).toBe("越南企业所得税标准税率为20%。");
    expect(result.conversation_id).toBe("conv-1");
    expect(result.session_id).toBe("session-1");
    expect(result.refers).toEqual([{ title: "越南税局", url: "https://example.vn" }]);
    expect(chunks).toEqual(["越南企业所得税", "标准税率为20%。"]);

    // 第二问不再 generate-globe（conversation_id 复用）
    fetchMock.mockImplementation(async () => sseResponse([
      { eventType: "MESSAGE", answer: "ok" },
      { eventType: "MESSAGE_FINISH", sessionId: "s2" },
    ]));
    await run("那增值税呢？");
    const generateCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("generate-globe"));
    expect(generateCalls).toHaveLength(1);
  });

  it("残缺流（无 MESSAGE_FINISH）触发自愈：重建会话后成功", async () => {
    vi.stubGlobal("fetch", mockFetch({
      conversations: ["conv-1", "conv-2"],
      attempts: [
        // 第一次：只有 MESSAGE，流被截断
        sseResponse([{ eventType: "MESSAGE", answer: "部分正文未完成" }]),
        // 自愈后：完整流
        sseResponse([
          { eventType: "MESSAGE", answer: "越南企业所得税为20%。" },
          { eventType: "MESSAGE_FINISH", sessionId: "session-2" },
        ]),
      ],
    }));

    const result = await run();

    expect(result.answer).toBe("越南企业所得税为20%。");
    expect(result.conversation_id).toBe("conv-2");
  });

  it("finish 载荷与拼接正文不一致时按流异常自愈", async () => {
    vi.stubGlobal("fetch", mockFetch({
      conversations: ["conv-1", "conv-2"],
      attempts: [
        sseResponse([
          { eventType: "MESSAGE", answer: "正文A" },
          { eventType: "MESSAGE_FINISH", answer: "不一致的完整正文", sessionId: "s1" },
        ]),
        sseResponse([
          { eventType: "MESSAGE", answer: "正文B" },
          { eventType: "MESSAGE_FINISH", answer: "正文B", sessionId: "s2" },
        ]),
      ],
    }));

    const result = await run();
    expect(result.answer).toBe("正文B");
    expect(result.conversation_id).toBe("conv-2");
  });

  it("两次都不完整时抛错（不再把部分正文当成功）", async () => {
    vi.stubGlobal("fetch", mockFetch({
      conversations: ["conv-1", "conv-2"],
      attempts: [
        sseResponse([{ eventType: "MESSAGE", answer: "截断1" }]),
        sseResponse([{ eventType: "MESSAGE", answer: "截断2" }]),
      ],
    }));

    await expect(run()).rejects.toThrow("TaxIQ 会话重试仍无响应");
  });
});

describe("streamTaxiqChat 未覆盖契约", () => {
  it("固定未覆盖答复抛 TaxiqNoDirectSupportError，不当成功交付", async () => {
    vi.stubGlobal("fetch", mockFetch({
      conversations: ["conv-1"],
      attempts: [
        sseResponse([
          { eventType: "MESSAGE", answer: "抱歉，当前问题超出知识库覆盖范围，暂时无法解答。" },
          { eventType: "MESSAGE_FINISH", sessionId: "s1" },
        ]),
      ],
    }));

    await expect(run()).rejects.toBeInstanceOf(TaxiqNoDirectSupportError);
  });

  it("未覆盖答复带空白变体同样识别", async () => {
    vi.stubGlobal("fetch", mockFetch({
      conversations: ["conv-1"],
      attempts: [
        sseResponse([
          { eventType: "MESSAGE", answer: "抱歉，当前问题超出知识库覆盖范围，" },
          { eventType: "MESSAGE", answer: "暂时无法解答。" },
          { eventType: "MESSAGE_FINISH", answer: "抱歉，当前问题超出知识库覆盖范围，暂时无法解答。", sessionId: "s1" },
        ]),
      ],
    }));

    await expect(run()).rejects.toBeInstanceOf(TaxiqNoDirectSupportError);
  });
});
