import { useState, useEffect, useRef } from "react";
import { RobotAvatar } from "./WelcomeFrame";
import type { AppFrame, AttachedFile } from "../App";

interface Props {
  frame: AppFrame;
  onFormConfirm: () => void;
  onContinueUpload: () => void;
  investMethod: string;
  setInvestMethod: (v: string) => void;
  entityType: string;
  setEntityType: (v: string) => void;
  destination: string;
  setDestination: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  preInfoConfirmed: boolean;
  attachedFiles: AttachedFile[];
  setAttachedFiles: (files: AttachedFile[] | ((prev: AttachedFile[]) => AttachedFile[])) => void;
  materialGenerationStarted: boolean;
  setMaterialGenerationStarted: (v: boolean) => void;
}

/* ─────────── constants ─────────── */

const INVESTMENT_METHODS = ["新设", "并购", "增资", "分公司", "办事处", "暂不确定"];
const ENTITY_TYPES = ["子公司", "分公司", "代表处或办事处", "并购标的", "暂不确定"];
const TICKER_TEXTS = ["ODI 助办智能体已启动", "正在同步材料清单", "企业认证信息已带出", "ODI 助办运行中"];

type WorkbenchTab = "preinfo" | "materials" | "generation" | "review" | "progress";

const FRAME_TO_TAB: Partial<Record<AppFrame, WorkbenchTab>> = {
  "odi-preinfo": "preinfo",
  "odi-materials": "materials",
  "odi-project": "progress",
  "odi-prereview": "review",
};

const WORKBENCH_TABS: { key: WorkbenchTab; label: string }[] = [
  { key: "preinfo", label: "前置" },
  { key: "materials", label: "材料" },
  { key: "generation", label: "生成" },
  { key: "review", label: "审核" },
  { key: "progress", label: "进度" },
];

type StatusKey =
  | "已补充" | "待补充" | "已认证带出"
  | "已上传" | "已识别" | "需补充" | "待上传"
  | "可下载" | "待生成" | "已生成"
  | "待确认" | "已完成" | "进行中" | "待完成" | "需补充信息";

const STATUS_STYLE: Record<StatusKey, { bg: string; color: string; border: string }> = {
  "已补充":    { bg: "#eff6ff", color: "#1a5bc6", border: "#bfdbfe" },
  "已认证带出":{ bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  "已上传":    { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  "已识别":    { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  "可下载":    { bg: "#eff6ff", color: "#1a5bc6", border: "#bfdbfe" },
  "已生成":    { bg: "#eff6ff", color: "#1a5bc6", border: "#bfdbfe" },
  "已完成":    { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  "待补充":    { bg: "#fff7ed", color: "#ea580c", border: "#fdba74" },
  "需补充":    { bg: "#fff7ed", color: "#ea580c", border: "#fdba74" },
  "需补充信息":{ bg: "#fff7ed", color: "#ea580c", border: "#fdba74" },
  "待上传":    { bg: "#fff7ed", color: "#ea580c", border: "#fdba74" },
  "待生成":    { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
  "待确认":    { bg: "#f5f3ff", color: "#7c3aed", border: "#c4b5fd" },
  "进行中":    { bg: "#eff6ff", color: "#1a5bc6", border: "#bfdbfe" },
  "待完成":    { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
};

/* ─────────── keyframes injected once ─────────── */
const ANIM_CSS = `
@keyframes odiPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55)}70%{box-shadow:0 0 0 6px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
@keyframes odiFabIn{0%{opacity:0;transform:scale(0.55)}100%{opacity:1;transform:scale(1)}}
@keyframes odiFabPulse{0%,100%{box-shadow:0 4px 16px rgba(26,64,140,0.32)}50%{box-shadow:0 6px 28px rgba(26,91,198,0.55)}}
@keyframes odiPanelIn{0%{opacity:0;transform:translateX(20px) scale(0.96)}100%{opacity:1;transform:translateX(0) scale(1)}}
@keyframes odiTabFade{0%{opacity:0}100%{opacity:1}}
@keyframes odiBadgePop{0%{transform:scale(0.4)}65%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes odiModalIn{0%{opacity:0;transform:scale(0.93)}100%{opacity:1;transform:scale(1)}}
@keyframes odiModalOut{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(0.93)}}
@keyframes odiMsgIn{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
@keyframes odiSpin{to{transform:rotate(360deg)}}
`;

/* ─────────── small shared components ─────────── */

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status as StatusKey] ?? { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" };
  return (
    <span style={{
      padding: "2px 7px", borderRadius: 20, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap",
      background: s.bg, color: s.color,
      borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
      borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
      borderTopColor: s.border, borderRightColor: s.border, borderBottomColor: s.border, borderLeftColor: s.border,
    }}>{status}</span>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 11, height: 11, borderRadius: "50%",
      borderTopWidth: 2, borderRightWidth: 2, borderBottomWidth: 2, borderLeftWidth: 2,
      borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
      borderTopColor: "#1a5bc6", borderRightColor: "#bfdbfe", borderBottomColor: "#bfdbfe", borderLeftColor: "#bfdbfe",
      animation: "odiSpin 0.7s linear infinite", verticalAlign: "middle",
    }} />
  );
}

function AgentStatusTicker() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIndex(i => (i + 1) % TICKER_TEXTS.length); setVisible(true); }, 350);
    }, 2600);
    return () => clearInterval(iv);
  }, []);
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20,
      background: "linear-gradient(90deg,#e8f0fe,#f0f6ff)",
      borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
      borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
      borderTopColor: "#bfdbfe", borderRightColor: "#bfdbfe", borderBottomColor: "#bfdbfe", borderLeftColor: "#bfdbfe",
    }}>
      <span style={{ display: "block", width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "odiPulse 1.6s infinite", flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: "#1a5bc6", fontWeight: 500, whiteSpace: "nowrap", opacity: visible ? 1 : 0, transition: "opacity 0.3s ease" }}>
        {TICKER_TEXTS[index]}
      </span>
    </div>
  );
}

function Chip({ label, selected, confirmed, onClick }: { label: string; selected: boolean; confirmed: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 10px", borderRadius: 16, fontSize: 11, cursor: confirmed ? "default" : "pointer",
      transition: "all 0.15s",
      borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
      borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
      borderTopColor: confirmed ? "#22c55e" : selected ? "#1a5bc6" : "#dde9f7",
      borderRightColor: confirmed ? "#22c55e" : selected ? "#1a5bc6" : "#dde9f7",
      borderBottomColor: confirmed ? "#22c55e" : selected ? "#1a5bc6" : "#dde9f7",
      borderLeftColor: confirmed ? "#22c55e" : selected ? "#1a5bc6" : "#dde9f7",
      background: confirmed ? "#f0fdf4" : selected ? "#1a5bc6" : "#fff",
      color: confirmed ? "#16a34a" : selected ? "#fff" : "#6b8ab0",
    }}>{label}</button>
  );
}

const formInputStyle = (readOnly: boolean): React.CSSProperties => ({
  width: "100%", height: 30, padding: "0 8px", borderRadius: 5, outline: "none",
  borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
  borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
  borderTopColor: "#dde9f7", borderRightColor: "#dde9f7", borderBottomColor: "#dde9f7", borderLeftColor: "#dde9f7",
  background: readOnly ? "#f0f4fb" : "#fff", color: "#1a2744",
  fontSize: 11, boxSizing: "border-box", fontFamily: "inherit",
});

