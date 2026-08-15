import { useState } from "react";

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export function AuthModal({ onConfirm, onCancel }: Props) {
  const [uploaded, setUploaded] = useState(false);
  const [idNum, setIdNum] = useState("");
  const [expiry, setExpiry] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);

  const sendSms = () => {
    if (!phone || countdown > 0) return;
    setCountdown(60);
    const t = setInterval(() => setCountdown((c) => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(10,20,60,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: 460, borderRadius: 16,
        background: "#fff",
        boxShadow: "0 8px 40px rgba(26,64,140,0.25)",
        border: "1px solid #e2eaf5",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 24px 16px",
          borderBottom: "1px solid #eef3fb",
          background: "linear-gradient(90deg, #f6f9ff 0%, #fff 100%)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#e8f0fe", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L3 5.5v5c0 4 2.5 6.5 6 7 3.5-.5 6-3 6-7v-5L9 2z" stroke="#1a5bc6" strokeWidth="1.5" fill="none" />
                <path d="M6 9.5l2.5 2.5 4-4.5" stroke="#1a5bc6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1a2744" }}>ODI 助办认证</span>
          </div>
          <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: "#8a9bbf", padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          <p style={{ fontSize: 13, color: "#6b8ab0", lineHeight: 1.8, marginBottom: 20, padding: "10px 14px", background: "#f6f9ff", borderRadius: 8, borderLeft: "3px solid #1a5bc6" }}>
            ODI 助办将涉及企业材料识别、表单字段整理和文书草稿生成。为保护企业信息安全，请先完成企业信息认证。
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Upload */}
            <FieldGroup label="营业执照上传">
              <div
                onClick={() => setUploaded(!uploaded)}
                style={{
                  border: `1.5px dashed ${uploaded ? "#22c55e" : "#bfdbfe"}`,
                  background: uploaded ? "#f0fdf4" : "#f8faff",
                  borderRadius: 8, padding: "14px 16px",
                  display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {uploaded ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" fill="#22c55e" /><path d="M6 10l3 3 5-5.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" /></svg>
                    <span style={{ fontSize: 13, color: "#22c55e", fontWeight: 500 }}>营业执照已上传 ✓</span>
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4v9M6.5 8L10 4l3.5 4" stroke="#1a5bc6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 16h12" stroke="#1a5bc6" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    <span style={{ fontSize: 13, color: "#1a5bc6" }}>点击上传营业执照（JPG / PDF）</span>
                  </>
                )}
              </div>
            </FieldGroup>

            <FieldGroup label="法人身份证号">
              <Input value={idNum} onChange={setIdNum} placeholder="请输入法定代表人身份证号码" />
            </FieldGroup>

            <FieldGroup label="法人身份证有效期">
              <Input type="date" value={expiry} onChange={setExpiry} placeholder="" />
            </FieldGroup>

            <FieldGroup label="经办人手机号">
              <Input value={phone} onChange={setPhone} placeholder="请输入经办人手机号码" />
            </FieldGroup>

            <FieldGroup label="短信验证码">
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <Input value={code} onChange={setCode} placeholder="请输入验证码" />
                </div>
                <button
                  onClick={sendSms}
                  disabled={countdown > 0}
                  style={{
                    padding: "0 12px", borderRadius: 8, flexShrink: 0,
                    background: countdown > 0 ? "#eef3fb" : "#1a5bc6",
                    color: countdown > 0 ? "#8a9bbf" : "#fff",
                    border: "none", cursor: countdown > 0 ? "default" : "pointer",
                    fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
                    height: 38,
                  }}
                >
                  {countdown > 0 ? `${countdown}s` : "获取验证码"}
                </button>
              </div>
            </FieldGroup>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 12, padding: "16px 24px", borderTop: "1px solid #eef3fb" }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, height: 40, borderRadius: 8,
              border: "1px solid #dde9f7", background: "#fff",
              color: "#6b8ab0", fontSize: 14, cursor: "pointer",
            }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 2, height: 40, borderRadius: 8,
              background: "linear-gradient(90deg, #1a5bc6 0%, #2d78e8 100%)",
              border: "none", color: "#fff", fontSize: 14, fontWeight: 600,
              cursor: "pointer", boxShadow: "0 2px 8px rgba(26,91,198,0.3)",
            }}
          >
            确认认证并进入
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#1a2744", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", height: 38, padding: "0 12px",
        borderRadius: 8, border: "1px solid #bfdbfe",
        background: "#f8faff", color: "#1a2744",
        fontSize: 13, outline: "none", boxSizing: "border-box",
        fontFamily: "inherit",
      }}
    />
  );
}
