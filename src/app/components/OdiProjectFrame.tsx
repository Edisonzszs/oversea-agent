import { useState } from "react";

interface Props {
  onPrereview: () => void;
}

const STEPS = [
  { label: "前置信息确认", status: "done" },
  { label: "材料上传与识别", status: "active" },
  { label: "表单草稿生成", status: "pending" },
  { label: "检查与导出", status: "pending" },
];

const MATERIALS = [
  { name: "企业营业执照（复印件）", status: "已识别", required: true },
  { name: "法定代表人身份证明", status: "已识别", required: true },
  { name: "境外投资备案表", status: "待上传", required: true },
  { name: "境外投资真实性承诺书", status: "待上传", required: true },
  { name: "最近一年经审计财务报表", status: "待补充", required: true },
  { name: "境外投资项目可行性研究报告", status: "未开始", required: true },
  { name: "投资协议或意向书", status: "未开始", required: false },
  { name: "投资资金来源说明材料", status: "已生成草稿", required: true },
];

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  "已识别": { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  "已生成草稿": { bg: "#eff6ff", color: "#1a5bc6", border: "#bfdbfe" },
  "待上传": { bg: "#fffbeb", color: "#b45309", border: "#fed7aa" },
  "待补充": { bg: "#fff7ed", color: "#ea580c", border: "#fdba74" },
  "未开始": { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
};

const PROJECT_INFO = [
  { label: "投资方式", value: "新设" },
  { label: "目的国家", value: "阿联酋（阿布扎比）" },
  { label: "投资金额", value: "500万美元" },
  { label: "境外企业名称", value: "XXX（阿布扎比）有限公司" },
  { label: "法定代表人", value: "张三", note: "来自营业执照识别" },
  { label: "注册地址", value: "阿布扎比，阿联酋", note: "来自营业执照识别" },
];

export function OdiProjectFrame({ onPrereview }: Props) {
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const done = MATERIALS.filter(m => m.status === "已识别" || m.status === "已生成草稿").length;
  const total = MATERIALS.length;
  const pct = Math.round((done / total) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "14px 0 14px 4px", gap: 0 }}>
      {/* Project header */}
      <div style={{
        background: "#fff", borderRadius: 10, margin: "0 12px 10px 0",
        padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 8px rgba(26,64,140,0.07)",
        borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
        borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
        borderTopColor: "#e8f0fe", borderRightColor: "#e8f0fe", borderBottomColor: "#e8f0fe", borderLeftColor: "#e8f0fe",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            background: "linear-gradient(135deg,#1e6ee8,#0f4cb5)", borderRadius: 8,
            padding: "4px 10px", color: "#fff", fontSize: 11, fontWeight: 600,
          }}>ODI项目</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1a2744" }}>
            XXX公司拟在阿布扎比新设XXX（阿布扎比）有限公司
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#6b8ab0" }}>完整度</span>
          <div style={{
            width: 80, height: 6, borderRadius: 3,
            background: "#e8f0fe", overflow: "hidden",
          }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#1a5bc6,#2d78e8)", borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#1a5bc6" }}>{pct}%</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", gap: 10, paddingRight: 12 }}>
        {/* Left step sidebar */}
        <div style={{
          width: 150, flexShrink: 0, background: "#fff", borderRadius: 10,
          padding: "16px 12px",
          boxShadow: "0 2px 8px rgba(26,64,140,0.07)",
          borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
          borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
          borderTopColor: "#e8f0fe", borderRightColor: "#e8f0fe", borderBottomColor: "#e8f0fe", borderLeftColor: "#e8f0fe",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <p style={{ fontSize: 11, color: "#8a9bbf", marginBottom: 10 }}>办理进度</p>
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", position: "relative" }}>
              {i < STEPS.length - 1 && (
                <div style={{
                  position: "absolute", left: 9, top: 20, width: 2, height: 28,
                  background: step.status === "done" ? "#1a5bc6" : "#e0e8f5",
                }} />
              )}
              <div style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                background: step.status === "done" ? "#1a5bc6" : step.status === "active" ? "#fff" : "#f0f4fb",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderTopWidth: 2, borderRightWidth: 2, borderBottomWidth: 2, borderLeftWidth: 2,
                borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                borderTopColor: step.status === "pending" ? "#c8daf0" : "#1a5bc6",
                borderRightColor: step.status === "pending" ? "#c8daf0" : "#1a5bc6",
                borderBottomColor: step.status === "pending" ? "#c8daf0" : "#1a5bc6",
                borderLeftColor: step.status === "pending" ? "#c8daf0" : "#1a5bc6",
              }}>
                {step.status === "done" ? (
                  <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : step.status === "active" ? (
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1a5bc6" }} />
                ) : null}
              </div>
              <div style={{ paddingTop: 1 }}>
                <p style={{
                  fontSize: 12, lineHeight: 1.4,
                  color: step.status === "pending" ? "#8a9bbf" : "#1a2744",
                  fontWeight: step.status === "active" ? 600 : 400,
                }}>{step.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Center material list */}
        <div style={{
          flex: 1, background: "#fff", borderRadius: 10, overflow: "hidden",
          boxShadow: "0 2px 8px rgba(26,64,140,0.07)",
          borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
          borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
          borderTopColor: "#e8f0fe", borderRightColor: "#e8f0fe", borderBottomColor: "#e8f0fe", borderLeftColor: "#e8f0fe",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{
            padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#e8f0fe",
            borderTopWidth: 0, borderTopStyle: "solid", borderTopColor: "transparent",
            borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
            borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#1a2744" }}>材料任务清单</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={onPrereview}
                style={{
                  padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: "linear-gradient(135deg,#1e6ee8,#0f4cb5)", color: "#fff",
                  borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
                  borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                  borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderLeftColor: "transparent",
                  cursor: "pointer",
                }}
              >提交预审</button>
            </div>
          </div>

          {/* Table header */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 110px 150px",
            padding: "8px 18px", background: "#f8fafc",
            borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#e8f0fe",
            borderTopWidth: 0, borderTopStyle: "solid", borderTopColor: "transparent",
            borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
            borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
          }}>
            {["材料名称", "状态", "操作"].map((h, i) => (
              <span key={i} style={{ fontSize: 11, color: "#6b8ab0", fontWeight: 600 }}>{h}</span>
            ))}
          </div>

          {/* Table rows */}
          <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "none" }}>
            {MATERIALS.map((mat, i) => {
              const sc = STATUS_COLORS[mat.status];
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr 110px 150px",
                  padding: "10px 18px", alignItems: "center",
                  borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#f0f4fb",
                  borderTopWidth: 0, borderTopStyle: "solid", borderTopColor: "transparent",
                  borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
                  borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
                  background: i % 2 === 0 ? "#fff" : "#fafbff",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {!mat.required && (
                      <span style={{ fontSize: 10, color: "#8a9bbf", background: "#f0f4fb", padding: "1px 5px", borderRadius: 3 }}>选</span>
                    )}
                    <span style={{ fontSize: 13, color: "#1a2744" }}>{mat.name}</span>
                  </div>
                  <span style={{
                    display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 20,
                    fontSize: 11, fontWeight: 600,
                    background: sc.bg, color: sc.color,
                    borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                    borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                    borderTopColor: sc.border, borderRightColor: sc.border, borderBottomColor: sc.border, borderLeftColor: sc.border,
                    width: "fit-content",
                  }}>{mat.status}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(mat.status === "待上传" || mat.status === "未开始") && (
                      <button style={{
                        fontSize: 12, padding: "3px 10px", borderRadius: 4, cursor: "pointer",
                        background: "#e8f0fe", color: "#1a5bc6",
                        borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                        borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                        borderTopColor: "#bfdbfe", borderRightColor: "#bfdbfe", borderBottomColor: "#bfdbfe", borderLeftColor: "#bfdbfe",
                      }}>上传</button>
                    )}
                    {mat.status === "待补充" && (
                      <button style={{
                        fontSize: 12, padding: "3px 10px", borderRadius: 4, cursor: "pointer",
                        background: "#fff7ed", color: "#ea580c",
                        borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                        borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                        borderTopColor: "#fdba74", borderRightColor: "#fdba74", borderBottomColor: "#fdba74", borderLeftColor: "#fdba74",
                      }}>补充</button>
                    )}
                    {(mat.status === "已识别" || mat.status === "已生成草稿") && (
                      <button style={{
                        fontSize: 12, padding: "3px 10px", borderRadius: 4, cursor: "pointer",
                        background: "#f0fdf4", color: "#16a34a",
                        borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                        borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                        borderTopColor: "#bbf7d0", borderRightColor: "#bbf7d0", borderBottomColor: "#bbf7d0", borderLeftColor: "#bbf7d0",
                      }}>查看</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right project summary */}
        <div style={{
          width: 200, flexShrink: 0, background: "#fff", borderRadius: 10,
          padding: "14px 14px",
          boxShadow: "0 2px 8px rgba(26,64,140,0.07)",
          borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
          borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
          borderTopColor: "#e8f0fe", borderRightColor: "#e8f0fe", borderBottomColor: "#e8f0fe", borderLeftColor: "#e8f0fe",
          overflow: "auto", scrollbarWidth: "none",
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#1a2744", marginBottom: 12 }}>项目摘要</p>
          {PROJECT_INFO.map((item, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: "#8a9bbf", marginBottom: 2 }}>{item.label}</p>
              <p style={{ fontSize: 12, color: "#1a2744", lineHeight: 1.5 }}>{item.value}</p>
              {item.note && (
                <p style={{ fontSize: 10, color: "#1a5bc6", marginTop: 2 }}>📎 {item.note}</p>
              )}
            </div>
          ))}
          <div style={{
            marginTop: 4, padding: "8px 10px", borderRadius: 8,
            background: "#f0f6ff",
            borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
            borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
            borderTopColor: "#dbeafe", borderRightColor: "#dbeafe", borderBottomColor: "#dbeafe", borderLeftColor: "#dbeafe",
          }}>
            <p style={{ fontSize: 11, color: "#1a5bc6", lineHeight: 1.6 }}>
              已完成 {done}/{total} 项材料，可提交预审。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
