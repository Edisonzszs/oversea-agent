# 合规自查·伴填子智能体 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 ODI POC 的「企业合规自查」模块右侧，新增一个独立的、DeepSeek 驱动的伴填子智能体（自然语言伴填+双确认、逐题法规伴答），判档计分零改动。

**Architecture:** 前端 `ComplianceCopilotPanel`（右栏）经 `/api/copilot/*` 调用 Vite dev-server 中间件；中间件持 key、调 DeepSeek（伴填用 JSON mode，法规伴答用 grounded JSON）。字段清单/法规摘录等领域知识在前端（非密），中间件是通用代理。判档仍是客户端 `logic/scoring.ts`，不动。

**Tech Stack:** React 18 + TS + Vite 6（已有）；新增 DeepSeek Chat API（`deepseek-chat`，OpenAI 兼容）；vitest（本计划新增，仅用于纯逻辑单测）。

## Global Constraints

- POC 目录：`E:\claude\出海智能体-合规\出海智能体设计 (最新版-ODI单独平台)`。所有路径相对于此。
- **本机 npm 默认 registry 会卡死**：任何 `npm install` 必须加 `--registry=https://registry.npmmirror.com --no-audit --no-fund`。
- **无 tsconfig**：校验用 `npm run build`（vite build / esbuild），不用 `tsc`。
- **非 git 仓库**：本计划中的「commit」步骤一律替换为**检查点**——`npm run build` 通过 + dev server 仍可起 + 无回归。
- **key 安全**：`DEEPSEEK_API_KEY` 只放 `.env`（gitignored），只服务端 `process.env` 读，**不**加 `VITE_` 前缀（会进前端包）。
- **红线**：伴填抽取结果不得直接进判档；只有用户点「确认」才经 fieldCatalog.writeBack 写入 `WizardState`；向导 `validateStep` 照常把关。
- 视觉沿用 POC 调性（`#1a5bc6`、内联样式、`src/app/motion/tokens.ts`）；不引入 shadcn `ui/`。
- 设计依据：`docs/superpowers/specs/2026-08-06-compliance-copilot-agent-design.md`。

---

### Task 1: DeepSeek dev-server 代理 + 环境变量

**Files:**
- Create: `.env`
- Create: `.gitignore`
- Create: `src/server/copilot.ts`
- Modify: `vite.config.ts:1-36`（加 import + 一个 plugin）

**Interfaces:**
- Produces: `registerCopilot(server: ViteDevServer)`，暴露两个端点：
  - `POST /api/copilot/extract`，body `{ systemPrompt: string, userText: string }` → `{ content: string }`（DeepSeek JSON mode 原始返回）
  - `POST /api/copilot/regulation`，body `{ contextPrompt: string, question: string }` → `{ content: string }`
  - 错误：HTTP 500 `{ error: string }`

- [ ] **Step 1: 建 `.env`（填入用户提供的 key）**

```
DEEPSEEK_API_KEY=在此填入用户提供的 sk- 开头 key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

- [ ] **Step 2: 建 `.gitignore`**

```
node_modules/
dist/
.env
```

- [ ] **Step 3: 建 `src/server/copilot.ts`**（含无依赖的 .env 读取 + 通用代理）

```ts
import type { ViteDevServer } from "vite";
import fs from "node:fs";
import path from "node:path";

// 无依赖读取 .env 到 process.env（仅服务端，不加 VITE_ 前缀，不进前端包）
function loadEnvFile() {
  const p = path.resolve(process.cwd(), ".env");
  let txt = "";
  try { txt = fs.readFileSync(p, "utf8"); } catch { return; }
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}
loadEnvFile();

const KEY = process.env.DEEPSEEK_API_KEY;
const BASE = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

