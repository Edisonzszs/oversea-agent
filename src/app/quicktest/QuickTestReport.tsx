// 速测版自查报告 —— 照简化版 HTML 报告页 10 区块渲染。
// 数据来自 grade.ts 的 gradeAll();配色沿用 HTML navy 政务风(与 reportHtml.ts token 一致)。
// 含「覆盖范围声明」与「升级完整版」引导(登录后把速测作答灌入完整版)。

import { gradeAll, gradeMeta, type Grade } from "./grade";
import type { Answers } from "./questions";

const NAVY = "#00355F";
const OK = "#1E7B4D";
const MID = "#5187BF";
const WARN = "#B07500";
const BAD = "#B03A2E";
const LIGHT = "#E8EFF7";
const LINE = "#C9D8E8";
const INK = "#22303C";

const GRADE_COLOR: Record<Exclude<Grade, "I">, string> = { A: OK, B: MID, C: WARN, D: BAD };
const MODULE_TITLE: Record<number, string> = { 1: "模块一", 2: "模块二", 3: "模块三", 4: "模块四", 5: "模块五" };

interface Props {
  answers: Answers;
  onUpgrade: () => void; // 升级完整版(登录后灌入)
  onBack: () => void;    // 返回修改
}

export function QuickTestReport({ answers, onUpgrade, onBack }: Props) {
  const r = gradeAll(answers);
  const total = r.total as Exclude<Grade, "I">;
  const meta = gradeMeta(total);
  const color = GRADE_COLOR[total];

  return (
    <div style={{ fontFamily: '"Songti SC","Microsoft YaHei",serif', color: INK, lineHeight: 1.7 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 16px", textAlign: "center" }}>企业境外投资自查报告(简化版)</h2>

      {/* 1-3 路径 / 路径判断 / 留痕 */}
      <Row text={r.pathLine} />
      <Row text={r.routeLine} />
      <Row text={r.ackLine} />

      {/* 4 覆盖范围声明 */}
      <div style={{ background: "#FFF9EC", border: `1px solid #EAD9A8`, borderLeft: `4px solid ${WARN}`, borderRadius: "0 7px 7px 0", padding: "10px 14px", margin: "12px 0", fontSize: 12.5, color: "#6B5417" }}>
        <b>覆盖范围声明:</b>本报告为简化版结果,仅覆盖核心自查事项;被精简的题目未参与判档,本结果可能高于完整版自查结果,正式档位以登录后完整版自查为准。本自查为自愿性辅导工具,不是申报条件,任何档位均可依法申报。
      </div>

      {/* 5 档位徽章 */}
      <div style={{ display: "flex", alignItems: "center", gap: 22, background: LIGHT, borderRadius: 10, padding: "20px 24px", margin: "16px 0", border: `1px solid ${LINE}` }}>
        <div style={{ width: 96, height: 96, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, fontWeight: 800, flexShrink: 0, boxShadow: `0 6px 18px ${color}55` }}>{total}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>自查判断等级　{total}——{meta.title}</div>
          <div style={{ fontSize: 13, color: INK, margin: "6px 0" }}>{meta.desc}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>(总档按"就低原则"确定;简化版覆盖范围见上方声明)</div>
        </div>
      </div>

      {/* 6 分题判档明细 */}
      <SectionTitle title="自查事项判档明细" />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, margin: "8px 0 4px" }}>
        <thead>
          <tr style={{ background: LIGHT }}>
            <Th>模块</Th><Th>自查事项</Th><Th style={{ width: 56 }}>档位</Th><Th>说明</Th>
          </tr>
        </thead>
        <tbody>
          {r.items.map(it => (
            <tr key={it.key} style={{ borderTop: `1px solid ${LINE}` }}>
              <Td>{MODULE_TITLE[it.module] || ""}</Td>
              <Td>{it.label}</Td>
              <Td style={{ textAlign: "center" }}>{it.grade === "I" ? <span style={{ color: "#94a3b8" }}>—</span> : <span style={{ display: "inline-block", width: 22, height: 22, lineHeight: "22px", borderRadius: 4, background: GRADE_COLOR[it.grade as Exclude<Grade, "I">], color: "#fff", fontWeight: 700, fontSize: 12 }}>{it.grade}</span>}</Td>
              <Td style={{ color: "#475569" }}>{it.desc}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 7 建议补充材料 */}
      <SectionTitle title="建议补充准备的材料" />
      <div style={{ fontSize: 12, color: "#64748b", margin: "4px 0 8px" }}>以下根据您的回答自动列出(仅列示,不计分、无权重);完整版可逐项核对全部应准备文件并完成文件齐备度计分。</div>
      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
        {r.missList.map((m, i) => <li key={i} style={{ margin: "4px 0", color: INK }}>{m}</li>)}
      </ul>

      {/* 8 升级引导 */}
      <div style={{ background: "#FFF9EC", border: `1px solid #EAD9A8`, borderLeft: `4px solid ${WARN}`, borderRadius: "0 7px 7px 0", padding: "12px 14px", margin: "16px 0" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#6B5417", marginBottom: 4 }}>进一步自测</div>
        <div style={{ fontSize: 12.5, color: "#6B5417", marginBottom: 10 }}>本结果为简化版初步自测,仅覆盖核心自查事项。登录后可使用完整版:逐题自查、文件齐备度计分、报告保存与重新生成。</div>
        <button onClick={onUpgrade} style={{ border: "none", borderRadius: 7, background: NAVY, color: "#fff", fontSize: 13.5, fontWeight: 600, padding: "9px 22px", cursor: "pointer" }}>登录升级完整版(作答可带入)</button>
      </div>

      {/* 9 咨询 */}
      <SectionTitle title="我可以咨询谁?" />
      <div style={{ fontSize: 12.5, color: "#475569", margin: "4px 0" }}>
        完成自查后仍有疑问?您可以:①查阅商务部《对外投资合作国别(地区)指南》(免费公开);②登录本市企业出海综合服务平台获取政策与流程指引;③如需专业支持,平台专业服务联盟机构可按您的行业与目的地提供对口服务(服务选择由企业自主决定)。
      </div>

      {/* 10 免责 */}
      <div style={{ background: "#F4F6F9", border: `1px solid ${LINE}`, borderRadius: 7, padding: "10px 14px", margin: "16px 0 8px", fontSize: 11.5, color: "#64748b" }}>
        <b>双层声明:</b>本报告由自查系统按企业填报的客观事实自动生成,不构成法律意见;自查结果不代表主管机关审批结论,最终以主管机关依法审查为准。企业填报内容仅用于生成本报告,不作为执法线索使用;匿名填报数据不保存,关闭页面后无法恢复。
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 20 }}>
        <button onClick={onBack} style={{ border: `1px solid ${LINE}`, background: "#fff", color: INK, borderRadius: 7, padding: "9px 22px", fontSize: 13.5, cursor: "pointer" }}>返回修改</button>
      </div>
    </div>
  );
}

function Row({ text }: { text: string }) {
  return <div style={{ fontSize: 12.5, color: "#475569", margin: "4px 0" }}>{text}</div>;
}
function SectionTitle({ title }: { title: string }) {
  return <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, margin: "18px 0 2px", paddingBottom: 4, borderBottom: `2px solid ${NAVY}` }}>{title}</div>;
}
function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 12.5, fontWeight: 700, color: NAVY }}>{children}</th>;
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "8px 10px", verticalAlign: "top", ...style }}>{children}</td>;
}
