// 使用反馈问卷 —— 右下角 FAB + 全屏浮层问卷(速测版/完整版共用)。
// 文案与流程照 20260813 交付稿「对外文案总表」第三章改版后口径:
//   身份 4 选项 / 10 项打分(5-1,可备注) / 6 道开放题 / 生成反馈意见 → 复制反馈内容。
// 填写内容在组件实例 state,关闭再打开不丢;浮层 createPortal 到 body 防裁切。

import { useState } from "react";
import { createPortal } from "react-dom";
import { C } from "../complianceTheme";

// 交付稿 FB_SCORE(改版后) —— 10 项打分题
const FB_SCORE = [
  "问题表述是否清楚易懂（企业无需法律背景即可回答）",
  "题量与用时是否可接受（必要最小原则）",
  "\"回答事实→系统判档\"的方式是否合理、结果是否符合预期",
  "\"分析依据\"法条框是否有帮助、内容是否准确",
  "投资方式分支（新设/并购/变更）划分是否清晰",
  "报告页（档位、缺失材料、行动建议、文件编制清单）是否可用",
  "行业与国别提示的深度是否合适（过深/合适/过浅请在备注注明）",
  "\"我可以咨询谁\"入口的出现时机与措辞是否得当（有无推销感）",
  "与实际申报要求的吻合度（按您了解的情况判断）",
  "总体推荐度：是否会建议其他企业在申报前使用",
];
// 交付稿 FB_OPEN(改版后) —— 6 道开放题
const FB_OPEN = [
  "您在填写过程中卡壳或产生歧义的题目是哪几道？具体哪里不清楚？",
  "按您了解的情况，哪些审批端实际会看的事项本表没有问到？（漏项）",
  "哪些题目您认为超出投前自查必要范围、建议删除或挪到投后？（冗项）",
  "判档结果与您的理解或预期不一致的地方？（请举例：题目+应判的档位+理由）",
  "如果只能改一处，您最希望改哪里？",
  "其他建议（界面、流程、措辞、报告形态等）：",
];
const FB_ROLES = ["拟申报企业经办人", "已备案企业经办人", "专业服务机构人员", "其他"];

interface Props {
  /** FAB 距右边缘(px)——默认 24;嵌伴填栏的页面传 384 避让 */
  right?: number;
}