async function deepseek(messages: { role: string; content: string }[], jsonMode: boolean): Promise<string> {
  if (!KEY) throw new Error("DEEPSEEK_API_KEY 未设置");
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, messages, ...(jsonMode ? { response_format: { type: "json_object" } } : {}), stream: false }),
  });
  if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (c: Buffer) => (buf += c.toString("utf8")));
    req.on("end", () => resolve(buf));
    req.on("error", reject);
  });
}
function send(res: any, status: number, obj: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

const EXTRACT_WRAP = (sys: string) =>
  `你是境外投资合规自查的结构化抽取伴填器。\n${sys}\n\n规则：只填能从企业描述客观判定的字段；不确定的整字段省略；严禁臆测；value 必须是字段允许值之一（给出 code 列表时用 code）；evidence 为企业原文摘录。只输出严格 JSON：{"字段键":{"value":...,"confidence":0到1的数,"evidence":"..."}}。`;

const REGULATION_WRAP = (ctx: string) =>
  `你是境外投资合规法规伴答器。\n${ctx}\n\n规则：只能引用上述已提供的条款；不得编造任何未提供的条文或文号；若无可用条款，needFallback=true 且 answer 固定为"该问题超出本工具解读范围，建议查阅原文或咨询平台专业服务联盟机构"。只输出严格 JSON：{"answer":"通俗解释","clauses":[{"id":"条款号","quote":"原文摘录"}],"needFallback":false}。`;

export function registerCopilot(server: ViteDevServer) {
  server.middlewares.use("/api/copilot/extract", async (req: any, res: any) => {
    try {
      const { systemPrompt = "", userText = "" } = JSON.parse((await readBody(req)) || "{}");
      const content = await deepseek([{ role: "system", content: EXTRACT_WRAP(systemPrompt) }, { role: "user", content: userText }], true);
      send(res, 200, { content });
    } catch (e: any) { send(res, 500, { error: String(e?.message || e) }); }
  });
  server.middlewares.use("/api/copilot/regulation", async (req: any, res: any) => {
    try {
      const { contextPrompt = "", question = "" } = JSON.parse((await readBody(req)) || "{}");
      const content = await deepseek([{ role: "system", content: REGULATION_WRAP(contextPrompt) }, { role: "user", content: question }], true);
      send(res, 200, { content });
    } catch (e: any) { send(res, 500, { error: String(e?.message || e) }); }
  });
}
```

- [ ] **Step 4: 在 `vite.config.ts` 接入插件**

在文件顶部 import 区加：
```ts
import { registerCopilot } from './src/server/copilot'
```
在 `plugins: [ ... ]` 数组末尾（`tailwindcss()` 之后）加：
```ts
    {
      name: 'compliance-copilot-proxy',
      configureServer(server) { registerCopilot(server); },
    },
```

- [ ] **Step 5: 检查点验证（curl 端到端）**

起服务：`npm run dev`（后台）。等 `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/` 返回 200。然后测端点：
```bash
curl -s -X POST http://localhost:5173/api/copilot/extract \
  -H "Content-Type: application/json" \
  -d '{"systemPrompt":"字段清单：\n1. investMode 投资方式 允许值 new/ma/chg；new=境外设立新企业。","userText":"我们打算在越南设个生产基地。"}' \
  | sed -E 's/sk-[A-Za-z0-9]+/sk-***/g'
```
Expected: HTTP 200，返回 `{"content":"{\"investMode\":{\"value\":\"new\",...}}"}。再确认前端包不含 key：`grep -rl DEEPSEEK_API_KEY dist/ 2>/dev/null` 应为空（dist 是 build 产物，无 key）。

- [ ] **Step 6: 检查点**——`npm run build` 通过；dev server 可起；`/api/copilot/extract` 返回 DeepSeek JSON。

---

### Task 2: vitest + fieldCatalog（纯逻辑，TDD）

**Files:**
- Modify: `package.json`（加 vitest devDep + `"test": "vitest run"` script）
- Create: `src/app/compliance/copilot/fieldCatalog.ts`
- Create: `src/app/compliance/copilot/fieldCatalog.test.ts`

**Interfaces:**
- Produces（供 Task 4 面板用）：
  - `type ExtractField = { key; label; kind: "select"|"text"|"boolean"; allowed?: {value,label}[]; note?: string; write: (api: WizardApi, value: string) => void }`
  - `getFieldsForStep(step: number, mode: Mode | null): ExtractField[]`——返回该步骤可抽取字段（step 3 仅当 mode==="ma" 返回并购字段；其余无客观字段的步骤返回 `[]`）。
  - `buildExtractSystemPrompt(step: number, mode: Mode | null): string`——把字段清单（含 code+含义+口径注释）拼成 system prompt 片段；无字段时返回空串。
  - `parseExtractResponse(content: string, fields: ExtractField[]): ParsedCandidate[]`，`ParsedCandidate = { field: ExtractField; value: string; confidence: number; evidence: string; lowConf: boolean }`。JSON 解析失败返回 `[]`；字段不在清单或 value 非法（select 不在 allowed）的丢弃；`lowConf = confidence < 0.8`。
- Consumes: `WizardApi`（来自 `src/app/components/fields.ts`，已存在，含 `setSingle/setMode/pickCountry/...`）；`Mode`（来自 `logic/weights.ts`）。

- [ ] **Step 1: 安装 vitest**

`npm install -D vitest --registry=https://registry.npmmirror.com --no-audit --no-fund`

- [ ] **Step 2: 在 `package.json` 的 `"scripts"` 加 `"test": "vitest run"`**

- [ ] **Step 3: 写失败测试 `src/app/compliance/copilot/fieldCatalog.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { getFieldsForStep, buildExtractSystemPrompt, parseExtractResponse } from "./fieldCatalog";
import type { WizardApi } from "../../components/fields";

const fakeApi = (): WizardApi & Record<string, jest.Mock> => {
  const calls: any = {};
  const mk = (k: string) => (...args: any[]) => { (calls[k] ||= []).push(args); };
  return {
    state: { mode: null, answers: { single: {}, multi: {} }, uploads: {}, ctryAck: null, lsNone: false, curStep: 0, maxSeen: 0, generated: false } as any,
    setSingle: mk("setSingle"), toggleMulti: mk("toggleMulti"), setMode: mk("setMode"),
    setLsNone: mk("setLsNone"), uploadFile: mk("uploadFile"), toggleMask: mk("toggleMask"), pickCountry: mk("pickCountry"),
  } as any;
};

describe("fieldCatalog", () => {
  it("step 1 has objective profile fields", () => {
    const keys = getFieldsForStep(1, null).map(f => f.key);
    expect(keys).toEqual(expect.arrayContaining(["investMode", "country", "amount", "ownership", "industry", "path"]));
  });
  it("step 3 returns M&A fields only when mode=ma", () => {
    expect(getFieldsForStep(3, "ma").map(f => f.key)).toEqual(expect.arrayContaining(["m0a", "m0b"]));
    expect(getFieldsForStep(3, "new")).toEqual([]);
  });
  it("steps with no objective fields return []", () => {
    expect(getFieldsForStep(2, null)).toEqual([]);
    expect(getFieldsForStep(5, null)).toEqual([]);
  });
  it("buildExtractSystemPrompt includes allowed codes + definitions", () => {
    const s = buildExtractSystemPrompt(1, null);
    expect(s).toContain("investMode");
    expect(s).toContain("new");
    expect(s).toContain("绿地投资"); // 口径注释
  });
  it("writeBack calls the right setter", () => {
    const api: any = fakeApi();
    const f = getFieldsForStep(1, null).find(x => x.key === "investMode")!;
    f.write(api, "new");
    expect(api.setMode.mock?.calls ?? api.__calls).toBeTruthy();
  });
  it("parseExtractResponse parses + flags low confidence + drops invalid", () => {
    const fields = getFieldsForStep(1, null);
    const raw = JSON.stringify({
      investMode: { value: "new", confidence: 0.9, evidence: "设个生产基地" },
      country: { value: "越南", confidence: 0.6, evidence: "在越南" },
      notAField: { value: "x", confidence: 1, evidence: "" },
    });
    const out = parseExtractResponse(raw, fields);
    expect(out.map(o => o.field.key).sort()).toEqual(["country", "investMode"]);
    const inv = out.find(o => o.field.key === "investMode")!;
    expect(inv.lowConf).toBe(false);
    expect(out.find(o => o.field.key === "country")!.lowConf).toBe(true);
  });
  it("parseExtractResponse returns [] on bad JSON", () => {
    expect(parseExtractResponse("not json", getFieldsForStep(1, null))).toEqual([]);
  });
});
```

> 注：上面用了 `jest.Mock` 类型占位仅为示意；vitest 不装 jest 类型。实现测试时把 `jest.Mock` 换成 `(...a:any[])=>void`，并直接在 `mk` 里把调用记到一个 `calls` 闭包对象，断言 `calls["setMode"]` 存在即可。不要引入 `@types/jest`。

- [ ] **Step 4: 跑测试确认失败**

`npm test`（= `vitest run`）。Expected: FAIL（模块未实现）。

- [ ] **Step 5: 实现 `src/app/compliance/copilot/fieldCatalog.ts`**

```ts
import type { Mode } from "../logic/weights";
import type { WizardApi } from "../../components/fields";

export interface ExtractField {
  key: string;
  label: string;
  kind: "select" | "text" | "boolean";
  allowed?: { value: string; label: string }[];
  note?: string;
  write: (api: WizardApi, value: string) => void;
}
export interface ParsedCandidate {
  field: ExtractField;
  value: string;
  confidence: number;
  evidence: string;
  lowConf: boolean;
}

const IND_OPTS = [
  { value: "C", label: "制造业" }, { value: "I", label: "信息传输、软件和信息技术服务业" },
  { value: "G", label: "交通运输、仓储和邮政业" }, { value: "L", label: "租赁和商务服务业" },
  { value: "K", label: "房地产业" }, { value: "J", label: "金融业" },
  { value: "M", label: "科学研究和技术服务业" }, { value: "E", label: "建筑业" },
];

const STEP1: ExtractField[] = [
  { key: "investMode", label: "投资方式", kind: "select", allowed: [
    { value: "new", label: "新设类（在境外设立新企业/绿地投资）" },
    { value: "ma", label: "并购类（取得既有标的公司股份）" },
    { value: "chg", label: "变更类（已获证项目载明事项变化）" },
  ], note: "对已获证项目的增资属变更类；通过增资首次入股他人既有公司属并购类", write: (api, v) => api.setMode(v as Mode) },
  { key: "country", label: "目的地国别", kind: "text", note: "拟投资最终目的地国别/地区", write: (api, v) => api.pickCountry(v) },
  { key: "amount", label: "拟投资总额", kind: "text", note: "含币种，如 5000 万美元", write: (api, v) => api.setSingle("p_amt", v) },
  { key: "ownership", label: "所有制类型", kind: "select", allowed: [
    { value: "民营", label: "民营" }, { value: "国有独资", label: "国有独资" },
    { value: "国有控股", label: "国有控股" }, { value: "外商投资", label: "外商投资" },
    { value: "混合所有制", label: "混合所有制" },
  ], write: (api, v) => api.setSingle("p_own", v) },
  { key: "industry", label: "拟投资行业类别", kind: "select", allowed: IND_OPTS, note: "GB/T 4754 门类，用 code 值", write: (api, v) => api.setSingle("p_ind2", v) },
  { key: "path", label: "投资路径", kind: "select", allowed: [
    { value: "direct", label: "直接投资至目的地" }, { value: "via", label: "经第三地（含港澳台）中转" },
  ], write: (api, v) => api.setSingle("p_path", v) },
];

const STEP3_MA: ExtractField[] = [
  { key: "m0a", label: "交易完成后类型", kind: "select", allowed: [
    { value: "bg", label: "并购（取得全部股权）" }, { value: "kg", label: "控股（过半数或实际控制）" },
    { value: "cg", label: "参股（不构成控制）" },
  ], write: (api, v) => api.setSingle("m0a", v) },
  { key: "m0b", label: "交易实现方式", kind: "select", allowed: [
    { value: "zr", label: "受让老股" }, { value: "zz", label: "增资认购新股" },
    { value: "hh", label: "转让+增资并用" },
  ], write: (api, v) => api.setSingle("m0b", v) },
];

export function getFieldsForStep(step: number, mode: Mode | null): ExtractField[] {
  if (step === 1) return STEP1;
  if (step === 3 && mode === "ma") return STEP3_MA;
  return [];
}

export function buildExtractSystemPrompt(step: number, mode: Mode | null): string {
  const fields = getFieldsForStep(step, mode);
  if (fields.length === 0) return "";
  const lines = fields.map((f, i) => {
    const allowed = f.kind === "select" && f.allowed
      ? "；允许值：" + f.allowed!.map(a => `${a.value}(${a.label})`).join("、")
      : "";
    const note = f.note ? `；口径：${f.note}` : "";
    return `${i + 1}. ${f.key}（${f.label}）${allowed}${note}`;
  });
  return "字段清单（value 必须是允许值之一；不确定的字段整字段省略）：\n" + lines.join("\n");
}

export function parseExtractResponse(content: string, fields: ExtractField[]): ParsedCandidate[] {
  let obj: Record<string, { value: unknown; confidence: number; evidence: string }>;
  try { obj = JSON.parse(content); } catch { return []; }
  const out: ParsedCandidate[] = [];
  for (const f of fields) {
    const v = obj[f.key];
    if (!v || v.value == null || v.value === "") continue;
    const value = String(v.value);
    if (f.kind === "select" && f.allowed && !f.allowed.some(a => a.value === value)) continue; // 非法值丢弃
    const conf = typeof v.confidence === "number" ? v.confidence : 0.5;
    out.push({ field: f, value, confidence: conf, evidence: String(v.evidence ?? ""), lowConf: conf < 0.8 });
  }
  return out;
}
```

- [ ] **Step 6: 跑测试确认通过**

`npm test`。Expected: 全部 PASS。

- [ ] **Step 7: 检查点**——`npm test` 全绿；`npm run build` 通过。

---

### Task 3: regulationLib + 前端 copilot/api.ts

**Files:**
- Create: `src/app/compliance/copilot/regulationLib.ts`
- Create: `src/app/compliance/copilot/api.ts`

**Interfaces:**
- Produces（供 Task 5 面板用）：
  - `regulationLib: Record<string, { title: string; clauses: { id: string; quote: string }[] }>`——按 questionId 索引。
  - `QUESTION_LIST: { moduleId: number; moduleLabel: string; questionId: string; questionLabel: string }[]`——法规伴答 tab 的下拉选项。
  - `buildRegulationContext(questionId: string): string`——把 `regulationLib[questionId]` 的 title+clauses 拼成 context prompt 片段；无条目返回空串。
  - `copilotApi.extract(systemPrompt, userText): Promise<string>` / `copilotApi.regulation(contextPrompt, question): Promise<string>`——fetch `/api/copilot/*`，解析 `{content}`，失败抛错。

- [ ] **Step 1: 写 `regulationLib.ts`（首批条目，公开法规摘录，按 questionId 索引）**

```ts
export interface RegulationEntry { title: string; clauses: { id: string; quote: string }[]; }
export const regulationLib: Record<string, RegulationEntry> = {
  z1: {
    title: "自查1 股权架构及实际控制人",
    clauses: [
      { id: "国务院令第837号 第二条", quote: "（投资者及对外投资定义相关条款——以官方原文为准）" },
      { id: "商务部令2014年第3号 第九条、第十条", quote: "（境外投资主体资格与申请材料相关条款）" },
      { id: "发改委令第11号", quote: "（企业境外投资管理办法相关条款）" },
    ],
  },
  z3: {
    title: "自查3 企业规模与资金实力（前置门槛）",
    clauses: [
      { id: "商务部令2014年第3号 第十九条", quote: "（投资资金来源真实性相关条款）" },
      { id: "国务院令第837号", quote: "（真实性审查要求上升至行政法规层级）" },
    ],
  },
  z4: {
    title: "自查4 违法违规记录（前置门槛）",
    clauses: [
      { id: "商合发〔2018〕24号", quote: "（对外投资备案（核准）报告暂行办法 + 联合惩戒机制）" },
      { id: "国务院令第837号 第十条", quote: "（分类分级全过程监管）" },
    ],
  },
  ls: {
    title: "模块三 三套负面清单核对",
    clauses: [
      { id: "发改外资〔2018〕251号", quote: "（境外投资敏感行业目录——清单A）" },
      { id: "国办发〔2017〕74号", quote: "（限制类/禁止类——清单B/C）" },
    ],
  },
  s1a: {
    title: "模块四 出口管制与技术出境",
    clauses: [
      { id: "国务院令第837号 第十三条", quote: "（涉管制物项/技术的跨境安排相关条款）" },
      { id: "中国禁止出口限制出口技术目录", quote: "（目录及清单核对依据）" },
    ],
  },
  t4: {
    title: "模块三 风险国别",
    clauses: [
      { id: "商务部系统填表说明 第15条", quote: "（需核准国别/地区范围）" },
      { id: "国办发〔2017〕74号", quote: "（敏感国家（地区）投资限制类）" },
    ],
  },
};

export const QUESTION_LIST: { moduleId: number; moduleLabel: string; questionId: string; questionLabel: string }[] = [
  { moduleId: 1, moduleLabel: "模块一 主体资格", questionId: "z1", questionLabel: "股权架构及实控人" },
  { moduleId: 1, moduleLabel: "模块一 主体资格", questionId: "z3", questionLabel: "规模与资金实力" },
  { moduleId: 1, moduleLabel: "模块一 主体资格", questionId: "z4", questionLabel: "违法违规记录" },
  { moduleId: 3, moduleLabel: "模块三 标的", questionId: "ls", questionLabel: "三套负面清单核对" },
  { moduleId: 3, moduleLabel: "模块三 标的", questionId: "t4", questionLabel: "风险国别" },
  { moduleId: 4, moduleLabel: "模块四 安全审查", questionId: "s1a", questionLabel: "出口管制与技术出境" },
];

export function buildRegulationContext(questionId: string): string {
  const e = regulationLib[questionId];
  if (!e) return "";
  const cl = e.clauses.map(c => `- ${c.id}：${c.quote}`).join("\n");
  return `问题：${e.title}\n可引用条款（只能引这些）：\n${cl}`;
}
```

> 说明：摘录里用「（条款主题——以官方原文为准）」做占位描述而非伪称逐字原文；正式版替换为律所审定的逐条原文。这是公开法规，可安全入库。

- [ ] **Step 2: 写 `copilot/api.ts`**

```ts
async function post(path: string, body: Record<string, string>): Promise<string> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg += " " + (await res.json())?.error; } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  return data?.content ?? "";
}

export const copilotApi = {
  extract: (systemPrompt: string, userText: string) => post("/api/copilot/extract", { systemPrompt, userText }),
  regulation: (contextPrompt: string, question: string) => post("/api/copilot/regulation", { contextPrompt, question }),
};
```

- [ ] **Step 3: 检查点**——`npm run build` 通过（这俩文件无 React，纯 TS，能被 esbuild 转译）。

---

### Task 4: ComplianceCopilotPanel —— 伴填 Tab

**Files:**
- Create: `src/app/compliance/components/ComplianceCopilotPanel.tsx`

**Interfaces:**
- Consumes: `WizardApi`（fields.ts）、`step: number`、`mode: Mode | null`（由 detail page 透传）、`getFieldsForStep/buildExtractSystemPrompt/parseExtractResponse`（Task 2）、`copilotApi`（Task 3）。
- Produces: 默认导出组件 `ComplianceCopilotPanel({ collapsed, onToggleCollapse, step, mode, api })`。

- [ ] **Step 1: 实现组件骨架 + 伴填 Tab**

```tsx
import { useState } from "react";
import { C } from "../complianceTheme";
import type { WizardApi } from "./fields";
import type { Mode } from "../logic/weights";
import { getFieldsForStep, buildExtractSystemPrompt, parseExtractResponse, type ParsedCandidate } from "../copilot/fieldCatalog";
import { copilotApi } from "../copilot/api";

interface Props {
  collapsed: boolean; onToggleCollapse: () => void;
  step: number; mode: Mode | null; api: WizardApi;
}

export function ComplianceCopilotPanel({ collapsed, onToggleCollapse, step, mode, api }: Props) {
  const [tab, setTab] = useState<"fill" | "regulation">("fill");
  if (collapsed) {
    return (
      <div style={{ width: 56, flexShrink: 0, background: "#fff", borderRight: `1px solid ${C.line}`, display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", gap: 8 }}>
        <button onClick={onToggleCollapse} title="展开伴填" style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.line}`, background: C.field, cursor: "pointer" }}>☰</button>
      </div>
    );
  }
  return (
    <div style={{ width: 340, flexShrink: 0, background: "#fff", borderLeft: `1px solid ${C.line}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.lineSoft}`, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: C.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>伴</span>
        <b style={{ fontSize: 13.5, color: C.ink }}>合规伴填子智能体</b>
        <button onClick={onToggleCollapse} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14 }}>▸</button>
      </div>
      <div style={{ display: "flex", background: C.lineSoft, padding: 3, margin: "8px 12px", borderRadius: 8, gap: 2 }}>
        {([["fill", "伴填"], ["regulation", "法规伴答"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "none", background: tab === k ? "#fff" : "transparent", color: tab === k ? C.primary : C.sub, fontWeight: tab === k ? 600 : 400, fontSize: 12.5, cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
        {tab === "fill" ? <FillTab step={step} mode={mode} api={api} /> : <RegulationTab />}
      </div>
    </div>
  );
}

function FillTab({ step, mode, api }: { step: number; mode: Mode | null; api: WizardApi }) {
  const fields = getFieldsForStep(step, mode);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [cands, setCands] = useState<ParsedCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (fields.length === 0) {
    return <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.7, padding: "8px 0" }}>本模块以企业自评为主，伴填不提供字段抽取。可切到「法规伴答」逐题追问，或回到<b>模块〇 企业画像</b>用伴填快速填入投资方式、国别、金额等客观信息。</div>;
  }

  const runExtract = async () => {
    setLoading(true); setError(null); setCands(null);
    try {
      const sys = buildExtractSystemPrompt(step, mode);
      const raw = await copilotApi.extract(sys, text);
      const parsed = parseExtractResponse(raw, fields);
      setCands(parsed.length ? parsed : []);
      if (parsed.length === 0) setError("未从描述中识别到可填字段，请补充描述或手动填写。");
    } catch (e: any) { setError("伴填暂不可用：" + (e?.message || e) + "，可手动填写。"); }
    finally { setLoading(false); }
  };

  const confirm = (c: ParsedCandidate, edited?: string) => {
    c.field.write(api, edited ?? c.value);
    setCands(prev => (prev ?? []).filter(x => x !== c));
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, margin: "6px 0" }}>当前可抽取：{fields.map(f => f.label).join("、")}</div>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="口语描述，如：我们准备在越南设个生产基地，注册资金自有，大概 500 万美元，可能还要银行贷一部分。" rows={4} style={{ width: "100%", boxSizing: "border-box", fontSize: 13, padding: 8, borderRadius: 8, border: `1px solid ${C.line}`, background: C.field, color: C.ink, outline: "none", resize: "vertical" }} />
      <button onClick={runExtract} disabled={loading || !text.trim()} style={{ marginTop: 8, width: "100%", padding: "8px 0", borderRadius: 8, border: "none", background: text.trim() && !loading ? C.primary : C.faint, color: "#fff", fontWeight: 600, fontSize: 13, cursor: text.trim() && !loading ? "pointer" : "not-allowed" }}>{loading ? "抽取中…" : "抽取候选字段"}</button>
      {error && <div style={{ marginTop: 8, fontSize: 12, color: C.bad, background: C.badBg, border: `1px solid ${C.badBorder}`, borderRadius: 7, padding: "6px 10px" }}>{error}</div>}
      {cands && cands.map((c, i) => <ConfirmCard key={i} c={c} onConfirm={(v) => confirm(c, v)} onDiscard={() => setCands(prev => (prev ?? []).filter(x => x !== c))} />)}
      {cands && cands.length === 0 && !error && <div style={{ marginTop: 10, fontSize: 12.5, color: C.ok }}>候选已全部处理，请回到表单核对。</div>}
    </div>
  );
}

