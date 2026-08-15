// 独立 HTML 报告生成器 —— 从 ReportResult 生成完整可打印 HTML 页面。
// CSS 沿用 HTML 第五版模板设计 token（#00355F 海军蓝、宋体、卡片布局）。
// 新窗口打开后自动触发 window.print() → 用户另存 PDF。

import type { ReportResult } from "./logic/scoring";
import { GRADE_TEXT } from "./logic/scoring";

const GCOLOR: Record<string, string> = { A: "#1E7B4D", B: "#5187BF", C: "#B07500", D: "#B03A2E" };

export function generateReportHTML(report: ReportResult, projectName: string): string {
  const { grade, fileScore, items, actions, docs, comboText, pathLine, routeLine, ackLine } = report;
  const score = fileScore.score;
  const ringColor = score >= 80 ? "#1E7B4D" : score >= 60 ? "#5187BF" : "#B07500";
  const circ = 2 * Math.PI * 52;
  const dash = (score / 100) * circ;
  const gText = GRADE_TEXT[grade];

  const itemRows = items.map(it =>
    `<tr><td>${it.mod}</td><td>${it.name}</td><td><span class="tag t${it.grade === "I" ? "I" : it.grade}">${it.grade === "I" ? "—" : it.grade}</span></td><td style="font-size:12.5px;color:#555">${it.desc}</td></tr>`
  ).join("");

  const scoreRows = fileScore.rows.map(r =>
    `<tr><td>${r.mod}</td><td>${r.label}</td><td style="color:${r.tierLabel.startsWith("增强") ? "#1E7B4D" : "#00355F"};font-weight:600">${r.tierLabel}</td><td style="font-size:12.5px">${r.status}</td><td style="font-weight:700">${r.got > 0 ? "+" + r.got : "0"}</td></tr>`
  ).join("");

  const actionItems = actions.length === 0
    ? '<div style="font-size:13px;color:#555">无待办事项，请按文件编制清单核对成册。</div>'
    : `<ul class="actions">${actions.map(a =>
        `<li><span class="tag t${a.grade}" style="margin-right:8px">${a.grade}</span>${a.text}${a.orgs.length > 0 ? ` <span style="font-size:12px;color:#1E7B4D">可寻求协助：${a.orgs.join("/")}</span>` : ""}</li>`
      ).join("")}</ul>`;

  const missCoreHtml = fileScore.missCore.length > 0
    ? `<div style="font-weight:700;color:#B03A2E;margin:6px 0">必备材料缺件（影响核心齐备度，请催办补齐）：</div><ul style="margin:4px 0 12px 20px;font-size:13px">${fileScore.missCore.map(m => `<li>${m.label}（核心 ${m.weight} 分）</li>`).join("")}</ul>`
    : `<div style="color:#1E7B4D;font-weight:700;margin:6px 0">必备材料：核心层材料已全部上传。</div>`;

  const missEnhHtml = fileScore.missEnh.length > 0
    ? `<div style="font-weight:700;color:#B07500;margin:8px 0">增强材料未提交（不扣分，提交每件 +1 分）：</div><ul style="margin:4px 0 12px 20px;font-size:13px;color:#555">${fileScore.missEnh.map(n => `<li>${n}</li>`).join("")}</ul>`
    : "";

  const maskNote = fileScore.maskN > 0
    ? `<div style="font-size:12px;color:#7A8CA0;margin-top:8px">*含脱敏文件 ${fileScore.maskN} 件（核心层，合计权重 ${fileScore.maskW} 分），按 80% 口径折算核心参考分 ${fileScore.refScore}，供审查环节了解材料完整性时参考：${fileScore.maskNames.join("、")}。</div>`
    : "";

  const docRows = docs.map(d => `<tr><td>${d.file}</td><td style="font-size:12.5px;color:#555">${d.form}</td></tr>`).join("");

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${projectName} - 合规自查报告</title>
<style>
:root{--navy:#00355F;--mid:#5187BF;--light:#E8EFF7;--line:#C9D8E8;--ok:#1E7B4D;--warn:#B07500;--bad:#B03A2E;--ink:#22303C}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Songti SC","STKaiti","Kaiti SC","Microsoft YaHei",serif;background:#F4F7FA;color:var(--ink);line-height:1.7;padding:20px}
.wrap{max-width:900px;margin:0 auto}
.card{background:#fff;border:1px solid var(--line);border-radius:8px;padding:20px 22px;margin-bottom:18px;box-shadow:0 1px 3px rgba(0,53,95,.06)}
.card h2{color:var(--navy);font-size:17px;border-bottom:2px solid var(--light);padding-bottom:8px;margin:0 0 12px}
.pathline{background:var(--light);border:1px solid var(--line);border-radius:6px;padding:8px 14px;color:var(--navy);margin-bottom:6px;font-size:13.5px}
.grade-hero{display:flex;justify-content:center;align-items:center;gap:48px;padding:24px 10px 16px;flex-wrap:wrap}
.grade-badge{width:96px;height:96px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:800;color:#fff;margin:0 auto 10px}
.glabel{font-size:16px;font-weight:700;color:var(--navy);text-align:center}
.gdesc{font-size:13px;max-width:320px;color:#555;text-align:center;margin:4px auto 0}
.ringwrap{position:relative;width:120px;height:120px;margin:0 auto 10px}
.ringwrap svg{transform:rotate(-90deg)}
.ringnum{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}
th{background:var(--navy);color:#fff;padding:8px 10px;font-weight:600;text-align:left;font-size:12.5px}
td{border:1px solid var(--line);padding:8px 10px;vertical-align:top;font-size:13px}
tr:nth-child(even) td{background:var(--light)}
.tag{display:inline-block;min-width:26px;text-align:center;border-radius:4px;color:#fff;font-weight:700;padding:1px 8px;font-size:12.5px}
.tA{background:var(--ok)}.tB{background:var(--mid)}.tC{background:var(--warn)}.tD{background:var(--bad)}.tI{background:#7A8CA0}
.actions{margin:4px 0 0 20px;font-size:14px}.actions li{margin-bottom:6px}
.disclaimer{font-size:12.5px;color:#7A8CA0;border-top:1px solid var(--line);padding-top:12px;margin-top:16px;line-height:1.7}
@media print{@page{size:A4;margin:14mm}body{background:#fff;padding:0}.card{page-break-inside:avoid;box-shadow:none}th,.tag,.grade-badge,.pathline{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="wrap">
<div class="card">
<h2>企业境外投资自查报告</h2>
<div class="pathline"><b>定位声明：</b>本自查为自愿性辅导工具，不是申报条件，任何档位均可依法申报。</div>
<div class="pathline">${pathLine}</div>
${routeLine ? `<div class="pathline">${routeLine}</div>` : ""}
<div class="pathline" style="font-size:12.5px;color:#7A8CA0">${ackLine}</div>
<div class="grade-hero">
<div style="text-align:center">
<div class="grade-badge" style="background:${GCOLOR[grade]}">${grade}</div>
<div class="glabel">自查判断等级 ${grade}——${gText[0]}</div>
<div class="gdesc">${gText[1]}（总档按"就低原则"确定）</div>
</div>
<div style="text-align:center">
<div class="ringwrap">
<svg width="120" height="120"><circle cx="60" cy="60" r="52" fill="none" stroke="#E4EBF2" stroke-width="10"/><circle cx="60" cy="60" r="52" fill="none" stroke="${ringColor}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${dash} ${circ}"/></svg>
<div class="ringnum"><span style="font-size:34px;font-weight:800;color:#22303C">${score}</span><span style="font-size:11px;color:#7A8CA0">核心齐备度</span></div>
</div>
<div class="glabel">核心齐备度（双层制）</div>
<div class="gdesc">核心层满分 100${fileScore.maxAvail < 100 ? `，本次实际可得上限 ${fileScore.maxAvail}` : ""} · 增强加分 +${Math.min(fileScore.enhScore, fileScore.enhCap)} 分（上限 ${fileScore.enhCap}）</div>
</div>
</div>
<div class="pathline" style="background:#FFF9EC;border-color:#EAD9A8;color:#6B5417">${comboText}</div>
<table><thead><tr><th style="width:14%">模块</th><th style="width:32%">自查事项</th><th style="width:9%">档位</th><th style="width:45%">说明</th></tr></thead><tbody>${itemRows}</tbody></table>
</div>
<div class="card">
<h2>文件齐备度明细（核心 + 增强双层 · 按模块列示）</h2>
<table><thead><tr><th style="width:13%">模块</th><th style="width:44%">应准备文件</th><th style="width:11%">层级/权重</th><th style="width:22%">状态</th><th style="width:10%">得分</th></tr></thead><tbody>${scoreRows}</tbody></table>
${maskNote}
</div>
<div class="card">
<h2>缺件清单与行动建议（按 D→C→B 优先级）</h2>
${missCoreHtml}${missEnhHtml}
<div style="font-weight:700;color:#22303C;margin:12px 0 6px;border-top:1px solid #C9D8E8;padding-top:12px">行动建议：</div>
${actionItems}
</div>
<div class="card">
<h2>文件编制清单（按投资方式分支输出）</h2>
<table><thead><tr><th style="width:70%">应编制文件</th><th style="width:30%">形式要件</th></tr></thead><tbody>${docRows}</tbody></table>
</div>
<div class="disclaimer">双层声明：本报告由自查系统按企业填报的客观事实自动生成，不构成法律意见；自查结果不代表主管机关审批结论，最终以主管机关依法审查为准。文件齐备度分数仅反映材料齐备程度，不代表合规结论；本演示版上传文件仅读取文件名、内容不上传不留存。</div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},300)};</script>
</body></html>`;
}
