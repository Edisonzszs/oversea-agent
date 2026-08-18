// 速测版向导 —— 8 步 stepper(使用说明/模块〇-五/报告)。
// UI 与完整版 ComplianceWizard 同一套平台风格:complianceTheme C 配色 + fields.tsx 原语
// (QuestionBlock/RadioQ/CheckQ/FormRow/TextInput/SelectInput/AskIcon)。
// 文案/流程/题库/判档逻辑来自交付稿简化版 HTML,形式统一为平台风格(2026-08-15 用户要求)。
// 右侧伴填同完整版(注入 CopilotAskContext/InstantQAContext);布局嵌入合规空间中央区(minHeight:0 防撑破)。

import { useState } from "react";
import { C } from "../compliance/complianceTheme";
import {
  QuestionBlock, RadioQ, CheckQ, FormRow, TextInput, SelectInput,
  CopilotAskContext, InstantQAContext,
} from "../compliance/components/fields";
import { ComplianceCopilotPanel } from "../compliance/components/ComplianceCopilotPanel";
import { FeedbackFab } from "../compliance/components/FeedbackSurvey";
import { lookupQA } from "../compliance/copilot/qaLibrary";
import { COUNTRY_OPTIONS, isRiskCtry } from "../compliance/logic/country";
import type { Mode } from "../compliance/logic/weights";
import { QUESTIONS, MODULES, checkedVals, val, type Answers, type Question } from "./questions";
import { QuickTestReport } from "./QuickTestReport";

// 与完整版 wizardSteps 同款说明黄条
const noteStyle: React.CSSProperties = {
  background: "#FFF9EC", border: "1px solid #EAD9A8", borderLeft: `4px solid ${C.warn}`,
  borderRadius: "0 7px 7px 0", padding: "8px 12px", margin: "8px 0", fontSize: 12.5, color: "#6B5417", lineHeight: 1.6,
};

const STEPS = ["使用说明", "模块〇 企业画像", "模块一 主体资格", "模块二 投资方式", "模块三 标的项目", "模块四 安全审查", "模块五 行业国别", "自查报告"];

const MODE_DESC: Record<string, string> = {
  new: "仅指在境外设立新企业(绿地投资)。已获证项目增资属\"变更类\";增资首次入股他人既有公司属\"并购类\"",
  ma: "取得既有境外标的公司股份,含并购、控股、参股;实现方式含受让老股、增资认购新股或两者并用",
  chg: "《企业境外投资证书》及核准/备案文件载明事项发生变化:投资额、投资人、资本构成、业务范围、投资路径等",
};
const MODE_LABEL: Record<string, string> = { new: "新设类", ma: "并购类", chg: "变更类" };

interface Props {
  onUpgrade: (answers: Answers) => void;  // 报告页升级完整版(带速测作答)
  onBackHome: () => void; // 返回合规自查列表(速测嵌入合规空间内)
}

