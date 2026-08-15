# ODI 模块改版设计(填报演示 + 申报助办)

> 把 ODI 从"融合在智询回答里"**拆成独立模块**,按 `ODI流程材料/ODI填报演示与申报助办完整流程_V1.0` 规格改版:ODI 入口分流两条服务(填报演示 / 申报助办),共享统一字段池 + 小海·ODI 伴填。
> 底层复用:合规自查的向导+伴填+确定性引擎架构 + 源 POC 的文档处理三件套。
> 日期:2026-08-12。

---

## 1. 背景

### 1.1 为什么改版
原始 ODI(源 POC `oversea-agent`)**融合在首页智询对话里**,寄生在 chat frames 上。当前平台(`出海智能体设计 (最新版-ODI单独平台)`)是"拆出来"的初步尝试,但形成了**两支互相不共用底座的 mock**:

| 支 | 位置 | 形式 | 数据 |
|---|---|---|---|
| **支 1** 项目驾驶舱 | `OdiProjectDetailPage`(mode: odi-list/odi-project) | 列表→详情 4 tab(驾驶舱/材料/校验/生成) | 全写死(MATERIAL_ROWS/ISSUES/DEPT_RESULTS/GENERATE_ITEMS) |
| **支 2** 对话内工作台 | `OdiWorkbenchFrame`+`OdiAssistantWorkbench`+`OdiWorkbenchPanelContent`(mode: xiaohai 的 odi-* frames) | 多步工作台 preinfo→materials→upload→review | mock,但模型更对(UploadedFile.dept / ValidationIssue.level / 校验状态机) |

两支功能重叠、各自 mock、无统一字段池、无真引擎。改版 = **合并为一支独立 ODI 模块**,取两边长处(支 1 的 `IssueCard` UI + 支 2 的部门/三态流程骨架),用 spec 把它们变真。

### 1.2 处置
- **废弃**:支 1 `OdiProjectDetailPage` 的 mock 数据、支 2 `OdiWorkbenchFrame`/`OdiAssistantWorkbench`/`OdiWorkbenchPanelContent` 的 mock;App.tsx 的 `odi-preinfo/materials/project/prereview` frames 与 `odi-list/odi-project/odi-demo` mode 收敛为统一 `odi` 模式 + `service: "guide"|"assist"`。
- **复用**:支 1 `IssueCard` 组件(证据/规则/说明/建议 UI);支 2 的 `UploadedFile.dept`、`ValidationIssue.level` 数据模型语义。

---

## 2. 设计原则

1. **独立模块**:ODI 不再寄生首页对话,自带入口、分流页、sidebar、三栏工作台。
2. **统一字段池为承重墙**:两条服务、伴填、校验、生成全部读写同一个 `OdiField[]`。
3. **确定性引擎**:校验/联动/派生是纯代码(镜像合规 `scoring.ts`),LLM 只解释/建议,不判定。
4. **镜像合规自查**:向导 / 伴填 / 引擎 / 三栏 / 报告,照抄合规的成熟形状。
5. **复用源 POC 文档三件套**:`fileParser` / `documentGenerator` / `downloadPackage`,移植到 `odi/doc/`。
6. **确认后写入**:伴填抽出的字段只是候选,用户确认才进字段池(合规红线不变)。

---

## 3. 整体架构与入口(IA)

```
平台导航 → ODI 入口
            └─ 分流页(两条服务二选一)
                 ├─ 填报演示(Guide)—— 尚无完整正式材料,7 轮引导填报,仅商务委,不上传
                 └─ 申报助办(Assist)—— 已有项目材料,上传→校验→生成,商务委+发改委
```

- 两条服务是**独立任务类型**,各自新建;共用**统一字段池 + 同一个小海·ODI 伴填**。
- App.tsx:`AppMode` 收敛新增 `"odi"`(取代 odi-list/odi-project/odi-demo 三者);`odi` 模式内由 `OdiProject.service: "guide"|"assist"` 分流渲染。

---

## 4. 数据模型与统一字段池

### 4.1 项目模型(替换当前计数器 mock)

