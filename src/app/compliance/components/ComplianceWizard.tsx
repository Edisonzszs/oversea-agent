// 合规自查向导外壳：步骤机 + 步进器 + 底部导航 + 校验 + 国别提示触发。
// 组合 NewOdiProjectModal 的步骤机、OdiDaibanPage 的字段栅格、ProgressStepper 的指示器。

import { useState } from "react";
import { C } from "../complianceTheme";
import { STEPS, REPORT_STEP, validateStep, clearBranchAnswers, type WizardState } from "../logic/wizardModel";
import type { Mode, FileId } from "../logic/weights";
import { CountryNoticeModal } from "./CountryNoticeModal";
import { StepIntro, StepProfile, StepSubject, StepInvestMode, StepTarget, StepSecurity, StepIndustryCountry } from "./wizardSteps";
import { CopilotAskContext, HighRiskFilterCtx, InstantQAContext, type WizardApi } from "./fields";

interface Props {
  state: WizardState;
  setState: (updater: (prev: WizardState) => WizardState) => void;
  onGenerated: () => void;
  onAskCopilot?: (question: string) => void;
  onInstantQA?: (q: string, a: string, clauses?: { id: string; quote: string }[]) => void;
  highRiskSteps?: number[];
  highRiskItems?: { name: string; grade: string }[];
  /** 退出"只看高风险"过滤,回到全量题目 */
  onExitHighRisk?: () => void;
}

