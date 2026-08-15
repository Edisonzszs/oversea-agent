# 合规自查·伴填子智能体设计（DeepSeek 驱动）

日期：2026-08-06  
范围：ODI POC（`出海智能体设计 (最新版-ODI单独平台)`）内的「企业合规自查」模块升级。  
依据：`企业出海合规智能体设计方案\出海合规自测智能体设计方案.html`（§4 交互、§4.3 双确认、§5.3 伴填 sub_agent、§4.2 法规伴答）。

## 1. 背景与目标

V1 已把「合规自查」移植进 POC（表单流 + 判档计分规则引擎，对律所 V5 口径零改动，位于 `src/app/compliance/`）。本设计在其之上加**智能体层**：右侧常驻一个**独立的伴填子智能体**（不复用 ODI 的 `OdiProjectAssistantPanel`），用真模型（DeepSeek）实现两类能力：

1. **自然语言伴填 + 双确认**（§4.3/§5.3）：企业口语描述 → 伴填抽取候选字段值 + 置信度 + 依据 → 待确认卡逐项确认 → 仅确认项写入表单。
2. **逐题法规伴答**（§4.2 行1）：每题「分析依据」升级为可追问的法规问答，强制引条款号 + 原文摘录 + 通俗解释 + 免责尾注。

**红线（设计 §4.3）**：伴填抽取结果在任何情况下不得未经确认直接进入判档输入；判档输入永远来自表单确认值，与对话内容物理隔离。演示环境同样执行。

**本轮不做**：报告个性化解读（§4.2 行3）、七点位/缺件行动建议全量（§4.4；V1 报告已有部分雏形）。

## 2. 已验证的技术前提

- DeepSeek API 可达：`POST https://api.deepseek.com/chat/completions`，HTTP 200，延迟约 0.7–1.5s。
- key 有效；模型 `deepseek-chat`（当前命中 `deepseek-v4-flash`）。
- **JSON mode 可用**（`response_format: {type:"json_object"}`）：实测输入「字段清单(含口径注释)+企业描述」，输出干净的 `{字段:{value,confidence,evidence}}`，且正确遵循口径注释（未误判）。
- 支持 **prompt cache**（返回含 `prompt_cache_*` 字段）：大段稳定的 system prompt（字段清单/法规 context）可缓存，重复调用降本。

## 3. 架构

```
浏览器(React)                    Vite dev server(中间件)            DeepSeek
ComplianceCopilotPanel  ──/api/copilot/*──>  持 key、拼 prompt   ──>  deepseek-chat
 (右侧伴填栏)            (相对路径，不见key)    (JSON mode/grounding)     (JSON/文本)
```

三处落位：
- **前端**：`ComplianceCopilotPanel`（独立组件，右侧栏，伴填/法规伴答两 tab）。
- **Vite 中间件**（`vite.config.ts` 的 `configureServer`）：`/api/copilot/extract`、`/api/copilot/regulation` 两个端点，服务端持 key、拼 prompt、调 DeepSeek。
- **`.env`（gitignored）**：`DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL`。

**为什么走 dev 代理而不浏览器直连**：① key 不进前端包（直连会在 DevTools/构建产物里暴露 key）；② 绕开 DeepSeek 可能的浏览器 CORS 限制；③ 服务端可加 prompt 复用与限流。环境变量**不加 `VITE_` 前缀**（加了会被打进客户端包），仅 `process.env` 服务端读取。

判档计分仍是客户端 `logic/scoring.ts`（零改动）；本设计只新增「智能体调用 + 右栏 UI」，不动规则引擎。

## 4. 伴填数据流（双确认防幻觉）

1. 用户停在向导步骤 N（某模块）。右栏伴填 tab 由 `ComplianceDetailPage` 把当前 step/module 透传进来，面板据此取该模块的「可抽取字段清单」（字段键、标签、可选值、口径注释、回写映射）。
2. 用户在描述区口语描述或粘贴材料（可选「场景预设」chip 填充示例）。点「抽取候选」。
3. 前端 `POST /api/copilot/extract` `{module, description}` → 中间件拼 system（字段清单 + 口径注释 + 「只填客观事实、不确定省略、严禁臆测、只输出 JSON」）+ user（描述）→ DeepSeek JSON mode → `[{field, value, confidence, evidence}]`。
4. 面板渲染**待确认卡**列表：字段名 / 候选值 / 置信度条 / 依据摘录 / `✓确认` `✎修改` `✗放弃`。
   - 置信度 `< 0.8` 标黄「低置信·需复核」，仍允许确认（由人把关）。
5. 仅「确认 / 修改」项经**回写映射**写入 `WizardState`（复用现有 wizard 的 `setSingle / setMode / toggleMulti` 等）。例如 `investMode=new` → `setMode('new')`；`country=越南` → 触发既有国别选择 + 国别提示书弹窗流程。
6. 放弃项不留存；确认动作计入审计（字段级，不存对话原文——POC 阶段仅 console 留痕）。