```ts
type OdiService = "guide" | "assist";
type OdiScene = "新设独资" | "并购" | "增资变更";      // 填报演示预制场景
type OdiProjectStatus = "填报中" | "待校验" | "校验中" | "待处理" | "可生成" | "已完成";

interface OdiProject {
  id: string; name: string;
  service: OdiService;
  scene?: OdiScene;                  // 仅 guide
  fieldPool: OdiField[];             // ← 统一字段池(承重墙)
  uploadedFiles: UploadedFile[];     // 仅 assist
  validation: ValidationSnapshot | null;  // assist 三态校验;guide 用轻量即时校验
  generatedDocs: GeneratedDoc[];
  status: OdiProjectStatus;
  materialVersion?: string;          // assist:当前校验基于的材料版本
  updatedAt: string;
}
```

### 4.2 统一字段池(核心)

```ts
type OdiFieldStatus = "empty" | "recognized" | "pending_confirm" | "confirmed" | "conflict" | "missing";
type OdiDept = "commerce" | "ndrc" | "shared";

interface OdiField {
  code: string;            // "investment_country" / "chinese_share_ratio" / "merger_target_name"
  name: string;            // 中文名
  value: string;
  sources: FieldSource[];  // 多来源 → 支持跨材料冲突检测
  status: OdiFieldStatus;
  dept: OdiDept;           // 归属哪条校验管线
  round?: 1|2|3|4|5|6|7;   // 填报演示归属轮次(assist 可空)
  confidence?: number;     // 0-1(assist 抽取时给)
  derived?: boolean;       // 派生字段(不可手填)
  updatedAt: number;
}
interface FieldSource {
  origin: "guide" | "upload" | "auth" | "ai" | "derived";
  material?: string;       // upload 时来自哪份材料
  evidence?: string;       // 原文摘录 / 页码
}
```

**两条服务往池里写**:
- **guide**:逐轮填 → `origin:"guide"`;派生字段引擎算 → `origin:"derived"`;企业主档(名称/法人/地址)认证预填 → `origin:"auth"`。
- **assist**:上传材料 → fileParser 抽 → `origin:"upload"` + confidence/evidence(候选,确认才 confirmed);同字段多材料命中 → `status:"conflict"`。

### 4.3 字段目录 `field/odiFieldCatalog.ts`
镜像合规 `fieldCatalog.ts`。每字段元数据:`code/name/dept/round/口径/required/联动规则`。内容**直接从 spec 6.2 的 7 轮字段定义抽取**(见 §5.2 字段清单)。

---

## 5. 填报演示向导(Guide)

### 5.1 入口:预制场景
新建 guide 任务选**场景 + 模式**(沿用现 DemoScene/DemoMode 语义):
- **场景** `新设独资 / 并购 / 增资变更` → 决定字段集(并购触发 R7、增资变更走变更口径)
- **模式** `快速体验`(按场景预填示例值,跑通全流程) / `自定义体验`(空白自填)

### 5.2 七轮向导(镜像合规 ComplianceWizard stepper,顺序锁 + 每轮即时联动)

| 轮 | 字段 | 联动/控制 |
|---|---|---|
| **R1 基础信息** | 投资国家·投资方式·设立方式·境外目标企业注册资本·投资总额 | 投资方式→是否触发 R7;设立方式→承诺书版本;投资国家→标准化/币种/风险提示;注册资本+投资总额→金额校验基础 |
| **R2 项目情况** | 境内公司名·新设或并购公司名·境外企业外文名·投资目的地·经营范围·所属行业 | 企业主档(名称/法人/地址)从认证预填,不重复问 |
| **R3 投资结构** | 中方/外方股东及股比·是否涉限制出口·是否影响一国以上·注册资中方/外方比例 | 无外方股东→单一中方投资默认(中方=境内公司 100%) |
| **R4 投资金额** | 中方/外方投资额·折算汇率·中方出资币种1+金额1·币种2+金额2 | **派生**:中方投资额人民币 / 外方投资额人民币 / 投资总额人民币 |
| **R5 出资安排** | 现金/自有/银行贷款/实物/无形资产/股权/其他 × 境内 + 境外三项 | 金额勾稽(各路出资和≈投资额) |
| **R6 项目说明** | 项目简况·项目意义 | 伴填可起草,**禁编造**:收益/就业/税收/市场规模/经营业绩/风险事实 |
| **R7 并购专项** | 仅并购:并购实施子公司·注册资本·注册地·并购背景·拟并购股权资产·交易方式·资金筹措·时间安排·风险·需政府服务 | 仅 R1 投资方式=并购 才出现 |

