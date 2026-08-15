// 速测版向导 —— 8 步 stepper(使用说明/模块〇-五/报告)。
// UI 1:1 复刻「20260813-ODI合规自查工具-简化版(匿名快闪版)-v1.html」:
// 宋体系字体、navy 政务配色、卡片式 stepper、.card/.q/.opts/.formrow/.law/.modechoice 原样样式。
// 逻辑(题库/判档/校验/互斥)不变;右侧伴填同完整版(注入 CopilotAskContext/InstantQAContext)。
// 布局:嵌入合规空间中央区(flex 高度链上 minHeight:0,防内容撑破)。

import { useState, useContext } from "react";
import { CopilotAskContext, InstantQAContext } from "../compliance/components/fields";
import { ComplianceCopilotPanel } from "../compliance/components/ComplianceCopilotPanel";
import { lookupQA } from "../compliance/copilot/qaLibrary";
import { COUNTRY_OPTIONS, isRiskCtry } from "../compliance/logic/country";
import type { Mode } from "../compliance/logic/weights";
import { QUESTIONS, MODULES, checkedVals, val, type Answers, type Question } from "./questions";
import { QuickTestReport } from "./QuickTestReport";

// ─── 交付稿 CSS 变量(原样) ─────────────────────────────────────────────────
const V = {
  navy: "#00355F", mid: "#5187BF", light: "#E8EFF7", line: "#C9D8E8",
  ok: "#1E7B4D", warn: "#B07500", bad: "#B03A2E", ink: "#22303C",
  page: "#F4F7FA", field: "#FAFCFE", sub: "#F7FAFD",
  gray: "#7A8CA0", lead: "#55677A",
};
const FONT = '"Songti SC","STKaiti","Kaiti SC","Microsoft YaHei",serif';

const STEPS = ["使用说明", "模块〇 企业画像", "模块一 主体资格", "模块二 投资方式", "模块三 标的项目", "模块四 安全审查", "模块五 行业国别", "自查报告"];