export function QuickTestWizard({ onUpgrade, onBackHome }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [err, setErr] = useState<string | null>(null);

  const set = (id: string, v: string) => { setAnswers(a => ({ ...a, [id]: v })); setErr(null); };
  const toggle = (q: Question, v: string) => {
    setAnswers(a => {
      let vs = checkedVals(a, q.id);
      const none = q.noneOpt;
      if (none && v === none) { vs = vs.includes(v) ? [] : [v]; }
      else {
        if (none && vs.includes(none)) vs = [];
        vs = vs.includes(v) ? vs.filter(x => x !== v) : [...vs, v];
      }
      return { ...a, [q.id]: vs.join(",") };
    });
    setErr(null);
  };

  const next = () => { const e = validateStep(step, answers); if (e) { setErr(e); return; } setStep(s => Math.min(7, s + 1)); };
  const prev = () => { setErr(null); setStep(s => Math.max(0, s - 1)); };
  const jump = (i: number) => { if (i < step) { setErr(null); setStep(i); } }; // 已完成步可回跳

  // 右侧伴填(同完整版):折叠态 / 题目一键种入 / sparkle 预设问答
  const [copilotCollapsed, setCopilotCollapsed] = useState(false);
  const [copilotSeed, setCopilotSeed] = useState<string | null>(null);
  const [instantQA, setInstantQA] = useState<{ q: string; a: string; clauses?: { id: string; quote: string }[] } | null>(null);

  // 伴填写入适配器:把「确认填入」落到速测 answers(题号与完整版一致)。
  const wizardApi = {
    state: undefined as unknown as import("../compliance/components/fields").WizardApi["state"],
    setSingle: (n: string, v: string) => { setAnswers(a => ({ ...a, [n]: v })); setErr(null); },
    toggleMulti: (n: string, v: string) => {
      setAnswers(a => {
        const cur = checkedVals(a, n);
        let nx: string[];
        if (v === "none" || v === "0") nx = cur.includes(v) ? [] : [v];
        else { const c = cur.filter(x => x !== "none" && x !== "0"); nx = c.includes(v) ? c.filter(x => x !== v) : [...c, v]; }
        return { ...a, [n]: nx.join(",") };
      });
      setErr(null);
    },
    setMulti: (n: string, values: string[]) => { setAnswers(a => ({ ...a, [n]: values.join(",") })); },
    setMode: (m: string) => {
      setAnswers(a => {
        const c = { ...a };
        for (const k of ["n1", "n2", "n3", "m0a", "m0b", "m1", "m1na_reason", "c1", "c2"]) delete c[k];
        return { ...c, mode: m };
      });
      setErr(null);
    },
    setLsNone: (b: boolean) => { setAnswers(a => ({ ...a, lsNone: b ? "1" : "" })); },
    uploadFile: () => {}, toggleMask: () => {},
    pickCountry: (ctry: string) => { setAnswers(a => ({ ...a, p_ctry: ctry })); },
  } as import("../compliance/components/fields").WizardApi;

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: C.page }}>
      {/* 头部:面包屑 + 速测身份(对齐 ComplianceDetailPage header) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 20px", background: "#fff", borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
        <button onClick={onBackHome} title="返回列表" aria-label="返回列表"
          style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", color: C.sub, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.primaryBorder; e.currentTarget.style.color = C.primary; }} onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.color = C.sub; }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ width: 1, height: 24, background: C.lineSoft, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>企业合规自查</span>
            <span style={{ color: C.faint, fontSize: 13 }}>›</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>速测版 · 匿名自查</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.primary, background: C.primaryBg, borderRadius: 6, padding: "2px 8px", flexShrink: 0 }}>简化版</span>
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>无需登录 · 约 10-15 分钟 · 输出 ABCD 判档与建议材料（匿名作答仅存本页，关闭后不保留）</div>
        </div>
        {/* 使用反馈问卷入口(页头行内;原右下 FAB 与"开始自查/下一步"重叠) */}
        <FeedbackFab />
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
        {/* 左列:速测主体 */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <CopilotAskContext.Provider value={q => setCopilotSeed(q)}>
          <InstantQAContext.Provider value={(q, a, clauses) => setInstantQA({ q, a, clauses })}>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "22px 28px 64px" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto" }}>

              {/* 步进器(照 ComplianceWizard:数字圆点,当前 C.primary,已完成 C.ok 可回跳) */}
              {step < 7 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
                  {STEPS.map((label, i) => {
                    const done = i < step, cur = i === step;
                    return (
                      <div key={i} onClick={() => jump(i)}
                        style={{ flex: "1 1 92px", textAlign: "center", background: "#fff", border: `1px solid ${cur ? C.primary : C.line}`, borderRadius: 7, padding: "8px 4px", fontSize: 12.5, color: done ? C.ok : cur ? C.primary : C.muted, fontWeight: cur ? 700 : 400, cursor: done ? "pointer" : "default", boxShadow: cur ? "0 1px 4px rgba(26,91,198,0.15)" : "none" }}>
                        <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: "50%", background: cur ? C.primary : done ? C.ok : C.lineSoft, color: cur || done ? "#fff" : C.sub, alignItems: "center", justifyContent: "center", fontWeight: 700, marginBottom: 3 }}>{i}</span>
                        <br />{label}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 使用说明(照 StepIntro 结构:标题+段落+有序列表+黄条声明+开始按钮) */}
              {step === 0 && <Instructions onStart={() => { setErr(null); setStep(1); }} />}

              {/* 模块〇-五(照完整版内容卡:白卡 + h2 底线) */}
              {step >= 1 && step <= 6 && (
                <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.line}`, padding: "22px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  <ModuleHead n={step - 1} a={answers} />
                  {renderModule(step - 1, answers, set, toggle)}
                </div>
              )}

              {/* 报告(步骤7,navy 输出物风格保持) */}
              {step === 7 && <QuickTestReport answers={answers} onUpgrade={() => onUpgrade(answers)} onBack={() => setStep(6)} />}

              {/* 底部导航(照 ComplianceWizard:error 红条 + ghost/primary) */}
              {step < 7 && (
                <>
                  {err && (
                    <div style={{ marginTop: 12, background: C.badBg, border: `1px solid ${C.badBorder}`, borderRadius: 8, padding: "9px 14px", fontSize: 13, color: C.bad }}>
                      ⚠ {err}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
                    {step > 0 ? (
                      <button onClick={prev} style={{ background: "none", border: `1px solid ${C.primaryBorder}`, color: C.primary, borderRadius: 8, padding: "9px 24px", fontSize: 14, cursor: "pointer" }}>上一步</button>
                    ) : <span />}
                    <button onClick={step === 6 ? () => { const e = validateStep(6, answers); if (e) { setErr(e); return; } setStep(7); } : next}
                      style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "10px 32px", fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: 1 }}>
                      {step === 0 ? "开始自查" : step === 6 ? "生成自查报告" : "下一步"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          </InstantQAContext.Provider>
          </CopilotAskContext.Provider>
        </div>

        {/* 右侧:沪航者·合规伴填(与完整版同一面板) */}
        <ComplianceCopilotPanel
          collapsed={copilotCollapsed}
          onToggleCollapse={() => setCopilotCollapsed(v => !v)}
          step={step}
          mode={(answers["mode"] as Mode | null) ?? null}
          api={wizardApi}
          seed={copilotSeed}
          onSeedConsumed={() => setCopilotSeed(null)}
          instantQA={instantQA}
          onInstantQAConsumed={() => setInstantQA(null)}
        />
      </div>
    </div>
  );
}

// ─── 使用说明(照 StepIntro 结构;文案保留速测版口径) ────────────────────────
function Instructions({ onStart }: { onStart: () => void }) {
  const items: [string, string][] = [
    ["本表定位。", "本表供拟开展境外投资的企业自愿自查使用，帮助企业在正式申报前系统了解监管要求、对照准备材料、预判自身状态。完成自查并非申报的前置条件，任何档位均可依法申报。"],
    ["版本说明。", "本工具为简化版：无需登录，约10-15分钟，覆盖核心自查事项，适合快速初步自测。登录后可使用完整版：逐题自查、随查随传文件、文件齐备度计分、报告保存与重新生成，完整填写约需40-60分钟。"],
    ["填写人建议。", "本表宜由企业主管投资业务的部门人员填写（境外经营团队对投资安排相关章节通常不熟悉）。"],
    ["填写方式。", "企业只需回答客观事实问题（是否、多少、有无），无需自行判断风险档位；各项评价档位由系统根据事实回答自动推导。全部问题附\"分析依据\"，点击可展开学习。"],
    ["评价档位含义。", "A＝材料齐备，可直接申报；B＝基本具备，需补充材料；C＝存在需先解决的问题；D＝存在禁止性情形或重大缺陷，不建议申报。总档按\"就低原则\"确定。"],
    ["术语说明。", "标注\"前置门槛\"的事项（自查1、自查3、自查4）若不符合，申报将不被受理，建议优先处理。"],
    ["数据用途告知。", "企业填报内容仅用于生成本次自查报告，不作为执法线索使用；匿名填报数据不保存，关闭页面后无法恢复；登录使用完整版的，可保存填报数据，数据存储位置、访问权限、保密责任与留存期限按平台公布的企业数据安全政策执行。"],
    ["声明。", "本自查结果不构成法律意见，亦不代表主管机关审批结论，最终以主管机关依法审查为准。涉及重大、复杂或敏感投资安排的，建议咨询专业机构（见报告页\"我可以咨询谁\"）。"],
    ["联盟服务引导。", "本工具在若干节点嵌入\"平台专业服务联盟机构\"服务引导，遵循四条铁律：帮扶不推销（只指机构类别、不点名机构）；公共服务先行；名词统一；企业自主——是否使用服务与判档完全脱钩。各专业服务事项按材料类型对应机构类别办理：审计、验资事项由会计师事务所办理；银行资金证明由银行出具；评估、估值事项由评估机构办理；法律调查、尽职调查及涉外法律咨询事项由律师事务所（含境内外律所）办理。"],
    ["法源标注。", "本表所附法律依据中，《国务院关于对外投资的规定》（国务院令第837号）相关条文已经全文逐条核验；部门规章条文号沿用既有评审标准定稿口径。"],
  ];
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.line}`, padding: "22px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 700, color: C.ink, paddingBottom: 8, borderBottom: `2px solid ${C.lineSoft}` }}>使用说明（企业必读）</h2>
      <ol style={{ margin: "14px 0 14px 22px", fontSize: 13.5, color: C.ink, lineHeight: 2 }}>
        {items.map(([t, d], i) => <li key={i} style={{ margin: "4px 0" }}><b>{t}</b>{d}</li>)}
      </ol>
      <div style={{ textAlign: "right", marginTop: 16 }}>
        <button onClick={onStart} style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "10px 30px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>开始自查</button>
      </div>
    </div>
  );
}

// ─── 模块标题(照完整版卡片标题样式;分支/前置黄条对齐 noteStyle) ─────────────
function ModuleHead({ n, a }: { n: number; a: Answers }) {
  const m = MODULES.find(x => x.n === n);
  if (!m) return null;
  return (
    <>
      <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 700, color: C.ink, paddingBottom: 8, borderBottom: `2px solid ${C.lineSoft}` }}>{m.title}</h2>
      {m.lead && <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.7, margin: "0 0 10px" }}>{m.lead}</p>}
      {n === 2 && (
        <div style={noteStyle}>
          已按模块〇选定的投资方式进入对应分支（当前：{MODE_LABEL[a["mode"]] || "—"}）；共通项全部填写。
        </div>
      )}
      {n === 2 && val(a, "mode") === "new" && (
        <div style={noteStyle}>
          <b style={{ color: C.warn }}>口径提示：</b>本分支仅适用于在境外设立新企业。对已获证境外企业的增资，请返回模块〇改选"变更类"；通过增资认购他人既有公司新发行股份的，请改选"并购类"。
        </div>
      )}
      {n === 2 && val(a, "mode") === "ma" && (
        <div style={noteStyle}>
          <b style={{ color: C.warn }}>前置程序提示：</b>设立方式为"并购"或"增资并购"的，必须先选择已填写或已通过的"并购事项前期报告表"（在系统"备案（核准）报告"应用中填报），方可继续填写境外投资申请表。
        </div>
      )}
      {n === 2 && val(a, "mode") === "chg" && (
        <div style={noteStyle}>
          变更类针对已核准/备案项目，对照《企业境外投资证书》及核准文件/备案通知书载明的各个事项逐项核查变化。
        </div>
      )}
      {n === 3 && <h3 style={h3Title}>3.1　标的（项目）基本信息与登记文件</h3>}
      {n === 3 && (
        <div style={noteStyle}>
          <b style={{ color: C.warn }}>审批填报预告：</b>申请表中"投资路径"仅指第一层级境外企业；"最终目的地境外企业"另行单独填报，注册资本应与其章程约定一致。请按"第一层级平台+最终目的地企业"两层口径梳理架构信息。
        </div>
      )}
      {n === 3 && <h3 style={h3Title}>3.2　三套负面清单逐项核对（法律渊源不同，分别核对，不可混淆）</h3>}
      {n === 4 && (
        <div style={noteStyle}>
          安全审查是受理后的前置环节：主管机关受理申请后先进行安全审查，疑虑未消除的不予批准、不进入后续实质审查。本模块为事实采集与预警，不能替代主管机关安全审查。
        </div>
      )}
    </>
  );
}
const h3Title: React.CSSProperties = { margin: "0 0 10px", fontSize: 16, fontWeight: 700, color: C.ink, paddingBottom: 7, borderBottom: `2px solid ${C.lineSoft}` };

