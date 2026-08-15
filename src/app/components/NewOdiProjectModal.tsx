import { useState } from "react";
import type { DemoScene, DemoMode } from "./odiProjectData";

export type NewTaskResult =
  | { kind: "assist"; name: string }
  | { kind: "demo"; scene: DemoScene; mode: DemoMode };

interface Props {
  onConfirm: (result: NewTaskResult) => void;
  onCancel: () => void;
}

type Step = "type" | "demo-scene" | "assist-name";

const SCENES: { scene: DemoScene; desc: string; country: string; duration: string; tags: string[]; recommended?: true }[] = [
  {
    scene: "新设独资",
    desc: "在境外设立一家由境内企业持股100%的新公司。",
    country: "新加坡",
    duration: "约2分钟",
    tags: ["注册资本", "投资总额", "资金来源", "商务委材料"],
    recommended: true,
  },
  {
    scene: "并购",
    desc: "通过股权、资产或业务收购方式投资一家已存在的境外企业。",
    country: "德国",
    duration: "约3分钟",
    tags: ["并购标的", "收购比例", "交易方式", "并购专项报告"],
  },
  {
    scene: "增资变更",
    desc: "对已有境外企业进行增资、减资、名称、股权或其他事项变更。",
    country: "新加坡",
    duration: "约2分钟",
    tags: ["变更前后对比", "增减资金额", "股权变化"],
  },
];

// ── shared styles ─────────────────────────────────────────────────────────────
const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 1000,
  background: "rgba(15,23,42,0.32)",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const modal: React.CSSProperties = {
  position: "relative", // 让右上角「×」关闭按钮锚定到弹窗(否则会跑到屏幕角落)
  background: "#fff", borderRadius: 20,
  boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
  overflow: "hidden",
};
const btnPrimary: React.CSSProperties = {
  padding: "10px 24px", borderRadius: 10, border: "none",
  background: "#1a5bc6", color: "#fff", fontSize: 14, fontWeight: 600,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  padding: "10px 24px", borderRadius: 10,
  border: "1px solid #d1d5db", background: "#fff",
  fontSize: 14, color: "#374151", cursor: "pointer",
};

