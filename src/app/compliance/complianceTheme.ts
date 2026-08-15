// 合规自查模块配色与共享样式常量（沿用 POC #1a5bc6 调性）。

export const C = {
  primary: "#1a5bc6",
  primaryHover: "#1549a8",
  primaryBg: "#eff6ff",
  primaryBorder: "#bfdbfe",
  ok: "#16a34a",
  okBg: "#f0fdf4",
  okBorder: "#bbf7d0",
  warn: "#b45309",
  warnBg: "#fff7ed",
  warnBorder: "#fed7aa",
  bad: "#dc2626",
  badBg: "#fef2f2",
  badBorder: "#fecaca",
  info: "#6d28d9",
  infoBg: "#f5f3ff",
  ink: "#111827",
  sub: "#64748b",
  muted: "#9ca3af",
  faint: "#d1d5db",
  line: "#e5eaf2",
  lineSoft: "#f1f5f9",
  surface: "#ffffff",
  page: "#f5f7fb",
  field: "#f8fafc",
  fieldBg: "#FAFCFE",
} as const;

// 档位颜色
export const GRADE_COLOR: Record<string, string> = {
  A: C.ok, B: C.primary, C: C.warn, D: C.bad, I: "#7A8CA0",
};
export const GRADE_BG: Record<string, string> = {
  A: C.okBg, B: C.primaryBg, C: C.warnBg, D: C.badBg, I: C.lineSoft,
};

// 共享内联样式（提到模块顶层，照搬 POC 约定）
export const cardStyle: React.CSSProperties = {
  background: C.surface,
  borderRadius: 14,
  border: `1px solid ${C.line}`,
  padding: "20px 22px",
  marginBottom: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
};

export const h2Style: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 17,
  fontWeight: 700,
  color: C.ink,
  paddingBottom: 8,
  borderBottom: `2px solid ${C.lineSoft}`,
};

export const leadStyle: React.CSSProperties = {
  fontSize: 13,
  color: C.sub,
  lineHeight: 1.7,
  marginBottom: 10,
};

export const btnPrimary: React.CSSProperties = {
  background: C.primary, color: "#fff", border: "none", borderRadius: 8,
  padding: "10px 30px", fontSize: 14, fontWeight: 600, cursor: "pointer",
};
export const btnGhost: React.CSSProperties = {
  background: "none", border: `1px solid ${C.primaryBorder}`, color: C.primary,
  borderRadius: 8, padding: "9px 22px", fontSize: 14, cursor: "pointer",
};
