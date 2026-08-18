// 合规自查向导 —— 共享字段组件（radio / checkbox / text / select / 文件上传）。
// 样式约定照搬 POC：内联 style，hover 经 onMouseEnter/Leave 改 currentTarget。

import type { ReactNode } from "react";
import { useState, useRef, createContext, useContext } from "react";
import { C } from "../complianceTheme";
import { lookupQA } from "../copilot/qaLibrary";
import type { FileId } from "../logic/weights";
import { fw, isENH } from "../logic/weights";
import type { Mode } from "../logic/weights";
import type { Upload } from "../logic/wizardModel";

// ─── 向导 API：步骤组件通过它读写状态 ────────────────────────────────────────
export interface WizardApi {
  state: import("../logic/wizardModel").WizardState;
  setSingle: (name: string, value: string) => void;
  toggleMulti: (name: string, value: string) => void;
  setMulti: (name: string, values: string[]) => void;
  setMode: (m: Mode) => void;
  setLsNone: (b: boolean) => void;
  uploadFile: (fid: FileId, name: string) => void;
  toggleMask: (fid: FileId) => void;
  pickCountry: (ctry: string) => void;
}

// 让向导题目一键把问题种入伴填输入框（由 ComplianceWizard 通过 Provider 注入；未注入时不渲染图标）。
export const CopilotAskContext = createContext<((question: string) => void) | null>(null);

// 高风险过滤上下文：非 null 时，只渲染匹配高风险事项的 QuestionBlock / FormRow，其余隐藏。
export const HighRiskFilterCtx = createContext<string[] | null>(null);

// 高风险修改模式下隐藏"非题目"包装(模块导语/提示条/小节标题/文件区等)——只留命中的高风险题目。
// 题目本体(QuestionBlock/FormRow)自行按 ctx 过滤;包装性内容包一层本组件即可。
export function RiskHide({ children }: { children?: ReactNode }) {
  const riskFilter = useContext(HighRiskFilterCtx);
  if (riskFilter) return null;
  return <>{children}</>;
}

// 预设问答上下文：点击 sparkle 后直接以 Q&A 对形式展示在右侧，不走 API。
export const InstantQAContext = createContext<((q: string, a: string, clauses?: { id: string; quote: string }[]) => void) | null>(null);

function matchHighRisk(stem: ReactNode, riskNames: string[]): boolean {
  if (typeof stem !== "string") return true; // 非文本题干不隐藏
  const norm = (s: string) => s.replace(/[\s　（）()（）]/g, "");
  const ns = norm(stem);
  return riskNames.some(name => {
    const n = norm(name);
    if (ns.includes(n) || n.includes(ns)) return true;
    for (let i = 0; i <= n.length - 4; i++) { if (ns.includes(n.slice(i, i + 4))) return true; }
    return false;
  });
}

// 轻量内联富文本：渲染 **bold**（与右侧伴填面板 RichText 同口径，便于浮层与面板观感一致）
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>)}</>;
}