/* ═══════════════════════════════════════════════════════
   WORKBENCH TAB CONTENTS
═══════════════════════════════════════════════════════ */

/* ─────────── 前置 tab ─────────── */
function PreInfoTab() {
  const INVEST_FIELDS = [
    { label: "本次投资方式是什么？", status: "待补充" as const },
    { label: "本次境外主体类型是什么？", status: "待补充" as const },
    { label: "投资目的地是哪里？", status: "待补充" as const },
    { label: "本次投资金额及币种是多少？", status: "待补充" as const },
  ];
  const CERT_FIELDS = [
    { label: "企业名称", value: "上海某科技有限公司" },
    { label: "统一社会信用代码", value: "91310000XXXXXXXXXX" },
    { label: "法定代表人", value: "张三" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#1a2744", marginBottom: 8 }}>核心前置字段</p>
      {INVEST_FIELDS.map((f, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          padding: "8px 0",
          borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#f0f4fb",
          borderTopWidth: 0, borderTopStyle: "solid", borderTopColor: "transparent",
          borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
          borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
        }}>
          <p style={{ fontSize: 11, color: "#6b8ab0", flex: 1 }}>{f.label}</p>
          <StatusBadge status={f.status} />
        </div>
      ))}

      <p style={{ fontSize: 11, fontWeight: 700, color: "#1a2744", marginTop: 14, marginBottom: 8 }}>认证已带出信息</p>
      {CERT_FIELDS.map((f, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          padding: "7px 0",
          borderBottomWidth: i < CERT_FIELDS.length - 1 ? 1 : 0, borderBottomStyle: "solid", borderBottomColor: "#f0f4fb",
          borderTopWidth: 0, borderTopStyle: "solid", borderTopColor: "transparent",
          borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
          borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, color: "#8a9bbf", marginBottom: 1 }}>{f.label}</p>
            <p style={{ fontSize: 12, color: "#16a34a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.value}</p>
          </div>
          <StatusBadge status="已认证带出" />
        </div>
      ))}

      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
        <p style={{ fontSize: 11, color: "#ea580c", lineHeight: 1.6 }}>
          ⚠ 当前 4 项字段待补充，可通过对话或点击下方按钮补充。
        </p>
        <button style={{
          width: "100%", padding: "7px 0", borderRadius: 6,
          background: "linear-gradient(90deg,#1a5bc6,#2d78e8)",
          borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
          borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
          borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderLeftColor: "transparent",
          color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>继续补充</button>
        <button style={{
          width: "100%", padding: "6px 0", borderRadius: 6,
          borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
          borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
          borderTopColor: "#bfdbfe", borderRightColor: "#bfdbfe", borderBottomColor: "#bfdbfe", borderLeftColor: "#bfdbfe",
          background: "#e8f0fe", color: "#1a5bc6", fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>确认生成清单</button>
      </div>
    </div>
  );
}

/* ─────────── 材料 tab ─────────── */
function MaterialsListTab() {
  const UPLOAD_MATS = [
    { name: "可行性研究报告或项目说明材料", status: "待上传" },
    { name: "投资决策文件（董事会/股东会决议）", status: "待上传" },
    { name: "投资协议、意向书或并购协议", status: "待上传" },
    { name: "审计报告或最近一年财务报表", status: "已上传" },
    { name: "资金来源说明或资金证明材料", status: "待上传" },
    { name: "其他项目支撑材料", status: "待上传" },
  ];
  const DOWNLOAD_MATS = [
    { name: "商务部门材料准备清单", status: "可下载" },
    { name: "境外投资备案申请表", status: "可下载" },
    { name: "境外投资真实性承诺书", status: "可下载" },
    { name: "股权架构图", status: "可下载" },
    { name: "可行性研究报告参考框架", status: "可下载" },
    { name: "备案申请表草稿", status: "待生成" },
    { name: "真实性承诺书草稿", status: "待生成" },
    { name: "股权架构图草稿", status: "待生成" },
    { name: "可行性研究报告草稿", status: "待生成" },
  ];

  const divider = (
    <div style={{
      margin: "10px 0",
      borderTopWidth: 1, borderTopStyle: "dashed", borderTopColor: "#dde9f7",
      borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
      borderBottomWidth: 0, borderBottomStyle: "solid", borderBottomColor: "transparent",
      borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
    }} />
  );

  return (
    <div>
      {/* Upload */}
      <p style={{ fontSize: 11, fontWeight: 700, color: "#1a2744", marginBottom: 3 }}>需上传材料</p>
      <p style={{ fontSize: 10, color: "#8a9bbf", lineHeight: 1.5, marginBottom: 8 }}>请上传已具备的项目支撑材料，系统将用于识别项目关键信息，并辅助后续表单和文书生成。</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {UPLOAD_MATS.map((m, i) => {
          const done = m.status === "已上传";
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "7px 9px", borderRadius: 7,
              background: done ? "#f0fdf4" : "#f8faff",
              borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
              borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
              borderTopColor: done ? "#bbf7d0" : "#e8f0fe",
              borderRightColor: done ? "#bbf7d0" : "#e8f0fe",
              borderBottomColor: done ? "#bbf7d0" : "#e8f0fe",
              borderLeftColor: done ? "#bbf7d0" : "#e8f0fe",
            }}>
              <div style={{ width: 24, height: 24, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: done ? "#dcfce7" : "#e8f0fe" }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  {done
                    ? <path d="M2 6.5l2.5 2.5L10 3" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    : <><path d="M6 8.5V4M4 5.5L6 3.5L8 5.5" stroke="#1a5bc6" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /><path d="M2 9.5h8" stroke="#1a5bc6" strokeWidth="1.2" strokeLinecap="round" /></>}
                </svg>
              </div>
              <p style={{ flex: 1, fontSize: 11, color: "#1a2744", lineHeight: 1.4, minWidth: 0 }}>{m.name}</p>
              <StatusBadge status={m.status} />
              <button style={{
                padding: "3px 7px", borderRadius: 4, fontSize: 10, cursor: "pointer", flexShrink: 0,
                background: done ? "#dcfce7" : "#e8f0fe",
                color: done ? "#16a34a" : "#1a5bc6",
                borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                borderTopColor: done ? "#bbf7d0" : "#bfdbfe",
                borderRightColor: done ? "#bbf7d0" : "#bfdbfe",
                borderBottomColor: done ? "#bbf7d0" : "#bfdbfe",
                borderLeftColor: done ? "#bbf7d0" : "#bfdbfe",
              }}>{done ? "查看识别" : "上传材料"}</button>
            </div>
          );
        })}
      </div>

      {divider}

      {/* Download */}
      <p style={{ fontSize: 11, fontWeight: 700, color: "#1a2744", marginBottom: 3 }}>需下载材料</p>
      <p style={{ fontSize: 10, color: "#8a9bbf", lineHeight: 1.5, marginBottom: 8 }}>包含可直接下载的清单与模板，以及待信息补齐后生成的草稿文件。</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {DOWNLOAD_MATS.map((m, i) => {
          const ready = m.status === "可下载";
          const gen = m.status === "已生成";
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "7px 9px", borderRadius: 7,
              background: "#f8faff",
              borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
              borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
              borderTopColor: "#e8f0fe", borderRightColor: "#e8f0fe", borderBottomColor: "#e8f0fe", borderLeftColor: "#e8f0fe",
            }}>
              <div style={{ width: 24, height: 24, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: ready ? "linear-gradient(135deg,#2b579a,#1e3f7a)" : "#f0f0f8" }}>
                {ready
                  ? <span style={{ color: "#fff", fontSize: 9, fontWeight: 700 }}>W</span>
                  : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 9l2-5 2 3 2-2 2 4" stroke="#7c3aed" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              <p style={{ flex: 1, fontSize: 11, color: "#1a2744", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</p>
              <StatusBadge status={m.status} />
              <button style={{
                padding: "3px 7px", borderRadius: 4, fontSize: 10, cursor: ready || gen ? "pointer" : "default", flexShrink: 0,
                background: ready || gen ? "#e8f0fe" : "#f0f4fb",
                color: ready || gen ? "#1a5bc6" : "#8a9bbf",
                borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                borderTopColor: ready || gen ? "#bfdbfe" : "#dde9f7",
                borderRightColor: ready || gen ? "#bfdbfe" : "#dde9f7",
                borderBottomColor: ready || gen ? "#bfdbfe" : "#dde9f7",
                borderLeftColor: ready || gen ? "#bfdbfe" : "#dde9f7",
              }}>{ready ? "下载" : gen ? "查看" : "生成"}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────── 生成 tab ─────────── */
function GenerationTab() {
  const TASKS = [
    { name: "境外投资备案申请表", status: "待生成", actions: ["生成"] },
    { name: "真实性承诺书", status: "待生成", actions: ["生成"] },
    { name: "股权架构图", status: "需补充信息", actions: ["生成"] },
    { name: "可行性研究报告草稿", status: "需补充信息", actions: ["生成"] },
    { name: "字段填报建议", status: "已生成", actions: ["查看", "下载"] },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{
        padding: "8px 10px", borderRadius: 7, background: "#f0f6ff",
        borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
        borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
        borderTopColor: "#dbeafe", borderRightColor: "#dbeafe", borderBottomColor: "#dbeafe", borderLeftColor: "#dbeafe",
      }}>
        <p style={{ fontSize: 11, color: "#3a4f72", lineHeight: 1.6 }}>
          生成内容将基于已认证信息、上传材料识别结果和对话补充字段生成，需由企业核验后使用。
        </p>
      </div>
      {TASKS.map((t, i) => {
        const done = t.status === "已生成";
        return (
          <div key={i} style={{
            padding: "9px 10px", borderRadius: 7, background: "#f8faff",
            borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
            borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
            borderTopColor: "#e8f0fe", borderRightColor: "#e8f0fe", borderBottomColor: "#e8f0fe", borderLeftColor: "#e8f0fe",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
              <p style={{ fontSize: 11, color: "#1a2744", flex: 1 }}>{t.name}</p>
              <StatusBadge status={t.status} />
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {t.actions.map((a, ai) => (
                <button key={ai} style={{
                  padding: "3px 8px", borderRadius: 4, fontSize: 10, cursor: "pointer",
                  background: done ? "#e8f0fe" : "#f0f4fb",
                  color: done ? "#1a5bc6" : "#6b8ab0",
                  borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                  borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                  borderTopColor: done ? "#bfdbfe" : "#dde9f7",
                  borderRightColor: done ? "#bfdbfe" : "#dde9f7",
                  borderBottomColor: done ? "#bfdbfe" : "#dde9f7",
                  borderLeftColor: done ? "#bfdbfe" : "#dde9f7",
                }}>{a}</button>
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 6, paddingTop: 2 }}>
        <button style={{
          flex: 1, padding: "7px 0", borderRadius: 6,
          background: "linear-gradient(90deg,#1a5bc6,#2d78e8)",
          borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
          borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
          borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderLeftColor: "transparent",
          color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer",
        }}>生成表单草稿</button>
        <button style={{
          padding: "7px 10px", borderRadius: 6,
          borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
          borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
          borderTopColor: "#bfdbfe", borderRightColor: "#bfdbfe", borderBottomColor: "#bfdbfe", borderLeftColor: "#bfdbfe",
          background: "#e8f0fe", color: "#1a5bc6", fontSize: 11, cursor: "pointer",
        }}>查看生成情况</button>
      </div>
    </div>
  );
}

/* ─────────── 审核 tab ─────────── */
function ReviewTab() {
  const GROUPS = [
    { title: "缺失字段", color: "#ea580c", items: ["境外企业注册资本（币种及金额）", "投资目的地（尚未填写）", "投资项目预期收益说明"] },
    { title: "缺失材料", color: "#b45309", items: ["可行性研究报告或项目说明材料", "投资决策文件（董事会/股东会决议）"] },
    { title: "信息不一致提醒", color: "#7c3aed", items: ["法定代表人签字与系统登记信息建议核对"] },
    { title: "签字盖章提醒", color: "#1a5bc6", items: ["境外投资备案表需加盖企业公章", "真实性承诺书需法定代表人亲签"] },
    { title: "需人工确认事项", color: "#0f766e", items: ["境外企业经营范围是否与境内母公司一致"] },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 7, padding: "7px 11px", borderRadius: 8, background: "#fffbeb",
        borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
        borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
        borderTopColor: "#fcd34d", borderRightColor: "#fcd34d", borderBottomColor: "#fcd34d", borderLeftColor: "#fcd34d",
      }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#b45309", display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#b45309" }}>建议补充后提交</span>
        <span style={{ fontSize: 10, color: "#92400e", marginLeft: 4 }}>仅供提交前自查参考</span>
      </div>
      {GROUPS.map((g, i) => (
        <div key={i}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
            <span style={{ width: 3, height: 10, borderRadius: 2, background: g.color, display: "inline-block", flexShrink: 0 }} />
            <p style={{ fontSize: 11, fontWeight: 600, color: "#1a2744" }}>{g.title}</p>
          </div>
          {g.items.map((item, ii) => (
            <div key={ii} style={{ display: "flex", gap: 5, fontSize: 11, color: "#3a4f72", lineHeight: 1.75, alignItems: "flex-start" }}>
              <span style={{ color: g.color, flexShrink: 0, marginTop: 1 }}>·</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      ))}
      <p style={{
        fontSize: 10, color: "#8a9bbf", lineHeight: 1.65, paddingTop: 8,
        borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "#eef3fb",
        borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
        borderBottomWidth: 0, borderBottomStyle: "solid", borderBottomColor: "transparent",
        borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
      }}>
        以上结果仅为材料准备阶段的智能辅助检查，不代表主管部门审批意见，实际办理以官方系统和主管部门要求为准。
      </p>
    </div>
  );
}

/* ─────────── 进度 tab ─────────── */
function ProgressTab({ frame }: { frame: AppFrame }) {
  const activeStep =
    frame === "odi-preinfo"   ? 3 :
    frame === "odi-materials" ? 4 :
    frame === "odi-project"   ? 5 :
    /* prereview */              7;

  const STEPS = [
    { label: "ODI意图识别", note: "" },
    { label: "企业认证", note: "企业认证已完成，认证信息已带出，无需重复上传。" },
    { label: "前置信息", note: "补充投资方式、主体类型、目的地和金额。" },
    { label: "材料清单", note: "" },
    { label: "上传识别", note: "请上传已有项目支撑材料，系统将自动识别关键字段。" },
    { label: "文书生成", note: "上传材料识别完成后开始生成。" },
    { label: "自查确认", note: "文书生成完成后进行提交前自查。" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {STEPS.map((step, i) => {
        const num = i + 1;
        const done = num < activeStep;
        const active = num === activeStep;
        return (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", position: "relative" }}>
            {i < STEPS.length - 1 && (
              <div style={{ position: "absolute", left: 9, top: 22, width: 2, height: "calc(100% - 6px)", background: done ? "#1a5bc6" : "#e0e8f5" }} />
            )}
            <div style={{
              width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 2,
              background: done ? "#1a5bc6" : active ? "#fff" : "#f0f4fb",
              display: "flex", alignItems: "center", justifyContent: "center",
              borderTopWidth: 2, borderRightWidth: 2, borderBottomWidth: 2, borderLeftWidth: 2,
              borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
              borderTopColor: done || active ? "#1a5bc6" : "#c8daf0",
              borderRightColor: done || active ? "#1a5bc6" : "#c8daf0",
              borderBottomColor: done || active ? "#1a5bc6" : "#c8daf0",
              borderLeftColor: done || active ? "#1a5bc6" : "#c8daf0",
            }}>
              {done
                ? <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
                : active ? <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1a5bc6" }} /> : null}
            </div>
            <div style={{ paddingBottom: 14, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                <p style={{ fontSize: 12, color: done || active ? "#1a2744" : "#8a9bbf", fontWeight: active ? 600 : 400 }}>{step.label}</p>
                <StatusBadge status={done ? "已完成" : active ? "进行中" : "待完成"} />
              </div>
              {step.note && (
                <p style={{
                  fontSize: 11, lineHeight: 1.55,
                  color: active ? "#1a5bc6" : done ? "#8a9bbf" : "#c8daf0",
                  background: active ? "#f0f6ff" : "transparent",
                  borderRadius: active ? 5 : 0, padding: active ? "4px 7px" : 0,
                }}>{step.note}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   FLOATING ODI WORKBENCH PANEL
═══════════════════════════════════════════════════════ */

function OdiWorkbenchPanel({ frame }: { frame: AppFrame }) {
  const [collapsed, setCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkbenchTab>(FRAME_TO_TAB[frame] ?? "preinfo");
  const [tabKey, setTabKey] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const t = FRAME_TO_TAB[frame];
    if (t) { setActiveTab(t); setTabKey(k => k + 1); }
  }, [frame]);

  const pendingCount = 2;
  const statusLine =
    frame === "odi-preinfo"   ? "基础信息待确认 · 材料清单待生成" :
    frame === "odi-materials" ? "基础信息已补充 · 材料清单已生成" :
    frame === "odi-project"   ? "上传识别中" :
                                "自查结果已生成";

  /* ── collapsed: floating FAB ── */
  if (collapsed) {
    return (
      <div
        title="查看 ODI 助办任务"
        onClick={() => setCollapsed(false)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "absolute", top: 14, right: 14, zIndex: 30,
          width: 52, height: 52, borderRadius: "50%",
          background: hovered
            ? "linear-gradient(135deg,#2563eb,#1a3ea0)"
            : "linear-gradient(135deg,#1a4ca8,#1e6ee8)",
          boxShadow: hovered
            ? "0 6px 22px rgba(26,64,140,0.42)"
            : "0 3px 14px rgba(26,64,140,0.3)",
          cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
          transition: "background 0.18s ease-out, box-shadow 0.18s ease-out",
          animation: "odiFabIn 0.22s ease-out",
        }}
      >
        <style>{ANIM_CSS}</style>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="1.5" width="13" height="13" rx="3" stroke="white" strokeWidth="1.3" fill="none" />
          <path d="M4 5.5h8M4 8h5M4 10.5h6" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", lineHeight: 1 }}>ODI</span>
        {pendingCount > 0 && (
          <div style={{
            position: "absolute", top: -3, right: -3,
            width: 18, height: 18, borderRadius: "50%",
            background: "#ef4444", color: "#fff",
            fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            borderTopWidth: 2, borderRightWidth: 2, borderBottomWidth: 2, borderLeftWidth: 2,
            borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
            borderTopColor: "#fff", borderRightColor: "#fff", borderBottomColor: "#fff", borderLeftColor: "#fff",
            animation: "odiBadgePop 0.3s ease-out",
          }}>{pendingCount}</div>
        )}
      </div>
    );
  }

  /* ── expanded panel ── */
  return (
    <div style={{
      position: "absolute", top: 14, right: 14, zIndex: 30,
      width: 392,
      background: "#fff", borderRadius: 12,
      boxShadow: "0 6px 32px rgba(26,64,140,0.18)",
      borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
      borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
      borderTopColor: "#dde9f7", borderRightColor: "#dde9f7", borderBottomColor: "#dde9f7", borderLeftColor: "#dde9f7",
      overflow: "hidden",
      display: "flex", flexDirection: "column",
      maxHeight: "min(560px, 62vh)",
      animation: "odiPanelIn 0.22s ease-out",
    }}>
      <style>{ANIM_CSS}</style>

      {/* ── header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", flexShrink: 0,
        background: "linear-gradient(90deg,#1a4ca8,#1e6ee8)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", flex: 1, minWidth: 0 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="12" height="12" rx="2.5" stroke="white" strokeWidth="1.3" fill="none" />
            <path d="M3.5 7h7M3.5 4.5h4.5M3.5 9.5h5.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>ODI助办</span>
          <span style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 10,
            background: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.92)",
            whiteSpace: "nowrap",
          }}>材料准备中</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          style={{
            display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 6,
            background: "rgba(255,255,255,0.15)", cursor: "pointer",
            borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
            borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
            borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderLeftColor: "transparent",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.85)" }}>收起</span>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M2.5 4.5l3-3 3 3" stroke="rgba(255,255,255,0.8)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* ── status summary ── */}
      <div style={{
        padding: "5px 14px", background: "#f0f5ff", flexShrink: 0,
        borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#e4edfc",
        borderTopWidth: 0, borderTopStyle: "solid", borderTopColor: "transparent",
        borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
        borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
      }}>
        <p style={{ fontSize: 11, color: "#4a6490", textAlign: "center" }}>{statusLine}</p>
      </div>

      {/* ── tab bar ── */}
      <div style={{
        display: "flex", flexShrink: 0,
        borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#eef3fb",
        borderTopWidth: 0, borderTopStyle: "solid", borderTopColor: "transparent",
        borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
        borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
      }}>
        {WORKBENCH_TABS.map(tab => {
          const showBadge = tab.key === "review" && pendingCount > 0;
          return (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setTabKey(k => k + 1); }} style={{
              flex: 1, padding: "8px 4px", whiteSpace: "nowrap", cursor: "pointer",
              background: "none", marginBottom: -1, fontSize: 11, textAlign: "center",
              transition: "color 0.18s ease-out",
              borderTopWidth: 0, borderTopStyle: "solid", borderTopColor: "transparent",
              borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
              borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
              borderBottomWidth: 2, borderBottomStyle: "solid",
              borderBottomColor: activeTab === tab.key ? "#1a5bc6" : "transparent",
              color: activeTab === tab.key ? "#1a5bc6" : "#8a9bbf",
              fontWeight: activeTab === tab.key ? 700 : 400,
              position: "relative",
            }}>
              {tab.label}
              {showBadge && (
                <div style={{
                  position: "absolute", top: 3, right: "calc(50% - 28px)",
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#ef4444", color: "#fff",
                  fontSize: 9, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderTopWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderLeftWidth: 1.5,
                  borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                  borderTopColor: "#fff", borderRightColor: "#fff", borderBottomColor: "#fff", borderLeftColor: "#fff",
                  animation: "odiBadgePop 0.3s ease-out",
                }}>{pendingCount}</div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── scrollable content ── */}
      <div
        key={tabKey}
        style={{
          flex: 1, overflowY: "auto", padding: "13px 14px",
          scrollbarWidth: "none",
          animation: "odiTabFade 0.18s ease-out",
        }}
      >
        {activeTab === "preinfo"    && <PreInfoTab />}
        {activeTab === "materials"  && <MaterialsListTab />}
        {activeTab === "generation" && <GenerationTab />}
        {activeTab === "review"     && <ReviewTab />}
        {activeTab === "progress"   && <ProgressTab frame={frame} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   INLINE CHAT PRE-INFO FORM
═══════════════════════════════════════════════════════ */

function InlineChatPreInfoForm({
  investMethod, setInvestMethod, entityType, setEntityType,
  destination, setDestination, amount, setAmount,
  onConfirm, confirmed,
}: {
  investMethod: string; setInvestMethod: (v: string) => void;
  entityType: string; setEntityType: (v: string) => void;
  destination: string; setDestination: (v: string) => void;
  amount: string; setAmount: (v: string) => void;
  onConfirm: () => void; confirmed: boolean;
}) {
  return (
    <div style={{
      marginTop: 12, borderRadius: 10, overflow: "hidden", background: "#f8faff",
      borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
      borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
      borderTopColor: "#dde9f7", borderRightColor: "#dde9f7", borderBottomColor: "#dde9f7", borderLeftColor: "#dde9f7",
    }}>
      <div style={{
        padding: "9px 14px", background: "#eef4fe",
        borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#dde9f7",
        borderTopWidth: 0, borderTopStyle: "solid", borderTopColor: "transparent",
        borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
        borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <rect x="1.5" y="1.5" width="10" height="10" rx="2" stroke="#1a5bc6" strokeWidth="1.3" fill="none" />
            <path d="M4 6.5h5M6.5 4v5" stroke="#1a5bc6" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#1a5bc6" }}>前置信息确认</span>
        </div>
        {confirmed && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#16a34a" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" fill="#22c55e" /><path d="M3.5 6l2 2L8.5 4" stroke="white" strokeWidth="1.3" strokeLinecap="round" /></svg>
            已确认
          </span>
        )}
      </div>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <p style={{ fontSize: 11, color: "#6b8ab0", marginBottom: 5 }}><span style={{ color: "#ef4444" }}>*</span> 投资方式</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {INVESTMENT_METHODS.map(m => <Chip key={m} label={m} selected={investMethod === m} confirmed={confirmed && investMethod === m} onClick={() => !confirmed && setInvestMethod(m)} />)}
          </div>
        </div>
        <div>
          <p style={{ fontSize: 11, color: "#6b8ab0", marginBottom: 5 }}><span style={{ color: "#ef4444" }}>*</span> 境外主体类型</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {ENTITY_TYPES.map(t => <Chip key={t} label={t} selected={entityType === t} confirmed={confirmed && entityType === t} onClick={() => !confirmed && setEntityType(t)} />)}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <p style={{ fontSize: 11, color: "#6b8ab0", marginBottom: 4 }}><span style={{ color: "#ef4444" }}>*</span> 投资目的地</p>
            <input value={confirmed ? (destination || "新加坡") : destination} onChange={e => !confirmed && setDestination(e.target.value)} readOnly={confirmed} placeholder="国家或地区" style={formInputStyle(confirmed)} />
          </div>
          <div>
            <p style={{ fontSize: 11, color: "#6b8ab0", marginBottom: 4 }}><span style={{ color: "#ef4444" }}>*</span> 投资金额及币种</p>
            <input value={confirmed ? (amount || "100万美元") : amount} onChange={e => !confirmed && setAmount(e.target.value)} readOnly={confirmed} placeholder="如：100万美元" style={formInputStyle(confirmed)} />
          </div>
        </div>
        <div>
          <p style={{ fontSize: 11, color: "#6b8ab0", marginBottom: 4 }}>投资主体（认证带出）</p>
          <input defaultValue="上海某科技有限公司" readOnly style={formInputStyle(true)} />
        </div>
        {!confirmed && (
          <button onClick={onConfirm} style={{
            padding: "8px 0", borderRadius: 7, marginTop: 2,
            background: "linear-gradient(90deg,#1a5bc6,#2d78e8)",
            borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
            borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
            borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderLeftColor: "transparent",
            color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
            boxShadow: "0 2px 8px rgba(26,91,198,0.25)",
          }}>确认并生成材料清单</button>
        )}
        <p style={{ fontSize: 10, color: "#8a9bbf", textAlign: "center" }}>平台仅提供申报前辅助准备，不替代官方审核。</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   STATIC DATA
═══════════════════════════════════════════════════════ */

const USER_AVATAR = (
  <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "#1a5bc6", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
      <circle cx="8" cy="5.5" r="2.8" /><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    </svg>
  </div>
);

const ODI_SECTIONS = [
  { title: "一、主体资格材料", items: ["企业营业执照（复印件，需加盖公章）", "法定代表人身份证明（如营业执照无法体现）"] },
  { title: "二、投资相关材料", items: ["境外投资备案表（在线填写后打印，加盖公章）", "境外投资真实性承诺书（法定代表人签字并加盖公章）", "投资主体最近一年经审计的财务报表或财务审计报告"] },
  { title: "三、投资项目材料", items: ["境外投资项目的可行性研究报告或说明材料", "投资协议或意向书（如已签署）", "投资资金来源说明材料（如验资报告、银行资信证明等）"] },
  { title: "四、其他材料（视项目情况提供）", items: ["涉及敏感国家和地区、敏感行业的，需提供有关部门的核准文件", "如涉及并购或股权收购，需提供被投资企业的基本情况及尽职调查报告", "其他备案机关要求的补充材料"] },
];

/* ═══════════════════════════════════════════════════════
   MAIN EXPORTED COMPONENT
═══════════════════════════════════════════════════════ */

export function OdiWorkbenchFrame({
  frame,
  onFormConfirm,
  onContinueUpload,
  investMethod,
  setInvestMethod,
  entityType,
  setEntityType,
  destination,
  setDestination,
  amount,
  setAmount,
  preInfoConfirmed,
  attachedFiles,
  setAttachedFiles,
  materialGenerationStarted,
  setMaterialGenerationStarted
}: Props) {
  const [inputVal, setInputVal] = useState("");
  const [uploadReplySent, setUploadReplySent] = useState(false);
  const [generationReplySent, setGenerationReplySent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const newFiles: AttachedFile[] = files.map((f, i) => ({
      name: f.name, status: "上传中", id: Date.now() + i,
    }));
    setAttachedFiles(prev => [...prev, ...newFiles]);
    // Simulate upload → recognise progression
    newFiles.forEach((af) => {
      setTimeout(() => setAttachedFiles(prev => prev.map(x => x.id === af.id ? { ...x, status: "已上传" } : x)), 900);
      setTimeout(() => setAttachedFiles(prev => prev.map(x => x.id === af.id ? { ...x, status: "识别中" } : x)), 1800);
      setTimeout(() => {
        setAttachedFiles(prev => prev.map(x => x.id === af.id ? { ...x, status: "已识别" } : x));
        setUploadReplySent(true);
      }, 3200);
    });
    e.target.value = "";
  };

  const removeFile = (id: number) => setAttachedFiles(prev => prev.filter(f => f.id !== id));

  const handleSendMessage = () => {
    const hasRecognizedFiles = attachedFiles.some(f => f.status === "已识别");

    if (hasRecognizedFiles && !materialGenerationStarted) {
      // 开始生成材料
      setMaterialGenerationStarted(true);
      setGenerationReplySent(true);
      setInputVal("");
    } else if (inputVal.trim()) {
      // 发送普通消息
      setInputVal("");
    }
  };

  const isConfirmed = preInfoConfirmed;
  const isLate      = frame === "odi-project"   || frame === "odi-prereview";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, overflow: "hidden", position: "relative" }}>
      <style>{ANIM_CSS}</style>

      {/* ── chat scroll area ── */}
      <div style={{ flex: 1, overflow: "auto", padding: "14px 12px 8px 4px", display: "flex", flexDirection: "column", gap: 14, scrollbarWidth: "none" }}>

        {/* User question */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "flex-start" }}>
          <div style={{ background: "linear-gradient(135deg,#2563eb,#1a4ca8)", borderRadius: 8, padding: "10px 16px", color: "#fff", fontSize: 14, fontWeight: 500, maxWidth: "72%" }}>
            ODI备案需要提交哪些材料？
          </div>
          {USER_AVATAR}
        </div>

        {/* AI answer */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <RobotAvatar size={40} />
          <div style={{
            flex: 1, background: "#fff", borderRadius: 12, padding: "18px 22px",
            boxShadow: "0 2px 12px rgba(26,64,140,0.07)",
            borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
            borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
            borderTopColor: "#e8f0fe", borderRightColor: "#e8f0fe", borderBottomColor: "#e8f0fe", borderLeftColor: "#e8f0fe",
          }}>
            <p style={{ fontSize: 13, color: "#1a2744", lineHeight: 1.8, marginBottom: 12 }}>
              您好！根据《企业境外投资管理办法》及国家发展改革委相关规定，企业开展非敏感类境外投资项目，一般需向备案机关提交以下材料：
            </p>
            {ODI_SECTIONS.map((sec, si) => (
              <div key={si} style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1a2744", marginBottom: 4 }}>{sec.title}</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {sec.items.map((item, ii) => (
                    <li key={ii} style={{ fontSize: 13, color: "#3a4f72", lineHeight: 1.8, display: "flex", gap: 6 }}>
                      <span style={{ color: "#1a5bc6", flexShrink: 0 }}>·</span><span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p style={{ fontSize: 13, color: "#3a4f72", lineHeight: 1.8, margin: "10px 0 14px" }}>
              请注意，具体材料要求可能因项目类型、投资国家/地区及行业领域不同而有所调整，建议在提交前通过本平台"办事指南"或咨询备案机关确认最新清单。
            </p>

            {/* ODI助办 引导区 */}
            <div style={{
              padding: "10px 14px", borderRadius: 8, background: "#f0f6ff",
              borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
              borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
              borderTopColor: "#dbeafe", borderRightColor: "#dbeafe", borderBottomColor: "#dbeafe", borderLeftColor: "#dbeafe",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
            }}>
              <span style={{ fontSize: 13, color: "#3a4f72", flex: 1 }}>
                如需进一步梳理材料清单、补充填报信息或进入办理辅助，可使用 ODI 助办。
              </span>
              {/* After auth this shows as "已认证进入" badge instead of a clickable button */}
              <span style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 14px", borderRadius: 20, flexShrink: 0,
                borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                borderTopColor: "#22c55e", borderRightColor: "#22c55e", borderBottomColor: "#22c55e", borderLeftColor: "#22c55e",
                background: "#f0fdf4", color: "#16a34a", fontSize: 13, fontWeight: 500,
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" fill="#22c55e" /><path d="M3.5 6l2 2L8.5 4" stroke="white" strokeWidth="1.3" strokeLinecap="round" /></svg>
                已认证进入
              </span>
            </div>

            <div style={{
              display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12, paddingTop: 12,
              borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "#eef3fb",
              borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
              borderBottomWidth: 0, borderBottomStyle: "solid", borderBottomColor: "transparent",
              borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
            }}>
              {["ODI备案的流程是怎样的？", "涉及敏感行业或地区怎么办？", "ODI助办可以帮我做什么？"].map((q, i) => (
                <button key={i} style={{
                  padding: "4px 11px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                  borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                  borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                  borderTopColor: "#bfdbfe", borderRightColor: "#bfdbfe", borderBottomColor: "#bfdbfe", borderLeftColor: "#bfdbfe",
                  background: "#eef4fe", color: "#1a5bc6",
                }}>{q}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Auth-success message + pre-info form ── */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: "odiMsgIn 0.22s ease-out" }}>
          <RobotAvatar size={40} />
          <div style={{
            flex: 1, background: "#fff", borderRadius: 12, padding: "18px 22px",
            boxShadow: "0 2px 12px rgba(26,64,140,0.07)",
            borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
            borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
            borderTopColor: "#e8f0fe", borderRightColor: "#e8f0fe", borderBottomColor: "#e8f0fe", borderLeftColor: "#e8f0fe",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 10, paddingBottom: 10,
              borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#eef3fb",
              borderTopWidth: 0, borderTopStyle: "solid", borderTopColor: "transparent",
              borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
              borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="#22c55e" /><path d="M4.5 8l3 3L12 5" stroke="white" strokeWidth="1.6" strokeLinecap="round" /></svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#16a34a" }}>认证已通过</span>
              <span style={{ marginLeft: "auto" }}><AgentStatusTicker /></span>
            </div>
            <p style={{ fontSize: 13, color: "#1a2744", lineHeight: 1.85 }}>
              认证已通过，已为您创建 ODI 备案材料准备任务。企业认证信息已完成带出，无需重复上传。接下来请确认四项前置信息：
              <strong> 投资方式、境外主体类型、投资目的地、投资金额及币种</strong>。确认后我将为您生成材料清单，并同步更新右上侧 ODI 助办。
            </p>
            <InlineChatPreInfoForm
              investMethod={investMethod} setInvestMethod={setInvestMethod}
              entityType={entityType} setEntityType={setEntityType}
              destination={destination} setDestination={setDestination}
              amount={amount} setAmount={setAmount}
              onConfirm={onFormConfirm}
              confirmed={isConfirmed}
            />
          </div>
        </div>

        {/* ── Post-confirm messages ── */}
        {isConfirmed && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "flex-start" }}>
              <div style={{ background: "linear-gradient(135deg,#2563eb,#1a4ca8)", borderRadius: 8, padding: "10px 16px", color: "#fff", fontSize: 13, maxWidth: "60%" }}>
                已确认以上基础信息
              </div>
              {USER_AVATAR}
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: "odiMsgIn 0.22s ease-out" }}>
              <RobotAvatar size={40} />
              <div style={{
                flex: 1, background: "#fff", borderRadius: 12, padding: "16px 20px",
                boxShadow: "0 2px 12px rgba(26,64,140,0.07)",
                borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                borderTopColor: "#e8f0fe", borderRightColor: "#e8f0fe", borderBottomColor: "#e8f0fe", borderLeftColor: "#e8f0fe",
              }}>
                <p style={{ fontSize: 13, color: "#1a2744", lineHeight: 1.9, marginBottom: 10 }}>
                  已根据您补充的基础信息，为您生成本次 ODI 备案材料清单，右上侧工作台「材料」页签已同步更新。
                </p>
                <p style={{ fontSize: 13, color: "#3a4f72", lineHeight: 1.85, marginBottom: 12 }}>
                  您可以先上传已有项目支撑材料；相关清单、模板和后续生成的草稿文件可在工作台中下载。
                </p>
                <div style={{
                  padding: "9px 13px", borderRadius: 8, background: "#f0f6ff", marginBottom: 14,
                  borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                  borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                  borderTopColor: "#dbeafe", borderRightColor: "#dbeafe", borderBottomColor: "#dbeafe", borderLeftColor: "#dbeafe",
                }}>
                  <p style={{ fontSize: 12, color: "#1a5bc6", lineHeight: 1.7 }}>
                    <span style={{ fontWeight: 600 }}>材料清单已生成</span>
                    &nbsp;·&nbsp;投资方式：{investMethod || "新设"}
                    &nbsp;·&nbsp;主体类型：{entityType || "子公司"}
                    &nbsp;·&nbsp;目的地：{destination || "新加坡"}
                  </p>
                </div>
                {/* ── 上传引导提示卡（替代大按钮）── */}
                <div style={{
                  display: "flex", gap: 10, padding: "11px 13px", borderRadius: 9, marginBottom: 12,
                  background: "#f0f6ff",
                  borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                  borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                  borderTopColor: "#dbeafe", borderRightColor: "#dbeafe", borderBottomColor: "#dbeafe", borderLeftColor: "#dbeafe",
                }}>
                  {/* 附件图标 */}
                  <div style={{ flexShrink: 0, marginTop: 2 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M13.5 7.5L7.5 13.5C6.1 14.9 3.9 14.9 2.5 13.5C1.1 12.1 1.1 9.9 2.5 8.5L8.5 2.5C9.4 1.6 10.9 1.6 11.8 2.5C12.7 3.4 12.7 4.9 11.8 5.8L6.3 11.3C5.9 11.7 5.2 11.7 4.8 11.3C4.4 10.9 4.4 10.2 4.8 9.8L9.8 4.8"
                        stroke="#1a5bc6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p style={{ fontSize: 12, color: "#3a4f72", lineHeight: 1.75 }}>
                    材料清单已生成，右上侧工作台「材料」页签已同步更新。<br />
                    请通过<strong style={{ color: "#1a5bc6" }}>下方输入框左侧的附件按钮</strong>上传已有项目支撑材料，例如可行性研究报告、投资决策文件、投资协议或意向书等。上传后我会自动识别材料内容，并同步更新右上侧工作台。
                  </p>
                </div>
                <p style={{ fontSize: 11, color: "#8a9bbf", lineHeight: 1.6, marginBottom: 10 }}>
                  平台仅提供申报前辅助准备，不替代官方系统申请和主管部门审核。
                </p>
                <div style={{
                  display: "flex", flexWrap: "wrap", gap: 7, paddingTop: 10,
                  borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "#eef3fb",
                  borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
                  borderBottomWidth: 0, borderBottomStyle: "solid", borderBottomColor: "transparent",
                  borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
                }}>
                  {["材料准备注意事项？", "如何正确填写备案表？", "审批大概多久完成？"].map((q, i) => (
                    <button key={i} style={{
                      padding: "4px 11px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                      borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                      borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                      borderTopColor: "#bfdbfe", borderRightColor: "#bfdbfe", borderBottomColor: "#bfdbfe", borderLeftColor: "#bfdbfe",
                      background: "#eef4fe", color: "#1a5bc6",
                    }}>{q}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Frame 07 / 08 extra messages */}
            {isLate && (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ background: "linear-gradient(135deg,#2563eb,#1a4ca8)", borderRadius: 8, padding: "10px 16px", color: "#fff", fontSize: 13, maxWidth: "60%" }}>
                    本次是在新加坡新设子公司，投资金额为 100 万美元。
                  </div>
                  {USER_AVATAR}
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: "odiMsgIn 0.22s ease-out" }}>
                  <RobotAvatar size={40} />
                  <div style={{
                    flex: 1, background: "#fff", borderRadius: 12, padding: "16px 20px",
                    boxShadow: "0 2px 12px rgba(26,64,140,0.07)",
                    borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                    borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                    borderTopColor: "#e8f0fe", borderRightColor: "#e8f0fe", borderBottomColor: "#e8f0fe", borderLeftColor: "#e8f0fe",
                  }}>
                    <p style={{ fontSize: 13, color: "#1a2744", lineHeight: 1.8, marginBottom: 10 }}>
                      已记录，本次投资方式为<strong>新设</strong>，投资目的地为<strong>新加坡</strong>，投资金额为<strong>100万美元</strong>。右上侧工作台「前置」页签已同步更新。
                    </p>
                    {frame === "odi-prereview" && (
                      <div style={{
                        padding: "10px 14px", borderRadius: 8, background: "#fffbeb", marginBottom: 10,
                        borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                        borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                        borderTopColor: "#fcd34d", borderRightColor: "#fcd34d", borderBottomColor: "#fcd34d", borderLeftColor: "#fcd34d",
                      }}>
                        <p style={{ fontSize: 13, color: "#b45309", lineHeight: 1.7 }}>
                          ⚠ 预审自查已完成，右上侧「审核」页签显示当前存在 5 项需处理事项，建议补充后再行提交，实际以主管部门要求为准。
                        </p>
                      </div>
                    )}
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: 7, paddingTop: 10,
                      borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "#eef3fb",
                      borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
                      borderBottomWidth: 0, borderBottomStyle: "solid", borderBottomColor: "transparent",
                      borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
                    }}>
                      {["查看审核结果", "如何上传可行性研究报告？", "预计多久可完成备案？"].map((q, i) => (
                        <button key={i} style={{
                          padding: "4px 11px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                          borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                          borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                          borderTopColor: "#bfdbfe", borderRightColor: "#bfdbfe", borderBottomColor: "#bfdbfe", borderLeftColor: "#bfdbfe",
                          background: "#eef4fe", color: "#1a5bc6",
                        }}>{q}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
        {/* ── Upload AI reply ── */}
        {uploadReplySent && (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: "odiMsgIn 0.22s ease-out" }}>
            <RobotAvatar size={40} />
            <div style={{
              flex: 1, background: "#fff", borderRadius: 12, padding: "16px 20px",
              boxShadow: "0 2px 12px rgba(26,64,140,0.07)",
              borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
              borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
              borderTopColor: "#e8f0fe", borderRightColor: "#e8f0fe", borderBottomColor: "#e8f0fe", borderLeftColor: "#e8f0fe",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#22c55e" /><path d="M4 7l2.5 2.5L10.5 5" stroke="white" strokeWidth="1.4" strokeLinecap="round" /></svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#16a34a" }}>材料已收到</span>
              </div>
              <p style={{ fontSize: 13, color: "#1a2744", lineHeight: 1.8 }}>
                已收到您上传的项目支撑材料，我将进行内容识别，并同步更新右上侧工作台「材料」和「生成」页签。
              </p>
            </div>
          </div>
        )}

        {/* ── Generation started reply ── */}
        {generationReplySent && (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: "odiMsgIn 0.22s ease-out" }}>
            <RobotAvatar size={40} />
            <div style={{
              flex: 1, background: "#fff", borderRadius: 12, padding: "16px 20px",
              boxShadow: "0 2px 12px rgba(26,64,140,0.07)",
              borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
              borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
              borderTopColor: "#e8f0fe", borderRightColor: "#e8f0fe", borderBottomColor: "#e8f0fe", borderLeftColor: "#e8f0fe",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#1a5bc6" /><path d="M4 4h6M4 7h6M4 10h4" stroke="white" strokeWidth="1.2" strokeLinecap="round" /></svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1a5bc6" }}>开始生成材料</span>
              </div>
              <p style={{ fontSize: 13, color: "#1a2744", lineHeight: 1.8, marginBottom: 10 }}>
                已基于上传材料的识别结果和前置信息，开始生成备案申请材料草稿。生成进度已同步到右上侧工作台「生成」页签。
              </p>
              <div style={{
                padding: "9px 13px", borderRadius: 8, background: "#f0f6ff",
                borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                borderTopColor: "#dbeafe", borderRightColor: "#dbeafe", borderBottomColor: "#dbeafe", borderLeftColor: "#dbeafe",
              }}>
                <p style={{ fontSize: 12, color: "#1a5bc6", lineHeight: 1.7 }}>
                  <span style={{ fontWeight: 600 }}>生成中</span>
                  &nbsp;·&nbsp;境外投资备案申请表
                  &nbsp;·&nbsp;真实性承诺书
                  &nbsp;·&nbsp;字段填报建议
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── input bar ── */}
      <div style={{ padding: "8px 12px 8px 4px", flexShrink: 0 }}>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />

        {/* File attachment tags — shown above input when files exist */}
        {attachedFiles.length > 0 && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 10px 6px",
            background: "#fff", borderRadius: "10px 10px 0 0",
            borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 0, borderLeftWidth: 1,
            borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
            borderTopColor: "#dde9f7", borderRightColor: "#dde9f7", borderBottomColor: "transparent", borderLeftColor: "#dde9f7",
          }}>
            {attachedFiles.map(f => {
              const statusColor =
                f.status === "已识别" ? "#16a34a" :
                f.status === "识别中" || f.status === "上传中" ? "#1a5bc6" : "#6b8ab0";
              const statusBg =
                f.status === "已识别" ? "#f0fdf4" :
                f.status === "识别中" || f.status === "上传中" ? "#eff6ff" : "#f8fafc";
              return (
                <div key={f.id} style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 6,
                  background: statusBg,
                  borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                  borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                  borderTopColor: "#e2e8f0", borderRightColor: "#e2e8f0", borderBottomColor: "#e2e8f0", borderLeftColor: "#e2e8f0",
                  animation: "odiMsgIn 0.18s ease-out",
                }}>
                  {/* File icon */}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <rect x="1.5" y="0.5" width="7" height="11" rx="1" stroke="#6b8ab0" strokeWidth="1" fill="none" />
                    <path d="M3 3.5h4M3 5.5h4M3 7.5h2.5" stroke="#6b8ab0" strokeWidth="0.8" strokeLinecap="round" />
                    <path d="M8.5 0.5l2 2-2 0V0.5z" fill="#6b8ab0" stroke="#6b8ab0" strokeWidth="0.5" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: 11, color: "#1a2744", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  {/* Status */}
                  <span style={{ fontSize: 10, color: statusColor, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 3 }}>
                    {(f.status === "上传中" || f.status === "识别中") && <Spinner />}
                    {f.status}
                  </span>
                  {/* Remove */}
                  <button
                    onClick={() => removeFile(f.id)}
                    title="移除"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 14, height: 14, borderRadius: "50%", cursor: "pointer",
                      background: "#e2e8f0", color: "#6b8ab0", fontSize: 10, lineHeight: 1,
                      borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
                      borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                      borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderLeftColor: "transparent",
                    }}
                  >×</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Input row */}
        <div style={{
          background: "#fff",
          borderRadius: attachedFiles.length > 0 ? "0 0 10px 10px" : 10,
          borderTopWidth: attachedFiles.length > 0 ? 0 : 1,
          borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
          borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
          borderTopColor: "#dde9f7", borderRightColor: "#dde9f7", borderBottomColor: "#dde9f7", borderLeftColor: "#dde9f7",
          boxShadow: "0 2px 8px rgba(26,64,140,0.06)",
          display: "flex", alignItems: "center", padding: "8px 10px", gap: 8, minHeight: 60,
        }}>
          {/* Attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="上传项目支撑材料"
            style={{
              width: 32, height: 32, borderRadius: 7, flexShrink: 0,
              background: "#f0f4fb", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
              borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
              borderTopColor: "#dde9f7", borderRightColor: "#dde9f7", borderBottomColor: "#dde9f7", borderLeftColor: "#dde9f7",
              transition: "background 0.15s",
            }}
          >
            {/* Paperclip icon */}
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M12.5 7L7 12.5C5.9 13.6 4.1 13.6 3 12.5C1.9 11.4 1.9 9.6 3 8.5L8.5 3C9.2 2.3 10.4 2.3 11.1 3C11.8 3.7 11.8 4.9 11.1 5.6L6.1 10.6C5.7 11 5.2 11 4.8 10.6C4.4 10.2 4.4 9.7 4.8 9.3L9.3 4.8"
                stroke="#6b8ab0" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <textarea
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="请输入问题或补充信息，也可点击左侧附件按钮上传项目支撑材料…"
            rows={2}
            style={{
              flex: 1, outline: "none", resize: "none",
              fontSize: 13, color: "#1a2744", background: "transparent",
              lineHeight: 1.6, fontFamily: "inherit", minHeight: 36,
              borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
              borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
              borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderLeftColor: "transparent",
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputVal.trim() && attachedFiles.length === 0}
            style={{
              width: 32, height: 32, borderRadius: 7, flexShrink: 0,
              background: (inputVal.trim() || attachedFiles.length > 0) ? "linear-gradient(135deg,#1a5bc6,#2d78e8)" : "#c8daf0",
              borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
              borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
              borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderLeftColor: "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: (inputVal.trim() || attachedFiles.length > 0) ? "pointer" : "default",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1.5 7L13 1.5L8 13L6.5 8L1.5 7Z" fill="white" />
            </svg>
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#8a9bbf", marginTop: 5 }}>
          AI生成回答仅供参考，实际办理以线下政务服务为准
          <span style={{ marginLeft: 5, color: "#1a5bc6", fontWeight: 600 }}>测试版</span>
        </p>
      </div>
    </div>
  );
}
