import { useState } from "react";

export type AssistantContext =
  | { type: "project"; projectId: string; projectName: string }
  | { type: "material"; projectId: string; projectName: string; materialId: string; materialName: string }
  | { type: "issue"; projectId: string; projectName: string; issueId: string; issueName: string; department: string; fieldCode?: string };

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  context: AssistantContext;
  pendingCount?: number;
  serviceType?: "assist" | "demo";
  projectStatus?: string;
}

// ── Avatar ────────────────────────────────────────────────
function XiaohaiAvatar({ size = 36, demo = false }: { size?: number; demo?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: demo
        ? "linear-gradient(135deg,#d97706 0%,#f59e0b 100%)"
        : "linear-gradient(135deg,#1a5bc6 0%,#3b82f6 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="#fff" strokeWidth="1.6"/>
        <path d="M6.5 8.5c0-1.38 1.12-2.5 3.5-2.5s3.5 1.12 3.5 2.5c0 1.5-1.2 2.3-2.5 2.8V13" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="10" cy="14.5" r="0.8" fill="#fff"/>
      </svg>
    </div>
  );
}

// ── Context tag ───────────────────────────────────────────
function ContextTag({ context, demo }: { context: AssistantContext; demo: boolean }) {
  const styles = {
    project:  { color: demo ? "#92400e" : "#1a5bc6",  background: demo ? "#fff7ed" : "#eff6ff", border: `1px solid ${demo ? "#fde68a" : "#bfdbfe"}` },
    material: { color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0" },
    issue:    { color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a" },
  };
  const labels = { project: "已关联项目", material: "已关联材料", issue: "已关联问题" };
  const name =
    context.type === "project"  ? context.projectName :
    context.type === "material" ? context.materialName :
    context.issueName;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "10px 14px", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, ...styles[context.type] }}>
        {labels[context.type]}：{name}
      </span>
      {context.type === "issue" && context.department && (
        <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, color: "#6d28d9", background: "#f5f3ff", border: "1px solid #ddd6fe" }}>
          {context.department}
        </span>
      )}
    </div>
  );
}

