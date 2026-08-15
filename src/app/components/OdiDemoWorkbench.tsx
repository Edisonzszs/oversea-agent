import { useState } from "react";
import { ConfirmTabContent } from "./OdiAssistantWorkbench";

interface Props {
  onClose?: () => void;
  demoFields?: Record<string, string>;
}

const FIELD_SECTIONS = [
  {
    title: "基础信息",
    fields: ["投资方式", "设立方式", "注册资本", "投资货币", "法定代表人"],
  },
  {
    title: "投资信息",
    fields: ["投资目标国家/地区", "所属行业及细分领域", "投资金额（折合人民币）"],
  },
  {
    title: "境外主体信息",
    fields: ["境外企业中文名称", "境外企业英文名称", "境外企业注册地", "投资人"],
  },
];

type DemoTab = "mapping" | "progress";

export function OdiDemoWorkbench({ onClose, demoFields = {} }: Props) {
  const [activeTab, setActiveTab] = useState<DemoTab>("mapping");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true, 1: true, 2: true });

  return (
    <div style={{ width: 400, height: "100%", background: "#fff", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 2px 16px rgba(26,64,140,0.10)" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px 0 16px", borderBottom: "1px solid #e8f0fe", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "#fffbeb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1a2744", flex: 1 }}>ODI 工作台</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 20, background: "#fffbeb", border: "1px solid #fde68a" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "#d97706", fontWeight: 600 }}>填报演示</span>
          </div>
          <button onClick={onClose} title="返回对话" style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
            {[0, 1, 2].map(i => <span key={i} style={{ display: "block", width: 14, height: 1.5, background: "#6b8ab0", borderRadius: 1 }} />)}
          </button>
        </div>

        <div style={{ display: "flex" }}>
          {[{ key: "mapping" as DemoTab, label: "字段与材料映射" }, { key: "progress" as DemoTab, label: "当前生成进度" }].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              flex: 1, padding: "8px 0", fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? "#1a5bc6" : "#6b8ab0",
              background: "transparent", border: "none", cursor: "pointer",
              borderBottom: activeTab === tab.key ? "2px solid #1a5bc6" : "2px solid transparent",
              transition: "all 0.15s",
            }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "none", padding: "12px 14px 16px" }}>
        {activeTab === "mapping" ? (
          <div>
            {FIELD_SECTIONS.map((section, si) => (
              <div key={si} style={{ marginBottom: 12, borderRadius: 8, border: "1px solid #e8f0fe", overflow: "hidden" }}>
                <button
                  onClick={() => setExpanded(prev => ({ ...prev, [si]: !prev[si] }))}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: "#f0f6ff", border: "none", cursor: "pointer" }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1a5bc6" }}>{section.title}</span>
                  <svg width="11" height="7" viewBox="0 0 12 8" fill="none" style={{ transform: expanded[si] ? "rotate(180deg)" : "none", transition: "0.2s", flexShrink: 0 }}>
                    <path d="M1 1l5 5 5-5" stroke="#1a5bc6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {expanded[si] && (
                  <div style={{ padding: "4px 0" }}>
                    {section.fields.map((fieldLabel, fi) => {
                      const filled = demoFields[fieldLabel];
                      return (
                        <div key={fi} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "7px 12px",
                          borderBottom: fi < section.fields.length - 1 ? "1px solid #f3f4f6" : "none",
                          background: filled ? "#f0fdf4" : "transparent",
                          transition: "background 0.3s",
                        }}>
                          <span style={{ fontSize: 12, color: "#3a4f72", flex: 1, minWidth: 0 }}>{fieldLabel}</span>
                          {filled ? (
                            <span style={{ fontSize: 11, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", marginLeft: 6 }}>{filled}</span>
                          ) : (
                            <span style={{ fontSize: 11, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap" }}>待填写</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <ConfirmTabContent generateState="done" hideUploaded />
        )}
      </div>
    </div>
  );
}
