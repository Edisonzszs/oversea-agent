import { beforeEach, describe, expect, it, vi } from "vitest";

import { streamReasoningChat } from "../../services/deepseekApi";
import { streamTaxiqChat } from "../../services/taxiqApi";
import { consultingAgent } from "../../agents/adapters/consultingAgent";
import { odiAgent } from "../../agents/adapters/odiAgent";
import { taxiqAgent } from "../../agents/adapters/taxiqAgent";
import { createEventStream } from "../../agents/eventStream";
import { createAgentRegistry, getAgentAdapter } from "../../agents/registry";
import type {
  AgentAdapter,
  AgentAdapterEvent,
  AgentTaskInput,
} from "../../agents/types";
import type { AgentId } from "../types";

vi.mock("../../services/deepseekApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/deepseekApi")>();
  return {
    ...actual,
    streamReasoningChat: vi.fn(),
  };
});

vi.mock("../../services/taxiqApi", () => ({
  streamTaxiqChat: vi.fn(),
}));

const reasoningMock = vi.mocked(streamReasoningChat);
const taxiqMock = vi.mocked(streamTaxiqChat);

const input: AgentTaskInput = {
  question: "如何在越南落地？",
  instruction: "给出办理顺序和主要风险",
  conversation: [
    { role: "user", content: "目标国家是越南" },
    { role: "assistant", content: "请补充业务类型" },
  ],
};