// ── Step 1: type selection ─────────────────────────────────────────────────────
// 两张卡片底色统一(中性白/灰),橙蓝只出现在底部按钮上(带透明度);
// 按钮用 marginTop:auto 钉到卡片底部,网格等高 → 两个按钮水平对齐。
function TypeStep({ onSelect }: { onSelect: (t: "demo" | "assist") => void }) {
  const [hovered, setHovered] = useState<"demo" | "assist" | null>(null);
  const cardBase: React.CSSProperties = {
    borderRadius: 16, padding: "24px 24px 20px", cursor: "pointer",
    background: "#fff",
    transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 12,
  };
  const iconBox: React.CSSProperties = {
    width: 38, height: 38, borderRadius: 10, background: "#f8fafc", border: "1px solid #e8edf5",
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const tagPill: React.CSSProperties = { fontSize: 11, color: "#4b5563", background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" };
  const infoP: React.CSSProperties = { margin: 0, fontSize: 12, color: "#4b5563", background: "#f8fafc", borderRadius: 8, padding: "6px 10px", border: "1px solid #e8edf5" };

  return (
    <div style={{ width: 720, padding: "36px 40px 32px" }}>
      <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: "#111827" }}>新建ODI任务</h2>
      <p style={{ margin: "0 0 28px", fontSize: 14, color: "#6b7280" }}>请选择本次任务的服务类型，创建后可在工作台中独立管理。</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24, alignItems: "stretch" }}>
        {/* 模拟填报 —— 中性卡 + 橙色(半透明)按钮 */}
        <div
          onMouseEnter={() => setHovered("demo")}
          onMouseLeave={() => setHovered(null)}
          style={{ ...cardBase, border: `1.5px solid ${hovered === "demo" ? "#cbd5e1" : "#e8edf5"}`, background: hovered === "demo" ? "#fafbfc" : "#fff" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={iconBox}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>ODI模拟填报</div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>模拟</div>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.65 }}>
            通过预设案例体验信息填写、关联校验和材料生成，无需上传真实项目资料。
          </p>
          <p style={infoP}>适合尚未准备材料，或希望先了解ODI办理方式的用户。</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["无需真实资料", "约2—3分钟", "可生成模拟参考稿"].map(t => (
              <span key={t} style={tagPill}>{t}</span>
            ))}
          </div>
          <button onClick={() => onSelect("demo")} style={{ ...btnPrimary, background: "rgba(217,119,6,0.9)", marginTop: "auto" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#d97706")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(217,119,6,0.9)")}
          >选择模拟填报</button>
        </div>

        {/* 申报助办 —— 中性卡 + 蓝色(半透明)按钮 */}
        <div
          onMouseEnter={() => setHovered("assist")}
          onMouseLeave={() => setHovered(null)}
          style={{ ...cardBase, border: `1.5px solid ${hovered === "assist" ? "#cbd5e1" : "#e8edf5"}`, background: hovered === "assist" ? "#fafbfc" : "#fff" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={iconBox}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>ODI申报助办</div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>助办</div>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.65 }}>
            上传已有项目材料，辅助识别商务委、发改委和共用信息，查看校验问题并生成商务委材料草稿。
          </p>
          <p style={infoP}>适合已经形成一份或多份项目材料的用户。</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["材料识别", "双部门校验", "商务委材料生成"].map(t => (
              <span key={t} style={tagPill}>{t}</span>
            ))}
          </div>
          <button onClick={() => onSelect("assist")} style={{ ...btnPrimary, background: "rgba(26,91,198,0.9)", marginTop: "auto" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#1a5bc6")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(26,91,198,0.9)")}
          >选择申报助办</button>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
        两类任务相互独立。模拟填报中的企业、金额和股权数据不会进入申报助办。
      </p>
    </div>
  );
}

// ── Step 2a: demo scene selection ─────────────────────────────────────────────
function DemoSceneStep({ onSelect, onBack }: { onSelect: (scene: DemoScene, mode: DemoMode) => void; onBack: () => void }) {
  return (
    <div style={{ width: 720, padding: "36px 40px 32px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#6b7280", padding: 0, marginBottom: 16, display: "flex", alignItems: "center", gap: 4 }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        返回
      </button>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#111827" }}>选择模拟投资场景</h2>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "#6b7280" }}>系统将载入一套完整模拟方案。您可以直接体验，也可以调整部分关键内容。</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {SCENES.map(s => (
          <div key={s.scene} style={{ border: "1.5px solid #e8edf5", borderRadius: 14, padding: "18px 20px", background: "#fff", display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{s.scene === "新设独资" ? "新设境外独资子公司" : s.scene === "并购" ? "并购境外企业" : "境外企业增资或变更"}</span>
                {s.recommended && <span style={{ fontSize: 10, fontWeight: 700, color: "#d97706", background: "#fef3c7", borderRadius: 5, padding: "1px 7px", border: "1px solid #fde68a" }}>推荐</span>}
                <span style={{ fontSize: 11, color: "#9ca3af" }}>示例：{s.country} · {s.duration}</span>
              </div>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "#4b5563", lineHeight: 1.6 }}>{s.desc}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {s.tags.map(t => <span key={t} style={{ fontSize: 11, color: "#92400e", background: "#fff7ed", borderRadius: 5, padding: "1px 7px", border: "1px solid #fde68a" }}>{t}</span>)}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
              <button onClick={() => onSelect(s.scene, "快速体验")} style={{ ...btnPrimary, background: "#d97706", padding: "8px 18px", fontSize: 13 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#b45309")}
                onMouseLeave={e => (e.currentTarget.style.background = "#d97706")}
              >快速体验</button>
              <button onClick={() => onSelect(s.scene, "自定义体验")} style={{ ...btnGhost, padding: "8px 18px", fontSize: 13 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
              >自定义体验</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 2b: assist name input ─────────────────────────────────────────────────
function AssistNameStep({ onConfirm, onBack }: { onConfirm: (name: string) => void; onBack: () => void }) {
  const [name, setName] = useState("");
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ width: 520, padding: "36px 40px 32px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#6b7280", padding: 0, marginBottom: 16, display: "flex", alignItems: "center", gap: 4 }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        返回
      </button>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#111827" }}>创建申报助办任务</h2>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "#6b7280" }}>填写任务名称后，可进入项目详情并上传材料。</p>

      <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>任务名称</label>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="例：越南新设智能装备生产基地项目"
        autoFocus
        style={{
          width: "100%", height: 44, borderRadius: 10, padding: "0 14px",
          border: `1.5px solid ${focused ? "#1a5bc6" : "#d1d5db"}`,
          fontSize: 14, color: "#111827", outline: "none", boxSizing: "border-box",
          transition: "border-color 0.15s",
        }}
      />
      <p style={{ margin: "8px 0 28px", fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
        名称仅用于任务管理，可随时修改。正式项目信息以上传材料识别结果为准。
      </p>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onBack} style={btnGhost}>取消</button>
        <button
          onClick={() => { if (name.trim()) onConfirm(name.trim()); }}
          disabled={!name.trim()}
          style={{ ...btnPrimary, opacity: name.trim() ? 1 : 0.45, cursor: name.trim() ? "pointer" : "not-allowed" }}
          onMouseEnter={e => { if (name.trim()) e.currentTarget.style.background = "#1549a8"; }}
          onMouseLeave={e => { if (name.trim()) e.currentTarget.style.background = "#1a5bc6"; }}
        >创建并进入</button>
      </div>
    </div>
  );
}

// ── Root modal ─────────────────────────────────────────────────────────────────
export function NewOdiProjectModal({ onConfirm, onCancel }: Props) {
  const [step, setStep] = useState<Step>("type");

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={modal}>
        {step === "type" && (
          <TypeStep onSelect={t => setStep(t === "demo" ? "demo-scene" : "assist-name")} />
        )}
        {step === "demo-scene" && (
          <DemoSceneStep
            onBack={() => setStep("type")}
            onSelect={(scene, mode) => onConfirm({ kind: "demo", scene, mode })}
          />
        )}
        {step === "assist-name" && (
          <AssistNameStep
            onBack={() => setStep("type")}
            onConfirm={name => onConfirm({ kind: "assist", name })}
          />
        )}
        {/* Close button —— 钉在弹窗右上角(modal 已 position:relative) */}
        <button
          onClick={onCancel}
          title="关闭"
          aria-label="关闭"
          style={{ position: "absolute", top: 14, right: 16, width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontSize: 20, color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5, transition: "background 0.15s, color 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#374151"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9ca3af"; }}
        >×</button>
      </div>
    </div>
  );
}
