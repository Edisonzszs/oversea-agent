import { useState, useEffect } from "react";
import type { AppFrame, AttachedFile } from "../App";

interface Props {
  frame: AppFrame;
  onClose: () => void;
  investMethod: string;
  entityType: string;
  destination: string;
  amount: string;
  preInfoConfirmed: boolean;
  attachedFiles: AttachedFile[];
  materialGenerationStarted: boolean;
}

type WorkbenchTab = "fillform" | "preinfo" | "materials" | "generation" | "progress";

const ANIM_CSS = `
@keyframes odiBadgePop{0%{transform:scale(0.4)}65%{transform:scale(1.25)}100%{transform:scale(1)}}
`;

const FRAME_TO_TAB: Partial<Record<AppFrame, WorkbenchTab>> = {
  "odi-preinfo": "preinfo",
  "odi-materials": "materials",
  "odi-project": "progress",
  "odi-prereview": "progress",
};

const WORKBENCH_TABS: { key: WorkbenchTab; label: string }[] = [
  { key: "fillform", label: "填报" },
  { key: "preinfo", label: "前置" },
  { key: "materials", label: "材料" },
  { key: "generation", label: "生成" },
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

// Tab内容组件
function FillFormTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* 顶部提示 */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        background: "#f8faff",
        borderRadius: 6,
        marginBottom: 12,
        border: "1px solid #e8f0fe",
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="2" y="2" width="10" height="10" rx="2" stroke="#1a5bc6" strokeWidth="1.2" fill="none" />
          <path d="M4 6h6M4 8h4" stroke="#1a5bc6" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 11, color: "#1a5bc6", fontWeight: 500 }}>商务部门 · 模板预览</span>
      </div>

      {/* 表单标题 */}
      <h3 style={{
        fontSize: 13,
        fontWeight: 700,
        color: "#1a2744",
        textAlign: "center",
        marginBottom: 14,
        padding: "8px 0",
      }}>境外并购事项前期报告表</h3>

      {/* 表单字段 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {/* 境内投资主体 */}
        <FormSection title="境内投资主体">
          <FormField label="名称" value="上海某科技有限公司" tag="执照" />
          <FormField label="注册资本" value="(待补充)" tag="用户" />
          <FormField label="行业" value="(待补充)" tag="用户" />
        </FormSection>

        {/* 实施具体并购行为的子公司 */}
        <FormSection title="实施具体并购行为的子公司">
          <FormField label="名称" value="(待补充)" tag="用户" />
          <FormField label="注册地点" value="(待补充)" tag="用户" />
          <FormField label="注册资本（万美元）" value="(待补充)" tag="用户" />
        </FormSection>

        {/* 境外并购目标企业 */}
        <FormSection title="境外并购目标企业">
          <FormField label="名称" value="" isParent />
          <FormField label="外文" value="(待补充)" tag="用户" indent={1} />
          <FormField label="中文" value="(待补充)" tag="用户" indent={1} />
          <FormField label="注册地点" value="(待补充)" tag="用户" />
          <FormField label="行业" value="(待补充)" tag="用户" />
        </FormSection>

        {/* 其他字段 */}
        <FormField label="并购背景" value="(待补充)" tag="用户" isTextarea />
        <FormField label="拟并购的股权、资产或业务情况" value="(待补充)" tag="用户" isTextarea />
        <FormField label="预计投资总额（万美元）" value="(待补充)" tag="用户" />
        <FormField label="交易方式（现金、股票及混合方式）" value="(待补充)" tag="用户" />
        <FormField label="资金筹措方案" value="(待补充)" tag="用户" isTextarea />
        <FormField label="初步时间安排" value="(待补充)" tag="用户" isTextarea />
        <FormField label="潜在风险及应对方案" value="(待补充)" tag="用户" isTextarea />
        <FormField label="需政府提供的服务" value="(待补充)" tag="用户" isTextarea />

        {/* 联系人信息 */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "2px solid #e8f0fe" }}>
          <FormField label="联系人" value="(待补充)" tag="用户" />
          <FormField label="电话" value="(待补充)" tag="用户" />
        </div>

        {/* 企业公章 */}
        <div style={{
          marginTop: 16,
          padding: "12px",
          background: "#f8faff",
          borderRadius: 6,
          border: "1px solid #e8f0fe",
          display: "flex",
          justifyContent: "flex-end",
        }}>
          <div style={{ textAlign: "right", fontSize: 11, color: "#6b8ab0" }}>
            <div style={{ marginBottom: 4 }}>（企业公章）</div>
            <div>____年____月____日</div>
          </div>
        </div>
      </div>

      {/* 底部说明 */}
      <div style={{
        marginTop: 12,
        padding: "10px 12px",
        background: "#fffbeb",
        borderRadius: 6,
        border: "1px solid #fcd34d",
      }}>
        <p style={{ fontSize: 10, color: "#92400e", lineHeight: 1.6 }}>
          <strong>填报说明：</strong>标注"执照"的字段从营业执照识别，标注"用户"的字段需要手动补充。
        </p>
      </div>
    </div>
  );
}