export function ComplianceWizard({ state, setState, onGenerated, onAskCopilot, onInstantQA, highRiskSteps, highRiskItems, onExitHighRisk }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pendingCountry, setPendingCountry] = useState<string | null>(null);

  const cur = state.curStep;

  // ── 状态写入（immutable）─────────────────────────────────────────────────
  const api: WizardApi = {
    state,
    setSingle: (name, value) =>
      setState(prev => ({ ...prev, answers: { ...prev.answers, single: { ...prev.answers.single, [name]: value } } })),
    toggleMulti: (name, value) =>
      setState(prev => {
        const curArr = prev.answers.multi[name] ?? [];
        let next: string[];
        if (value === "none" || value === "0") {
          next = curArr.includes(value) ? [] : [value];
        } else {
          const cleaned = curArr.filter(v => v !== "none" && v !== "0");
          next = cleaned.includes(value) ? cleaned.filter(v => v !== value) : [...cleaned, value];
        }
        return { ...prev, answers: { ...prev.answers, multi: { ...prev.answers.multi, [name]: next } } };
      }),
    setMulti: (name, values) =>
      setState(prev => ({ ...prev, answers: { ...prev.answers, multi: { ...prev.answers.multi, [name]: values } } })),
    setMode: (m: Mode) => setState(prev => ({ ...clearBranchAnswers(prev, prev.mode), mode: m })),
    setLsNone: (b: boolean) =>
      setState(prev => ({
        ...prev, lsNone: b,
        answers: { ...prev.answers, multi: { ...prev.answers.multi, lsA: b ? [] : prev.answers.multi.lsA ?? [], lsB: b ? [] : prev.answers.multi.lsB ?? [], lsC: b ? [] : prev.answers.multi.lsC ?? [] } },
      })),
    uploadFile: (fid: FileId, name: string) =>
      setState(prev => ({ ...prev, uploads: { ...prev.uploads, [fid]: { name, masked: prev.uploads[fid]?.masked ?? false } } })),
    toggleMask: (fid: FileId) =>
      setState(prev => {
        const u = prev.uploads[fid];
        return { ...prev, uploads: { ...prev.uploads, [fid]: { name: u?.name ?? "", masked: !(u?.masked ?? false) } } };
      }),
    pickCountry: (ctry: string) => {
      // 换国别即作废旧确认(合规告知留痕须与实际国别一致);重选同一国别不重复作废
      setState(prev => {
        const changed = ctry !== prev.answers.single.p_ctry;
        return { ...prev, answers: { ...prev.answers, single: { ...prev.answers.single, p_ctry: ctry } }, ctryAck: changed ? null : prev.ctryAck };
      });
      if (ctry) setPendingCountry(ctry);
    },
  };

  const goStep = (i: number) => {
    setState(prev => ({ ...prev, curStep: i, maxSeen: Math.max(prev.maxSeen, i) }));
    setError(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 步进器前向跳步与「下一步」同口径:途经步骤逐一校验当前作答,
  // 防止改投资方式清空分支作答后直接跳步绕过校验生成残缺报告
  const jumpValidated = (i: number) => {
    if (i > cur) {
      for (let s = cur; s < i; s++) {
        const err = validateStep(s, state);
        if (err) { setError(err); return; }
      }
    }
    goStep(i);
  };

  const handleNext = () => {
    const err = validateStep(cur, state);
    if (err) { setError(err); return; }
    if (cur === REPORT_STEP - 1) { onGenerated(); return; }   // 步骤 6 → 生成报告
    goStep(cur + 1);
  };

  const isLast = cur === REPORT_STEP - 1;

  return (
    <CopilotAskContext.Provider value={onAskCopilot ?? null}>
    <InstantQAContext.Provider value={onInstantQA ?? null}>
    <HighRiskFilterCtx.Provider value={highRiskItems && highRiskItems.length > 0 ? highRiskItems.map(it => it.name) : null}>
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 28px 64px" }}>
      {highRiskItems && highRiskItems.length > 0 && (
        <div style={{ background: "#FFF9EC", border: `1px solid #EAD9A8`, borderLeft: `4px solid ${C.warn}`, borderRadius: "0 8px 8px 0", padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#6B5417", flex: 1 }}>🎯 高风险修改模式 — 请优先检查以下 {highRiskItems.length} 项（步进器红点标注）</div>
            {onExitHighRisk && (
              <button onClick={onExitHighRisk} title="退出只看高风险,回到全量题目"
                style={{ flexShrink: 0, background: "#fff", border: `1px solid ${C.warnBorder}`, color: "#92400e", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>退出只看高风险</button>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {highRiskItems.map((it, i) => (
              <span key={i} style={{ fontSize: 12, background: "#fff", border: `1px solid ${C.warnBorder}`, borderRadius: 6, padding: "3px 10px", color: C.ink, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 700, background: C.warn, color: "#fff", borderRadius: 3, padding: "0 5px" }}>{it.grade}</span>
                {it.name}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* 步进器 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
        {STEPS.map(st => {
          const isCur = st.key === cur;
          const isDone = st.key < cur || (st.key <= state.maxSeen && st.key !== cur);
          const clickable = st.key <= state.maxSeen;
          return (
            <button key={st.key} disabled={!clickable} onClick={() => clickable && jumpValidated(st.key)}
              style={{
                flex: "1 1 92px", textAlign: "center", background: "#fff",
                border: `1px solid ${isCur ? C.primary : C.line}`, borderRadius: 7, padding: "8px 4px",
                fontSize: 12.5, color: isCur ? C.primary : isDone ? C.ok : C.muted, fontWeight: isCur ? 700 : 400,
                cursor: clickable ? "pointer" : "default", opacity: clickable ? 1 : 0.5,
                boxShadow: isCur ? "0 1px 4px rgba(26,91,198,0.15)" : "none",
              }}>
              <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: "50%", background: isCur ? C.primary : isDone ? C.ok : C.lineSoft, color: isCur || isDone ? "#fff" : C.sub, alignItems: "center", justifyContent: "center", fontWeight: 700, marginBottom: 3, position: "relative" }}>{st.key}{highRiskSteps?.includes(st.key) && <span style={{ position: "absolute", top: -2, right: -4, width: 7, height: 7, borderRadius: "50%", background: "#dc2626", border: "1.5px solid #fff" }} />}</span>
              <br />{st.short}
            </button>
          );
        })}
      </div>

      {/* 当前步骤卡片 */}
      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.line}`, padding: "22px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 700, color: C.ink, paddingBottom: 8, borderBottom: `2px solid ${C.lineSoft}` }}>
          {STEPS[cur]?.title}
        </h2>

        {cur === 0 && <StepIntro onStart={() => goStep(1)} />}
        {cur === 1 && <StepProfile api={api} />}
        {cur === 2 && <StepSubject api={api} />}
        {cur === 3 && <StepInvestMode api={api} />}
        {cur === 4 && <StepTarget api={api} />}
        {cur === 5 && <StepSecurity api={api} />}
        {cur === 6 && <StepIndustryCountry api={api} />}
      </div>

      {/* 校验提示 */}
      {error && (
        <div style={{ marginTop: 12, background: C.badBg, border: `1px solid ${C.badBorder}`, borderRadius: 8, padding: "9px 14px", fontSize: 13, color: C.bad }}>
          ⚠ {error}
        </div>
      )}

      {/* 底部导航(使用说明步骤隐藏:说明卡内已有「开始自查」按钮,避免两个开始按钮) */}
      {cur > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
          <button onClick={() => goStep(cur - 1)} style={btnGhostStyle}>上一步</button>
          <button onClick={handleNext}
            style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "10px 32px", fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: 1 }}>
            {isLast ? "生成自查报告" : "下一步"}
          </button>
        </div>
      )}

      {/* 国别提示模态 */}
      {pendingCountry && (
        <CountryNoticeModal
          country={pendingCountry}
          onClose={() => setPendingCountry(null)}
          onAck={() => {
            setState(prev => ({ ...prev, ctryAck: { ctry: pendingCountry, time: new Date().toLocaleString("zh-CN") } }));
            setPendingCountry(null);
          }}
        />
      )}
    </div>
    </HighRiskFilterCtx.Provider>
    </InstantQAContext.Provider>
    </CopilotAskContext.Provider>
  );
}

const btnGhostStyle: React.CSSProperties = {
  background: "none", border: `1px solid ${C.primaryBorder}`, color: C.primary, borderRadius: 8, padding: "9px 24px", fontSize: 14, cursor: "pointer",
};
