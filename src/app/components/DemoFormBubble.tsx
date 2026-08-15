import { useState } from "react";
import { RobotAvatar } from "./WelcomeFrame";

const USER_AVATAR = (
  <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: "#1a5bc6", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <svg width="17" height="17" viewBox="0 0 17 17" fill="white"><circle cx="8.5" cy="6" r="3"/><path d="M2 15c0-3.5 2.9-6.5 6.5-6.5S15 11.5 15 15"/></svg>
  </div>
);

function ToggleGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt === value ? "" : opt)} style={{
          padding: "5px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer",
          background: value === opt ? "#1a5bc6" : "#fff",
          color: value === opt ? "#fff" : "#3a4f72",
          border: `1px solid ${value === opt ? "#1a5bc6" : "#dde9f7"}`,
          fontWeight: value === opt ? 600 : 400, transition: "all 0.15s",
        }}>{opt}</button>
      ))}
    </div>
  );
}

interface Props {
  onFieldChange?: (key: string, value: string) => void;
}

export function DemoFormBubble({ onFieldChange }: Props) {
  const [country, setCountry] = useState("");
  const [investType, setInvestType] = useState("");
  const [setupType, setSetupType] = useState("");
  const [regCapital, setRegCapital] = useState("");
  const [totalInvest, setTotalInvest] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [r1Amount, setR1Amount] = useState("");
  const [r1Submitted, setR1Submitted] = useState(false);
  const [r2Name, setR2Name] = useState("");
  const [r2Location, setR2Location] = useState("");
  const [r2Submitted, setR2Submitted] = useState(false);

  const notify = (key: string, val: string) => onFieldChange?.(key, val);

  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #dde9f7", fontSize: 12, color: "#1a2744", outline: "none", background: "#fff", boxSizing: "border-box" };
  const cardStyle: React.CSSProperties = { flex: 1, background: "#fff", borderRadius: 12, padding: "18px 22px", boxShadow: "0 2px 12px rgba(26,64,140,0.07)", border: "1px solid #e8f0fe" };

  return (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: "fadeSlideIn 0.4s ease" }}>
        <RobotAvatar size={42} />
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#22c55e"/><path d="M5 8l2.5 2.5 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1a2744" }}>ODI 填报演示信息确认</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
              <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 500 }}>填报演示 运行中</span>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "#3a4f72", lineHeight: 1.7, marginBottom: 16 }}>请先确认以下基础信息，系统将基于这些信息生成演示材料框架。</p>
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "#f8faff", border: "1px solid #e8f0fe", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, border: "1.5px solid #1a5bc6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="#1a5bc6" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1a2744" }}>前置信息</span>
            </div>
            <p style={{ fontSize: 12, color: "#6b8ab0", lineHeight: 1.7, marginBottom: 14 }}>为了帮你模拟匹配 ODI 材料清单和表单填写内容，请先补充以下基础信息。这些信息仅用于填报演示，不作为正式申报材料。</p>
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: "#3a4f72", marginBottom: 6 }}>投资国家/地区</p>
              <input value={country} onChange={e => { setCountry(e.target.value); notify("投资目标国家/地区", e.target.value); }} placeholder="如：新加坡、越南、美国" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: "#3a4f72", marginBottom: 6 }}>投资方式</p>
              <ToggleGroup options={["新设", "并购", "其他"]} value={investType} onChange={v => { setInvestType(v); notify("投资方式", v); }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: "#3a4f72", marginBottom: 6 }}>设立方式</p>
              <ToggleGroup options={["子公司", "分公司或代表处/办事处"]} value={setupType} onChange={v => { setSetupType(v); notify("设立方式", v); }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: "#3a4f72", marginBottom: 6 }}>注册资本</p>
              <input value={regCapital} onChange={e => { setRegCapital(e.target.value); notify("注册资本", e.target.value); }} placeholder="如：100万美元" style={inputStyle} />
            </div>
            <div>
              <p style={{ fontSize: 12, color: "#3a4f72", marginBottom: 6 }}>投资总额</p>
              <input value={totalInvest} onChange={e => { setTotalInvest(e.target.value); notify("投资金额（折合人民币）", e.target.value); }} placeholder="如：500万美元" style={inputStyle} />
            </div>
          </div>
          {!confirmed && (
            <>
              <button onClick={() => setConfirmed(true)} style={{ width: "100%", padding: "11px 0", borderRadius: 8, background: "linear-gradient(135deg,#2563eb,#1a4ca8)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", marginBottom: 8 }}>
                确认并查看演示进度
              </button>
              <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>平台仅提供申报辅助准备，不替代官方审核。</p>
            </>
          )}
        </div>
      </div>

      {confirmed && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "flex-start", animation: "fadeSlideIn 0.3s ease" }}>
            <div style={{ background: "linear-gradient(135deg,#2563eb,#1a4ca8)", borderRadius: 10, padding: "10px 18px", color: "#fff", fontSize: 13, fontWeight: 500, maxWidth: "82%", lineHeight: 1.75 }}>
              前置信息已确认：投资方式「{investType || "未填"}」、境外主体类型「{setupType || "未填"}」、投资目的地「{country || "未填"}」、投资金额「{totalInvest || "未填"}」。请根据这些信息匹配适用材料、更新表单预览，并根据当前缺失字段继续追问引导我补充。
            </div>
            {USER_AVATAR}
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: "fadeSlideIn 0.5s ease" }}>
            <RobotAvatar size={42} />
            <div style={cardStyle}>
              <p style={{ fontSize: 13, color: "#1a2744", lineHeight: 1.85, marginBottom: 12 }}>好的，已根据您确认的前置信息完成材料初步匹配：</p>
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#f0f6ff", border: "1px solid #dbeafe", marginBottom: 14 }}>
                {[
                  investType && `投资方式「${investType}」→ 已匹配：境外投资备案申请表、投资决策文件、境外投资真实性承诺书`,
                  setupType && `境外主体类型「${setupType}」→ 已匹配：股权架构图、注册登记证明文件`,
                  country && `投资目的地「${country}」→ 适用一般境外投资备案流程`,
                ].filter(Boolean).map((line, i) => (
                  <p key={i} style={{ fontSize: 12, color: "#3a4f72", lineHeight: 1.75, marginBottom: i < 2 ? 4 : 0 }}>· {line as string}</p>
                ))}
                {!investType && !setupType && !country && <p style={{ fontSize: 12, color: "#94a3b8" }}>请先填写前置信息以完成材料匹配。</p>}
              </div>
              <p style={{ fontSize: 13, color: "#1a2744", lineHeight: 1.85, marginBottom: 14 }}>
                当前 <span style={{ color: "#d97706", fontWeight: 600 }}>投资金额</span> 尚未填写，请问您本次交易的<strong>投资金额（折合人民币）</strong>预计是多少？
              </p>
              {!r1Submitted ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={r1Amount} onChange={e => setR1Amount(e.target.value)} placeholder="如：5000万人民币 / 500万美元" style={{ flex: 1, padding: "8px 10px", borderRadius: 7, border: "1px solid #dde9f7", fontSize: 12, color: "#1a2744", outline: "none" }} />
                  <button onClick={() => { if (r1Amount.trim()) { notify("投资金额（折合人民币）", r1Amount); setR1Submitted(true); } }} style={{ padding: "8px 16px", borderRadius: 7, background: "linear-gradient(135deg,#2563eb,#1a4ca8)", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>提交</button>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: "#16a34a" }}>✓ 投资金额已记录：{r1Amount}</p>
              )}
            </div>
          </div>

          {r1Submitted && (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "flex-start", animation: "fadeSlideIn 0.3s ease" }}>
                <div style={{ background: "linear-gradient(135deg,#2563eb,#1a4ca8)", borderRadius: 10, padding: "10px 18px", color: "#fff", fontSize: 13 }}>{r1Amount}</div>
                {USER_AVATAR}
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: "fadeSlideIn 0.5s ease" }}>
                <RobotAvatar size={42} />
                <div style={cardStyle}>
                  <p style={{ fontSize: 13, color: "#1a2744", lineHeight: 1.85, marginBottom: 14 }}>感谢补充！投资金额已记录。接下来请提供境外主体的基本信息：</p>
                  {!r2Submitted ? (
                    <>
                      <div style={{ marginBottom: 10 }}>
                        <p style={{ fontSize: 12, color: "#3a4f72", marginBottom: 6 }}>境外企业中文名称</p>
                        <input value={r2Name} onChange={e => setR2Name(e.target.value)} placeholder="如：美国XX科技有限公司" style={inputStyle} />
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <p style={{ fontSize: 12, color: "#3a4f72", marginBottom: 6 }}>境外企业注册地（州/城市）</p>
                        <input value={r2Location} onChange={e => setR2Location(e.target.value)} placeholder="如：加利福尼亚州 旧金山" style={inputStyle} />
                      </div>
                      <button onClick={() => { if (r2Name.trim() || r2Location.trim()) { notify("境外企业中文名称", r2Name); notify("境外企业注册地", r2Location); setR2Submitted(true); } }} style={{ padding: "8px 20px", borderRadius: 7, background: "linear-gradient(135deg,#2563eb,#1a4ca8)", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>提交</button>
                    </>
                  ) : (
                    <p style={{ fontSize: 12, color: "#16a34a" }}>✓ 境外主体信息已记录</p>
                  )}
                </div>
              </div>
            </>
          )}

          {r2Submitted && (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "flex-start", animation: "fadeSlideIn 0.3s ease" }}>
                <div style={{ background: "linear-gradient(135deg,#2563eb,#1a4ca8)", borderRadius: 10, padding: "10px 18px", color: "#fff", fontSize: 13, lineHeight: 1.75 }}>
                  {r2Name}{r2Name && r2Location ? "，" : ""}{r2Location}
                </div>
                {USER_AVATAR}
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: "fadeSlideIn 0.5s ease" }}>
                <RobotAvatar size={42} />
                <div style={cardStyle}>
                  <p style={{ fontSize: 13, color: "#1a2744", lineHeight: 1.85, marginBottom: 12 }}>很好！关键字段已基本完善，右侧字段映射已同步更新。您可以在右侧工作台查看完整字段映射和材料生成进度。</p>
                  <div style={{ padding: "10px 14px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <p style={{ fontSize: 12, color: "#166534", fontWeight: 600, marginBottom: 4 }}>已完成字段</p>
                    {[investType && `投资方式：${investType}`, setupType && `设立方式：${setupType}`, country && `投资目的地：${country}`, r1Amount && `投资金额：${r1Amount}`, r2Name && `境外企业名称：${r2Name}`, r2Location && `境外企业注册地：${r2Location}`].filter(Boolean).map((line, i) => (
                      <p key={i} style={{ fontSize: 11, color: "#3a4f72", lineHeight: 1.7 }}>· {line as string}</p>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
