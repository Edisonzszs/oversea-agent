// 国别提示书模态（复刻商务部系统交互：选定目的地后须阅读 6 方面提示并确认）。

import { C } from "../complianceTheme";
import { COUNTRY_NOTICE_SECTIONS } from "../logic/country";

export function CountryNoticeModal({ country, onClose, onAck }: {
  country: string;
  onClose: () => void;
  onAck: () => void;
}) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,20,40,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 560, width: "92%", maxHeight: "80vh", overflow: "auto", padding: "22px 26px", boxShadow: "0 8px 30px rgba(0,20,40,0.3)" }}>
        <h3 style={{ color: C.primary, fontSize: 16, marginBottom: 10, borderBottom: `2px solid ${C.lineSoft}`, paddingBottom: 8 }}>
          对外投资提示事项——{country}（演示简版）
        </h3>
        <div style={{ fontSize: 13.5, color: "#33475C", lineHeight: 1.7 }}>
          <p style={{ margin: "6px 0" }}>依照商务部系统交互样式，选定投资目的地后，请阅读以下六方面提示（正式版接入该国别官方提示全文，以官方最新发布为准）：</p>
          {COUNTRY_NOTICE_SECTIONS.map(s => (
            <p key={s.title} style={{ margin: "6px 0" }}><b>{s.title}</b>{s.body}</p>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <button onClick={onAck} style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 7, padding: "9px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>我已阅读并知悉</button>
        </div>
      </div>
    </div>
  );
}
