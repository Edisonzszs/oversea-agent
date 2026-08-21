// 统一伴填对话的系统提示与响应解析。
// 一个入口同时支持：① 描述投资安排 → 抽取可填字段（含置信度/依据）；
// ② 提问（字段含义/该填什么/法规）→ 通俗解释 + 引用精选条款。可兼有。
// 红线不变：抽取结果只是候选，是否写入由用户「确认」决定（写入在组件层）。

import type { Mode } from "../logic/weights";
import { getFieldsForStep, matchOptionValue, mapMultiTokens, cleanTextValue, clampConfidence, type ExtractField, type ParsedCandidate } from "./fieldCatalog";
import { regulationLib } from "./regulationLib";

// 把精选条款拍平成「id → point/topic」登记表，供回答时引用、解析时校验（杜绝编造文号/条文）。
const CLAUSE_REGISTRY: { id: string; point: string; topic: string }[] = (() => {
  const out: { id: string; point: string; topic: string }[] = [];
  for (const e of Object.values(regulationLib)) {
    for (const c of e.clauses) out.push({ id: c.id, point: c.point, topic: e.title });
  }
  return out;
})();
const CLAUSE_BY_ID = new Map(CLAUSE_REGISTRY.map(c => [c.id, c]));

export function buildChatSystemPrompt(step: number, mode: Mode | null): string {
  const fields = getFieldsForStep(step, mode);
  const fieldLines = fields.length
    ? fields.map((f, i) => {
        const allowed = f.allowed && f.allowed.length ? "；允许值：" + f.allowed.map(a => `${a.value}(${a.label})`).join("、") : "";
        const kind = f.kind === "multi" ? "（多选；value 用逗号拼接 code）" : f.kind === "text" ? "（文本）" : "";
        const note = f.note ? `；口径：${f.note}` : "";
        return `${i + 1}. ${f.key}（${f.label}）${kind}${allowed}${note}`;
      }).join("\n")
    : "（本步骤无可抽取字段——只回答问题，不要抽取）";

  const kb = CLAUSE_REGISTRY.map(c => `- ${c.id}｜${c.topic}：${c.point}`).join("\n");

  return [
    "你是「沪航者」，企业境外投资(ODI)合规自查的伴填助手。你要同时胜任两件事：",
    "A. 字段抽取：当用户在描述自身投资安排时，从下方【可抽取字段】里客观抽取，给出 value/置信度/依据。",
    "B. 问题解答：当用户问「某字段是什么意思 / 该填什么 / 相关政策法规」时，用通俗中文解释，并只能引用下方【法规知识库】里的法规依据（知识库为口径要点、非逐字条文；须标注法规名称,不得当作逐字原文呈现,正式材料以官方原文为准）。",
    "你常常需要同时做两件事——例如先解释某字段该填什么，再顺势抽取用户已透露的字段。",
    "",
    "【可抽取字段】（仅限当前步骤；value 必须用允许值括号内的 code，如 investMode 用 new/ma/chg——严禁把括号内的中文描述或自己改写的说法当 value；不确定的字段整字段省略，严禁臆测；evidence 必须为用户原文逐字摘录，不得概括或改写；confidence 取值：用户明确陈述 0.9-1.0、可合理推断 0.6-0.8、低于 0.6 整字段省略）：",
    fieldLines,
    "",
    "【法规知识库】（口径要点,非逐字条文;回答时只能引用这里的法规依据并标注法规名称,不得编造任何未列出的条文或文号,不得当作逐字原文呈现;若没有相关条款,就一般性作答并明确说明「未命中精选条款,建议查阅原文」）：",
    kb,
    "",
    '只输出严格 JSON：{"answer":"通俗解释，没有则 null","candidates":[{"key":"字段键","value":"","confidence":0.0,"evidence":""}],"clauses":[{"id":"条款号"}]}。无对应内容时，answer 为 null、数组为空。',
  ].join("\n");
}

export interface ChatResponse {
  answer?: string;
  candidates: ParsedCandidate[];
  clauses: { id: string; point: string }[];
}

export function parseChatResponse(content: string, fields: ExtractField[]): ChatResponse {
  let obj: any;
  try { obj = JSON.parse(content); } catch { return { answer: content, candidates: [], clauses: [] }; }

  const answer = obj && obj.answer ? String(obj.answer).trim() || undefined : undefined;

  const fieldByKey = new Map(fields.map(f => [f.key, f]));
  const candidates: ParsedCandidate[] = [];
  for (const c of Array.isArray(obj?.candidates) ? obj.candidates : []) {
    const f = fieldByKey.get(String(c?.key));
    if (!f) continue;
    const raw = c?.value == null ? "" : String(c.value);
    if (!raw) continue;
    const conf = clampConfidence(c?.confidence);
    const evidence = String(c.evidence ?? "");
    // 识别准度提升:select/multi 支持 code/label/主干三级匹配(歧义丢弃),text 清洗规整
    if (f.kind === "multi") {
      const codes = mapMultiTokens(raw, f.allowed);
      if (codes.length === 0) continue;
      candidates.push({ field: f, value: codes.join(","), confidence: conf, evidence, lowConf: conf < 0.8 });
    } else if (f.kind === "select") {
      const code = f.allowed ? matchOptionValue(raw, f.allowed) : cleanTextValue(raw);
      if (!code) continue;
      candidates.push({ field: f, value: code, confidence: conf, evidence, lowConf: conf < 0.8 });
    } else {
      const text = cleanTextValue(raw);
      if (!text) continue;
      candidates.push({ field: f, value: text, confidence: conf, evidence, lowConf: conf < 0.8 });
    }
  }

  const clauses: { id: string; point: string }[] = [];
  const seen = new Set<string>();
  for (const c of Array.isArray(obj?.clauses) ? obj.clauses : []) {
    const id = String(c?.id || "");
    const entry = CLAUSE_BY_ID.get(id);
    if (!entry || seen.has(id)) continue;
    seen.add(id);
    clauses.push({ id, point: entry.point });
  }

  return { answer, candidates, clauses };
}