### 5.3 字段联动引擎 `field/odiGuideLogic.ts`(镜像合规 wizardModel + scoring 轻量版)
落地 spec 6.3 四条联动 + 三条派生:
- **企业主档复用**:认证后企业名称/法定代表人/注册地址/联系人 → `origin:"auth"` 预填
- **单一中方投资默认**:无外方股东 → 中方股东=境内公司 100%、外方=空、注册资中方比例=100%
- **投资方式→并购专项**:R1 选并购 → 解锁 R7;否则隐藏
- **设立方式→承诺书版本**:决定生成时承诺书模板分支
- **派生**:中方/外方投资额×汇率→人民币;各方人民币→投资总额人民币(`derived:true`,不可手填)

### 5.4 伴填(G 模式)
口语描述("越南胡志明市设独资厂,800 万美元,自有 500+贷款 300")→ 伴填抽该轮字段候选(投资国家/方式/总额/出资安排)带置信度+依据 → **确认后写入**。R6 可让伴填基于已确认字段起草项目说明(提示"草稿需核验",挡禁编造项)。

### 5.5 生成参考稿(G 模式尾部)
字段不要求全填,**缺失留空也允许生成**(spec 6.1)。走 `doc/documentGenerator` 从 fieldPool 回填,生成商务委三件:备案表 / 真实性承诺书(按设立方式选版本)/ 可行性研究报告。并购场景加并购前期报告表。

---

## 6. 申报助办三栏(Assist)

> 现状 4 tab(驾驶舱/材料/校验/生成)全 mock。改版:**驾驶舱变真**(从字段池+校验实时算)+ spec **三栏**工作流。

### 6.1 栏一 · 材料上传
- 上传区(拖拽/点击)→ **文件基础检查**(PDF/DOC/DOCX、≤20MB;复用源 POC `fileParser.validateUploadFile`),失败给具体原因重来
- 上传成功 → `待校验`;可继续多传;材料列表显示 文件名/类型/**识别后部门归属**/版本/识别状态/校验状态
- 🔒 **校验锁定机制(spec V3,关键)**:点"开始校验"后,**上传/删除/替换/下载/生成/切换任务/对话**全部锁住,直到校验完成解锁——现版完全缺失。

### 6.2 栏二 · 材料校验中心(核心引擎)
```
开始校验(材料版本变化才触发)
 → 锁定全部操作
 → OCR + 文本/版面解析(fileParser:pdfjs/mammoth + DeepSeek 抽字段)
 → 识别材料类型/部门(commerce|ndrc|shared)/版本
 → 字段抽取·标准化·写入统一字段池(多材料命中同字段→conflict)
 → 按材料覆盖分流校验:
     商务委材料    → 商务委校验管线
     发改委材料    → 发改委校验管线
     仅共用材料    → 主体/财务/资金 预校验
     两侧均有      → 并行 商务委+发改委+跨业务
     无可识别材料  → 输出 缺失/不匹配
 → 汇总三态(通过/不通过/缺失)
 → 解锁 + 记录材料版本
 → 展示三区:商务委结果 / 发改委结果 / 跨业务核心字段结果
```
**问题卡**:复用支 1 `IssueCard`(证据位置/命中规则/说明/建议),数据从字段池 DERIVE(见 §7)。

### 6.3 栏三 · 生成管理
- **生成条件判断**:商务委字段齐备度达标 + 无阻断级 issue → 可生成;否则按钮置灰 + 说明缺什么
- 生成:**备案表 + 真实性承诺书**(按设立方式选版本)+ 并购场景加**并购前期报告表**(`doc/documentGenerator` 从 fieldPool 回填)
- **预览 / 下载**:单份下载或 `doc/downloadPackage` 打 zip(含材料状态说明)
- ⚠️ **发改委只校验、不生成**(spec 明确)

### 6.4 驾驶舱(overview,变真)
不再写死 `DEPT_RESULTS`/`ACTIVITY`。所有数字从 `fieldPool` + `validation` 实时算:已传/已识别/三态计数/字段齐备度/关键待办(从 issue 派生)。`StatusCard` 5 态由真实状态驱动。

### 6.5 伴填(A 模式)
"问小海"遍布三栏。职责:**解释某条 issue**(+命中规则+怎么办)、追问法规、辅助处理 issue、基于字段答疑。只解释/建议,不改字段池。

---