const MODE_DESC: Record<string, string> = {
  new: "仅指在境外设立新企业(绿地投资)。已获证项目增资属\"变更类\";增资首次入股他人既有公司属\"并购类\"",
  ma: "取得既有境外标的公司股份,含并购、控股、参股;实现方式含受让老股、增资认购新股或两者并用",
  chg: "《企业境外投资证书》及核准/备案文件载明事项发生变化:投资额、投资人、资本构成、业务范围、投资路径等",
};

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
  const jump = (i: number) => { if (i < step) { setErr(null); setStep(i); } }; // 已完成步可回跳(HTML 原交互)

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
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", overflow: "hidden", background: V.page, fontFamily: FONT, color: V.ink, lineHeight: 1.7 }}>
      {/* 左列:速测主体 */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* 页头(HTML header 原样:navy 通栏 + h1 + badge + 副标题;左侧加返回箭头) */}
        <div style={{ background: V.navy, color: "#fff", padding: "14px 20px", flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBackHome} title="返回合规自查列表" aria-label="返回" style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", padding: 2, display: "flex", flexShrink: 0, opacity: 0.85 }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M10 3.5L5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1, margin: 0 }}>ODI合规自查工具</h1>
              <span style={{ background: V.mid, color: "#fff", fontSize: 12, padding: "2px 10px", borderRadius: 12 }}>简化版</span>
            </div>
            <p style={{ fontSize: 12, color: "#BCD2E8", margin: "4px 0 0" }}>企业境外投资自查表·简化版｜无需登录·约10-15分钟·覆盖核心自查事项｜输出：自查判断等级（ABCD）＋建议补充准备的材料</p>
          </div>
        </div>

        <CopilotAskContext.Provider value={q => setCopilotSeed(q)}>
        <InstantQAContext.Provider value={(q, a, clauses) => setInstantQA({ q, a, clauses })}>

        {/* 内容区(.wrap 原样:maxWidth 900 居中) */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 16px 56px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>

            {/* Stepper(HTML 原样:8 格小卡片,当前 navy,已完成绿可点回跳) */}
            {step < 7 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
                {STEPS.map((label, i) => {
                  const done = i < step, cur = i === step;
                  return (
                    <div key={i} onClick={() => jump(i)} style={{ flex: "1 1 92px", textAlign: "center", background: "#fff", border: `1px solid ${cur ? V.navy : V.line}`, borderRadius: 6, padding: "8px 4px", fontSize: 12.5, color: done ? V.ok : cur ? V.navy : V.gray, fontWeight: cur ? 700 : 400, cursor: done ? "pointer" : "default", boxShadow: cur ? "0 1px 4px rgba(0,53,95,.15)" : "none" }}>
                      <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: "50%", background: cur ? V.navy : done ? V.ok : V.light, color: cur || done ? "#fff" : V.mid, alignItems: "center", justifyContent: "center", fontWeight: 700, marginBottom: 3 }}>{done ? "✓" : i}</span>
                      <br />{label}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 使用说明(步骤0:card + ol.usage 原样) */}
            {step === 0 && <Instructions onStart={() => { setErr(null); setStep(1); }} />}

            {/* 模块〇-五(card + h2 底线 + lead + 题块) */}
            {step >= 1 && step <= 6 && (
              <div style={{ background: "#fff", border: `1px solid ${V.line}`, borderRadius: 8, padding: "20px 22px", boxShadow: "0 1px 3px rgba(0,53,95,.06)" }}>
                <ModuleHead n={step - 1} a={answers} />
                {renderModule(step - 1, answers, set, toggle)}
              </div>
            )}

            {/* 报告(步骤7) */}
            {step === 7 && <QuickTestReport answers={answers} onUpgrade={() => onUpgrade(answers)} onBack={() => setStep(6)} />}

            {/* 底部按钮(.btnrow 原样:ghost/primary;步骤7 由报告自带) */}
            {step < 7 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 0 8px", gap: 10 }}>
                <div style={{ fontSize: 13, color: V.bad, flex: 1, minWidth: 0 }}>{err || (step === 0 ? "" : "")}</div>
                {step > 0 ? (
                  <button onClick={prev} style={{ background: "none", border: `1px solid ${V.mid}`, color: V.mid, borderRadius: 6, padding: "10px 24px", fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>上一步</button>
                ) : <span />}
                <button onClick={step === 6 ? () => { const e = validateStep(6, answers); if (e) { setErr(e); return; } setStep(7); } : next} style={{ background: V.navy, color: "#fff", border: "none", borderRadius: 6, padding: "11px 36px", fontSize: 15, fontFamily: "inherit", cursor: "pointer", letterSpacing: 2 }}>
                  {step === 0 ? "开始自查" : step === 6 ? "生成自查报告" : `下一步　${STEPS[step + 1].split(" ")[0]}`}
                </button>
              </div>
            )}
          </div>
        </div>
        </InstantQAContext.Provider>
        </CopilotAskContext.Provider>
      </div>

      {/* 右侧:小海·合规伴填(与完整版同一面板) */}
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
  );
}

// ─── 使用说明(HTML 步骤0 原样:card + ol.usage,10 条 <b>标题。</b>正文) ─────
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
    <div style={{ background: "#fff", border: `1px solid ${V.line}`, borderRadius: 8, padding: "20px 22px", boxShadow: "0 1px 3px rgba(0,53,95,.06)" }}>
      <h2 style={{ color: V.navy, fontSize: 17, margin: "0 0 12px", paddingBottom: 8, borderBottom: `2px solid ${V.light}` }}>使用说明（企业必读）</h2>
      <ol style={{ margin: "6px 0 0 22px", fontSize: 14, padding: 0 }}>
        {items.map(([t, d], i) => <li key={i} style={{ margin: "7px 0", lineHeight: 1.7 }}><b>{t}</b>{d}</li>)}
      </ol>
    </div>
  );
}

// ─── 模块标题(card h2 底线 + lead 原样;模块三标题按 HTML 拆 h2+h3) ──────────
function ModuleHead({ n, a }: { n: number; a: Answers }) {
  const m = MODULES.find(x => x.n === n);
  if (!m) return null;
  return (
    <>
      <h2 style={{ color: V.navy, fontSize: 17, margin: "0 0 12px", paddingBottom: 8, borderBottom: `2px solid ${V.light}` }}>{m.title}</h2>
      {m.lead && <p style={{ fontSize: 13.5, color: V.lead, margin: "0 0 10px" }}>{m.lead}</p>}
      {n === 2 && (
        <div style={{ background: "#FFF9EC", border: "1px solid #EAD9A8", borderLeft: `4px solid ${V.warn}`, borderRadius: "0 6px 6px 0", padding: "8px 12px", margin: "8px 0", fontSize: 13, color: "#6B5417" }}>
          已按模块〇选定的投资方式进入对应分支（当前：{({ new: "新设类", ma: "并购类", chg: "变更类" } as Record<string, string>)[a["mode"]] || "—"}）；共通项全部填写。
        </div>
      )}
      {n === 2 && val(a, "mode") === "new" && (
        <div style={{ background: "#FFF9EC", border: "1px solid #EAD9A8", borderLeft: `4px solid ${V.warn}`, borderRadius: "0 6px 6px 0", padding: "8px 12px", margin: "8px 0", fontSize: 13, color: "#6B5417" }}>
          <b style={{ color: V.warn }}>口径提示：</b>本分支仅适用于在境外设立新企业。对已获证境外企业的增资，请返回模块〇改选"变更类"；通过增资认购他人既有公司新发行股份的，请改选"并购类"。
        </div>
      )}
      {n === 2 && val(a, "mode") === "ma" && (
        <div style={{ background: "#FFF9EC", border: "1px solid #EAD9A8", borderLeft: `4px solid ${V.warn}`, borderRadius: "0 6px 6px 0", padding: "8px 12px", margin: "8px 0", fontSize: 13, color: "#6B5417" }}>
          <b style={{ color: V.warn }}>前置程序提示：</b>设立方式为"并购"或"增资并购"的，必须先选择已填写或已通过的"并购事项前期报告表"（在系统"备案（核准）报告"应用中填报），方可继续填写境外投资申请表。
        </div>
      )}
      {n === 2 && val(a, "mode") === "chg" && (
        <div style={{ background: "#FFF9EC", border: "1px solid #EAD9A8", borderLeft: `4px solid ${V.warn}`, borderRadius: "0 6px 6px 0", padding: "8px 12px", margin: "8px 0", fontSize: 13, color: "#6B5417" }}>
          变更类针对已核准/备案项目，对照《企业境外投资证书》及核准文件/备案通知书载明的各个事项逐项核查变化。
        </div>
      )}
      {n === 3 && <h3 style={{ color: V.navy, fontSize: 15, margin: "16px 0 8px" }}>3.1　标的（项目）基本信息与登记文件</h3>}
      {n === 3 && (
        <div style={{ background: "#FFF9EC", border: "1px solid #EAD9A8", borderLeft: `4px solid ${V.warn}`, borderRadius: "0 6px 6px 0", padding: "8px 12px", margin: "8px 0", fontSize: 13, color: "#6B5417" }}>
          <b style={{ color: V.warn }}>审批填报预告：</b>申请表中"投资路径"仅指第一层级境外企业；"最终目的地境外企业"另行单独填报，注册资本应与其章程约定一致。请按"第一层级平台+最终目的地企业"两层口径梳理架构信息。
        </div>
      )}
      {n === 3 && <h3 style={{ color: V.navy, fontSize: 15, margin: "16px 0 8px" }}>3.2　三套负面清单逐项核对（法律渊源不同，分别核对，不可混淆）</h3>}
      {n === 4 && (
        <div style={{ background: "#FFF9EC", border: "1px solid #EAD9A8", borderLeft: `4px solid ${V.warn}`, borderRadius: "0 6px 6px 0", padding: "8px 12px", margin: "8px 0", fontSize: 13, color: "#6B5417" }}>
          安全审查是受理后的前置环节：主管机关受理申请后先进行安全审查，疑虑未消除的不予批准、不进入后续实质审查。本模块为事实采集与预警，不能替代主管机关安全审查。
        </div>
      )}
    </>
  );
}

// ─── 模块渲染 ──────────────────────────────────────────────────────────────
type SetFn = (id: string, v: string) => void;
type ToggleFn = (q: Question, v: string) => void;

function renderModule(n: number, a: Answers, set: SetFn, toggle: ToggleFn) {
  const qs = QUESTIONS.filter(q => q.module === n && (!q.show || q.show(a)));
  return <>{qs.map((q, i) => <QView key={q.id} q={q} i={i} a={a} set={set} toggle={toggle} />)}</>;
}

function QView({ q, i, a, set, toggle }: { q: Question; i: number; a: Answers; set: SetFn; toggle: ToggleFn }) {
  // 投资方式三选(modechoice 原样:2px 边框大按钮,选中 navy 反白)
  if (q.type === "mode") return <ModePicker value={val(a, q.id)} onChange={v => set(q.id, v)} />;

  // 模块〇:表单行(formrow 原样:label 200px 定宽 + hint 换行)
  if (q.module === 0) {
    if (q.type === "text") return <FormRowQt label={q.stem} hint={q.hint}><input type="text" value={val(a, q.id)} onChange={e => set(q.id, e.target.value)} placeholder={q.placeholder} style={inputS} /></FormRowQt>;
    if (q.type === "multi") return (
      <FormRowQt label={q.stem} hint={q.hint}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(q.opts || []).map(o => (
            <label key={o.v} style={{ background: V.field, border: `1px solid ${V.line}`, borderRadius: 6, padding: "6px 12px", fontSize: 13.5, cursor: "pointer" }}>
              <input type="checkbox" checked={checkedVals(a, q.id).includes(o.v)} onChange={() => toggle(q, o.v)} style={{ marginRight: 8 }} />{o.label}
            </label>
          ))}
        </div>
      </FormRowQt>
    );
    const opts = q.id === "p_ctry" ? COUNTRY_OPTIONS.map(c => ({ v: c, label: c })) : q.opts || [];
    return (
      <FormRowQt label={q.stem} hint={q.hint}>
        <select value={val(a, q.id)} onChange={e => set(q.id, e.target.value)} style={{ ...inputS, flex: "1 1 240px" }}>
          <option value="">{q.id === "p_ctry" ? "请选择国别（地区）" : "请选择"}</option>
          {opts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
      </FormRowQt>
    );
  }

  // 条件文本题(如 m1na_reason):formrow
  if (q.type === "text") return <FormRowQt label={q.stem}><input type="text" value={val(a, q.id)} onChange={e => set(q.id, e.target.value)} placeholder={q.placeholder} style={{ ...inputS, flex: "1 1 240px" }} /></FormRowQt>;

  // 模块一-五题块(.q 原样:上虚线 + 15px 加粗题干 + opts 原生控件 + details.law)
  const isMulti = q.type === "multi";
  return (
    <div style={{ margin: "16px 0 6px", paddingTop: i === 0 ? 0 : 12, borderTop: i === 0 ? "none" : `1px dashed ${V.line}` }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 6 }}>
        <span style={{ flex: 1 }}>{q.stem}</span>
        <AskSparkle stem={q.stem} />
      </div>
      <div>
        {(q.opts || []).map(o => (
          <label key={o.v} style={{ display: "block", background: V.field, border: `1px solid ${V.line}`, borderRadius: 6, padding: "8px 12px", margin: "6px 0", fontSize: 14, cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.background = V.light)} onMouseLeave={e => (e.currentTarget.style.background = V.field)}>
            <input type={isMulti ? "checkbox" : "radio"} name={q.id} checked={isMulti ? checkedVals(a, q.id).includes(o.v) : val(a, q.id) === o.v} onChange={() => isMulti ? toggle(q, o.v) : set(q.id, o.v)} style={{ marginRight: 8 }} />{o.label}
          </label>
        ))}
      </div>
      {q.law && <LawBox law={q.law} />}
    </div>
  );
}

