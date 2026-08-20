/**
 * orch · 服务端三适配器（AgentAdapter 协议，shared/orchestration 消费）
 * ============================================================
 * 移植 app/agents/adapters/* 的机制（QUICK_QUESTIONS 协议、TaxIQ 净化/澄清/兜底链、
 * degraded 标记），传输换服务端：consulting/odi → llm.ts 直连 DeepSeek；
 * taxiq → taxiqClient.ts 直连中经社（conv 作用域）。2d 后浏览器版适配器退役。
 */
import type { AgentAdapter, AgentAdapterEvent } from "../../app/agents/types";
import type { AgentId, AgentSource } from "../../shared/orchestration/types";
import { serverStreamChat } from "./llm";
import { serverTaxiqChat } from "./taxiqClient";
import {
  hasTaxiqInternalSourceDisclosure,
  sanitizeTaxiqAnswer,
} from "../../app/services/taxiqSanitize";
import { TAXIQ_FALLBACK_PROMPT } from "../../app/prompts/systemPrompts";
import { COUNTRY_115 } from "../../app/services/intentDetector";

const MD_RULES = `输出使用简洁的 Markdown：小标题用 ##、要点用 - 列表、关键结论用 **加粗**；不要输出表格。`;
const CHIPS_RULES = `回答末尾单独一行输出推荐引导话题：[QUICK_QUESTIONS: 话题1|话题2|话题3]
- 每个话题是简短的行动引导短语，用"帮我了解…""告诉我…""介绍一下…"开头，不用疑问句式
- 提供 3 个与当前话题相关的引导话题；若该答复不适合引导（如寒暄/免责说明）则省略此行`;

const CONSULTING_PROMPT = `你是面向上海企业的出海政策与公共服务咨询专家。
请聚焦海外经营政策、公共服务资源、办事路径和风险提示，给出准确、清晰、可执行的答复。
不要输出内部推理过程；不确定的信息应明确说明，并建议向相应主管部门核实。
${MD_RULES}
${CHIPS_RULES}`;

const ODI_PROMPT = `你是境外直接投资（ODI）办事专家。
请聚焦 ODI 项目备案或核准、商务部门申报、外汇登记、办理顺序、材料清单和常见补正风险。
仅提供流程与申报指引，不修改任何工作台状态，不输出内部标记或内部推理过程。
${MD_RULES}
${CHIPS_RULES}`;

function summaryOf(output: string): string {
  return output.trim().slice(0, 160);
}

/** 流式专家应答（consulting/odi 共用骨架：直连 reasoner，QUICK_QUESTIONS 协议） */
async function* runLlmExpert(
  input: Parameters<AgentAdapter["run"]>[0],
  context: Parameters<AgentAdapter["run"]>[1],
  systemPrompt: string,
  progressText: string,
): AsyncIterable<AgentAdapterEvent> {
  yield { type: "progress", text: progressText };
  let output = "";
  const r = await serverStreamChat({
    messages: [
      ...input.conversation,
      { role: "user", content: `任务指令：${input.instruction}\n用户问题：${input.question}` },
    ],
    systemPrompt,
    reasoner: true,
    signal: context.signal,
    onContent(delta) { if (delta) output += delta; },
  });
  output = r.content || output;
  yield { type: "completed", result: { output, summary: summaryOf(output), sources: [] } };
}

export function createServerConsultingAgent(): AgentAdapter {
  return {
    id: "consulting",
    name: "出海智询",
    capabilities: ["海外政策咨询", "公共服务指引"],
    async *run(input, context) {
      yield* runLlmExpert(input, context, CONSULTING_PROMPT, "正在梳理政策与公共服务信息");
    },
  };
}

export function createServerOdiAgent(): AgentAdapter {
  return {
    id: "odi",
    name: "ODI智能体",
    capabilities: ["ODI 流程指引", "申报材料清单"],
    async *run(input, context) {
      yield* runLlmExpert(input, context, ODI_PROMPT, "正在梳理 ODI 流程与申报材料");
    },
  };
}