## 7. 校验引擎(确定性,规则源自 spec §11-16)

### 7.1 架构与结果模型
**引擎是代码,不是 LLM**。输入 `fieldPool + uploadedFiles` → 输出 `ValidationSnapshot`。LLM 只解释/建议,不判定。结果模型严格对齐 spec §15:

```ts
type RuleResult = "pass" | "fail" | "missing" | "not_triggered";  // §15.1 三态 + §15.2 未触发
interface ValidationIssue {
  id: string; ruleId: string; ruleName: string;
  result: RuleResult;
  ruleType: "consistency" | "missing" | "validity" | "format" | "completeness";
  dept: "commerce" | "ndrc" | "shared";
  field: string;
  materials: { name: string; value: string; page: string }[];  // 证据位置→IssueCard
  reason: string; suggestion: string;
}
interface ValidationSnapshot {
  commerce: ValidationIssue[]; ndrc: ValidationIssue[]; cross: ValidationIssue[];
  summary: { passed: number; failed: number; missing: number };
  materialVersion: string; locked: boolean;
}
```
- 汇总优先级 **不通过 > 缺失 > 通过**(§15.3);汇总为不通过时仍显示缺失项数量与清单;风险提示(如负债率>75%)不自动改三态(§11.6/§15.3)。

### 7.2 三条管线(按 spec §14.1 分流,共享字段池)
- **跨业务管线**(§14):**同时**识别到商务委+发改委材料才触发;只校验客观核心字段(§14.4 主观文本不跨业务比)
- **商务委管线**(§11):8 层(§7.3)
- **发改委管线**(§13):9 层(§7.4)
- 仅共用材料 → 只跑主体/财务/资金预校验,三管线均未触发(§14.1)

### 7.3 商务委校验流水线(spec §11,8 层)
1. **文件层**:可读/页面完整/类型可识别/商务委版本正确/主体可识别/多版本关系明确
2. **单材料字段层**:必填/条件必填/格式/枚举/内容充分性/表单内部金额与股比
3. **主体与决策链**:营业执照=主体基准;章程→有权决策机构;决策文件决策机构与章程匹配;决议/承诺书/备案表/可研主体与投资事项一致(不一致**显示证据位置,不自动选择**)
4. **项目场景**:投资方式/设立方式/承诺书版本匹配/境外企业中英文名/投资国家/直接vs最终目的地口径/投资路径层级 一致
5. **金额币种股权**(勾稽):注册资本<投资总额、中方+外方=投资总额、股比合计=100%、股比与投资额占比一致、出资币种金额折算=投资额、出资构成=中方投资额、资金证明=出资额(计算前必须识别数值/币种/单位/汇率)
6. **财务提示**:负债率>75%/未分配利润为负/净利润为负 → **只提示不阻断**
7. **前期工作报告**:新设/并购各有检查清单(项目概况/股权/经营范围/…/标的情况/并购合规性…)
8. **形式审查**:只识别签名/盖章存在,不判真伪/权限/效力

### 7.4 发改委校验流水线(spec §13,9 层)
1. **材料完备性**:备案表完整/请示结构/承诺书要素/营业执照可识别/财报三表/资金文件覆盖
2. **备案表字段**:按官方表单逐字段(必填/条件必填/格式/枚举/口径/充分性);长文本(项目背景/内容规模/风险/国家利益/下一步)保持整段不拆分
3. **主体一致性**(7 项与营业执照比对):企业名称/信用代码/注册地址/注册资本/成立日期/企业类型/经营范围
4. **金额**:总投资额≥中方投资额;同币种直接比、多币种按币种分比/折算;构成合计=中方投资额;允许≤0.01万美元四舍五入;缺币种/单位/汇率→缺失
5. **资金来源**:全部自有/部分自有/银行融资/实物股权知产/其他募集 各有匹配规则
6. **财务数据**:总资产/净资产/主营收入/净利润 对应财报(负数保留原值)
7. **请示和承诺书**:项目名称/投资主体/投资方式/目的地/投资金额 一致 + 公文结构/承诺内容完整
8. **文本充分性**:项目背景/内容规模/行业/目的地/风险/国家利益/下一步 单独检查(**不与商务委主观文本跨业务比对**)
9. **形式审查边界**