// 辅助组件：表单分组
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 8,
      }}>
        <div style={{
          width: 3,
          height: 12,
          background: "#1a5bc6",
          borderRadius: 2,
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1a2744" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// 辅助组件：表单字段
function FormField({
  label,
  value,
  tag,
  indent = 0,
  isParent = false,
  isTextarea = false
}: {
  label: string;
  value: string;
  tag?: string;
  indent?: number;
  isParent?: boolean;
  isTextarea?: boolean;
}) {
  const tagColor = tag === "执照" ? "#16a34a" : "#ea580c";
  const tagBg = tag === "执照" ? "#f0fdf4" : "#fff7ed";
  const tagBorder = tag === "执照" ? "#bbf7d0" : "#fdba74";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: indent > 0 ? "20px 100px 1fr" : "120px 1fr",
      gap: 8,
      padding: "8px 0",
      borderBottom: "1px solid #f0f4fb",
    }}>
      {indent > 0 && <div />}
      <div style={{
        fontSize: 11,
        color: "#6b8ab0",
        lineHeight: 1.5,
        paddingLeft: indent > 0 ? "10px" : "0",
      }}>{label}</div>

      {!isParent && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 11,
            color: value.includes("待补充") ? "#ea580c" : "#1a2744",
            flex: isTextarea ? "1" : "none",
          }}>{value}</span>
          {tag && (
            <span style={{
              fontSize: 9,
              padding: "2px 6px",
              borderRadius: 3,
              background: tagBg,
              color: tagColor,
              fontWeight: 600,
              border: `1px solid ${tagBorder}`,
            }}>{tag}</span>
          )}
        </div>
      )}
    </div>
  );
}