async function collect(
  iterable: AsyncIterable<AgentAdapterEvent>,
): Promise<AgentAdapterEvent[]> {
  const events: AgentAdapterEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

async function collectValues<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

function signal(): AbortSignal {
  return new AbortController().signal;
}

async function settleWithin<T>(promise: Promise<T>): Promise<T | "timed out"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<"timed out">((resolve) => {
        timer = setTimeout(() => resolve("timed out"), 100);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

describe("agent registry", () => {
  it("returns the three adapters in stable order", () => {
    const registry = createAgentRegistry();

    expect([...registry.keys()]).toEqual(["consulting", "taxiq", "odi"]);
    expect([...registry.values()]).toEqual([
      consultingAgent,
      taxiqAgent,
      odiAgent,
    ]);
  });

  it("throws a clear error for a missing adapter", () => {
    const registry = createAgentRegistry();

    expect(() => getAgentAdapter(registry, "missing" as AgentId)).toThrow(
      "未找到专业智能体: missing",
    );
  });

  it.each([consultingAgent, taxiqAgent, odiAgent])(
    "exposes non-empty metadata for $id",
    (adapter: AgentAdapter) => {
      expect(adapter.id).toMatch(/^(consulting|taxiq|odi)$/);
      expect(adapter.name.trim()).not.toBe("");
      expect(adapter.capabilities.length).toBeGreaterThan(0);
      expect(adapter.capabilities.every((item) => item.trim().length > 0)).toBe(true);
    },
  );
});

describe("callback event stream", () => {
  it("preserves callback event order", async () => {
    const events = await collectValues(
      createEventStream<string>(async (emit) => {
        emit("first");
        await Promise.resolve();
        emit("second");
      }, signal()),
    );

    expect(events).toEqual(["first", "second"]);
  });

  it("rejects iteration when the producer fails", async () => {
    const failure = new Error("producer failed");
    const events = createEventStream<string>(async () => {
      throw failure;
    }, signal());

    await expect(collectValues(events)).rejects.toBe(failure);
  });

  it("delivers concurrent next calls in FIFO order", async () => {
    let emit: ((event: string) => void) | undefined;
    let finish: (() => void) | undefined;
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const iterator = createEventStream<string>((producerEmit) => {
      emit = producerEmit;
      markStarted?.();
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    }, signal())[Symbol.asyncIterator]();

    const first = iterator.next();
    const second = iterator.next();
    await started;
    emit?.("first");
    emit?.("second");

    const outcome = await settleWithin(Promise.all([first, second]));
    finish?.();
    await iterator.return?.();
    expect(outcome).toEqual([
      { done: false, value: "first" },
      { done: false, value: "second" },
    ]);
  });

  it("resolves every pending next when the producer completes", async () => {
    let finish: (() => void) | undefined;
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const iterator = createEventStream<string>(() => {
      markStarted?.();
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    }, signal())[Symbol.asyncIterator]();

    const first = iterator.next();
    const second = iterator.next();
    await started;
    finish?.();

    const outcome = await settleWithin(Promise.all([first, second]));
    await iterator.return?.();
    expect(outcome).toEqual([
      { done: true, value: undefined },
      { done: true, value: undefined },
    ]);
  });

  it("rejects every pending and future next with the producer error", async () => {
    const failure = new Error("concurrent producer failure");
    let rejectProducer: ((error: Error) => void) | undefined;
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const iterator = createEventStream<string>(() => {
      markStarted?.();
      return new Promise<void>((_, reject) => {
        rejectProducer = reject;
      });
    }, signal())[Symbol.asyncIterator]();

    const first = iterator.next().catch((error: unknown) => error);
    const second = iterator.next().catch((error: unknown) => error);
    await started;
    rejectProducer?.(failure);

    const outcome = await settleWithin(Promise.all([first, second]));
    expect(outcome).toEqual([failure, failure]);
    await expect(iterator.next()).rejects.toBe(failure);
  });

  it("drains queued events before rejecting with the producer error", async () => {
    const failure = new Error("failed after partial output");
    let rejectProducer: ((error: Error) => void) | undefined;
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const iterator = createEventStream<string>((emit) => {
      emit("partial");
      markStarted?.();
      return new Promise<void>((_, reject) => {
        rejectProducer = reject;
      });
    }, signal())[Symbol.asyncIterator]();

    await started;
    rejectProducer?.(failure);
    await Promise.resolve();

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: "partial",
    });
    await expect(iterator.next()).rejects.toBe(failure);
  });

  it("terminates promptly when aborted", async () => {
    const controller = new AbortController();
    const events = createEventStream<string>(
      () => new Promise<void>(() => undefined),
      controller.signal,
    );

    const pending = collectValues(events);
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("does not start the producer when the signal is already aborted", async () => {
    const controller = new AbortController();
    const producer = vi.fn();
    controller.abort();

    const pending = collectValues(createEventStream(producer, controller.signal));

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(producer).not.toHaveBeenCalled();
  });

  it("drops queued events when aborted after the producer finishes", async () => {
    const controller = new AbortController();
    const iterator = createEventStream<string>((emit) => {
      emit("first");
      emit("second");
    }, controller.signal)[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({ done: false, value: "first" });
    await Promise.resolve();
    controller.abort();

    await expect(iterator.next()).rejects.toMatchObject({ name: "AbortError" });
  });

  it("resolves pending and future next as done after return", async () => {
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const iterator = createEventStream<string>(() => {
      markStarted?.();
      return new Promise<void>(() => undefined);
    }, signal())[Symbol.asyncIterator]();

    const first = iterator.next();
    const second = iterator.next();
    await started;
    await expect(iterator.return?.()).resolves.toEqual({
      done: true,
      value: undefined,
    });

    const outcome = await settleWithin(Promise.all([first, second]));
    expect(outcome).toEqual([
      { done: true, value: undefined },
      { done: true, value: undefined },
    ]);
    await expect(iterator.next()).resolves.toEqual({
      done: true,
      value: undefined,
    });
  });

  it("aborts the stream-scoped producer signal on early consumer exit", async () => {
    let observedSignal: AbortSignal | undefined;
    const events = createEventStream<string>((emit, streamSignal) => {
      observedSignal = streamSignal;
      emit("first");
      return new Promise<void>((_, reject) => {
        streamSignal.addEventListener(
          "abort",
          () => reject(new Error("producer cancelled after return")),
          { once: true },
        );
      });
    }, signal());

    for await (const event of events) {
      expect(event).toBe("first");
      break;
    }

    expect(observedSignal?.aborted).toBe(true);
    await Promise.resolve();
  });
});

describe("professional agent adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("streams TaxIQ chunks in order and completes once with safe URL citations", async () => {
    const answer = "A".repeat(170);
    taxiqMock.mockImplementation(async ({ onChunk, signal: passedSignal }) => {
      expect(passedSignal).toBeDefined();
      onChunk("");
      onChunk("A".repeat(80));
      onChunk("A".repeat(90));
      return {
        answer,
        conversation_id: "conversation-1",
        refers: [
          " https://example.gov.vn/tax ",
          { title: " 越南税务机关 ", url: " https://structured.example/tax " },
          { url: "https://fallback.example/tax" },
          { title: "危险引用", url: "javascript:alert(1)" },
          "javascript:alert(1)",
        ],
      };
    });

    const events = await collect(taxiqAgent.run(input, { signal: signal() }));

    expect(events.map((event) => event.type)).toEqual([
      "progress",
      "output.delta",
      "output.delta",
      "completed",
    ]);
    expect(events.filter((event) => event.type === "completed")).toHaveLength(1);
    expect(events[events.length - 1]).toEqual({
      type: "completed",
      result: {
        output: answer,
        summary: "A".repeat(160),
        sources: [
          {
            title: "https://example.gov.vn/tax",
            url: "https://example.gov.vn/tax",
          },
          {
            title: "越南税务机关",
            url: "https://structured.example/tax",
          },
          {
            title: "https://fallback.example/tax",
            url: "https://fallback.example/tax",
          },
        ],
      },
    });
    expect(taxiqMock).toHaveBeenCalledWith(
      expect.objectContaining({ question: input.question }),
    );
  });

  it.each([
    null,
    ["not a url", "data:text/plain,unsafe", "javascript:alert(1)", {}, 42],
  ])("discards malformed or unsafe TaxIQ refers: %j", async (refers) => {
    taxiqMock.mockImplementation(async ({ onChunk }) => {
      onChunk("结果");
      return {
        answer: "结果",
        conversation_id: "conversation-1",
        refers: refers as unknown as unknown[],
      };
    });

    const events = await collect(taxiqAgent.run(input, { signal: signal() }));
    const completed = events.find((event) => event.type === "completed");

    expect(completed).toEqual({
      type: "completed",
      result: { output: "结果", summary: "结果", sources: [] },
    });
  });

  it.each([
    [consultingAgent, "consulting"],
    [odiAgent, "odi"],
  ] as const)(
    "%s streams content without exposing reasoning and completes once",
    async (adapter) => {
      reasoningMock.mockImplementation(async (options) => {
        expect(options.onReasoning).toBeUndefined();
        expect(options.signal).toBeDefined();
        expect(options.messages.slice(0, 2)).toEqual(input.conversation);
        const promptInput = options.messages.map((message) => message.content).join("\n");
        expect(promptInput).toContain(input.instruction);
        expect(promptInput).toContain(input.question);
        options.onContent("办理");
        options.onContent("建议");
        return { reasoning: "内部推理不得泄露", content: "办理建议" };
      });

      const events = await collect(adapter.run(input, { signal: signal() }));

      expect(events.map((event) => event.type)).toEqual([
        "progress",
        "output.delta",
        "output.delta",
        "completed",
      ]);
      expect(events).not.toContainEqual(
        expect.objectContaining({ delta: "内部推理不得泄露" }),
      );
      expect(events.filter((event) => event.type === "completed")).toEqual([
        {
          type: "completed",
          result: {
            output: "办理建议",
            summary: "办理建议",
            sources: [],
          },
        },
      ]);
    },
  );

  it("normalizes producer failures instead of swallowing them", async () => {
    reasoningMock.mockRejectedValue(new Error("upstream unavailable"));

    await expect(
      collect(consultingAgent.run(input, { signal: signal() })),
    ).rejects.toEqual({
      code: "agent_request_failed",
      message: "专业智能体暂时不可用",
      detail: "upstream unavailable",
    });
  });

  it("propagates abort as a normalized cancellation without hanging", async () => {
    const controller = new AbortController();
    let markInvoked: (() => void) | undefined;
    let observedSignal: AbortSignal | undefined;
    const invoked = new Promise<void>((resolve) => {
      markInvoked = resolve;
    });
    taxiqMock.mockImplementation(({ signal: passedSignal }) => {
      observedSignal = passedSignal;
      markInvoked?.();
      return new Promise((_, reject) => {
        const rejectAbort = () =>
          reject(new DOMException("The operation was aborted", "AbortError"));
        if (passedSignal?.aborted) rejectAbort();
        else passedSignal?.addEventListener("abort", rejectAbort, { once: true });
      });
    });

    const pending = collect(taxiqAgent.run(input, { signal: controller.signal }));
    await invoked;
    expect(taxiqMock).toHaveBeenCalledOnce();
    expect(observedSignal).not.toBe(controller.signal);
    controller.abort();
    expect(observedSignal?.aborted).toBe(true);

    await expect(pending).rejects.toEqual({
      code: "cancelled",
      message: "任务已停止",
    });
  });
});