export function FeedbackFab({ right = 24 }: Props) {
  const [open, setOpen] = useState(false);
  // 问卷数据(实例级:关闭再开不丢)
  const [role, setRole] = useState("");
  const [date, setDate] = useState("");
  const [minutes, setMinutes] = useState("");
  const [scores, setScores] = useState<(string | null)[]>(Array(FB_SCORE.length).fill(null));
  const [notes, setNotes] = useState<string[]>(Array(FB_SCORE.length).fill(""));
  const [opens, setOpens] = useState<string[]>(Array(FB_OPEN.length).fill(""));
  const [fbText, setFbText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const complete =
    !!role &&
    scores.every(s => s != null) &&
    opens.every(t => t.trim().length > 0);

  const hint = complete ? "✓ 已填写完整，可生成反馈意见" : "填写完整后点亮（身份 + 10项打分 + 6道开放题）";

  const gen = () => {
    const L: string[] = [];
    L.push("【ODI合规自查工具 · 使用反馈问卷】");
    L.push("填写人身份：" + (role || "（未选）"));
    L.push("填写日期：" + (date || "（未填）") + "　用时约：" + (minutes || "—") + "分钟");
    L.push("");
    L.push("一、结构化评价（5非常好～1很差）");
    FB_SCORE.forEach((q, i) => {
      const note = notes[i]?.trim();
      L.push(`${i + 1}. ${q}　打分：${scores[i] ?? "（未选）"}${note ? "　备注：" + note : ""}`);
    });
    L.push("");
    L.push("二、开放式反馈");
    FB_OPEN.forEach((q, i) => {
      L.push(`${i + 1}. ${q}`);
      L.push("   → " + (opens[i]?.trim() || "（未填）"));
    });
    setFbText(L.join("\n"));
    setCopied(false);
    setTimeout(() => {
      document.getElementById("fb-out-card")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 30);
  };

  const copy = async () => {
    if (!fbText) return;
    try { await navigator.clipboard.writeText(fbText); } catch {
      const ta = document.getElementById("fb-text") as HTMLTextAreaElement | null;
      if (ta) { ta.select(); try { document.execCommand("copy"); } catch { /* ignore */ } }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <>
      {/* FAB */}
      <button onClick={() => setOpen(true)} title="使用反馈问卷"
        style={{ position: "fixed", right, bottom: 24, zIndex: 9000, background: C.primary, color: "#fff", border: "none", borderRadius: 28, padding: "12px 22px", fontSize: 15, fontWeight: 700, boxShadow: "0 4px 16px rgba(26,91,198,0.42)", cursor: "pointer", display: "inline-flex", alignItems: "center", transition: "background .15s", fontFamily: "inherit" }}
        onMouseEnter={e => (e.currentTarget.style.background = C.primaryHover)} onMouseLeave={e => (e.currentTarget.style.background = C.primary)}>
        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#f0a020", marginRight: 8 }} />
        反馈问卷
      </button>

      {/* 浮层 */}
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10030, background: "rgba(15,23,42,0.45)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 24, overflow: "auto", fontFamily: '"Microsoft YaHei","PingFang SC",sans-serif' }}>
          <div style={{ background: "#fff", maxWidth: 900, width: "100%", borderRadius: 14, boxShadow: "0 12px 44px rgba(0,0,0,0.3)", margin: "auto", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 48px)" }}
            onClick={e => e.stopPropagation()}>

            {/* 头部 */}
            <div style={{ position: "sticky", top: 0, background: C.primary, color: "#fff", padding: "13px 18px", borderRadius: "14px 14px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, zIndex: 1 }}>
              <b style={{ fontSize: 16 }}>使用反馈问卷</b>
              <button onClick={() => setOpen(false)}
                style={{ background: "#fff", color: C.primary, border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>← 返回继续填写</button>
            </div>

            {/* 主体 */}
            <div style={{ padding: "14px 22px", overflowY: "auto" }}>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.8, margin: "4px 0 6px" }}>
                您可在填写的<b>任何一步</b>点开本问卷记录使用体验，填好后点"返回继续填写"回到原处继续，内容会<b>保留</b>。全部必填项（标 <span style={{ color: "#c0392b", fontWeight: 700 }}>*</span>）填完后，底部"生成反馈意见"按钮点亮，即可生成可复制的反馈。<b>问卷信息仅用于本工具优化，不作他用</b>。
              </div>

              {/* 一、填写人信息 */}
              <FbSec>一、填写人信息</FbSec>
              <FbQ>
                <FbStem req>您的身份：</FbStem>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {FB_ROLES.map(r => (
                    <label key={r} style={{ fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <input type="radio" name="fb_role" checked={role === r} onChange={() => setRole(r)} />{r}
                    </label>
                  ))}
                </div>
              </FbQ>
              <FbQ>
                <FbStem>填写日期与用时（可选）：</FbStem>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13.5, color: C.ink }}>
                  <span>填写日期 <input type="date" value={date} onChange={e => setDate(e.target.value)} style={metaInput} /></span>
                  <span>全表用时约 <input type="number" min={0} value={minutes} onChange={e => setMinutes(e.target.value)} style={{ ...metaInput, width: 64 }} />　分钟</span>
                </div>
              </FbQ>

              {/* 二、结构化评价 */}
              <FbSec>二、结构化评价（请逐项打分：5非常好　4好　3一般　2较差　1很差）</FbSec>
              {FB_SCORE.map((q, i) => (
                <FbQ key={i}>
                  <FbStem req>{i + 1}. {q}</FbStem>
                  <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                    {["5", "4", "3", "2", "1"].map(v => (
                      <label key={v} style={{ fontSize: 13, color: C.ink, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <input type="radio" name={`fb_s${i}`} checked={scores[i] === v} onChange={() => setScores(prev => prev.map((x, j) => (j === i ? v : x)))} />{v}
                      </label>
                    ))}
                    <span style={{ color: C.muted, fontSize: 12 }}>（5非常好 · 1很差）</span>
                  </div>
                  <input value={notes[i]} onChange={e => setNotes(prev => prev.map((x, j) => (j === i ? e.target.value : x)))} placeholder="备注（可选）" style={{ ...noteInput, display: "block", marginTop: 4 }} />
                </FbQ>
              ))}

              {/* 三、开放式反馈 */}
              <FbSec>三、开放式反馈</FbSec>
              {FB_OPEN.map((q, i) => (
                <FbQ key={i}>
                  <FbStem req>{i + 1}. {q}</FbStem>
                  <textarea value={opens[i]} onChange={e => setOpens(prev => prev.map((x, j) => (j === i ? e.target.value : x)))} style={openInput} />
                </FbQ>
              ))}

              {/* 生成结果 */}
              {fbText && (
                <div id="fb-out-card" style={{ marginTop: 14, background: "#f4faf6", border: `1px solid ${C.okBorder}`, borderLeft: `4px solid ${C.ok}`, borderRadius: 8, padding: "12px 14px" }}>
                  <b style={{ color: C.ok }}>✓ 反馈意见已生成</b>　请点"复制反馈内容"，粘贴到邮件或消息中发回即可。
                  <textarea id="fb-text" readOnly value={fbText} onChange={() => {}} style={{ ...openInput, marginTop: 8, minHeight: 220, lineHeight: 1.6, background: "#fbfdff", borderColor: C.primary }} />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <button onClick={copy}
                      style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 6, padding: "9px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{copied ? "已复制 ✓" : "复制反馈内容"}</button>
                  </div>
                </div>
              )}
            </div>

            {/* 底部 */}
            <div style={{ position: "sticky", bottom: 0, background: "#eef3f9", borderTop: "1px solid #dfe6ef", padding: "12px 18px", borderRadius: "0 0 14px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: C.muted }}>{hint}</span>
              <button onClick={gen} disabled={!complete}
                style={{ background: complete ? C.primary : "#b8c4d2", color: "#fff", border: "none", borderRadius: 6, padding: "9px 20px", fontSize: 15, fontWeight: 700, cursor: complete ? "pointer" : "not-allowed", fontFamily: "inherit" }}>生成反馈意见</button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

// ─── 小原语 ────────────────────────────────────────────────────────────────
function FbSec({ children }: { children: React.ReactNode }) {
  return <div style={{ margin: "14px 0 4px", fontWeight: 700, color: C.primary, fontSize: 15.5, borderLeft: `4px solid ${C.primary}33`, paddingLeft: 8 }}>{children}</div>;
}
function FbQ({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "8px 0", borderBottom: `1px dashed ${C.line}` }}>{children}</div>;
}
function FbStem({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return <div style={{ fontSize: 14, marginBottom: 5, color: C.ink }}>{req && <span style={{ color: "#c0392b", fontWeight: 700 }}>* </span>}{children}</div>;
}
const metaInput: React.CSSProperties = { border: `1px solid ${C.line}`, borderRadius: 4, padding: "3px 6px", fontSize: 13, fontFamily: "inherit" };
const noteInput: React.CSSProperties = { width: "100%", maxWidth: 520, padding: "4px 6px", border: `1px solid ${C.line}`, borderRadius: 4, fontSize: 13, fontFamily: "inherit", outline: "none" };
const openInput: React.CSSProperties = { width: "100%", minHeight: 52, padding: "6px 8px", border: `1px solid ${C.line}`, borderRadius: 5, fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" };