// ── Proactive status messages ─────────────────────────────
function ProactiveMessage({ context, demo, pendingCount }: { context: AssistantContext; demo: boolean; pendingCount?: number }) {
  const accent = demo ? "#92400e" : "#1e40af";
  const bg = demo ? "#fff7ed" : "#eff6ff";
  const border = demo ? "#fde68a" : "#bfdbfe";

  let msg = "";

  if (demo) {
    msg = "当前投资总额为500万美元，其中自有资金350万（70%）、银行贷款150万（30%），资金合计关系正确。";
  } else if (context.type === "issue") {
    msg = `我已定位到「${context.issueName}」相关问题。这是当前影响${context.department}校验的核心字段，需要在两份材料中保持一致后重新上传。`;
  } else if (context.type === "material") {
    msg = `我已识别「${context.materialName}」的关键字段。该材料涉及核心申报信息，以下是识别结果和校验状态。`;
  } else if ((pendingCount ?? 0) > 0) {
    msg = `本次发现 ${pendingCount} 个待处理问题，其中投资总额不一致的影响范围最大，建议优先处理。`;
  } else {
    msg = "我可以帮助您了解需要准备哪些材料，解释校验规则，或协助分析当前问题。";
  }

  return (
    <div style={{ margin: "12px 14px", padding: "10px 14px", borderRadius: 10, background: bg, border: `1px solid ${border}` }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <XiaohaiAvatar size={20} demo={demo} />
        <div style={{ fontSize: 12, color: accent, lineHeight: 1.6, flex: 1 }}>{msg}</div>
      </div>
    </div>
  );
}

// ── Quick questions ───────────────────────────────────────
const DEMO_QUICK_QUESTIONS = [
  "为什么需要填写注册资本？",
  "修改投资总额会影响什么？",
  "当前资金结构为什么合理？",
  "帮我生成项目说明草稿",
  "恢复案例默认值",
  "下一步体验什么？",
];

const ASSIST_QUICK: Record<string, string[]> = {
  project_pending: [
    "查看最重要的问题",
    "为什么校验不通过？",
    "缺少哪些材料？",
    "字段来自哪份材料？",
    "下一步应该先处理什么？",
  ],
  project_unuploaded: [
    "需要准备哪些材料？",
    "商务委和发改委有什么区别？",
    "支持哪些文件格式？",
  ],
  project_uploaded: [
    "本次会检查什么？",
    "哪些材料可能缺失？",
    "开始校验前要注意什么？",
  ],
  project: [
    "缺少哪些材料？",
    "为什么校验不通过？",
    "建议下一步补充什么？",
    "当前不能生成的原因是什么？",
  ],
  material: [
    "这份材料的主要用途？",
    "已识别到哪些关键字段？",
    "该材料存在哪些校验问题？",
    "如何更新这份材料？",
  ],
  issue: [
    "为什么校验不通过？",
    "这个字段来自哪份材料？",
    "建议如何处理？",
    "定位到材料证据",
  ],
};

function getQuickQuestions(context: AssistantContext, demo: boolean, pendingCount?: number): string[] {
  if (demo) return DEMO_QUICK_QUESTIONS;
  if (context.type === "material") return ASSIST_QUICK.material;
  if (context.type === "issue") return ASSIST_QUICK.issue;
  if ((pendingCount ?? 0) > 0) return ASSIST_QUICK.project_pending;
  return ASSIST_QUICK.project;
}

// ── Suggested questions panel ─────────────────────────────
function SuggestedPanel({ context, demo, onAsk, pendingCount }: { context: AssistantContext; demo: boolean; onAsk: (q: string) => void; pendingCount?: number }) {
  const questions = getQuickQuestions(context, demo, pendingCount);
  const accent = demo ? "#d97706" : "#1a5bc6";
  const accentBg = demo ? "#fff7ed" : "#eff6ff";
  const accentBorder = demo ? "#fde68a" : "#bfdbfe";

  return (
    <div>
      <ProactiveMessage context={context} demo={demo} pendingCount={pendingCount} />
      <div style={{ padding: "0 14px 12px" }}>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8, fontWeight: 600, letterSpacing: 0.5 }}>快捷操作</div>
        {questions.map((q, i) => (
          <button key={i} onClick={() => onAsk(q)} style={{
            display: "block", width: "100%", textAlign: "left", padding: "9px 12px", marginBottom: 6,
            background: "#f8fafc", border: "1px solid #e5eaf2", borderRadius: 8, cursor: "pointer",
            fontSize: 12, color: "#374151", lineHeight: 1.45, transition: "background 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = accentBg; e.currentTarget.style.borderColor = accentBorder; e.currentTarget.style.color = accent; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#e5eaf2"; e.currentTarget.style.color = "#374151"; }}
          >{q}</button>
        ))}
      </div>

      {/* Proactive alert for issues */}
      {!demo && (pendingCount ?? 0) > 0 && (
        <div style={{ margin: "0 14px 14px", padding: "12px 14px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fde68a" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
            发现 {pendingCount} 个待处理问题
          </div>
          <div style={{ fontSize: 11, color: "#92400e", lineHeight: 1.6, marginBottom: 10 }}>
            其中投资总额不一致的影响范围最大，会阻碍商务委校验通过。
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onAsk("查看最重要的问题")} style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: "1px solid #fde68a", background: "#fff", fontSize: 11, color: "#92400e", cursor: "pointer", fontWeight: 600 }}>查看问题</button>
            <button onClick={() => onAsk("继续查看")} style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: "none", background: "#d97706", fontSize: 11, color: "#fff", cursor: "pointer", fontWeight: 600 }}>继续处理</button>
          </div>
        </div>
      )}

      {demo && (
        <div style={{ margin: "0 14px 14px", padding: "12px 14px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fde68a" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>发现1处可以调整的内容</div>
          <div style={{ fontSize: 11, color: "#92400e", lineHeight: 1.6, marginBottom: 10 }}>
            当前自有资金和贷款合计与投资总额不一致，但这不会阻断模拟材料生成。
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onAsk("查看提示")} style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: "1px solid #fde68a", background: "#fff", fontSize: 11, color: "#92400e", cursor: "pointer", fontWeight: 600 }}>查看提示</button>
            <button onClick={() => onAsk("继续生成")} style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: "none", background: "#d97706", fontSize: 11, color: "#fff", cursor: "pointer", fontWeight: 600 }}>继续生成</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Answer cards ──────────────────────────────────────────