**红线落实**：抽取结果绝不直接 `setState`；只有确认按钮触发写入；向导的 `validateStep` 仍照常把关。判档输入始终来自表单。

## 5. 法规伴答数据流（grounded 防编造）

1. 法规伴答 tab 展示「当前题」上下文（题干 + 口径注释 + 文号），提供「追问」输入与若干建议问。
2. 前端 `POST /api/copilot/regulation` `{questionId, ask}` → 中间件拼 system（「只能引用下述提供条款；无命中则回固定模板，不得编造条文」）+ context（该题的「分析依据」+ `regulationLib` 中精选条款原文摘录）+ user（追问）→ DeepSeek → `{answer, clauses:[{编号,摘录}], needFallback}`。
3. 渲染：通俗解释 + 条款号与原文摘录列表 + 免责尾注。
4. 无命中（`needFallback=true`）→ 固定模板「该问题超出本工具解读范围，建议查阅原文或咨询平台专业服务联盟机构」。

`regulationLib.ts` 首批收录公开法规的关键条款摘录（国务院令 837 号、商务部令 2014 年第 3 号第 9/10/14/15/19 条、发改委令第 11 号第 16/34 条、国办发〔2017〕74 号限制/禁止类、汇发〔2014〕37 号、国务院令 835 号等），按问题/模块键索引。POC 不做向量 RAG，用「精选条款 + 模型 grounding」即可防编造。

## 6. 三栏布局

`ComplianceDetailPage` 由两栏改三栏：`ComplianceSidebar` | 中（向导/报告）| `ComplianceCopilotPanel`。

- 右栏可收起，照搬 ODI 侧的收起交互（`motion/tokens.ts`、内联样式）。
- 向导 tab 默认展开右栏；报告 tab 默认收起（报告本身是主信息）。
- 右栏上下文随当前 step/question 变化（伴填目标模块、法规伴答当前题）。

## 7. 文件计划

新增：
- `src/app/compliance/copilot/fieldCatalog.ts` — 模块 → 可抽取字段（key/label/allowedValues/口径注释/回写映射）。口径注释直接取自律所原文。
- `src/app/compliance/copilot/regulationLib.ts` — 精选法规条款摘录库（按 questionId/module 索引）。
- `src/app/compliance/copilot/api.ts` — 前端封装：`extract(module, desc)`、`regulation(questionId, ask)`，调 `/api/copilot/*`。
- `src/app/compliance/components/ComplianceCopilotPanel.tsx` — 右栏（伴填/法规两 tab、待确认卡、状态机）。
- `src/server/copilot.ts` — 服务端中间件（`/api/copilot/extract`、`/api/copilot/regulation`），由 `vite.config.ts` 的 `configureServer` 引入。
- `.env`（含 `DEEPSEEK_API_KEY` 等）、`.gitignore`（忽略 `.env`、`node_modules`、`dist`）。

改动：
- `src/app/compliance/components/ComplianceDetailPage.tsx` — 两栏 → 三栏，把当前 step/module 与 wizard 写入 api 透传给 copilot 面板。
- `src/app/App.tsx` — 无需改动（向导状态与 step 都在 detail page 内，面板由 detail page 直接喂参）。

不动：`logic/scoring.ts` / `weights.ts` / `wizardModel.ts`（规则引擎）、V1 向导与报告组件。

## 8. 模型、成本与降级

- 模型 `deepseek-chat` + JSON mode（伴填）；法规伴答用同模型纯文本。
- system prompt（字段清单、法规 context）保持稳定以命中 prompt cache。
- 降级：API 超时/错误 → 面板提示「伴填暂不可用，请手动填写」+ 重试；抽取为空 → 「未从描述中识别到可填字段」；全部低置信 → 全标黄交人复核。

## 9. 验证

1. `npm run dev` 起服务；右栏可见、可收起。
2. 伴填：在模块〇输入「越南设厂，部分银行贷款」→ 抽取 → 确认 investMode/country/hasNonOwnFunds → 表单字段真被填上、国别弹窗正常触发；判档/齐备度随之更新。
3. 低置信字段标黄；放弃项不写入。
4. 法规伴答：对某题追问 → 返回通俗解释 + 引条款号；超出范围问 → 固定模板；无编造条文。
5. 红线：断网/关代理时，向导仍可纯手动填写并生成报告（规则引擎不依赖模型）。
6. key 不出现在前端构建产物（`grep -r DEEPSEEK_API_KEY dist/` 无命中；`.env` 已 gitignore）。

## 10. 安全注意

- API key 由用户提供，已暴露在会话记录中 → 用完建议在 DeepSeek 后台轮换。
- key 仅存 `.env`（gitignored）、仅服务端 `process.env` 读取，不进客户端包、不进 git。
- 企业描述经 DeepSeek 处理（用户已知并授权）；POC 不上传文件内容（伴填只接收文本描述）。