// 法源折叠(details.law 原样)
function LawBox({ law }: { law: string }) {
  return (
    <details style={{ marginTop: 8, fontSize: 13 }}>
      <summary style={{ color: V.mid, cursor: "pointer", fontSize: 13 }}>分析依据</summary>
      <div style={{ background: V.light, borderLeft: `4px solid ${V.mid}`, padding: "10px 14px", marginTop: 6, borderRadius: "0 6px 6px 0", color: "#33475C" }}>{law}</div>
    </details>
  );
}

// 表单行(formrow 原样)
const inputS: React.CSSProperties = { fontFamily: "inherit", fontSize: 14, padding: "7px 10px", border: `1px solid ${V.line}`, borderRadius: 6, background: V.field, color: V.ink, outline: "none" };
function FormRowQt({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "8px 0", flexWrap: "wrap", fontSize: 14 }}>
      <span style={{ flex: "0 0 200px", fontWeight: 700, display: "flex", alignItems: "flex-start", gap: 4 }}>
        <span style={{ flex: 1 }}>{label}</span>
        <AskSparkle stem={label} small />
      </span>
      <div style={{ flex: "1 1 240px", display: "flex", alignItems: "center" }}>{children}</div>
      {hint && <div style={{ flex: "1 1 100%", fontSize: 12.5, color: V.gray, marginLeft: 210 }}>{hint}</div>}
    </div>
  );
}