// ─── 模块渲染 ──────────────────────────────────────────────────────────────
type SetFn = (id: string, v: string) => void;
type ToggleFn = (q: Question, v: string) => void;

function renderModule(n: number, a: Answers, set: SetFn, toggle: ToggleFn) {
  const qs = QUESTIONS.filter(q => q.module === n && (!q.show || q.show(a)));
  return <>{qs.map(q => <QView key={q.id} q={q} a={a} set={set} toggle={toggle} />)}</>;
}

function QView({ q, a, set, toggle }: { q: Question; a: Answers; set: SetFn; toggle: ToggleFn }) {
  // 投资方式三选(照 StepProfile 三选按钮:2px 边框,选中 C.primary 反白,带 small 描述)
  if (q.type === "mode") return (
    <div style={{ marginTop: 8 }}>
      <h3 style={{ ...h3Title, borderBottom: "none", marginBottom: 4, paddingBottom: 0 }}>投资方式（决定模块二分支，请先选择）</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {(["new", "ma", "chg"] as const).map(k => {
          const sel = val(a, q.id) === k;
          return (
            <button key={k} onClick={() => set(q.id, k)}
              style={{ flex: "1 1 200px", background: sel ? C.primary : C.primaryBg, color: sel ? "#fff" : C.primary, border: `2px solid ${sel ? C.primary : C.primaryBorder}`, borderRadius: 8, padding: "14px 12px", fontSize: 15, cursor: "pointer", textAlign: "left", transition: "all .15s" }}>
              {MODE_LABEL[k]}
              <small style={{ display: "block", fontSize: 12, marginTop: 5, opacity: 0.85, fontWeight: 400 }}>{MODE_DESC[k]}</small>
            </button>
          );
        })}
      </div>
    </div>
  );

  // 模块〇:表单行(FormRow + TextInput/SelectInput/CheckQ,同完整版企业画像)
  if (q.module === 0) {
    if (q.type === "text") return <FormRow label={q.stem} hint={q.hint}><TextInput value={val(a, q.id)} onChange={v => set(q.id, v)} placeholder={q.placeholder} /></FormRow>;
    if (q.type === "multi") return (
      <FormRow label={q.stem} hint={q.hint}>
        <CheckQ values={checkedVals(a, q.id)} options={q.opts || []} noneValue={q.noneOpt} onToggle={v => toggle(q, v)} />
      </FormRow>
    );
    const opts = q.id === "p_ctry" ? COUNTRY_OPTIONS.map(c => ({ v: c, label: c })) : q.opts || [];
    return (
      <FormRow label={q.stem} hint={q.hint}>
        <SelectInput value={val(a, q.id)} onChange={v => set(q.id, v)}>
          <option value="">{q.id === "p_ctry" ? "请选择国别（地区）" : "请选择"}</option>
          {opts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
        </SelectInput>
      </FormRow>
    );
  }

  // 条件文本题(如 m1na_reason):FormRow
  if (q.type === "text") return <FormRow label={q.stem}><TextInput value={val(a, q.id)} onChange={v => set(q.id, v)} placeholder={q.placeholder} /></FormRow>;

  // 模块一-五题块(QuestionBlock + RadioQ/CheckQ,同完整版)
  if (q.type === "multi") {
    return (
      <QuestionBlock stem={q.stem} law={q.law}>
        <CheckQ values={checkedVals(a, q.id)} options={q.opts || []} noneValue={q.noneOpt} onToggle={v => toggle(q, v)} />
      </QuestionBlock>
    );
  }
  if (q.type === "info") {
    return <QuestionBlock stem={q.stem} law={q.law}><p style={{ fontSize: 12.5, color: C.muted, margin: "2px 0 0" }}>（信息采集项，不参与判档）</p></QuestionBlock>;
  }
  return (
    <QuestionBlock stem={q.stem} law={q.law}>
      <RadioQ name={q.id} value={val(a, q.id)} options={q.opts || []} onChange={v => set(q.id, v)} />
      {q.hint && <p style={{ fontSize: 12, color: C.muted, margin: "6px 0 0", lineHeight: 1.5 }}>{q.hint}</p>}
    </QuestionBlock>
  );
}

// ─── 步骤校验 ──────────────────────────────────────────────────────────────
function validateStep(step: number, a: Answers): string | null {
  if (step === 1) { if (!a["mode"]) return "请选择投资方式（新设类/并购类/变更类）"; }
  if (step === 2) { for (const k of ["z1", "z2", "z3", "z4", "z5", "z6"]) if (!a[k]) return "模块一共 6 项，请全部作答"; }
  if (step === 3) {
    const mode = a["mode"];
    if (mode === "new") { for (const k of ["n1", "n2", "n3"]) if (!a[k]) return "请完成新设类分支全部问题"; }
    if (mode === "ma") { if (!a["m0a"] || !a["m0b"] || !a["m1"]) return "请完成并购类分支全部问题"; if (a["m1"] === "na" && !a["m1na_reason"]) return "请填写\"客观不适用\"的具体理由"; }
    if (mode === "chg") { if (!a["c1"]) return "请完成变更类变化对照"; if (checkedVals(a, "c1").some(x => x !== "0") && !a["c2"]) return "请回答变更申请办理情况"; }
    if (!a["g2"]) return "请回答共通项（关联交易）";
  }
  if (step === 4) {
    const checked = checkedVals(a, "lsA").length || checkedVals(a, "lsB").length || checkedVals(a, "lsC").length || a["lsNone"];
    if (!checked) return "请逐项核对三套负面清单，或勾选\"均不涉及\"";
    if (checkedVals(a, "p_arch").includes("vie") && !a["t3"]) return "请回答 37 号文登记情况";
    if (isRiskCtry(a["p_ctry"]) && !a["t4"]) return "请回答风险国别防控材料备妥情况";
  }
  if (step === 5) {
    if (!a["s1a"]) return "请回答出口管制/技术出境情况";
    if (a["s1a"] === "y" && !a["s1c"]) return "请回答出口管制核对结果";
    if (!checkedVals(a, "s2a").length) return "请选择数据出境场景";
    if (!a["s2c"]) return "请回答数据出境合规路径";
  }
  if (step === 6) { if (!a["q52"] || !a["q53"]) return "请完成模块五信息采集"; }
  return null;
}