/* ── TaxIQ（机制完整移植自浏览器版 taxiqAgent） ───────────────────── */

const REGION_RE = /(东盟|欧盟|欧洲|亚洲|非洲|美洲|大洋洲|欧亚|海湾|北美|拉美|中东|全球|各国|多国)/;
const NEEDS_COUNTRY_RE =
  /(跨境派遣|外派|派驻|派遣员工|个人所得税|个税|税收居民|183天|双重征税|税收协定)/;
const COUNTRIES_BY_LENGTH = [...COUNTRY_115].sort((a, b) => b.length - a.length);

function findCountry(text: string): string {
  const country = COUNTRIES_BY_LENGTH.find((item) => text.includes(item));
  if (country) return country;
  return REGION_RE.exec(text)?.[0] ?? "";
}

function completeTaxiqQuestion(
  question: string,
  conversation: Array<{ role: string; content: string }>,
): { question: string; country: string } {
  const direct = findCountry(question);
  if (direct) return { question, country: direct };
  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const country = findCountry(conversation[index]?.content ?? "");
    if (country) return { question: `${question}（国家/地区：${country}）`, country };
  }
  return { question, country: "" };
}

function sourcesFrom(refers: unknown): AgentSource[] {
  const sources: AgentSource[] = [];
  if (!Array.isArray(refers)) return sources;
  for (const refer of refers) {
    let url = "";
    let title = "";
    if (typeof refer === "string") url = refer.trim();
    else if (typeof refer === "object" && refer !== null) {
      const record = refer as Record<string, unknown>;
      if (typeof record.url !== "string") continue;
      url = record.url.trim();
      if (typeof record.title === "string") title = record.title.trim();
    } else continue;
    if (!url) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      sources.push({ title: title || url, url });
    } catch { continue; }
  }
  return sources;
}

export function createServerTaxiqAgent(convId: string): AgentAdapter {
  return {
    id: "taxiq",
    name: "TaxIQ",
    capabilities: ["国别税制查询", "跨境税务风险"],
    async *run(input, context): AsyncIterable<AgentAdapterEvent> {
      const { question: effectiveQuestion, country } = completeTaxiqQuestion(
        input.question,
        input.conversation,
      );

      // 缺国别澄清终局（生产 taxiq_qa 口径）
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

      // 主路径：缓冲 → 净化 → 逐字交付
      try {
        const result = await serverTaxiqChat({
          question: effectiveQuestion,
          convId,
          signal: context.signal,
        });
        const sanitized = sanitizeTaxiqAnswer(result.answer);
        if (!sanitized || hasTaxiqInternalSourceDisclosure(sanitized)) {
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
        if (context.signal.aborted) throw error;
      }

      // 兜底：未覆盖/净化失败/传输失败 → 通用税务知识（degraded）
      yield { type: "progress", text: "国别税策库暂不可用，正在以通用税务知识应答" };
      let output = "";
      const r = await serverStreamChat({
        messages: [
          ...input.conversation,
          { role: "user", content: `任务指令：${input.instruction}\n用户问题：${effectiveQuestion}` },
        ],
        systemPrompt: TAXIQ_FALLBACK_PROMPT,
        reasoner: true,
        signal: context.signal,
      });
      output = r.content;
      yield {
        type: "completed",
        result: {
          output,
          summary: `TaxIQ 不可用，通用税务知识应答：${summaryOf(output)}`,
          sources: [],
          degraded: "TaxIQ 国别税策库不可用，本结果为通用税务知识参考",
        },
      };
    },
  };
}

/** 每 run 一个注册表（taxiq 绑 conv 作用域）；消费方 = shared/orchestration/orchestrator */
export function createServerRegistry(convId: string): Map<AgentId, AgentAdapter> {
  return new Map<AgentId, AgentAdapter>([
    ["consulting", createServerConsultingAgent()],
    ["taxiq", createServerTaxiqAgent(convId)],
    ["odi", createServerOdiAgent()],
  ]);
}