// 可复用的「问沪航者」图标按钮（行内字段用，尺寸较小）
// 悬停：浮层直接显示该项预设解释（口径 / 各档含义 / 法规依据）；点击：推送到右侧伴填，可继续追问。
function AskIcon({ question, label, size = 26 }: { question: string; label?: string; size?: number }) {
  const ask = useContext(CopilotAskContext);
  const instantQA = useContext(InstantQAContext);
  const [hover, setHover] = useState(false);
  const timer = useRef<number | null>(null);
  if (!ask && !instantQA) return null;
  // 仅当存在预设问答时才挂浮层（hover/点击都与这条 qa 对齐，无 qa 时退回原生 title + ask）
  const qa = instantQA && label ? lookupQA(label) : null;
  const cancelHover = () => { if (timer.current != null) { window.clearTimeout(timer.current); timer.current = null; } };
  return (
    <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}
      onMouseEnter={() => { if (qa) { cancelHover(); timer.current = window.setTimeout(() => setHover(true), 120); } }}
      onMouseLeave={() => { cancelHover(); setHover(false); }}>
      <button onClick={() => {
        if (qa) { instantQA?.(qa.q, qa.a, qa.clauses); return; }
        if (ask) ask(question);
      }} title={qa ? undefined : "让沪航者解释这一项"} aria-label="让沪航者解释这一项"
        style={{ width: size, height: size, border: "none", background: "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: C.primary, flexShrink: 0, transition: "opacity .15s", padding: 0, verticalAlign: "middle", opacity: 0.6 }}
        onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = "0.6"; }}>
        <svg width={size * 0.8} height={size * 0.8} viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5c.3 2.5 1.5 3.7 4 4-2.5.3-3.7 1.5-4 4-.3-2.5-1.5-3.7-4-4 2.5-.3 3.7-1.5 4-4z" /><path d="M12.5 10.5c.15 1.2.7 1.75 1.9 1.9-1.2.15-1.75.7-1.9 1.9-.15-1.2-.7-1.75-1.9-1.9 1.2-.15 1.75-.7 1.9-1.9z" opacity="0.5" /></svg>
      </button>
      {qa && hover && (
        <div role="tooltip" style={{ position: "absolute", top: "100%", right: 0, marginTop: 6, zIndex: 50, pointerEvents: "none",
            background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, boxShadow: "0 6px 20px rgba(22,40,56,.13)",
            padding: "10px 12px", width: "max-content", maxWidth: 340, minWidth: 200, fontSize: 12.5, lineHeight: 1.6, color: C.ink, textAlign: "left" }}>
          <div style={{ fontWeight: 700, color: C.primary, marginBottom: 4 }}>{qa.q}</div>
          <div style={{ whiteSpace: "pre-wrap" }}><RichText text={qa.a} /></div>
          {qa.clauses && qa.clauses.length > 0 && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${C.line}`, fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>
              {qa.clauses.map((c, i) => <div key={i}>· {c.id}{c.quote && c.quote.trim() ? `：${c.quote}` : ""}</div>)}
            </div>
          )}
          <div style={{ marginTop: 7, fontSize: 11, color: C.muted }}>点击可在右侧伴填继续追问</div>
        </div>
      )}
    </span>
  );
}

// ─── 题块（题干 + 可选分析依据 + 正文）──────────────────────────────────────
export function QuestionBlock({ stem, children, law }: { stem: ReactNode; children?: ReactNode; law?: string }) {
  const [open, setOpen] = useState(false);
  const riskFilter = useContext(HighRiskFilterCtx);
  if (riskFilter && !matchHighRisk(stem, riskFilter)) return null;
  const seed = () => {
    const t = typeof stem === "string" ? stem.replace(/\s+/g, " ").trim() : "这道自查题";
    return `请结合法规解释：「${t}」——这一项具体怎么判断？我们这种情况该怎么填？`;
  };
  return (
    <div style={{ margin: "16px 0", padding: "14px 0 6px", borderTop: `1px dashed ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: C.ink, lineHeight: 1.6 }}>{stem}</div>
        <AskIcon question={seed()} label={typeof stem === "string" ? stem : undefined} size={26} />
      </div>
      {children}
      {law && (
        <div style={{ marginTop: 6 }}>
          <button onClick={() => setOpen(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: C.primary, padding: 0 }}>
            {open ? "▾ 收起分析依据" : "▸ 分析依据"}
          </button>
          {open && (
            <div style={{ background: C.primaryBg, borderLeft: `4px solid ${C.primary}`, padding: "9px 13px", marginTop: 6, borderRadius: "0 7px 7px 0", fontSize: 12.5, color: "#33475C", lineHeight: 1.6 }}>
              {law}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 单选题 ─────────────────────────────────────────────────────────────────
export function RadioQ({ name, value, options, onChange }: {
  name: string;
  value: string | null;
  options: { v: string; label: ReactNode }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      {options.map(opt => {
        const sel = value === opt.v;
        return (
          <label key={opt.v} onClick={() => onChange(opt.v)}
            style={{ display: "block", background: sel ? C.primaryBg : C.fieldBg, border: `1px solid ${sel ? C.primary : C.line}`, borderRadius: 7, padding: "9px 12px", margin: "6px 0", fontSize: 13.5, cursor: "pointer", color: C.ink, lineHeight: 1.55, transition: "border-color .15s, background .15s" }}>
            <span style={{ display: "inline-flex", width: 15, height: 15, borderRadius: "50%", border: `2px solid ${sel ? C.primary : "#9aa8b5"}`, marginRight: 9, verticalAlign: "middle", position: "relative", flexShrink: 0 }}>
              {sel && <span style={{ position: "absolute", inset: 2, borderRadius: "50%", background: C.primary }} />}
            </span>
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}

// ─── 多选题（支持"均不涉及"互斥项 noneValue）─────────────────────────────────
export function CheckQ({ values, options, onToggle, noneValue }: {
  values: string[];
  options: { v: string; label: ReactNode }[];
  onToggle: (v: string) => void;
  noneValue?: string;
}) {
  const noneOn = noneValue != null && values.includes(noneValue);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map(opt => {
        const isNone = opt.v === noneValue;
        const sel = isNone ? noneOn : values.includes(opt.v);
        const disabled = !isNone && noneOn;
        return (
          <label key={opt.v} onClick={() => { if (!disabled) onToggle(opt.v); }}
            style={{ background: sel ? C.primaryBg : C.fieldBg, border: `1px solid ${sel ? C.primary : C.line}`, borderRadius: 7, padding: "6px 12px", fontSize: 13, cursor: disabled ? "not-allowed" : "pointer", color: disabled ? C.muted : C.ink, opacity: disabled ? 0.55 : 1, lineHeight: 1.4, transition: "border-color .15s" }}>
            <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, border: `2px solid ${sel ? C.primary : "#9aa8b5"}`, marginRight: 7, verticalAlign: "middle", position: "relative" }}>
              {sel && <span style={{ position: "absolute", inset: 1.5, background: C.primary, borderRadius: 1 }} />}
            </span>
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}

// ─── 文本/下拉（栅格行）──────────────────────────────────────────────────────
export function FormRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const riskFilter = useContext(HighRiskFilterCtx);
  if (riskFilter && !matchHighRisk(label, riskFilter)) return null;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "9px 0", flexWrap: "wrap", fontSize: 13.5 }}>
      <span style={{ flex: "0 0 140px", fontWeight: 700, color: C.ink }}>{label}</span>
      <div style={{ flex: "1 1 260px", display: "flex", alignItems: "center", gap: 6 }}>{children}<AskIcon question={`请解释：「${label}」——这一项具体指什么？该怎么填？`} label={label} /></div>
      {hint && <div style={{ flex: "1 1 100%", fontSize: 12, color: C.muted, marginLeft: 150, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  fontFamily: "inherit", fontSize: 13.5, padding: "7px 10px", border: `1px solid ${C.line}`, borderRadius: 7, background: C.fieldBg, color: C.ink, outline: "none", width: "100%", boxSizing: "border-box",
};

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />;
}

export function SelectInput({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>{children}</select>;
}

// ─── 文件上传区 ─────────────────────────────────────────────────────────────
export function FilesBlock({ title = "应准备文件（上传自愿 · 不作申报条件 · 可脱敏 · 上传即得分）", fids, mode, uploads, onUpload, onToggleMask }: {
  title?: string;
  fids: FileId[];
  mode: Mode;
  uploads: Partial<Record<FileId, Upload>>;
  onUpload: (fid: FileId, name: string) => void;
  onToggleMask: (fid: FileId) => void;
}) {
  const riskFilter = useContext(HighRiskFilterCtx);
  if (riskFilter) return null; // 高风险修改模式只看问题项,文件区不显示
  return (
    <div style={{ background: "#F4F9F4", border: `1px solid #CFE3D2`, borderLeft: `4px solid ${C.ok}`, borderRadius: "0 8px 8px 0", padding: "10px 14px", margin: "10px 0 4px" }}>
      <div style={{ fontWeight: 700, color: C.ok, fontSize: 13, marginBottom: 6 }}>{title}</div>
      {fids.map(fid => (
        <FileRow key={fid} fid={fid} mode={mode} upload={uploads[fid]} onUpload={onUpload} onToggleMask={onToggleMask} />
      ))}
    </div>
  );
}

function FileRow({ fid, mode, upload, onUpload, onToggleMask }: {
  fid: FileId; mode: Mode; upload?: Upload;
  onUpload: (fid: FileId, name: string) => void; onToggleMask: (fid: FileId) => void;
}) {
  const enhanced = isENH(fid, mode);
  const w = fw(fid, mode);
  const weightLabel = enhanced ? "增强 +1" : w > 0 ? `核心 ${w} 分` : "信息采集";
  const hasName = !!upload?.name;
  const statusTxt = hasName
    ? `已上传${upload!.masked ? "·脱敏" : ""}：${upload!.name}`
    : `未上传${upload?.masked ? "（已勾脱敏，待上传）" : ""}`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "6px 0", borderTop: `1px dashed #CFE3D2`, fontSize: 13, color: "#2C4A33" }}>
      <span style={{ flex: "1 1 280px" }}>
        {FILE_LABELS_INLINE[fid] ?? fid}
        <em style={{ fontStyle: "normal", color: enhanced ? C.ok : C.primary, fontSize: 11.5, marginLeft: 6, fontWeight: 600 }}>{weightLabel}</em>
      </span>
      <label style={{ background: "#fff", border: `1px solid ${C.ok}`, color: C.ok, borderRadius: 5, padding: "3px 12px", fontSize: 12.5, cursor: "pointer" }}>
        选择文件
        <input type="file" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(fid, f.name); e.target.value = ""; }} />
      </label>
      <label style={{ fontSize: 12.5, color: "#55677A", cursor: "pointer", whiteSpace: "nowrap" }}>
        <input type="checkbox" checked={!!upload?.masked} onChange={() => onToggleMask(fid)} style={{ marginRight: 3 }} />已脱敏
      </label>
      <span style={{ fontSize: 12.5, color: hasName ? C.ok : C.muted, fontWeight: hasName ? 700 : 400, minWidth: 60 }}>{statusTxt}</span>
    </div>
  );
}

// 文件名展示（与 logic/weights 的 FILE_LABEL 一致，这里内联用于上传区）
import { FILE_LABEL } from "../logic/weights";
const FILE_LABELS_INLINE: Record<FileId, string> = FILE_LABEL;
