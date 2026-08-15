// 新建合规自查任务 —— 名称输入弹窗（含重名校验）。

import { useState } from "react";
import { C } from "../complianceTheme";

interface Props {
  existingNames: string[];
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function NewComplianceProjectModal({ existingNames, onConfirm, onCancel }: Props) {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const isDup = trimmed && existingNames.some(n => n === trimmed);

  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 440, maxWidth: "92%", padding: "26px 28px", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: C.ink }}>新建合规自查任务</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: C.sub, lineHeight: 1.6 }}>为本次境外投资合规自查起个名字（投资方式将在向导第一步选定）。</p>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && trimmed && !isDup) onConfirm(trimmed); }}
          placeholder="如：越南新设智能装备子公司·合规自查"
          style={{ width: "100%", height: 40, padding: "0 12px", borderRadius: 8, border: `1px solid ${isDup ? C.bad : C.line}`, background: isDup ? C.badBg : C.field, fontSize: 14, color: C.ink, outline: "none", boxSizing: "border-box" }}
        />
        {isDup && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: C.bad, display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" /><path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            已存在同名任务「{trimmed}」，请使用其他名称
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={onCancel} style={{ background: "none", border: `1px solid ${C.line}`, color: C.sub, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer" }}>取消</button>
          <button onClick={() => trimmed && !isDup && onConfirm(trimmed)} disabled={!trimmed || isDup} style={{ background: trimmed && !isDup ? C.primary : C.faint, color: "#fff", border: "none", borderRadius: 8, padding: "8px 22px", fontSize: 13, fontWeight: 600, cursor: trimmed && !isDup ? "pointer" : "not-allowed" }}>创建</button>
        </div>
      </div>
    </div>
  );
}
