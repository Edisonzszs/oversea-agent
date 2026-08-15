// 合规自查项目的快捷操作：⋯ 下拉菜单（重命名 / 复制 / 删除）+ 重命名弹窗 + 删除确认。

import { useState } from "react";
import { C } from "../complianceTheme";

interface MenuProps {
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function ComplianceItemMenu({ onRename, onDuplicate, onDelete }: MenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4, color: "#94a3b8", fontSize: 14, lineHeight: 1 }}
        onMouseEnter={e => (e.currentTarget.style.color = C.primary)}
        onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}
      >···</button>
      {open && (
        <div
          style={{ position: "absolute", right: 0, top: "100%", zIndex: 200, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(26,64,140,0.12)", minWidth: 120, overflow: "hidden" }}
          onMouseLeave={() => setOpen(false)}
        >
          {[
            { label: "重命名", fn: () => { onRename(); setOpen(false); } },
            { label: "复制", fn: () => { onDuplicate(); setOpen(false); } },
            { label: "删除", fn: () => { onDelete(); setOpen(false); }, danger: true },
          ].map(item => (
            <button key={item.label}
              onClick={e => { e.stopPropagation(); item.fn(); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: item.danger ? C.bad : C.ink }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >{item.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RenameModal({ initialName, onConfirm, onCancel }: { initialName: string; onConfirm: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(initialName);
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 440, maxWidth: "92%", padding: "26px 28px", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: C.ink }}>重命名</h3>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && name.trim()) onConfirm(name.trim()); }}
          style={{ width: "100%", height: 40, padding: "0 12px", borderRadius: 8, border: `1px solid ${C.line}`, background: C.field, fontSize: 14, color: C.ink, outline: "none", boxSizing: "border-box" }} />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={onCancel} style={{ background: "none", border: `1px solid ${C.line}`, color: C.sub, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer" }}>取消</button>
          <button onClick={() => name.trim() && onConfirm(name.trim())} disabled={!name.trim()} style={{ background: name.trim() ? C.primary : C.faint, color: "#fff", border: "none", borderRadius: 8, padding: "8px 22px", fontSize: 13, fontWeight: 600, cursor: name.trim() ? "pointer" : "not-allowed" }}>确定</button>
        </div>
      </div>
    </div>
  );
}

export function DeleteConfirmModal({ projectName, onConfirm, onCancel }: { projectName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 400, maxWidth: "92%", padding: "26px 28px", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: C.ink }}>删除确认</h3>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, color: C.sub, lineHeight: 1.6 }}>确定删除「{projectName}」吗？删除后不可恢复，所有自查数据和报告将丢失。</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onCancel} style={{ background: "none", border: `1px solid ${C.line}`, color: C.sub, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer" }}>取消</button>
          <button onClick={onConfirm} style={{ background: C.bad, color: "#fff", border: "none", borderRadius: 8, padding: "8px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>删除</button>
        </div>
      </div>
    </div>
  );
}
