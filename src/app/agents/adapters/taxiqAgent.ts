import { normalizeApiError, streamReasoningChat } from "../../services/deepseekApi";
import { streamTaxiqChat } from "../../services/taxiqApi";
import {
  hasTaxiqInternalSourceDisclosure,
  sanitizeTaxiqAnswer,
} from "../../services/taxiqSanitize";
import { TAXIQ_FALLBACK_PROMPT } from "../../prompts/systemPrompts";
import { COUNTRY_115 } from "../../services/intentDetector";
import type { AgentSource } from "../../orchestration/types";
import { createEventStream } from "../eventStream";
import type { AgentAdapter, AgentAdapterEvent } from "../types";

/**
 * TaxIQ 调用机制（对齐生产 skills/taxiq_qa + custom_tools/taxiq_api.py 契约）：
 *  1. 多轮补全：问题缺国别时，从会话上下文回溯最近国别拼入问题，不猜测新国别；
 *  2. 缺国别澄清：外派个税/税收居民类问题无任何国别 → 直接澄清终局，不调 TaxIQ；
 *  3. 净化交付：缓冲整段答复 → 剥离内部来源表述（"根据TaxIQ的分析"等）→ 逐字交付；
 *  4. 兜底链：未覆盖契约 / 净化失败 / 传输失败 → 通用税务知识应答（degraded 标记），
 *     兜底正文不描述检索来源与服务可用状态（生产 general_answer_required 口径）。
 */

/** 区域名兜底（COUNTRY_115 之外的多国/区域表述也算国别实体） */
const REGION_RE =
  /(东盟|欧盟|欧洲|亚洲|非洲|美洲|大洋洲|欧亚|海湾|北美|拉美|中东|全球|各国|多国)/;

/** 生产 taxiq_qa 澄清家族：跨境派遣/个税/税收居民/183天/双重征税 */
const NEEDS_COUNTRY_RE =
  /(跨境派遣|外派|派驻|派遣员工|个人所得税|个税|税收居民|183天|双重征税|税收协定)/;

/** 国别实体按长度倒序（"印度尼西亚"先于"印度"命中） */
const COUNTRIES_BY_LENGTH = [...COUNTRY_115].sort((a, b) => b.length - a.length);

function findCountry(text: string): string {
  const country = COUNTRIES_BY_LENGTH.find((item) => text.includes(item));
  if (country) return country;
  return REGION_RE.exec(text)?.[0] ?? "";
}

/**
 * 多轮问题补全：问题本身无国别时，从会话历史（倒序）回溯最近出现过的国别拼入问题；
 * 历史里也没有则返回空 country（上层按需澄清）。不猜测用户没提过的国别。
 */
function completeTaxiqQuestion(
  question: string,
  conversation: Array<{ role: string; content: string }>,
): { question: string; country: string } {
  const direct = findCountry(question);
  if (direct) return { question, country: direct };
  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const country = findCountry(conversation[index]?.content ?? "");
    if (country) {
      return { question: `${question}（国家/地区：${country}）`, country };
    }
  }
  return { question, country: "" };
}

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
    const { question: effectiveQuestion, country } = completeTaxiqQuestion(
      input.question,
      input.conversation,
    );

    // 缺国别澄清（生产 taxiq_qa 澄清终局）：外派个税/税收居民类问题没有国别时不调 TaxIQ
    if (!country && NEEDS_COUNTRY_RE.test(input.question)) {
      const clarification = [
        "您想了解哪个国家或地区的相关税务处理规则？例如越南、新加坡、德国等。补充国家/地区后，我再继续为您查询。",
        "[QUICK_QUESTIONS: 帮我了解越南个人所得税|帮我了解新加坡外派员工税务|帮我了解中国与越南的税收协定]",
      ].join("\n\n");
      yield { type: "output.delta", delta: clarification };
      yield {
        type: "completed",
        result: { output: clarification, summary: "已请用户补充国家/地区", sources: [] },
      };
      return;
    }

    yield {
      type: "progress",
      text: country ? `正在检索${country}税收政策（TaxIQ 国别税策库）` : "正在查询国别税收政策",
    };

    // TaxIQ 主路径：缓冲整段（净化需要完整正文，对齐生产 Tool 载荷边界），净化后逐字交付
    try {
      const result = await streamTaxiqChat({
        question: effectiveQuestion,
        onChunk: () => {},
        signal: context.signal,
      });
      const sanitized = sanitizeTaxiqAnswer(result.answer);
      if (!sanitized || hasTaxiqInternalSourceDisclosure(sanitized)) {
        // 净化后为空或仍残留内部来源披露 → 视为不可交付，走兜底
        throw new Error(sanitized ? "TaxIQ 答复仍残留内部来源表述" : "TaxIQ 答复净化后为空");
      }
      yield { type: "progress", text: "已完成国别税策检索" };
      yield { type: "output.delta", delta: sanitized };
      yield {
        type: "completed",
        result: {
          output: sanitized,
          summary: summaryOf(sanitized),
          sources: sourcesFrom(result.refers),
        },
      };
      return;
    } catch (error) {
      if (context.signal.aborted) throw normalizeApiError(error);
    }

    // 兜底：未覆盖契约 / 净化失败 / 传输失败 → 通用税务知识应答（degraded 标记）
    yield { type: "progress", text: "国别税策库暂不可用，正在以通用税务知识应答" };
    try {
      let output = "";
      const content = createEventStream<string>(async (emit, streamSignal) => {
        const result = await streamReasoningChat({
          messages: [
            ...input.conversation,
            {
              role: "user",
              content: `任务指令：${input.instruction}\n用户问题：${effectiveQuestion}`,
            },
          ],
          systemPrompt: TAXIQ_FALLBACK_PROMPT,
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
        result: {
          output,
          summary: `TaxIQ 不可用，通用税务知识应答：${summaryOf(output)}`,
          sources: [],
          degraded: "TaxIQ 国别税策库不可用，本结果为通用税务知识参考",
        },
      };
    } catch (fallbackError) {
      // 兜底也失败才让任务失败（上层披露信息缺口）
      throw normalizeApiError(fallbackError);
    }
  },
};
