import { useRef, useState } from "react";
import cleanBase from "../../imports/portal-base.png";
import seggLockup from "../../imports/segg-lockup.png";
import xiaohaiBot from "../../imports/a79a33e60349890f7bf1eb25f7af24df.png";
import { SendUpGlyph } from "./BrandIcons";

/**
 * Portal_Home_Desktop —— 上海市企业出海综合服务平台首页智能体入口。
 * 版式对齐官网 segg.sh.gov.cn：思源黑体(Source Han Sans)字族、官方标题锁版图
 * (segg-lockup.png,透明底藏青 #00479C)、导航选中/hover = 底部 3px 白色下划线
 * (透明下划线占位,无布局跳动,口径同官网 index-style.css)。
 *
 * portal-base.png 为"干净官网底图"（城市景观 + 顶部纯色蓝条 ~7vh，无导航/标题/Logo 烤入）。
 * 顶端导航、标题锁版、登录辅助入口、左侧资讯卡、右侧浮动按钮、沪航者机器人、
 * 智能输入卡均为叠加在底图之上的可编辑组件。
 */

/** 官网字族:思源黑体优先(官网 index-style.css 口径),本机无则回退苹方/雅黑 */
const PORTAL_FONT = "'Source Han Sans SC','Source Han Sans','Noto Sans SC','PingFang SC','Microsoft YaHei','Hiragino Sans GB',sans-serif";

const NAV_ITEMS = [
  "首页", "资讯服务", "办事指南", "金融支持", "专业服务", "培训活动",
  "一带一路", "境外网点", "安全合规", "项目发布", "留言交流",
];

const HOT_QUESTIONS = ["企业出海扶持政策", "ODI备案材料", "新加坡的企业所得税率"];

const WELCOME =
  "您好，我是沪航者，欢迎来到上海市企业出海综合服务平台。我可以为您提供出海政策咨询、办事指南、ODI 备案、国别税策等相关服务。您想咨询哪方面的问题？我将尽力为您解答。";

const PLACEHOLDER = "请输入您想了解的出海问题，例如：ODI 备案需要准备哪些材料？";

const NEWS_CARDS = [
  {
    title: "出海选上海",
    items: [
      "不靠低价“杀入”中东市场，要靠产品“扎进去”",
      "中企出海马来西亚，七类“国别事项”须前置考量",
      "中东出海战略深度观察与合规要点",
    ],
  },
  {
    title: "热点关注",
    items: [
      "中东地区投资合规指引发布",
      "中东地区贸易合规指引解读",
      "境外投资制裁应对合规指引",
    ],
  },
];

interface Props {
  onSubmit: (question: string, source: "custom" | "hot") => void;
  submitting: boolean;
  initialDraft?: string;
  onLogin?: () => void;
  /** 右侧浮动栏「智能体」按钮:直接进入出海智能体界面 */
  onEnterAgent?: () => void;
}

