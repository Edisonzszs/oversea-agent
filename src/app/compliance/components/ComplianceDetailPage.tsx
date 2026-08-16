// 合规自查详情页：tab 容器（自查向导 / 自查报告），托管向导状态并持久化到项目。
// 已完成项目默认进报告 tab（只读）；"重新自查"回到向导。

import { useRef, useState } from "react";
import { C } from "../complianceTheme";
import { createInitialState, clearBranchAnswers, prefillFromQuickAnswers, takeQuickAnswersFromSession, type WizardState } from "../logic/wizardModel";
import { buildReport, type ReportResult } from "../logic/scoring";
import { generateReportHTML } from "../reportHtml";
import type { ComplianceProject, ComplianceStatus } from "../data/complianceProjects";
import { ComplianceWizard } from "./ComplianceWizard";
import { ComplianceReport } from "./ComplianceReport";
import { ComplianceCopilotPanel } from "./ComplianceCopilotPanel";
import { FeedbackFab } from "./FeedbackSurvey";
import type { WizardApi } from "./fields";

interface Props {
  project: ComplianceProject;
  onUpdate: (patch: Partial<ComplianceProject>) => void;
  onBack: () => void;
}

type Tab = "wizard" | "report";

export function ComplianceDetailPage({ project, onUpdate, onBack }: Props) {
  // 初始化:项目快照 → 否则消费 sessionStorage 里的速测作答预填(升级完整版场景) → 空白
  const [initial] = useState<WizardState>(() => {
    const base = project.snapshot ?? createInitialState();
    const quick = takeQuickAnswersFromSession();
    if (quick) {
      const { state } = prefillFromQuickAnswers(base, quick);
      return state;
    }
    return base;
  });
  const [working, setWorking] = useState<WizardState>(initial);
  const [tab, setTab] = useState<Tab>(initial.generated ? "report" : "wizard");
  const [report, setReport] = useState<ReportResult | null>(initial.generated ? buildReport(initial) : null);
  const [copilotCollapsed, setCopilotCollapsed] = useState<boolean>(initial.generated);
  const [copilotSeed, setCopilotSeed] = useState<string | null>(null);
  const [instantQA, setInstantQA] = useState<{ q: string; a: string; clauses?: { id: string; quote: string }[] } | null>(null);
  const [highRiskSteps, setHighRiskSteps] = useState<number[]>([]);
  const [highRiskItems, setHighRiskItems] = useState<{ name: string; grade: string }[]>([]);
  const [showRecheck, setShowRecheck] = useState(false);
  const highRiskCount = report?.items.filter(it => it.grade === "C" || it.grade === "D").length ?? 0;
  const stateRef = useRef(working);
  stateRef.current = working;

  // wizardApi 适配器：把伴填面板的写入操作汇入本页 working 状态（与向导同一份 WizardState）。
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
    setMulti: (n, values) => updateState(prev => ({ ...prev, answers: { ...prev.answers, multi: { ...prev.answers.multi, [n]: values } } })),
    setMode: (m) => updateState(prev => ({ ...clearBranchAnswers(prev, prev.mode), mode: m })),
    setLsNone: (b) => updateState(prev => ({ ...prev, lsNone: b })),
    uploadFile: () => {}, toggleMask: () => {},
    pickCountry: (ctry) => updateState(prev => ({ ...prev, answers: { ...prev.answers, single: { ...prev.answers.single, p_ctry: ctry } }, ctryAck: ctry ? prev.ctryAck : null })),
  };

  const persist = (st: WizardState, grade?: string, score?: number) => {
    const status: ComplianceStatus = st.generated ? "已完成" : st.curStep === 0 ? "待填写" : "填写中";
    onUpdate({
      snapshot: st,
      status,
      investBranch: st.mode ?? undefined,
      ...(grade != null ? { grade: grade as ComplianceProject["grade"], coreCompleteness: score } : {}),
    });
  };

  const updateState = (updater: (prev: WizardState) => WizardState) => {
    const next = updater(stateRef.current);
    stateRef.current = next;
    setWorking(next);
    persist(next);
  };

  const handleGenerated = () => {
    const next = { ...stateRef.current, generated: true };
    stateRef.current = next;
    const r = buildReport(next);
    setWorking(next);
    setReport(r);
    setTab("report");
    persist(next, r.grade, r.fileScore.score);
  };

  const handleClearAnswers = () => {
    const next = { ...createInitialState(), curStep: 1 };
    stateRef.current = next;
    setWorking(next);
    setReport(null);
    persist(next);
  };

  const handleFixHighRisk = () => {
    if (!report || highRiskCount === 0) return;
    const modToStep: Record<string, number> = {
      "模块一": 2, "模块二·分支A": 3, "模块二·分支B": 3, "模块二·分支C": 3, "模块二·共通": 3,
      "模块三": 4, "模块四": 5, "模块五": 6,
    };
    const items = report.items.filter(it => it.grade === "C" || it.grade === "D");
    const steps = [...new Set(items.map(it => modToStep[it.mod] ?? 1).filter(s => s >= 2 && s <= 6))].sort((a, b) => a - b);
    setHighRiskSteps(steps);
    setHighRiskItems(items.map(it => ({ name: it.name, grade: it.grade as string })));
    if (steps.length > 0) updateState(prev => ({ ...prev, curStep: steps[0] }));
    setTab("wizard");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: C.page }}>
      {/* 头部：面包屑 + 项目身份 + 分段切换（清晰锚定下方工作区）*/}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 20px", background: "#fff", borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
        <button onClick={onBack} title="返回列表" aria-label="返回列表" style={backIconBtn}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.primaryBorder; e.currentTarget.style.color = C.primary; }} onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.color = C.sub; }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ width: 1, height: 24, background: C.lineSoft, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>企业合规自查</span>
            <span style={{ color: C.faint, fontSize: 13 }}>›</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</span>
            {project.investBranch && <span style={branchPillStyle}>{({ new: "新设类", ma: "并购类", chg: "变更类" } as const)[project.investBranch]}</span>}
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>最近更新 {project.updatedAt}</div>
        </div>
        {tab === "wizard" && (
          <button onClick={() => { if (window.confirm("确定清空所有作答、重新开始？项目名称保留。")) handleClearAnswers(); }} title="清空全部作答数据" style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: "transparent", color: C.bad, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>清空作答</button>
        )}
        <div style={{ display: "flex", background: C.lineSoft, borderRadius: 8, padding: 3, gap: 2, flexShrink: 0 }}>
          {([["wizard", "自查向导"], ["report", "自查报告"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: "6px 15px", borderRadius: 6, border: "none", background: tab === k ? "#fff" : "transparent", color: tab === k ? C.primary : C.sub, fontWeight: tab === k ? 600 : 400, fontSize: 12.5, cursor: "pointer", boxShadow: tab === k ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all .15s" }}>{label}</button>
          ))}
        </div>
      </div>

      {/* 内容：3 栏布局 = 向导/报告 | 伴填面板 */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {tab === "wizard" && (
            <ComplianceWizard state={working} setState={updateState} onGenerated={handleGenerated} onAskCopilot={(q) => { setCopilotSeed(q); setCopilotCollapsed(false); }} onInstantQA={(q, a, clauses) => { setCopilotCollapsed(false); setInstantQA({ q, a, clauses }); }} highRiskSteps={highRiskSteps} highRiskItems={highRiskItems} />
          )}
          {tab === "report" && (
            report
              ? <>
                  <ComplianceReport report={report} projectName={project.name} />
                  {/* 完成面板 */}
                  <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 28px 48px" }}>
                    <div style={{ textAlign: "center", marginBottom: 20 }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: C.ok, marginBottom: 4 }}>✅ 自查完成</div>
                      <div style={{ fontSize: 13, color: C.sub }}>自查档位 <b style={{ color: C.ink }}>{report.grade}</b> · 核心齐备度 <b style={{ color: C.primary }}>{report.fileScore.score}</b> 分 · 增强加分 +{Math.min(report.fileScore.enhScore, report.fileScore.enhCap)} 分</div>
                    </div>
                    <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                      <button onClick={() => { const html = generateReportHTML(report, project.name); const w = window.open("", "_blank"); if (w) { w.document.open(); w.document.write(html); w.document.close(); } }} style={{ padding: "12px 32px", borderRadius: 10, border: "none", background: C.primary, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 10px rgba(26,91,198,0.25)", display: "flex", alignItems: "center", gap: 8 }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5v9m0 0L5 7.5m3 3l3-3M2.5 12.5v2h11v-2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        导出报告
                      </button>
                      <button onClick={() => setShowRecheck(v => !v)} style={{ padding: "12px 32px", borderRadius: 10, border: `1px solid ${C.primaryBorder}`, background: "#fff", color: C.primary, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M11 2.5l2.5 2.5L6 12.5l-3 .5.5-3L11 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                        再次填报
                        <span style={{ fontSize: 10, transition: "transform .2s", transform: showRecheck ? "rotate(180deg)" : "none" }}>▾</span>
                      </button>
                    </div>
                    {showRecheck && (
                      <div style={{ marginTop: 16, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                        <div onClick={() => { setHighRiskSteps([]); setHighRiskItems([]); updateState(prev => ({ ...prev, curStep: 1 })); setTab("wizard"); }} style={{ width: 280, background: "#fff", borderRadius: 12, border: `1px solid ${C.line}`, padding: "16px 18px", cursor: "pointer", transition: "border-color .15s, box-shadow .15s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = C.primaryBorder; e.currentTarget.style.boxShadow = "0 4px 14px rgba(26,91,198,0.08)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.boxShadow = "none"; }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                            <span style={{ width: 30, height: 30, borderRadius: 8, background: C.primaryBg, display: "flex", alignItems: "center", justifyContent: "center", color: C.primary, flexShrink: 0 }}>
                              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 3h7l3 3v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M6 8h4M6 10.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                            </span>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>重新填报</div>
                          </div>
                          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>保留全部作答，回到向导逐项检查修改</div>
                        </div>
                        <div onClick={highRiskCount > 0 ? handleFixHighRisk : undefined} style={{ width: 280, background: "#fff", borderRadius: 12, border: `1px solid ${C.line}`, padding: "16px 18px", cursor: highRiskCount > 0 ? "pointer" : "default", opacity: highRiskCount > 0 ? 1 : 0.5, transition: "border-color .15s, box-shadow .15s" }} onMouseEnter={e => { if (highRiskCount > 0) { e.currentTarget.style.borderColor = C.warnBorder; e.currentTarget.style.boxShadow = "0 4px 14px rgba(180,117,0,0.08)"; } }} onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.boxShadow = "none"; }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                            <span style={{ width: 30, height: 30, borderRadius: 8, background: C.warnBg, display: "flex", alignItems: "center", justifyContent: "center", color: C.warn, flexShrink: 0 }}>
                              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 2L1.5 14h13L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M8 7v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                            </span>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>仅修改高风险项</div>
                            {highRiskCount > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: C.warn, background: C.warnBg, borderRadius: 5, padding: "1px 7px", marginLeft: "auto" }}>{highRiskCount} 项</span>}
                          </div>
                          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{highRiskCount > 0 ? "定位到 C/D 级事项所在模块，修改后重新生成报告" : "当前无 C/D 级高风险事项"}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              : <div style={{ textAlign: "center", padding: "80px 0", color: C.muted }}>
                  <p style={{ fontSize: 15, color: C.sub, marginBottom: 16 }}>尚未生成自查报告</p>
                  <button onClick={() => setTab("wizard")} style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "9px 26px", fontSize: 13.5, cursor: "pointer" }}>前往自查向导</button>
                </div>
          )}
        </div>
        <ComplianceCopilotPanel
          collapsed={copilotCollapsed}
          onToggleCollapse={() => setCopilotCollapsed(v => !v)}
          step={working.curStep}
          mode={working.mode}
          api={wizardApi}
          seed={copilotSeed}
          onSeedConsumed={() => setCopilotSeed(null)}
          instantQA={instantQA}
          onInstantQAConsumed={() => setInstantQA(null)}
        />
      </div>
      {/* 使用反馈问卷 FAB(填写向导期间随时可点;right 384 避让右侧伴填栏) */}
      {tab === "wizard" && <FeedbackFab right={384} />}
    </div>
  );
}

const backIconBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", color: C.sub, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .15s" };
const branchPillStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: C.primary, background: C.primaryBg, border: `1px solid ${C.primaryBorder}`, borderRadius: 5, padding: "1px 7px", flexShrink: 0, lineHeight: 1.5 };