function ConfirmCard({ c, onConfirm, onDiscard }: { c: ParsedCandidate; onConfirm: (edited?: string) => void; onDiscard: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(c.value);
  const pct = Math.round(c.confidence * 100);
  const confColor = pct >= 80 ? C.ok : pct >= 60 ? C.warn : C.bad;
  return (
    <div style={{ marginTop: 10, border: `1px solid ${C.line}`, borderRadius: 9, padding: 10, background: C.field }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <b style={{ fontSize: 12.5, color: C.ink }}>{c.field.label}</b>
        <span title="置信度" style={{ fontSize: 11, color: confColor, fontWeight: 700 }}>{pct}%{c.lowConf ? " ·低置信" : ""}</span>
      </div>
      <div style={{ height: 4, borderRadius: 3, background: C.lineSoft, marginBottom: 6 }}><div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: confColor }} /></div>
      {editing && c.field.kind === "select" ? (
        <select value={val} onChange={e => setVal(e.target.value)} style={{ width: "100%", fontSize: 12.5, padding: "5px 6px", borderRadius: 6, border: `1px solid ${C.line}`, background: "#fff", marginBottom: 6 }}>
          {c.field.allowed!.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      ) : (
        <div style={{ fontSize: 13, color: C.primary, fontWeight: 600, marginBottom: 4 }}>{c.field.kind === "select" ? (c.field.allowed!.find(a => a.value === c.value)?.label ?? c.value) : c.value}</div>
      )}
      <div style={{ fontSize: 11.5, color: C.muted, background: "#fff", borderRadius: 5, padding: "4px 6px", marginBottom: 8, lineHeight: 1.5 }}>依据：「{c.evidence}」</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onConfirm(editing ? val : undefined)} style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "none", background: C.ok, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✓ 确认填入</button>
        {c.field.kind === "select" && <button onClick={() => setEditing(v => !v)} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${C.line}`, background: "#fff", color: C.sub, fontSize: 12, cursor: "pointer" }}>{editing ? "取消" : "✎ 改"}</button>}
        <button onClick={onDiscard} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${C.line}`, background: "#fff", color: C.bad, fontSize: 12, cursor: "pointer" }}>✗</button>
      </div>
    </div>
  );
}
```

> `RegulationTab` 占位为 Task 5 实现：先 `function RegulationTab() { return <div style={{color:C.sub,fontSize:12.5}}>法规伴答即将上线</div>; }` 让本任务可编译。

- [ ] **Step 2: 检查点（/browse）**——`npm run build` 通过；`npm run dev`；/browse 进合规详情页（Task 6 完成后才能看到右栏；本任务先 `import` 进 detail page 临时渲染验证编译与无 console error）。

---

### Task 5: ComplianceCopilotPanel —— 法规伴答 Tab

**Files:**
- Modify: `src/app/compliance/components/ComplianceCopilotPanel.tsx`（替换 `RegulationTab` 占位）

**Interfaces:**
- Consumes: `QUESTION_LIST`、`buildRegulationContext`、`regulationLib`（Task 3）、`copilotApi.regulation`。

- [ ] **Step 1: 实现 `RegulationTab`**

```tsx
function RegulationTab() {
  const [qid, setQid] = useState<string>(QUESTION_LIST[0].questionId);
  const [ask, setAsk] = useState("");
  const [loading, setLoading] = useState(false);
  const [ans, setAns] = useState<{ answer: string; clauses: { id: string; quote: string }[]; needFallback: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setError(null); setAns(null);
    try {
      const ctx = buildRegulationContext(qid);
      const raw = await copilotApi.regulation(ctx, ask || "请就本题给出通俗解释与法律依据。");
      let parsed: any;
      try { parsed = JSON.parse(raw); } catch { parsed = { answer: raw, clauses: [], needFallback: false }; }
      setAns(parsed);
    } catch (e: any) { setError("法规伴答暂不可用：" + (e?.message || e)); }
    finally { setLoading(false); }
  };

  const hasLib = !!regulationLib[qid];
  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, margin: "6px 0" }}>选择自查题目追问法规依据：</div>
      <select value={qid} onChange={e => { setQid(e.target.value); setAns(null); }} style={{ width: "100%", fontSize: 12.5, padding: "6px", borderRadius: 7, border: `1px solid ${C.line}`, background: C.field, color: C.ink }}>
        {QUESTION_LIST.map(q => <option key={q.questionId} value={q.questionId}>{q.moduleLabel} · {q.questionLabel}</option>)}
      </select>
      {!hasLib && <div style={{ fontSize: 11.5, color: C.warn, margin: "6px 0" }}>本题暂未入库精选条款，回答将走兜底模板。</div>}
      <textarea value={ask} onChange={e => setAsk(e.target.value)} placeholder="可追问，或留空让伴答给出本题的通俗解释与依据。" rows={3} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, fontSize: 13, padding: 8, borderRadius: 8, border: `1px solid ${C.line}`, background: C.field, outline: "none", resize: "vertical" }} />
      <button onClick={run} disabled={loading} style={{ marginTop: 8, width: "100%", padding: "8px 0", borderRadius: 8, border: "none", background: loading ? C.faint : C.primary, color: "#fff", fontWeight: 600, fontSize: 13, cursor: loading ? "not-allowed" : "pointer" }}>{loading ? "查询中…" : "法规伴答"}</button>
      {error && <div style={{ marginTop: 8, fontSize: 12, color: C.bad, background: C.badBg, border: `1px solid ${C.badBorder}`, borderRadius: 7, padding: "6px 10px" }}>{error}</div>}
      {ans && (
        <div style={{ marginTop: 10, fontSize: 13, color: C.ink, lineHeight: 1.7 }}>
          <div style={{ background: C.primaryBg, borderLeft: `3px solid ${C.primary}`, padding: "8px 10px", borderRadius: "0 7px 7px 0", marginBottom: 8 }}>{ans.answer}</div>
          {!ans.needFallback && ans.clauses.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>引用条款：</div>
              {ans.clauses.map((c, i) => <div key={i} style={{ fontSize: 12, color: C.sub, background: C.field, borderRadius: 5, padding: "4px 7px", marginBottom: 4 }}><b>{c.id}</b>：{c.quote}</div>)}
            </>
          )}
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>本回答仅供参考，不构成法律意见；以官方原文与主管机关审查为准。</div>
        </div>
      )}
    </div>
  );
}
```

> 顶部 `import` 需补：`import { useState } from "react"`（已有）+ `import { QUESTION_LIST, buildRegulationContext, regulationLib } from "../copilot/regulationLib";`

- [ ] **Step 2: 检查点（/browse）**——`npm run build` 通过；法规伴答 tab 选「股权架构及实控人」追问 → 返回通俗解释 + 引条款（无编造文号）；选未入库项 → 走兜底句。

---

### Task 6: 接入 ComplianceDetailPage（三栏 + 上下文透传）

**Files:**
- Modify: `src/app/compliance/components/ComplianceDetailPage.tsx`

**Interfaces:**
- Consumes: `ComplianceCopilotPanel`（Task 4/5）、`WizardApi`（已有，detail page 持有 `updateState` + `working`）。

- [ ] **Step 1: detail page 增加 copilot 面板状态与透传**

在 `ComplianceDetailPage` 顶部 import：
```ts
import { ComplianceCopilotPanel } from "./ComplianceCopilotPanel";
```
在组件内加折叠状态（与 wizard/report tab 并列）：
```ts
const [copilotCollapsed, setCopilotCollapsed] = useState<boolean>(initial.generated); // 报告(已完成)默认收起
```
构造一个透传给面板的 `api`（复用现有 `updateState` 包出来的写入 api；detail page 已有 `working` 与 `updateState`）。由于 detail page 目前没有完整的 `WizardApi` 对象（它把 setState 透传给了 `ComplianceWizard`），这里新建一个薄适配器：
```ts
const wizardApi: WizardApi = {
  state: working,
  setSingle: (n, v) => updateState(prev => ({ ...prev, answers: { ...prev.answers, single: { ...prev.answers.single, [n]: v } } })),
  toggleMulti: (n, v) => updateState(prev => {
    const cur = prev.answers.multi[n] ?? [];
    let next: string[];
    if (v === "none" || v === "0") next = cur.includes(v) ? [] : [v];
    else { const c = cur.filter(x => x !== "none" && x !== "0"); next = c.includes(v) ? c.filter(x => x !== v) : [...c, v]; }
    return { ...prev, answers: { ...prev.answers, multi: { ...prev.answers.multi, [n]: next } } };
  }),
  setMode: (m) => updateState(prev => ({ ...prev, mode: m })),
  setLsNone: (b) => updateState(prev => ({ ...prev, lsNone: b })),
  uploadFile: () => {}, toggleMask: () => {},
  pickCountry: (ctry) => updateState(prev => ({ ...prev, answers: { ...prev.answers, single: { ...prev.answers.single, p_ctry: ctry } }, ctryAck: ctry ? prev.ctryAck : null })),
};
```
> 注意：`pickCountry` 在面板确认国别后只写入 `p_ctry` 并清 ack；国别提示书弹窗由 `ComplianceWizard` 内部的 `CountryNoticeModal` 在用户进入向导操作国别时触发。面板确认国别后若 `ctryAck` 为空，向导侧下次聚焦国别字段时仍会提示。此为实现取舍，不绕过红线。

- [ ] **Step 2: 三栏布局**

把现有「头部 + 内容」外层结构里，内容区右侧挂上 `ComplianceCopilotPanel`。当前 detail page 的根是 `<div flex column>`：头部 + `<div flex:1 overflow>`（内容）。改为：内容用 `flex row`，左为现有向导/报告滚动区（`flex:1`），右为 copilot 面板。具体：把
```tsx
<div style={{ flex: 1, overflowY: "auto" }}>
  {tab === "wizard" && <ComplianceWizard .../>}
  {tab === "report" && (...)}