// 投资方式三选(modechoice 原样)
function ModePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>投资方式（决定模块二分支，请先选择）</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {(["new", "ma", "chg"] as const).map(k => {
          const sel = value === k;
          return (
            <button key={k} onClick={() => onChange(k)}
              style={{ flex: "1 1 180px", background: sel ? V.navy : V.light, border: `2px solid ${sel ? V.navy : V.line}`, borderRadius: 8, padding: "14px 10px", fontSize: 15, fontFamily: "inherit", cursor: "pointer", color: sel ? "#fff" : V.navy, transition: ".15s" }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = V.mid; }} onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = V.line; }}>
              {{ new: "新设类", ma: "并购类", chg: "变更类" }[k]}
              <small style={{ display: "block", fontSize: 12, marginTop: 5, opacity: 0.75, fontWeight: 400 }}>{MODE_DESC[k]}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 题目「问小海」sparkle(同完整版 AskIcon 行为:命中预设 QA 直达对话,否则种入输入框)
function AskSparkle({ stem, small }: { stem: string; small?: boolean }) {
  const ask = useContext(CopilotAskContext);
  const instantQA = useContext(InstantQAContext);
  if (!ask && !instantQA) return null;
  const size = small ? 20 : 24;
  const fire = () => {
    const qa = lookupQA(stem);
    if (qa && instantQA) { instantQA(qa.q, qa.a, qa.clauses as { id: string; quote: string }[] | undefined); return; }
    ask?.(`请结合法规解释：「${stem.replace(/\s+/g, " ").trim()}」——这一项具体怎么判断？我们这种情况该怎么填？`);
  };
  return (
    <button onClick={fire} title="让小海解释这一项" aria-label="让小海解释这一项"
      style={{ width: size, height: size, border: "none", background: "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: V.mid, flexShrink: 0, padding: 0, opacity: 0.75 }}
      onMouseEnter={e => (e.currentTarget.style.opacity = "1")} onMouseLeave={e => (e.currentTarget.style.opacity = "0.75")}>
      <svg width={size * 0.8} height={size * 0.8} viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5c.3 2.5 1.5 3.7 4 4-2.5.3-3.7 1.5-4 4-.3-2.5-1.5-3.7-4-4 2.5-.3 3.7-1.5 4-4z" /><path d="M12.5 10.5c.15 1.2.7 1.75 1.9 1.9-1.2.15-1.75.7-1.9 1.9-.15-1.2-.7-1.75-1.9-1.9 1.2-.15 1.75-.7 1.9-1.9z" opacity="0.5" /></svg>
    </button>
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
