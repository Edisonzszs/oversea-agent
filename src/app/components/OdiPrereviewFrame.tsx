import { useState } from "react";

const MISSING_FIELDS = [
  "境外企业注册资本（币种及金额）",
  "投资项目预期收益说明",
  "外汇资金来源说明（具体银行账户）",
];

const MISSING_ATTACHMENTS = [
  "境外投资项目可行性研究报告",
  "境外目标公司基本情况说明",
];

const CONFIRM_ITEMS = [
  "境外企业经营范围是否与境内母公司一致（需人工核实）",
  "投资金额是否与外汇局备案限额一致",
];

const PARSED_RESULTS = [
  { material: "境外投资备案表", field: "注册资本", suggestion: "补充币种：美元，金额：500万" },
  { material: "可行性研究报告", field: "全文", suggestion: "需上传完整报告文件（PDF格式）" },
  { material: "投资真实性承诺书", field: "法人签字", suggestion: "确认是否已由法定代表人本人签字" },
];

type ResultLevel = "green" | "yellow" | "orange";

const RESULT_CONFIG: Record<ResultLevel, { label: string; bg: string; color: string; border: string; desc: string }> = {
  green: { label: "可进入官方系统", bg: "#f0fdf4", color: "#15803d", border: "#86efac", desc: "材料完整度达到要求，可直接进入商务部 FDI 系统提交" },
  yellow: { label: "建议补充后提交", bg: "#fffbeb", color: "#b45309", border: "#fcd34d", desc: "存在部分缺失项，建议补齐后再行提交，减少退件风险" },
  orange: { label: "需人工确认后提交", bg: "#fff7ed", color: "#c2410c", border: "#fdba74", desc: "存在需要人工确认的关键信息，请联系专业顾问或商务局窗口" },
};