function ProjectAnswer({ context, demo, pendingCount }: { context: AssistantContext & { type: "project" }; demo: boolean; pendingCount?: number }) {
  if (demo) {
    return (
      <div style={{ padding: "0 14px 14px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", marginBottom: 10 }}>模拟填报要点</div>
        {[
          "投资总额字段是核心字段，修改后系统会自动重算人民币换算结果和注册资本。",
          "股权比例为100%代表全资子公司，若修改为非100%需要说明其他股东信息。",
          "资金来源建议优先填写企业自有资金，贷款出资部分在正式申报中需要补充银行意向函。",
        ].map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
            <span style={{ color: "#d97706", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>{t}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ padding: "0 14px 14px" }}>
      <div style={{ fontSize: 12, color: "#374151", marginBottom: 10, lineHeight: 1.6 }}>
        根据 <strong>{context.projectName}</strong> 当前状态：
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 12 }}>
        {[
          { label: "已上传材料", value: "6 份", color: "#1a5bc6" },
          { label: "校验通过",   value: "8 项", color: "#16a34a" },
          { label: "不通过问题", value: "3 项", color: "#dc2626" },
          { label: "缺失内容",   value: "4 项", color: "#d97706" },
        ].map(s => (
          <div key={s.label} style={{ background: "#f8fafc", borderRadius: 7, padding: "8px 10px", border: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 7 }}>优先建议</div>
      {[
        "商务委备案申请表投资金额与可研报告不一致（差额300万），需先修正",
        "发改委可研报告缺少环境影响评估章节，需补充后重新上传",
        "法人授权书有效期已过，需重新签署",
      ].map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
          <span style={{ color: "#dc2626", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>{s}
        </div>
      ))}
    </div>
  );
}

function MaterialAnswer({ context }: { context: AssistantContext & { type: "material" } }) {
  const rows: [string, string][] = [
    ["材料性质", "企业内部决策文件"],
    ["主要用途", "证明投资决策合法性，提交至商务委与发改委"],
    ["已识别字段", "项目名称、投资金额、目标国家、投资方式、签署日期"],
    ["未识别字段", "法定代表人签字、公司印章（扫描件不清晰）"],
    ["校验问题", "投资金额与备案申请表不一致：¥3,200万 vs ¥3,500万"],
  ];
  return (
    <div style={{ padding: "0 14px 14px" }}>
      <div style={{ fontSize: 13, color: "#374151", marginBottom: 10, fontWeight: 500 }}>材料说明：{context.materialName}</div>
      {rows.map(([label, val]) => (
        <div key={label} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 12 }}>
          <span style={{ color: "#9ca3af", flexShrink: 0, width: 72 }}>{label}</span>
          <span style={{ color: "#1f2937", lineHeight: 1.5 }}>{val}</span>
        </div>
      ))}
    </div>
  );
}

function IssueAnswer({ context }: { context: AssistantContext & { type: "issue" } }) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const sections = [
    { title: "当前结论", content: "该字段存在不一致问题，两份材料中记录的投资金额不符，需优先修正后方可提交。" },
    { title: "发现依据", content: "《境外投资备案申请表》第5条：RMB 3,200万；《可行性研究报告》第2章：RMB 3,500万。差异金额 RMB 300万。" },
    { title: "为什么触发", content: "商务委校验规则要求同一项目申请材料中，核心经济指标须在所有文件中完全一致。" },
    { title: "建议处理", content: "以可研报告数据为准（RMB 3,500万），同步修改备案申请表后重新上传校验。" },
  ];
  return (
    <div style={{ padding: "0 14px 14px" }}>
      <div style={{ fontSize: 13, color: "#374151", marginBottom: 10, fontWeight: 600 }}>{context.issueName}</div>
      {sections.map((s, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 3 }}>{s.title}</div>
          <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.55 }}>{s.content}</div>
        </div>
      ))}
      <button onClick={() => setEvidenceOpen(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "8px 12px", background: "#f8fafc", border: "1px solid #e5eaf2", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#374151", marginBottom: 6 }}>
        <span>证据卡片</span><span style={{ color: "#94a3b8" }}>{evidenceOpen ? "▲" : "▼"}</span>
      </button>
      {evidenceOpen && (
        <div style={{ padding: "10px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#78350f", marginBottom: 6, lineHeight: 1.7 }}>
          来源1：境外投资备案申请表.pdf 第2页 第5条 → ¥3,200万<br/>
          来源2：可行性研究报告.pdf 第12页 第2.3节 → ¥3,500万
        </div>
      )}
      <button onClick={() => setRuleOpen(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "8px 12px", background: "#f8fafc", border: "1px solid #e5eaf2", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#374151" }}>
        <span>规则卡片</span><span style={{ color: "#94a3b8" }}>{ruleOpen ? "▲" : "▼"}</span>
      </button>
      {ruleOpen && (
        <div style={{ padding: "10px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 12, color: "#1e3a8a", marginTop: 6, lineHeight: 1.7 }}>
          规则编号：COM-AMOUNT-001<br/>
          来源：《商务委境外投资备案操作指引》2024版 第3.2条<br/>
          要求：同一项目所有申请材料中投资金额须完全一致
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────
export function OdiProjectAssistantPanel({ collapsed, onToggleCollapse, context, pendingCount, serviceType = "assist" }: Props) {
  const [askedWith, setAskedWith] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState("");
  const isDemo = serviceType === "demo";
  const accent = isDemo ? "#d97706" : "#1a5bc6";
  const accentBg = isDemo ? "#fff7ed" : "#eff6ff";
  const accentBorder = isDemo ? "#fde68a" : "#bfdbfe";
  const title = isDemo ? "沪航者·模拟教练" : "沪航者·项目助手";
  const disclaimer = isDemo
    ? "模拟教练不会修改您的模拟数据，仅解释字段关系和填报逻辑"
    : "项目助手不会直接修改正式材料字段，不可替代材料上传";

  const handleSend = (q?: string) => {
    const text = q ?? inputVal.trim();
    if (text) { setAskedWith(text); setInputVal(""); }
  };

  if (collapsed) {
    return (
      <div onClick={onToggleCollapse}
        style={{ width: 48, flexShrink: 0, background: "#fff", borderLeft: "1px solid #e5eaf2", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", gap: 10, cursor: "pointer", transition: "background 0.15s" }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "#f8fafc")}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "#fff")}
      >
        <XiaohaiAvatar size={30} demo={isDemo} />
        <div style={{ writingMode: "vertical-rl", fontSize: 11, color: "#64748b", letterSpacing: 1, fontWeight: 500 }}>
          {isDemo ? "模拟教练" : "沪航者助手"}
        </div>
        {(pendingCount != null && pendingCount > 0) && (
          <div style={{ background: "#dc2626", color: "#fff", borderRadius: 8, padding: "2px 6px", fontSize: 10, fontWeight: 700 }}>{pendingCount}</div>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: 360, flexShrink: 0, background: "#fff", borderLeft: "1px solid #e5eaf2", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${isDemo ? "#fef3c7" : "#f1f5f9"}`, background: isDemo ? "#fffbeb" : "#fff", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <XiaohaiAvatar size={32} demo={isDemo} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: isDemo ? "#92400e" : "#111827" }}>{title}</div>
          <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {context.type === "project" ? context.projectName :
             context.type === "material" ? context.materialName :
             context.issueName}
          </div>
        </div>
        {askedWith && (
          <button onClick={() => setAskedWith(null)} style={{ fontSize: 11, color: "#64748b", background: "none", border: "1px solid #e5eaf2", borderRadius: 6, cursor: "pointer", padding: "3px 8px" }}>返回</button>
        )}
        <button onClick={onToggleCollapse} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, padding: 4, borderRadius: 6 }}
          onMouseEnter={e => (e.currentTarget.style.color = "#374151")}
          onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}
        >›</button>
      </div>

      {/* Context tag */}
      <ContextTag context={context} demo={isDemo} />

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
        {!askedWith ? (
          <SuggestedPanel context={context} demo={isDemo} onAsk={handleSend} pendingCount={pendingCount} />
        ) : (
          <div style={{ padding: "14px" }}>
            {/* User bubble */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <div style={{ background: accent, color: "#fff", borderRadius: "12px 12px 4px 12px", padding: "9px 13px", fontSize: 12, maxWidth: "85%", lineHeight: 1.5 }}>
                {askedWith}
              </div>
            </div>
            {/* AI answer */}
            <div style={{ background: "#f8fafc", borderRadius: "12px 12px 12px 4px", border: "1px solid #f1f5f9", overflow: "hidden", marginBottom: 12 }}>
              {context.type === "project"  && <ProjectAnswer context={context} demo={isDemo} pendingCount={pendingCount} />}
              {context.type === "material" && <MaterialAnswer context={context} />}
              {context.type === "issue"    && <IssueAnswer context={context} />}
            </div>

            {/* Action buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
              {(isDemo
                ? ["查看填报说明", "恢复示例数据", "继续体验", "下一步"]
                : context.type === "issue"
                ? ["定位原文", "查看关联材料", "加入待办", "重新校验"]
                : context.type === "material"
                ? ["预览材料", "查看校验结果", "加入待办", "重新识别"]
                : ["查看全部问题", "下载材料清单", "推荐下一步", "刷新状态"]
              ).map(label => (
                <button key={label} style={{
                  padding: "7px 8px", borderRadius: 7, border: `1px solid ${accentBorder}`, background: accentBg,
                  fontSize: 11, color: accent, cursor: "pointer",
                }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >{label}</button>
              ))}
            </div>

            <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.5, padding: "8px 10px", background: "#fafafa", borderRadius: 6, border: "1px solid #f1f5f9" }}>
              {isDemo ? "模拟分析结果仅用于学习理解，不构成正式申报建议。" : "本结果为申报前辅助分析，不等同于主管部门正式审核意见。"}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "10px 12px", borderTop: `1px solid ${isDemo ? "#fef3c7" : "#f1f5f9"}`, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          <textarea value={inputVal} onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={isDemo ? "向模拟教练提问…" : "向沪航者提问…"} rows={2}
            style={{ flex: 1, borderRadius: 8, border: `1px solid ${accentBorder}`, background: "#f8fafc", padding: "8px 10px", fontSize: 12, resize: "none", outline: "none", color: "#1f2937", fontFamily: "inherit", lineHeight: 1.5 }}
          />
          <button onClick={() => handleSend()} style={{ width: 34, height: 34, borderRadius: 8, border: "none", background: accent, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M14 8H2M8 2l6 6-6 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 5, textAlign: "center" }}>{disclaimer}</div>
      </div>
    </div>
  );
}
