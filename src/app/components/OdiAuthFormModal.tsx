import { useState } from "react";

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export function OdiAuthFormModal({ onConfirm, onCancel }: Props) {
  const [licenseUploaded, setLicenseUploaded] = useState(false);
  const [idNumber, setIdNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");

  const completed = [licenseUploaded, idNumber.trim().length > 0 && birthDate.trim().length > 0, phone.trim().length >= 11].filter(Boolean).length;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onCancel}
    >
      <div
        style={{ width: 520, background: "#fff", borderRadius: 16, padding: "28px 32px 28px", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5L2 4v4c0 3.3 2.6 5.8 6 6.5 3.4-.7 6-3.2 6-6.5V4L8 1.5z" stroke="#1a5bc6" strokeWidth="1.4" fill="none"/>
                <path d="M5.5 8l2 2 3-3" stroke="#1a5bc6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 17, fontWeight: 700, color: "#1a2744" }}>进入 ODI 申报助办</span>
          </div>
          <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="#8a9bbf" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        {(() => {
          const steps = [
            { label: "营业执照", done: licenseUploaded },
            { label: "法人身份证", done: idNumber.trim().length > 0 && birthDate.trim().length > 0 },
            { label: "手机验证", done: phone.trim().length >= 11 },
          ];
          return (
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", marginBottom: 24 }}>
              {steps.map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: step.done ? "#1a5bc6" : "#e8f0fe",
                      color: step.done ? "#fff" : "#1a5bc6",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700,
                      transition: "background 0.3s ease, color 0.3s ease",
                      boxShadow: step.done ? "0 0 0 3px rgba(26,91,198,0.15)" : "none",
                    }}>
                      {step.done ? (
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path d="M3 7l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : i + 1}
                    </div>
                    <span style={{ fontSize: 11, color: step.done ? "#1a5bc6" : "#6b8ab0", fontWeight: step.done ? 600 : 400, transition: "color 0.3s" }}>{step.label}</span>
                  </div>
                  {i < 2 && (
                    <div style={{ width: 80, height: 3, borderRadius: 2, background: "#e2eaf5", margin: "0 4px", marginBottom: 18, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 2,
                        background: "linear-gradient(90deg,#2563eb,#1a4ca8)",
                        width: steps[i].done ? "100%" : "0%",
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Progress hint */}
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "#f8faff", borderLeft: "3px solid #1a5bc6", marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: "#3a4f72" }}>进入申报助办前，请完成以下准备。已填写 <span style={{ color: "#1a5bc6", fontWeight: 700 }}>{completed}/3</span> 项。</p>
        </div>

        {/* Company info */}
        <div style={{ padding: "12px 14px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 4 }}>已识别企业信息</p>
          <p style={{ fontSize: 13, color: "#166534" }}>上海某科技有限公司 · 91310000XXXXXXXXXX</p>
        </div>

        {/* Section 1: 营业执照 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: licenseUploaded ? "#1a5bc6" : "#e8f0fe", color: licenseUploaded ? "#fff" : "#1a5bc6", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>1</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1a2744" }}>营业执照认证</span>
            </div>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>用于确认企业主体信息</span>
          </div>
          {licenseUploaded ? (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#22c55e"/><path d="M5 8l2.5 2.5 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <span style={{ fontSize: 13, color: "#166534" }}>营业执照已上传</span>
              <button onClick={() => setLicenseUploaded(false)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#94a3b8" }}>重新上传</button>
            </div>
          ) : (
            <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "14px", borderRadius: 8, border: "1.5px dashed #93c5fd", background: "#f8fbff", cursor: "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a5bc6" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span style={{ fontSize: 13, color: "#1a5bc6" }}>点击上传营业执照（JPG / PDF / DOCX）</span>
              <input type="file" style={{ display: "none" }} accept=".jpg,.jpeg,.pdf,.docx" onChange={() => setLicenseUploaded(true)} />
            </label>
          )}
        </div>

        {/* Section 2: 法人身份证 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: (idNumber.trim().length > 0 && birthDate.trim().length > 0) ? "#1a5bc6" : "#e8f0fe", color: (idNumber.trim().length > 0 && birthDate.trim().length > 0) ? "#fff" : "#1a5bc6", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>2</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1a2744" }}>法人身份证信息</span>
            </div>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>用于完成法人身份核验</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="身份证号码"
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #dde9f7", fontSize: 13, color: "#1a2744", outline: "none", background: "#fafcff" }}
            />
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              style={{ width: 150, padding: "10px 12px", borderRadius: 8, border: "1px solid #dde9f7", fontSize: 13, color: birthDate ? "#1a2744" : "#94a3b8", outline: "none", background: "#fafcff" }}
            />
          </div>
        </div>

        {/* Section 3: 手机号 */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: phone.trim().length >= 11 ? "#1a5bc6" : "#e8f0fe", color: phone.trim().length >= 11 ? "#fff" : "#1a5bc6", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>3</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1a2744" }}>经办人手机号</span>
            </div>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>用于确认当前办理人联系方式</span>
          </div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="手机号码"
            maxLength={11}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #dde9f7", fontSize: 13, color: "#1a2744", outline: "none", background: "#fafcff", boxSizing: "border-box" }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px 0", borderRadius: 10, background: "#fff", color: "#3a4f72", fontSize: 14, fontWeight: 500, cursor: "pointer", border: "1px solid #dde9f7" }}>
            取消
          </button>
          <button
            onClick={completed === 3 ? onConfirm : undefined}
            style={{
              flex: 2, padding: "12px 0", borderRadius: 10,
              background: completed === 3 ? "linear-gradient(135deg,#2563eb,#1a4ca8)" : "#e2eaf5",
              color: completed === 3 ? "#fff" : "#94a3b8",
              fontSize: 14, fontWeight: 700, border: "none",
              cursor: completed === 3 ? "pointer" : "default",
              boxShadow: completed === 3 ? "0 4px 12px rgba(37,99,235,0.3)" : "none",
              transition: "all 0.2s",
            }}
          >
            {completed === 3 ? "进入申报助办" : `已完成 ${completed}/3 项`}
          </button>
        </div>
      </div>
    </div>
  );
}