function PreInfoTab({ investMethod, entityType, destination, amount }: {
  investMethod: string;
  entityType: string;
  destination: string;
  amount: string;
}) {
  const INVEST_FIELDS = [
    { label: "本次投资方式是什么？", value: investMethod, status: investMethod ? "已补充" as const : "待补充" as const },
    { label: "本次境外主体类型是什么？", value: entityType, status: entityType ? "已补充" as const : "待补充" as const },
    { label: "投资目的地是哪里？", value: destination, status: destination ? "已补充" as const : "待补充" as const },
    { label: "本次投资金额及币种是多少？", value: amount, status: amount ? "已补充" as const : "待补充" as const },
  ];
  const CERT_FIELDS = [
    { label: "企业名称", value: "上海某科技有限公司" },
    { label: "统一社会信用代码", value: "91310000XXXXXXXXXX" },
    { label: "法定代表人", value: "张三" },
  ];

  const filledCount = INVEST_FIELDS.filter(f => f.value).length;
  const totalCount = INVEST_FIELDS.length;
  const percentage = (filledCount / totalCount) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* 前置信息进度条 */}
      {filledCount > 0 && (
        <div style={{
          padding: "10px 12px",
          background: "#f8faff",
          borderRadius: 6,
          border: "1px solid #e8f0fe",
          marginBottom: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#1a5bc6" }}>填写进度</span>
            <span style={{ fontSize: 10, color: "#6b8ab0" }}>{filledCount}/{totalCount} 已完成</span>
          </div>
          <div style={{
            height: 6,
            background: "#e8f0fe",
            borderRadius: 3,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${percentage}%`,
              background: "linear-gradient(90deg, #1a5bc6 0%, #2d78e8 100%)",
              transition: "width 0.3s ease",
            }} />
          </div>
        </div>
      )}

      <p style={{ fontSize: 11, fontWeight: 700, color: "#1a2744", marginBottom: 8 }}>核心前置字段</p>
      {INVEST_FIELDS.map((f, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8,
          padding: "8px 0",
          borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#f0f4fb",
          borderTopWidth: 0, borderTopStyle: "solid", borderTopColor: "transparent",
          borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
          borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
        }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
            <p style={{ fontSize: 11, color: "#6b8ab0" }}>{f.label}</p>
            {f.value && <p style={{ fontSize: 12, color: "#1a5bc6", fontWeight: 500 }}>{f.value}</p>}
          </div>
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
    </div>
  );
}

function MaterialsListTab({ attachedFiles }: { attachedFiles: AttachedFile[] }) {
  // 根据上传文件动态计算材料状态
  const recognizedFiles = attachedFiles.filter(f => f.status === "已识别");

  const UPLOAD_MATS = [
    { name: "可行性研究报告或项目说明材料", status: recognizedFiles.length > 0 ? "已上传" : "待上传" },
    { name: "投资决策文件（董事会/股东会决议）", status: recognizedFiles.length > 1 ? "已上传" : "待上传" },
    { name: "投资协议、意向书或并购协议", status: recognizedFiles.length > 2 ? "已上传" : "待上传" },
    { name: "审计报告或最近一年财务报表", status: recognizedFiles.length > 3 ? "已上传" : "待上传" },
    { name: "资金来源说明或资金证明材料", status: recognizedFiles.length > 4 ? "已上传" : "待上传" },
    { name: "其他项目支撑材料", status: recognizedFiles.length > 5 ? "已上传" : "待上传" },
  ];

  const uploadedCount = UPLOAD_MATS.filter(m => m.status === "已上传").length;
  const totalCount = UPLOAD_MATS.length;
  const percentage = (uploadedCount / totalCount) * 100;

  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#1a2744", marginBottom: 3 }}>需上传材料</p>
      <p style={{ fontSize: 10, color: "#8a9bbf", lineHeight: 1.5, marginBottom: 8 }}>请上传已具备的项目支撑材料，系统将用于识别项目关键信息。</p>

      {/* 材料进度条 */}
      <div style={{
        padding: "10px 12px",
        background: "#f8faff",
        borderRadius: 6,
        border: "1px solid #e8f0fe",
        marginBottom: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#1a5bc6" }}>材料进度</span>
          <span style={{ fontSize: 10, color: "#6b8ab0" }}>{uploadedCount}/{totalCount} 已上传</span>
        </div>
        <div style={{
          height: 6,
          background: "#e8f0fe",
          borderRadius: 3,
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${percentage}%`,
            background: "linear-gradient(90deg, #1a5bc6 0%, #2d78e8 100%)",
            transition: "width 0.3s ease",
          }} />
        </div>
      </div>

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
              <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: done ? "#dcfce7" : "#e8f0fe" }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  {done
                    ? <path d="M2 5l2 2L8 3" stroke="#16a34a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    : <><path d="M5 7V3M3.5 4.5L5 3L6.5 4.5" stroke="#1a5bc6" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /><path d="M2 8h6" stroke="#1a5bc6" strokeWidth="1" strokeLinecap="round" /></>}
                </svg>
              </div>
              <p style={{ flex: 1, fontSize: 10, color: "#1a2744", lineHeight: 1.4, minWidth: 0 }}>{m.name}</p>
              <StatusBadge status={m.status} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GenerationTab({ materialGenerationStarted }: { materialGenerationStarted: boolean }) {
  const TASKS = [
    { name: "境外投资备案申请表", status: materialGenerationStarted ? "已生成" : "待生成", actions: materialGenerationStarted ? ["查看", "下载"] : ["生成"] },
    { name: "真实性承诺书", status: materialGenerationStarted ? "已生成" : "待生成", actions: materialGenerationStarted ? ["查看", "下载"] : ["生成"] },
    { name: "股权架构图", status: "需补充信息", actions: ["生成"] },
    { name: "可行性研究报告草稿", status: "需补充信息", actions: ["生成"] },
    { name: "字段填报建议", status: materialGenerationStarted ? "已生成" : "待生成", actions: materialGenerationStarted ? ["查看", "下载"] : ["生成"] },
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

function ProgressTab({ frame }: { frame: AppFrame }) {
  const activeStep =
    frame === "odi-preinfo"   ? 3 :
    frame === "odi-materials" ? 4 :
    frame === "odi-project"   ? 5 : 7;

  const STEPS = [
    { label: "ODI意图识别" },
    { label: "企业认证" },
    { label: "前置信息" },
    { label: "材料清单" },
    { label: "上传识别" },
    { label: "文书生成" },
    { label: "自查确认" },
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
              <div style={{ position: "absolute", left: 7, top: 18, width: 2, height: "calc(100% - 6px)", background: done ? "#1a5bc6" : "#e0e8f5" }} />
            )}
            <div style={{
              width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 2,
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
                ? <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4l2 2L6.5 2" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" /></svg>
                : active ? <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1a5bc6" }} /> : null}
            </div>
            <div style={{ paddingBottom: 12, flex: 1 }}>
              <p style={{ fontSize: 11, color: done || active ? "#1a2744" : "#8a9bbf", fontWeight: active ? 600 : 400 }}>{step.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OdiWorkbenchPanelContent({ frame, onClose, investMethod, entityType, destination, amount, preInfoConfirmed, attachedFiles, materialGenerationStarted }: Props) {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>(FRAME_TO_TAB[frame] ?? "preinfo");
  const [tabKey, setTabKey] = useState(0);

  useEffect(() => {
    const t = FRAME_TO_TAB[frame];
    if (t) { setActiveTab(t); setTabKey(k => k + 1); }
  }, [frame]);

  return (
    <>
      <style>{ANIM_CSS}</style>
      {/* Header */}
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
          onClick={onClose}
          style={{
            display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 6,
            background: "rgba(255,255,255,0.15)", cursor: "pointer",
            borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
            borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
            borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderLeftColor: "transparent",
            flexShrink: 0,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M8 3L3 8M3 3l5 5" stroke="rgba(255,255,255,0.8)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.85)" }}>返回</span>
        </button>
      </div>

      {/* Status summary */}
      <div style={{
        padding: "5px 14px", background: "#f0f5ff", flexShrink: 0,
        borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#e4edfc",
        borderTopWidth: 0, borderTopStyle: "solid", borderTopColor: "transparent",
        borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
        borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
      }}>
        <p style={{ fontSize: 11, color: "#4a6490", textAlign: "center" }}>基础信息待确认 · 材料清单待生成</p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", flexShrink: 0,
        borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#eef3fb",
        borderTopWidth: 0, borderTopStyle: "solid", borderTopColor: "transparent",
        borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
        borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
      }}>
        {WORKBENCH_TABS.map(tab => {
          const generatedCount = materialGenerationStarted ? 3 : 0;
          const showBadge = tab.key === "generation" && generatedCount > 0 && activeTab !== "generation";

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
                }}>{generatedCount}</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Scrollable content */}
      <div
        key={tabKey}
        style={{
          flex: 1, overflowY: "auto", padding: "13px 14px",
          scrollbarWidth: "none",
        }}
      >
        {activeTab === "fillform"   && <FillFormTab />}
        {activeTab === "preinfo"    && <PreInfoTab investMethod={investMethod} entityType={entityType} destination={destination} amount={amount} />}
        {activeTab === "materials"  && <MaterialsListTab attachedFiles={attachedFiles} />}
        {activeTab === "generation" && <GenerationTab materialGenerationStarted={materialGenerationStarted} />}
        {activeTab === "progress"   && <ProgressTab frame={frame} />}
      </div>
    </>
  );
}