### 7.5 跨业务核心字段矩阵(spec §14.2,15 组真实字段)
每字段给出在 **商务委材料 / 发改委材料 / 并购前期报告 / 真实性承诺** 四处的对应来源,引擎按矩阵做多源比对(完整四列对应见 spec §14.2):

| # | 统一字段 | # | 统一字段 |
|---|---|---|---|
| 1 | 境内投资主体名称 | 9 | 最终目的地 |
| 2 | 统一社会信用代码 | 10 | 境外企业中文/外文名称 |
| 3 | 注册地址 | 11 | 股权结构 |
| 4 | 境内投资主体注册资本 | 12 | 项目总投资额 |
| 5 | 行业/经营范围 | 13 | 中方投资额 |
| 6 | 联系人信息 | 14 | 中方出资币种和金额 |
| 7 | 设立/投资方式 | 15 | 中方投资构成 |
| 8 | 直接目的地 | | |

### 7.6 比对口径(spec §14.3,引擎核心逻辑)
六种比对方式,字段按类型选用:
- **精确标准化比对**:境内投资主体名称/信用代码/注册地址/注册资本
- **对象拆分比对**:境外企业行业 vs 发改投资行业领域;境内主体经营范围只与营业执照+发改备案表比(不强求与境外企业经营范围同)
- **交集字段比对**:联系人只比双方共同出现的 姓名/座机/手机/电邮
- **场景兼容映射**:商务新设=发改新建、并购=并购、增资=增资;并购报告交易方式只作佐证不代替投资方式;**跨业务比的是投资动作(新设/并购/增资/变更),子公司/分公司/办事处等设立形态不与发改投资方式机械比**
- **目的地层级**:直接目的地只与第一层级境外企业所在地比;最终目的地只与实际经营/建设/并购标的所在地比;**直接与最终不得混用**
- **名称/股权/金额/承诺书**:境外企业中英文名/暂定名/登记名/并购标的名分别存比;股权按股东名+股比+层级结构化比(不比整段文字);金额统一为 数值+币种+单位+汇率 后比;两套承诺书正文不同,只提取核心事实不比模板正文

### 7.7 不进入跨业务匹配的字段(spec §14.4)
项目简况/项目意义/项目背景/实施安排/风险措施/国家利益安全影响 等**主观叙述字段只做各自材料内部必填+充分性检查**,不跨业务比对。

### 7.8 规则来源(纠正)
**校验规则权威来源 = spec docx §11-16**(商务委 8 层 / 发改委 9 层 / 跨业务矩阵+比对口径 / 三态结果模型),**不是从零编写**。源 POC `validationEngine.ts`(7 条通用规则 + 规则注册表架构)作为**架构参考**移植(`runValidation→results→todos→hasBlocker` 模式),规则内容以 spec 为准。spec 引用的 `ODI材料字段填写清单 V1.4`、`字段级校验清单 V1.0`、`ODI校验规则文档.txt` 仍不在工作区,取得后用于逐条核对/补全。

---

## 8. 小海·ODI 伴填(两条服务共享)

### 8.1 职责(按服务切换)
| | 填报演示(G) | 申报助办(A) |
|---|---|---|
| 职责 | 口语→抽该轮字段候选→确认写入;R6 起草项目说明(挡禁编造) | 解释 issue(+规则+怎么办)、追问法规、辅助处理、字段答疑 |
| 红线 | 确认后才写入字段池 | 只解释/建议,不改字段池 |
| 后端 | 复用现 `server.js`:`/api/copilot/extract`+`/api/copilot/regulation`+`/api/copilot/general-stream` | 同左 |

### 8.2 配套(镜像合规,新写同结构)
- `copilot/odiQaLibrary.ts` — ODI 字段/轮次预设问答(秒出,hover 浮层复用)
- `copilot/odiRegulationLib.ts` — ODI 法规库(837号令/3号令/11号令/74号文),**补真实条文摘录**(合规 regulationLib 是占位,已知隐患)

### 8.3 布局
三栏:`OdiSidebar | (向导/三栏) | OdiCopilotPanel`,照搬合规三栏。

---

## 9. 复用清单

