import { useState } from "react";
import { RobotAvatar, ChatInputBar } from "./WelcomeFrame";

const INFO_FIELDS = [
  "投资方式",
  "境外主体类型",
  "法定代表人",
  "投资目的地",
  "投资金额及币种",
  "决策机构",
  "境外企业中文名称",
  "境外企业外文名称",
  "主管部门/集团总部",
  "基本事由",
  "项目简况",
];

function GreenCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="9" fill="#58D479" />
      <path d="M5 9L7.5 11.5L13 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
      <rect y="0" width="18" height="2" rx="1" fill="#6b8ab0" />
      <rect y="6" width="18" height="2" rx="1" fill="#6b8ab0" />
      <rect y="12" width="18" height="2" rx="1" fill="#6b8ab0" />
    </svg>
  );
}

function DocListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="10" height="13" rx="1" stroke="#1a2744" strokeWidth="1.2" />
      <path d="M5 5H9M5 8H9M5 11H7" stroke="#1a2744" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}


interface Props {
  goTo?: (f: string) => void;
  onSkipToUpload?: () => void;
}

// Maps INFO_FIELDS labels to the form state keys that should populate them
const FIELD_STATE_MAP: Record<string, string> = {
  "投资方式": "investMethod",
  "境外主体类型": "entityType",
  "投资目的地": "destination",
  "投资金额及币种": "amount",
};