export function OdiPrereviewFrame() {
  const [correctionText, setCorrectionText] = useState("");
  const [parsed, setParsed] = useState(false);
  const resultLevel: ResultLevel = "yellow";
  const rc = RESULT_CONFIG[resultLevel];
  const completeness = 62;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "14px 12px 14px 4px", gap: 12, overflow: "auto", scrollbarWidth: "none" }}>

      {/* Header row */}
      <div style={{
        background: "#fff", borderRadius: 10, padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 8px rgba(26,64,140,0.07)", flexShrink: 0,
        borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
        borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
        borderTopColor: "#e8f0fe", borderRightColor: "#e8f0fe", borderBottomColor: "#e8f0fe", borderLeftColor: "#e8f0fe",
      }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#1a2744", marginBottom: 2 }}>预审补正分析</p>
          <p style={{ fontSize: 12, color: "#6b8ab0" }}>XXX公司拟在阿布扎比新设XXX（阿布扎比）有限公司</p>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 20,
          background: rc.bg, color: rc.color,
          borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
          borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
          borderTopColor: rc.border, borderRightColor: rc.border, borderBottomColor: rc.border, borderLeftColor: rc.border,
          fontSize: 13, fontWeight: 600,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: rc.color, display: "inline-block" }} />
          {rc.label}
        </div>
      </div>

      {/* Two-col main */}
      <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>

        {/* Left: completeness analysis */}
        <div style={{
          flex: 1, background: "#fff", borderRadius: 10, padding: "16px 20px",
          boxShadow: "0 2px 8px rgba(26,64,140,0.07)", overflow: "auto", scrollbarWidth: "none",
          borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
          borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
          borderTopColor: "#e8f0fe", borderRightColor: "#e8f0fe", borderBottomColor: "#e8f0fe", borderLeftColor: "#e8f0fe",
        }}>
          {/* Completeness bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#1a2744" }}>材料完整度</p>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1a5bc6" }}>{completeness}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "#e8f0fe", overflow: "hidden" }}>
              <div style={{
                width: `${completeness}%`, height: "100%", borderRadius: 4,
                background: "linear-gradient(90deg,#f59e0b,#1a5bc6)",
              }} />
            </div>
            <p style={{ fontSize: 12, color: "#6b8ab0", marginTop: 6 }}>{rc.desc}</p>
          </div>

          {/* Missing fields */}
          <Section title="缺失字段" color="#b45309" bg="#fffbeb" border="#fcd34d" items={MISSING_FIELDS} />

          {/* Missing attachments */}
          <Section title="缺失附件" color="#ea580c" bg="#fff7ed" border="#fdba74" items={MISSING_ATTACHMENTS} />

          {/* Manual confirm */}
          <Section title="需人工确认项" color="#7c3aed" bg="#faf5ff" border="#c4b5fd" items={CONFIRM_ITEMS} />
        </div>

        {/* Right: correction textarea + parsed results + hotline */}
        <div style={{
          width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12,
        }}>
          {/* Correction input */}
          <div style={{
            background: "#fff", borderRadius: 10, padding: "16px 18px",
            boxShadow: "0 2px 8px rgba(26,64,140,0.07)",
            borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
            borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
            borderTopColor: "#e8f0fe", borderRightColor: "#e8f0fe", borderBottomColor: "#e8f0fe", borderLeftColor: "#e8f0fe",
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#1a2744", marginBottom: 10 }}>粘贴预审补正意见</p>
            <textarea
              value={correctionText}
              onChange={(e) => setCorrectionText(e.target.value)}
              placeholder="将商务局出具的补正意见原文粘贴至此处，AI将自动解析受影响的材料、字段及修改建议..."
              style={{
                width: "100%", height: 120, resize: "none", outline: "none",
                fontSize: 12, color: "#1a2744", lineHeight: 1.7,
                padding: "8px 10px", borderRadius: 6, fontFamily: "inherit",
                boxSizing: "border-box",
                borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                borderTopColor: "#dde9f7", borderRightColor: "#dde9f7", borderBottomColor: "#dde9f7", borderLeftColor: "#dde9f7",
                background: "#f8fafc",
              }}
            />
            <button
              onClick={() => { if (correctionText.trim()) setParsed(true); }}
              style={{
                marginTop: 10, width: "100%", padding: "8px 0", borderRadius: 6,
                background: correctionText.trim() ? "linear-gradient(135deg,#1e6ee8,#0f4cb5)" : "#c8daf0",
                color: "#fff", fontSize: 13, fontWeight: 600, cursor: correctionText.trim() ? "pointer" : "default",
                borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
                borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderLeftColor: "transparent",
              }}
            >解析补正意见</button>
          </div>

          {/* Parsed results */}
          {parsed && (
            <div style={{
              background: "#fff", borderRadius: 10, padding: "14px 18px",
              boxShadow: "0 2px 8px rgba(26,64,140,0.07)",
              borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
              borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
              borderTopColor: "#e8f0fe", borderRightColor: "#e8f0fe", borderBottomColor: "#e8f0fe", borderLeftColor: "#e8f0fe",
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#1a2744", marginBottom: 10 }}>解析结果</p>
              {PARSED_RESULTS.map((r, i) => (
                <div key={i} style={{
                  padding: "8px 10px", borderRadius: 8, marginBottom: 8,
                  background: "#f8fafc",
                  borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
                  borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
                  borderTopColor: "#e2e8f0", borderRightColor: "#e2e8f0", borderBottomColor: "#e2e8f0", borderLeftColor: "#e2e8f0",
                }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#1a5bc6", background: "#e8f0fe", padding: "1px 6px", borderRadius: 4 }}>{r.material}</span>
                    <span style={{ fontSize: 11, color: "#6b8ab0" }}>· {r.field}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#3a4f72", lineHeight: 1.6 }}>{r.suggestion}</p>
                </div>
              ))}
            </div>
          )}

          {/* Hotline */}
          <div style={{
            background: "linear-gradient(135deg,#e8f9f0,#d6eeff)", borderRadius: 10, padding: "14px 16px",
            borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
            borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
            borderTopColor: "rgba(26,91,198,0.12)", borderRightColor: "rgba(26,91,198,0.12)", borderBottomColor: "rgba(26,91,198,0.12)", borderLeftColor: "rgba(26,91,198,0.12)",
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#1a2744", marginBottom: 6 }}>📞 人工服务热线</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#1a5bc6", marginBottom: 4 }}>021—XXXX-XXXX</p>
            <p style={{ fontSize: 11, color: "#4a6490", lineHeight: 1.7 }}>
              工作日 9:00–11:30，13:30–17:00<br />
              节假日及非工作时间请留言，工作人员将于次工作日回复
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, color, bg, border, items }: {
  title: string; color: string; bg: string; border: string; items: string[];
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ width: 3, height: 12, borderRadius: 2, background: color, display: "inline-block" }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: "#1a2744" }}>{title}</p>
        <span style={{
          fontSize: 11, padding: "1px 7px", borderRadius: 20, background: bg, color,
          borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
          borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
          borderTopColor: border, borderRightColor: border, borderBottomColor: border, borderLeftColor: border,
        }}>{items.length}项</span>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 6, fontSize: 13, color: "#3a4f72", lineHeight: 1.8, alignItems: "flex-start" }}>
          <span style={{ color, flexShrink: 0, marginTop: 2 }}>·</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}