export function PortalHomePage({ onSubmit, submitting, initialDraft = "", onLogin, onEnterAgent }: Props) {
  const [value, setValue] = useState(initialDraft);
  const [focused, setFocused] = useState(false);
  const [lastSource, setLastSource] = useState<"custom" | "hot">("custom");
  const [selectedHot, setSelectedHot] = useState<string | null>(null);
  const [closedCards, setClosedCards] = useState<number[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const hasContent = value.trim().length > 0;
  // 默认展示欢迎语；点击 / 聚焦 / 有内容后进入输入态
  const inInput = focused || hasContent;

  const enterInput = () => { setFocused(true); setTimeout(() => taRef.current?.focus(), 0); };

  const handleSend = () => {
    if (!hasContent || submitting) return;
    onSubmit(value.trim(), lastSource);
  };

  const handleHotClick = (q: string) => {
    setValue(q);              // 仅填入，不直接发送
    setSelectedHot(q);
    setLastSource("hot");
    enterInput();
  };

  const handleClear = () => {
    setValue("");
    setSelectedHot(null);
    setFocused(false);        // 清空后恢复欢迎语
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", background: "#0b3a7a" }}>
      {/* ── 干净官网底图（真实背景资产，不重绘 Logo / 标题 / 城市景观） ── */}
      <img
        src={cleanBase}
        alt="上海市企业出海综合服务平台"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center top",
          pointerEvents: "none", userSelect: "none",
        }}
        draggable={false}
      />

      {/* ── 顶部导航（叠加在底图蓝条内，唯一一条导航） ── */}
      <HeaderNavigation />

      {/* ── 登录 / 繁体 / 无障碍 辅助入口（蓝条右侧） ── */}
      <HeaderUtilityLinks onLogin={onLogin} />

      {/* ── 中部平台标题锁版：上海 Logo + 平台名 + SHANGHAI DESK ── */}
      <HeroLockup />

      {/* ── 右侧浮动服务按钮:公众号 / 小程序 / 网页端 / 智能体(直达) ── */}
      <FloatingServiceBar onEnterAgent={onEnterAgent} />

      {/* ── 左下角门户资讯卡 ── */}
      <div style={{ position: "absolute", left: "2.5%", bottom: "7%", display: "flex", flexDirection: "column", gap: 12, zIndex: 12, width: "clamp(200px, 15vw, 236px)" }}>
        {NEWS_CARDS.map((card, i) => !closedCards.includes(i) && (
          <PortalNewsCard key={card.title} title={card.title} items={card.items} onClose={() => setClosedCards((prev) => [...prev, i])} />
        ))}
      </div>

      {/* ── 中央：沪航者机器人 + 智能输入卡 ── */}
      <div
        style={{
          position: "absolute", left: "50%", bottom: "6%", transform: "translateX(-50%)",
          width: "clamp(820px, 52%, 1040px)", zIndex: 15,
        }}
      >
        {/* 沪航者机器人：置于输入卡下层，仅头部从卡片后方露出 */}
        <img
          src={xiaohaiBot}
          alt="沪航者"
          draggable={false}
          style={{
            position: "absolute", left: "82%", top: -84, transform: "translateX(-50%)",
            width: "clamp(90px, 7.4vw, 118px)", height: "auto", zIndex: 14,
            filter: "drop-shadow(0 6px 14px rgba(9,26,60,0.18))",
            pointerEvents: "none", userSelect: "none",
          }}
        />

        {/* HomeQuestionPanel —— 整体式半透明智能服务卡(固定高度,欢迎态/输入态尺寸一致,无跳变) */}
        <div
          onClick={() => !inInput && enterInput()}
          style={{
            position: "relative", zIndex: 15, height: 178,
            background: "rgba(242,247,253,0.92)",
            border: focused ? "1px solid rgba(37,99,235,0.5)" : "1px solid rgba(255,255,255,0.75)",
            backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            borderRadius: 22,
            boxShadow: focused ? "0 14px 38px rgba(22,66,128,0.22)" : "0 12px 32px rgba(22,66,128,0.16)",
            padding: "20px 24px 16px", display: "flex", flexDirection: "column",
            cursor: inInput ? "default" : "text",
          }}
        >
          {/* 上半部：欢迎语 或 多行输入(固定高,不随状态变高) */}
          <div style={{ height: 78, flexShrink: 0, overflow: "hidden" }}>
            {inInput ? (
              <textarea
                ref={taRef}
                value={value}
                onChange={(e) => { setValue(e.target.value); setLastSource("custom"); setSelectedHot(null); }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={PLACEHOLDER}
                rows={3}
                autoFocus
                style={{
                  width: "100%", height: "78px", border: "none", outline: "none", resize: "none",
                  background: "transparent", color: "#000000",
                  fontFamily: PORTAL_FONT,
                  fontSize: "clamp(14px,0.95vw,15px)", lineHeight: 1.7, caretColor: "#1a5bc6",
                }}
              />
            ) : (
              <p style={{ color: "#33547e", fontSize: "clamp(13px,0.9vw,15px)", lineHeight: 1.8, margin: 0 }}>
                {WELCOME}
              </p>
            )}
          </div>

          {/* 下半部：热门问题（左） · 清除 + 发送（右） */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginTop: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, color: "#5a7196", marginBottom: 6 }}>热门问题</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {HOT_QUESTIONS.map((q) => {
                  const sel = selectedHot === q;
                  return (
                    <button
                      key={q}
                      onClick={(e) => { e.stopPropagation(); handleHotClick(q); }}
                      style={{
                        padding: "5px 14px", borderRadius: 8,
                        border: `1px solid ${sel ? "#2563eb" : "rgba(200,215,235,0.9)"}`,
                        background: sel ? "rgba(219,234,254,0.85)" : "rgba(255,255,255,0.72)",
                        color: sel ? "#1a4ca8" : "#3a5a8a", fontSize: 14, cursor: "pointer",
                        whiteSpace: "nowrap", lineHeight: 1.5, transition: "border 0.15s, background 0.15s", fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => { if (!sel) e.currentTarget.style.borderColor = "#7dabf0"; }}
                      onMouseLeave={(e) => { if (!sel) e.currentTarget.style.borderColor = "rgba(200,215,235,0.9)"; }}
                    >{q}</button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <button
                onClick={(e) => { e.stopPropagation(); handleClear(); }}
                disabled={!hasContent || submitting}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "none", padding: 0,
                  color: hasContent ? "#5a7196" : "#aebdd0", fontSize: 13,
                  cursor: hasContent && !submitting ? "pointer" : "default", fontFamily: "inherit",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
                清除
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); handleSend(); }}
                disabled={!hasContent || submitting}
                aria-label="发送"
                style={{
                  width: 52, height: 52, border: "none", flexShrink: 0, background: "transparent", padding: 0,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  cursor: hasContent && !submitting ? "pointer" : "default",
                  transition: "transform 0.15s",
                }}
                onMouseDown={(e) => { if (hasContent && !submitting) e.currentTarget.style.transform = "scale(0.92)"; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                {submitting ? <Spinner /> : (
                  <SendUpGlyph size={52}
                    color={hasContent ? "#1a5bc6" : "#c8d8ec"}
                    style={hasContent ? { filter: "drop-shadow(0 4px 10px rgba(37,99,235,0.35))" } : undefined} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── HeaderNavigation：叠在底图顶部蓝条内,选中/hover=底部3px白色下划线(官网口径) ── */
const NAV_BAR_H = "clamp(38px, 6.6vh, 64px)";

function HeaderNavigation() {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <nav
      style={{
        position: "absolute", top: 0, left: "46%", transform: "translateX(-50%)",
        height: NAV_BAR_H, width: "58%",
        display: "flex", alignItems: "stretch", justifyContent: "space-between",
        zIndex: 20, gap: "0.4vw", fontFamily: PORTAL_FONT,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = item === "首页";
        const isHover = hover === item;
        return (
          <div
            key={item}
            onMouseEnter={() => setHover(item)}
            onMouseLeave={() => setHover(null)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              padding: "0 2px",
              borderBottom: active || isHover ? "3px solid #ffffff" : "3px solid transparent",
              marginBottom: -1.5, transition: "border-color 0.15s",
            }}
          >
            <span style={{
              color: "#ffffff",
              fontSize: "clamp(13px, 0.95vw, 18px)", fontWeight: active ? 600 : 400,
              whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(0,0,0,0.18)",
            }}>{item}</span>
          </div>
        );
      })}
    </nav>
  );
}

/* ── HeaderUtilityLinks：蓝条右侧(白字,与导航同行) ── */
function HeaderUtilityLinks({ onLogin }: { onLogin?: () => void }) {
  return (
    <div style={{
      position: "absolute", top: 0, right: "2.2%",
      height: NAV_BAR_H,
      display: "flex", alignItems: "center", gap: 10, zIndex: 20, fontFamily: PORTAL_FONT,
    }}>
      {["登录", "繁体", "无障碍"].map((t, i) => (
        <div key={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {i > 0 && <span style={{ width: 1, height: 11, background: "rgba(255,255,255,0.45)" }} />}
          <button
            onClick={t === "登录" ? onLogin : undefined}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.92)", fontSize: 12.5, fontFamily: "inherit", padding: 0, textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.92)")}
          >{t}</button>
        </div>
      ))}
    </div>
  );
}

/* ── HeroLockup：官方标题锁版图(透明底藏青,Logo+平台名+SHANGHAI DESK 一体) ── */
function HeroLockup() {
  return (
    <img
      src={seggLockup}
      alt="上海市企业出海综合服务平台"
      draggable={false}
      style={{
        position: "absolute", top: "clamp(140px, 25vh, 270px)", left: "50%", transform: "translateX(-50%)",
        width: "clamp(400px, 42vw, 640px)", height: "auto", zIndex: 12,
        filter: "drop-shadow(0 3px 10px rgba(13,54,116,0.18))",
        pointerEvents: "none", userSelect: "none",
      }}
    />
  );
}

/* ── FloatingServiceBar:微信公众号 / 小程序 / 网页端 / 智能体(直达出海智能体) ── */
function FloatingServiceBar({ onEnterAgent }: { onEnterAgent?: () => void }) {
  const icons: { key: string; label: string; svg: React.ReactNode; onClick?: () => void }[] = [
    { key: "wechat", label: "微信公众号", svg: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /> },
    { key: "miniapp", label: "小程序", svg: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></> },
    { key: "web", label: "网页端", svg: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.7 2.7 2.7 15.3 0 18M12 3c-2.7 2.7-2.7 15.3 0 18" /></> },
    { key: "agent", label: "出海智能体", onClick: onEnterAgent, svg: <><rect x="5" y="8.5" width="14" height="10" rx="2.5" /><circle cx="9.5" cy="13.2" r="1.15" fill="#fff" stroke="none" /><circle cx="14.5" cy="13.2" r="1.15" fill="#fff" stroke="none" /><path d="M12 8.5V6" /><circle cx="12" cy="4.6" r="1.1" /><path d="M5 12.5H3.2M20.8 12.5H19" /></> },
  ];
  return (
    <div style={{
      position: "absolute", right: "clamp(48px, 4vw, 72px)", top: "50%", transform: "translateY(-50%)",
      display: "flex", flexDirection: "column", gap: 16, zIndex: 18,
    }}>
      {icons.map((ic) => (
        <button
          key={ic.key}
          title={ic.label}
          aria-label={ic.label}
          onClick={ic.onClick}
          style={{
            width: "clamp(48px,3.4vw,60px)", height: "clamp(48px,3.4vw,60px)", borderRadius: "50%", border: "none", cursor: "pointer",
            background: "linear-gradient(135deg,#2f7be0,#1a5bc6)", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(26,64,140,0.28)", transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(26,64,140,0.4)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(26,64,140,0.28)"; }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {ic.svg}
          </svg>
        </button>
      ))}
    </div>
  );
}

/* ── PortalNewsCard ── */
function PortalNewsCard({ title, items, onClose }: { title: string; items: string[]; onClose: () => void }) {
  return (
    <div
      style={{ borderRadius: 8, overflow: "hidden", background: "#fff", boxShadow: "0 2px 10px rgba(9,26,60,0.14)", transition: "box-shadow 0.15s" }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 6px 18px rgba(9,26,60,0.22)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 2px 10px rgba(9,26,60,0.14)")}
    >
      {/* 蓝色标题栏 + 火焰图标 + 关闭按钮 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", background: "linear-gradient(90deg,#1a5bc6,#2d78e8)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffc234" style={{ flexShrink: 0 }}>
          <path d="M12 2c1 3-1 5-2 6.5C8.5 10.5 8 12 8 13.5a4 4 0 0 0 8 0c0-1-.3-2-1-3 .5 2-1 3-1 3 .3-2-1-3.5-2-5 1.5 1 1 3 1 3 1-1.5 2-3 0-6.5-.5 2-2 3-2 3s2-3 1-6z" />
        </svg>
        <span style={{ flex: 1, color: "#fff", fontSize: 13, fontWeight: 600 }}>{title}</span>
        <button
          onClick={onClose}
          aria-label="关闭"
          style={{ width: 16, height: 16, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.25)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1l-6 6" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" /></svg>
        </button>
      </div>
      {/* 蓝色圆点列表 */}
      <div style={{ padding: "8px 10px", background: "#fbfcfe" }}>
        {items.map((it) => (
          <div key={it} style={{ display: "flex", gap: 6, alignItems: "flex-start", padding: "4px 0", cursor: "pointer" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#2563eb", flexShrink: 0, marginTop: 6 }} />
            <span style={{
              fontSize: 12, color: "#3a4f6b", lineHeight: 1.5,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0,
            }}>{it}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.7s linear infinite" }}>
      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