export function OdiDaibanPage({ goTo, onSkipToUpload }: Props) {
  const [inputVal, setInputVal] = useState("");
  const [investMethod, setInvestMethod] = useState("");
  const [entityType, setEntityType] = useState("");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const formValues: Record<string, string> = { investMethod, entityType, destination, amount };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}>
      {/* Left: chat area */}
      <div style={{
        display: "flex", flexDirection: "column", flex: 1, minWidth: 0,
        padding: "16px 12px 0 4px", overflow: "hidden",
      }}>
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Single unified AI bubble containing all 3 modules */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <RobotAvatar size={42} />
            <div style={{
              flex: 1, background: "#fff", borderRadius: 12,
              boxShadow: "0 2px 12px rgba(26,64,140,0.07)", border: "1px solid #e8f0fe",
              overflow: "hidden",
            }}>
              {/* Module 1: Status row */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e8f0fe",
                background: "#F2FEFC",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <GreenCheckIcon />
                  <span style={{ fontSize: 14, color: "#58D479", fontWeight: 600 }}>ODI 导办已启动</span>
                </div>
                <span style={{ fontSize: 13, color: "#8f9fae" }}>正在同步材料清单</span>
              </div>

              {/* Module 2: Description */}
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #e8f0fe" }}>
                <p style={{ fontSize: 13, color: "#2d3644", lineHeight: 1.85, margin: 0 }}>
                  ODI 导模式已启动。您可以浏览完整的备案材料清单、下载各类模板文件进行准备。如需更精准的清单推荐，可选择填写以下信息：投资方式、境外主体类型、投资目的地、投资金额。填写后右侧模板将同步更新。
                </p>
              </div>

              {/* Module 3: 信息填写 form */}
              <div>
                {/* Section header */}
                <div style={{
                  padding: "10px 18px",
                  background: "#EEF4FE",
                  borderBottom: "1px solid #e8f0fe",
                }}>
                  <span style={{ fontSize: 15, color: "#1a60c6", fontWeight: 700 }}>信息填写</span>
                </div>

                {/* Form fields */}
                <div style={{ padding: "16px 18px 0" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
                    {/* 投资方式 */}
                    <div>
                      <p style={{ fontSize: 13, color: "#2d3644", marginBottom: 6 }}>投资方式</p>
                      <div style={{ position: "relative" }}>
                        <select
                          value={investMethod}
                          onChange={(e) => setInvestMethod(e.target.value)}
                          style={{
                            width: "100%", padding: "9px 32px 9px 12px",
                            borderRadius: 6, border: "1px solid #CBE1FE",
                            background: "#FCFDFF", color: investMethod ? "#272a38" : "#8f9fae", fontSize: 14,
                            appearance: "none", cursor: "pointer", outline: "none",
                            fontFamily: "inherit",
                          }}
                        >
                          <option value="">请选择</option>
                          <option>新设</option>
                          <option>并购</option>
                          <option>增资</option>
                          <option>其他</option>
                          <option>暂不确定</option>
                        </select>
                        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="#707070" strokeLinecap="round" /></svg>
                        </span>
                      </div>
                    </div>

                    {/* 境外主体类型 */}
                    <div>
                      <p style={{ fontSize: 13, color: "#2d3644", marginBottom: 6 }}>境外主体类型</p>
                      <div style={{ position: "relative" }}>
                        <select
                          value={entityType}
                          onChange={(e) => setEntityType(e.target.value)}
                          style={{
                            width: "100%", padding: "9px 32px 9px 12px",
                            borderRadius: 6, border: "1px solid #CBE1FE",
                            background: "#FCFDFF", color: entityType ? "#272a38" : "#8f9fae", fontSize: 14,
                            appearance: "none", cursor: "pointer", outline: "none",
                            fontFamily: "inherit",
                          }}
                        >
                          <option value="">请选择</option>
                          <option>子公司</option>
                          <option>分公司</option>
                          <option>办事处</option>
                          <option>暂不确定</option>
                        </select>
                        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="#707070" strokeLinecap="round" /></svg>
                        </span>
                      </div>
                    </div>

                    {/* 投资目的地 */}
                    <div>
                      <p style={{ fontSize: 13, color: "#2d3644", marginBottom: 6 }}>投资目的地</p>
                      <input
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="请输入"
                        style={{
                          width: "100%", padding: "9px 12px",
                          borderRadius: 6, border: "1px solid #CBE1FE",
                          background: "#FCFDFF", color: "#272a38", fontSize: 14,
                          outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                        }}
                      />
                    </div>

                    {/* 投资金额及币种 */}
                    <div>
                      <p style={{ fontSize: 13, color: "#2d3644", marginBottom: 6 }}>投资金额及币种</p>
                      <input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="请输入"
                        style={{
                          width: "100%", padding: "9px 12px",
                          borderRadius: 6, border: "1px solid #CBE1FE",
                          background: "#FCFDFF", color: "#272a38", fontSize: 14,
                          outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  {/* Skip button */}
                  <button
                    onClick={onSkipToUpload}
                    style={{
                      width: "100%", marginTop: 16, marginBottom: 18,
                      padding: "12px 0", borderRadius: 6, border: "none", cursor: "pointer",
                      background: "linear-gradient(90deg, #1A4CA9 0%, #1E6EE7 100%)",
                      color: "#fff", fontSize: 16, fontWeight: 700,
                    }}
                  >
                    跳过，直接生成通用清单
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ChatInputBar value={inputVal} onChange={setInputVal} onSend={() => setInputVal("")} />
      </div>

      {/* Right: info panel */}
      <div style={{ flexShrink: 0, padding: "12px 12px 12px 0", width: 340 }}>
        <div style={{
          height: "100%", borderRadius: 12, overflow: "hidden",
          boxShadow: "0 2px 16px rgba(26,64,140,0.10)", border: "1px solid #dde9f7",
          display: "flex", flexDirection: "column", background: "#F8FAFF",
        }}>
          {/* Header */}
          <div style={{
            background: "#fff",
            borderBottom: "1px solid #e8f0fe",
            padding: "0 16px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, background: "#f0f4ff",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <DocListIcon />
              </div>
              <span style={{ fontSize: 16, color: "#1a2744", fontWeight: 700 }}>ODI 工作台</span>
            </div>
            <HamburgerIcon />
          </div>

          {/* Description */}
          <div style={{ padding: "12px 16px", background: "#fff", borderBottom: "1px solid #e8f0fe", flexShrink: 0 }}>
            <p style={{ fontSize: 12, color: "#5b5b5b", lineHeight: 1.7, margin: 0 }}>
              ODI导办仅提供材料清单参考与模板下载，不进行身份认证与实际材料生成，如需正式办理，请切换至助办模式。
            </p>
          </div>

          {/* 信息采集中 label */}
          <div style={{ padding: "10px 16px", background: "#EEF4FE", borderBottom: "1px solid #dde9f7", flexShrink: 0 }}>
            <span style={{ fontSize: 14, color: "#1a60c6", fontWeight: 700 }}>信息采集中</span>
          </div>

          {/* Info section */}
          <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "12px 14px" }}>
            {INFO_FIELDS.map((field, i) => {
              const stateKey = FIELD_STATE_MAP[field];
              const value = stateKey ? formValues[stateKey] : "";
              const isFilled = !!value;
              return (
                <div
                  key={field}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    padding: "8px 0",
                    borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#f0f4fb",
                    borderTopWidth: 0, borderTopStyle: "solid", borderTopColor: "transparent",
                    borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent",
                    borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent",
                  }}
                >
                  <p style={{ fontSize: 11, color: "#6b8ab0", flex: 1 }}>{field}</p>
                  <span style={{
                    fontSize: 10, fontWeight: 600, whiteSpace: "nowrap",
                    color: isFilled ? "#1a5bc6" : "#ea580c",
                    maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {isFilled ? value : "待补充"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