| 来源 | 复用 | 新写 |
|---|---|---|
| **合规自查** | wizard 骨架、伴填 UX、`fieldCatalog`/`chatPrompt`/`parseChatResponse` 范式、`scoring.ts` 确定性引擎范式、三栏布局、`reportHtml` 政务风、qaLibrary/regulationLib 范式 | — |
| **源 POC** | `fileParser`、`documentGenerator`、`downloadPackage`、`validationEngine`(架构:规则注册表) | — |
| **当前项目** | 支1 `IssueCard`、支2 `UploadedFile.dept`/`ValidationIssue.level` 语义、项目列表→详情外壳 | — |
| **新写** | — | `OdiField` 字段池、`odiFieldCatalog`、`odiGuideLogic`、`odiValidation`、`odiQaLibrary`、`odiRegulationLib`(补真条文)、`OdiEntry`/分流页、`OdiGuideWizard`、`OdiAssistWorkbench`、`OdiCopilotPanel` |

## 10. 文件结构(镜像 `src/app/compliance/`)
```
src/app/odi/
├── data/        odiProjects.ts · types.ts
├── field/       odiFieldCatalog.ts · odiGuideLogic.ts · odiValidation.ts   ← 引擎,纯逻辑可单测
├── copilot/     odiChatPrompt.ts · odiQaLibrary.ts · odiRegulationLib.ts
├── doc/         documentGenerator.ts · downloadPackage.ts                  ← 从源 POC 移植
└── components/  OdiEntry.tsx · OdiGuideWizard.tsx · OdiAssistWorkbench.tsx
                 OdiCopilotPanel.tsx · IssueCard.tsx(复用) · GenDocPreview.tsx
```
废弃见 §1.2。App.tsx:新增 `"odi"` mode + handlers,下线 odi-* frames 与 odi-list/project/demo 三 mode。

---

## 11. 分期实施(设计全量,落地分批;每期复用 P0 字段池)

| 期 | 范围 | 产出 |
|---|---|---|
| **P0 骨架** | 模块入口分流 + `OdiField` 字段池 + `odiFieldCatalog`(字段目录 from spec)+ App.tsx mode 收敛 | ODI 独立模块可进,字段池就位 |
| **P1 填报演示** | 7 轮向导 + 预制场景 + 联动/派生 + 伴填(G) + 商务委生成参考稿 | guide 端到端跑通 |
| **P2 申报助办核心** | 上传→fileParser 抽字段入池→校验引擎(商务委§11 / 发改委§13 / 跨业务§14 含矩阵+比对口径)→三态展示→校验锁定 | assist 从 mock→真 |
| **P3 补全** | 驾驶舱 real + 打包下载 + 法规条文补真 + odiQaLibrary + 取得官方 xlsx/txt 后逐条核对规则 | 完整 |

---

## 12. POC 边界与风险

- **纯前端**(与合规一致):项目存 App.tsx state,无后端持久化;DeepSeek key 走 vite dev-server 中间件(服务端 only);`server.js` 现有 `/api/copilot/*` 端点直接复用,不新增后端。
- **验证**:`npm test`(vitest,引擎纯逻辑单测)+ `npm run dev`(/browse 交互)。注意 exFAT `dist/` 损坏老问题——构建用 `--outDir` 绕过,校验以 test + dev 为准。
- **风险**:
  - 校验规则源自 spec §11-16(权威),但 spec 引用的官方字段清单 xlsx/txt 未取得——取得前按 spec 文字实现,取得后逐条核对补全(§7.8)。
  - 源 POC `FieldPoolItem` 与本设计 `OdiField`(多来源 `sources[]`)形状不同——移植 fileParser/validationEngine 时需对齐数据形状。
  - 工程量大(全量 C)——严格按 P0-P3 分期,每期可独立验证。

---

## 附:与 spec 的对应

| spec(`ODI填报演示与申报助办完整流程_V1.0`) | 本设计 |
|---|---|
| 统一字段池 | §4.2 `OdiField` |
| 填报演示 7 轮 + 字段联动 6.2/6.3 | §5 |
| 申报助办三栏 + 校验锁定 V3 | §6 |
| 商务委校验流水线 §11(8 层) | §7.3 |
| 发改委校验流水线 §13(9 层) | §7.4 |
| 跨业务核心字段矩阵 §14.2(15 组) | §7.5 |
| 比对口径 §14.3(6 种) | §7.6 |
| 不进入跨业务字段 §14.4 | §7.7 |
| 审核结果模型 §15(三态 + 优先级) | §7.1 |
| 商务委生成(备案表/承诺书/并购报告) | §5.5 / §6.3 |
| 发改委只校验不生成 | §6.3 |