</div>
```
替换为：
```tsx
<div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
  <div style={{ flex: 1, overflowY: "auto" }}>
    {tab === "wizard" && <ComplianceWizard state={working} setState={updateState} onGenerated={handleGenerated} />}
    {tab === "report" && (report ? <><ComplianceReport report={report} /><div style={{ textAlign: "center", paddingBottom: 32 }}><button onClick={() => setTab("wizard")} style={{ background: "none", border: `1px solid ${C.primaryBorder}`, color: C.primary, borderRadius: 8, padding: "9px 26px", fontSize: 13.5, cursor: "pointer" }}>重新自查（修改作答）</button></div></> : <div style={{ textAlign: "center", padding: "80px 0", color: C.muted }}><p style={{ fontSize: 15, color: C.sub, marginBottom: 16 }}>尚未生成自查报告</p><button onClick={() => setTab("wizard")} style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "9px 26px", fontSize: 13.5, cursor: "pointer" }}>前往自查向导</button></div>)}
  </div>
  <ComplianceCopilotPanel collapsed={copilotCollapsed} onToggleCollapse={() => setCopilotCollapsed(v => !v)} step={working.curStep} mode={working.mode} api={wizardApi} />
</div>
```
> 需在文件顶部 `import type { WizardApi } from "./fields";` 与 `import { C } from "../complianceTheme";`（若未引）。

- [ ] **Step 3: 检查点（/browse）**——`npm run build` 通过；`npm run dev`；/browse 进合规详情页：右栏可见、可收起；切 wizard/report tab 右栏都在。

---

### Task 7: 端到端验证（/browse + 安全）

**Files:** 无（仅验证）

- [ ] **Step 1: 伴填端到端**

`npm run dev`；/browse：新建合规自查 → 向导 step1（模块〇）；右栏伴填 tab 输入「我们准备在越南设个生产基地，注册资金自有，大概 500 万美元，可能还要银行贷一部分」→ 抽取候选 → 出现 investMode/country/amount/ownership 等待确认卡 → 逐项「确认填入」→ **表单对应字段被填上**（投资方式=新设类、最终目的地=越南、拟投资总额=500万美元 等）；低置信项标黄。

- [ ] **Step 2: 红线验证**

确认后继续向导，完成全部作答 → 生成报告 → 档位/齐备度反映的是**确认后的表单值**；断开 `/api/copilot/*`（临时把 vite.config 里 plugin 注释掉重启）→ 向导仍可纯手动填写并生成报告（规则引擎不依赖模型）。

- [ ] **Step 3: 法规伴答验证**

切「法规伴答」tab → 选「模块一·股权架构及实控人」→ 留空或追问 → 返回通俗解释 + 引用条款号；选未入库题目 → 走兜底句；console 无 error。

- [ ] **Step 4: 安全检查**

`grep -rl "DEEPSEEK_API_KEY" dist/ src/app 2>/dev/null` → `src/app` 下无命中（key 不进前端代码/包）；`.env` 存在且未被任何 `src/**` import 引用键名值；`npm run build` 产物 `dist/` 中 `grep -l "sk-"` 无真实 key。

- [ ] **Step 5: 检查点**——全部通过即完成。把「伴填/法规伴答」能力交付。

---

## Self-Review（写完后自检）

1. **Spec 覆盖**：伴填+双确认 → Task 2(fieldCatalog/parse)+Task 4(FillTab)+Task 6(透传)；法规伴答 → Task 3(lib)+Task 5；dev 代理与 key 安全 → Task 1+Task 7-step4；三栏布局 → Task 6；红线 → Task 7-step2；JSON mode/grounding → Task 1 wrapper + Task 3 context。✅ 全覆盖。
2. **占位扫描**：无 TBD/TODO；Task 5 的 RegulationTab、Task 4 的 ConfirmCard 均为完整代码。✅
3. **类型一致**：`WizardApi`（fields.ts）在 Task 2/6 用法一致；`getFieldsForStep/buildExtractSystemPrompt/parseExtractResponse` 签名 Task 2 定义、Task 4 消费一致；`copilotApi.extract/regulation` Task 3 定义、Task 4/5 消费一致；`ParsedCandidate` Task 2 定义、Task 4 消费一致。✅
4. **已知取舍**（非占位，已注明）：法规摘录用「条款主题描述」非伪称逐字原文（正式版替换）；面板 `pickCountry` 写入后国别提示书由向导侧下次聚焦触发，不绕红线。
