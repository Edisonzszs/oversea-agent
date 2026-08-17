// 合规自查报告渲染 —— 接收纯计算结果 ReportResult，输出 3 类核心报告。
// ① 自查报告（档位徽章 + 核心齐备度环 + 结论 + 自查事项明细表）
// ② 文件齐备度明细表（核心 + 增强双层）
// ③ 缺件清单 + 行动建议（D→C→B）

import { C, GRADE_COLOR, GRADE_BG, cardStyle, h2Style } from "../complianceTheme";
import type { ReportResult } from "../logic/scoring";
import { GRADE_TEXT } from "../logic/scoring";
import { generateReportHTML } from "../reportHtml";

const RING_R = 52;
const RING_CIRC = 2 * Math.PI * RING_R;

export function ComplianceReport({ report, projectName }: { report: ReportResult; projectName?: string }) {
  const { grade, fileScore } = report;
  const score = fileScore.score;
  const ringColor = score >= 80 ? C.ok : score >= 60 ? C.primary : C.warn;
  const dash = (score / 100) * RING_CIRC;
  const gText = GRADE_TEXT[grade];

  return (
    <div className="print-area" style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 28px 64px" }}>
      <style>{`@media print{body *{visibility:hidden}.print-area,.print-area *{visibility:visible}.print-area{position:absolute;left:0;top:0;width:100%;padding:20px}.no-print{display:none}}`}</style>
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => { const html = generateReportHTML(report, projectName || "合规自查"); const w = window.open("", "_blank"); if (w) { w.document.open(); w.document.write(html); w.document.close(); } }} style={{ padding: "8px 20px", borderRadius: 8, border: `1px solid ${C.primaryBorder}`, background: C.primaryBg, color: C.primary, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 5V2h8v3M4 11H2.5V5h11v6H12M5 11v3h6v-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          导出 / 打印报告
        </button>
      </div>
      {/* ① 自查报告 */}
      <div style={cardStyle}>
        <h2 style={h2Style}>企业境外投资自查报告</h2>
        <div style={{ background: C.primaryBg, border: `1px solid ${C.primaryBorder}`, borderRadius: 7, padding: "8px 14px", fontSize: 13, color: C.primary, marginBottom: 8 }}>
          <b>定位声明：</b>本自查为自愿性辅导工具，不是申报条件，任何档位均可依法申报。
        </div>
        <div style={{ background: "#EEF4FB", border: "1px solid #B9CFE8", borderRadius: 7, padding: "8px 14px", fontSize: 13.5, color: C.ink, marginBottom: 6 }}>{report.pathLine}</div>
        {report.routeLine && <div style={{ background: C.primaryBg, border: `1px solid ${C.primaryBorder}`, borderRadius: 7, padding: "8px 14px", fontSize: 13.5, color: C.primary, marginBottom: 6 }}>{report.routeLine}</div>}
        <div style={{ fontSize: 12.5, color: C.muted, padding: "4px 2px", marginBottom: 8 }}>{report.ackLine}</div>

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 56, flexWrap: "wrap", padding: "18px 0" }}>
          {/* 档位徽章 */}
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 96, height: 96, borderRadius: "50%", background: GRADE_COLOR[grade], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, fontWeight: 800, margin: "0 auto 10px" }}>{grade}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>自查判断等级 {grade}——{gText[0]}</div>
            <div style={{ fontSize: 12.5, color: C.sub, maxWidth: 280, margin: "4px auto 0" }}>{gText[1]}（总档按"就低原则"确定）</div>
          </div>
          {/* 核心齐备度环 */}
          <div style={{ textAlign: "center" }}>
            <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 10px" }}>
              <svg width={120} height={120} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={60} cy={60} r={RING_R} fill="none" stroke="#E4EBF2" strokeWidth={10} />
                <circle cx={60} cy={60} r={RING_R} fill="none" stroke={ringColor} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${dash} ${RING_CIRC}`} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: C.ink, lineHeight: 1.1 }}>{score}</span>
                <span style={{ fontSize: 11, color: C.muted }}>核心齐备度</span>
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>核心齐备度（双层制）</div>
            <div style={{ fontSize: 12, color: C.sub, maxWidth: 300, margin: "4px auto 0" }}>核心层满分 100{fileScore.maxAvail < 100 ? `，本次实际可得上限 ${fileScore.maxAvail}` : ""} · 增强加分 +{Math.min(fileScore.enhScore, fileScore.enhCap)} 分（上限 {fileScore.enhCap}）</div>
          </div>
        </div>

        <div style={{ background: "#FFF9EC", border: "1px solid #EAD9A8", borderRadius: 7, padding: "8px 14px", fontSize: 13, color: "#6B5417", marginBottom: 10 }}>{report.comboText}</div>

        {/* 自查事项明细表 */}
        <table style={tableStyle}>
          <thead><tr>{["模块", "自查事项", "档位", "说明"].map((h, i) => <th key={h} style={{ ...thStyle, width: ["14%", "32%", "9%", "45%"][i] }}>{h}</th>)}</tr></thead>
          <tbody>
            {report.items.map((it, i) => (
              <tr key={i} style={{ background: i % 2 ? C.primaryBg : "#fff" }}>
                <td style={tdStyle}>{it.mod}</td>
                <td style={tdStyle}>{it.name}</td>
                <td style={tdStyle}><GradeTag g={it.grade} /></td>
                <td style={{ ...tdStyle, color: C.sub, fontSize: 12.5 }}>{it.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ② 文件齐备度明细 */}
      <div style={cardStyle}>
        <h2 style={h2Style}>文件齐备度明细（核心 + 增强双层 · 按模块列示）</h2>
        <table style={tableStyle}>
          <thead><tr>{["模块", "应准备文件", "层级/权重", "状态", "得分"].map((h, i) => <th key={h} style={{ ...thStyle, width: ["13%", "44%", "11%", "22%", "10%"][i] }}>{h}</th>)}</tr></thead>
          <tbody>
            {fileScore.rows.map((r, i) => (
              <tr key={r.fid} style={{ background: i % 2 ? C.primaryBg : "#fff" }}>
                <td style={tdStyle}>{r.mod}</td>
                <td style={tdStyle}>{r.label}</td>
                <td style={{ ...tdStyle, color: r.tierLabel.startsWith("增强") ? C.ok : C.primary, fontWeight: 600 }}>{r.tierLabel}</td>
                <td style={{ ...tdStyle, fontSize: 12.5 }}>{r.status}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{r.got > 0 ? `+${r.got}` : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {fileScore.maskN > 0 && (
          <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
            *含脱敏文件 {fileScore.maskN} 件（核心层，合计权重 {fileScore.maskW} 分），按 80% 口径折算核心参考分 {fileScore.refScore}，供审查环节了解材料完整性时参考：{fileScore.maskNames.join("、")}。
          </div>
        )}
      </div>

      {/* ③ 缺件清单 + 行动建议 */}
      <div style={cardStyle}>
        <h2 style={h2Style}>缺件清单与行动建议（按 D→C→B 优先级）</h2>

        {fileScore.missCore.length > 0 ? (
          <>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.bad, margin: "6px 0" }}>必备材料缺件（影响核心齐备度，请催办补齐）：</div>
            <ul style={{ margin: "4px 0 12px 20px", fontSize: 13, color: C.ink, lineHeight: 1.8 }}>
              {fileScore.missCore.map((m, i) => <li key={i}>{m.label}（核心 {m.weight} 分）</li>)}
            </ul>
          </>
        ) : (
          <div style={{ fontSize: 13.5, color: C.ok, margin: "6px 0" }}><b>必备材料：</b>核心层材料已全部上传。</div>
        )}

        {fileScore.missEnh.length > 0 && (
          <>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.warn, margin: "6px 0" }}>增强材料未提交（不扣分，提交每件 +1 分）：</div>
            <ul style={{ margin: "4px 0 12px 20px", fontSize: 13, color: C.sub, lineHeight: 1.8 }}>
              {fileScore.missEnh.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </>
        )}

        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, margin: "12px 0 6px", borderTop: `1px solid ${C.lineSoft}`, paddingTop: 12 }}>行动建议：</div>
        {report.actions.length === 0 ? (
          <div style={{ fontSize: 13, color: C.sub }}>无待办事项，请按文件编制清单核对成册。</div>
        ) : (
          <ul style={{ margin: "4px 0 0 20px", fontSize: 13, color: C.ink, lineHeight: 1.8 }}>
            {report.actions.map((a, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <span style={{ display: "inline-block", minWidth: 26, textAlign: "center", borderRadius: 4, color: "#fff", fontWeight: 700, padding: "1px 7px", fontSize: 12.5, background: GRADE_COLOR[a.grade], marginRight: 8 }}>{a.grade}</span>
                {a.text}
                {a.orgs.length > 0 && <span style={{ display: "inline-block", marginLeft: 8, background: C.okBg, border: `1px solid ${C.okBorder}`, color: C.ok, borderRadius: 4, fontSize: 11.5, padding: "1px 7px" }}>可寻求协助：{a.orgs.join("/")}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, padding: "0 4px" }}>
        双层声明：本报告由自查系统按企业填报的客观事实自动生成，不构成法律意见；自查结果不代表主管机关审批结论，最终以主管机关依法审查为准。文件齐备度分数仅反映材料齐备程度，不代表合规结论；上传文件仅用于本次自查计分与报告生成。
      </div>
    </div>
  );
}

function GradeTag({ g }: { g: string }) {
  return <span style={{ display: "inline-block", minWidth: 26, textAlign: "center", borderRadius: 4, color: "#fff", fontWeight: 700, padding: "1px 8px", fontSize: 12.5, background: GRADE_COLOR[g] }}>{g === "I" ? "—" : g}</span>;
}

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 };
const thStyle: React.CSSProperties = { background: C.primary, color: "#fff", padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: 12.5 };
const tdStyle: React.CSSProperties = { border: `1px solid ${C.line}`, padding: "8px 10px", verticalAlign: "top", fontSize: 13 };
