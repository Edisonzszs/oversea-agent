import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { DUR, EASE, DIST, STAGGER, REDUCED_MOTION_QUERY } from "../motionTokens";


interface RelatedResult {
  id: string;
  title: string;
  org: string;
  snippet: string;
  tag: string;
  tagColor: { color: string; bg: string };
}

const QUESTION = "新加坡设立子公司需要哪些手续？";

const CONCLUSION =
  "在新加坡设立子公司，通常需完成 4 个关键环节：① 在会计与企业管理局（ACRA）核名并注册公司；② 满足至少 1 名本地董事、注册地址及公司秘书的要求；③ 开立本地企业银行账户并完成实缴；④ 在境内同步办理 ODI 境外投资备案（发改委 + 商务部 + 外汇登记）。全流程一般 2–4 周，其中境内备案是资金合规出境的前提。";

const KEY_POINTS = [
  "允许 100% 外资持股，注册资本无最低限制",
  "须委任至少 1 名新加坡本地常住董事",
  "境内需先完成 ODI 备案方可合规出资",
];

const RELATED: RelatedResult[] = [
  {
    id: "r1",
    title: "新加坡公司法关于外资设立要求",
    org: "上海走出去综合服务平台 · 知识库",
    snippet: "外资可 100% 持股，注册资本无最低限制，通常需 1 名本地董事与 1 名公司秘书。",
    tag: "平台知识库",
    tagColor: { color: "#6d5bd0", bg: "#f5f3ff" },
  },
  {
    id: "r2",
    title: "境外投资备案管理办法",
    org: "商务部",
    snippet: "企业境外投资应向商务主管部门备案，取得企业境外投资证书后方可实施。",
    tag: "官方政策",
    tagColor: { color: "#1a5bc6", bg: "#eff6ff" },
  },
  {
    id: "r3",
    title: "境外直接投资外汇登记指引",
    org: "国家外汇管理局",
    snippet: "完成 ODI 备案后，需办理境外直接投资外汇登记，方可办理资金汇出。",
    tag: "官方政策",
    tagColor: { color: "#1a5bc6", bg: "#eff6ff" },
  },
  {
    id: "r4",
    title: "中国制造企业出海东南亚最新动态",
    org: "财新网",
    snippet: "多家制造业龙头在东南亚设立生产基地，新加坡作为地区总部受到青睐。",
    tag: "新闻资讯",
    tagColor: { color: "#b45309", bg: "#fffbeb" },
  },
];

const FOLLOW_UPS = [
  "本地董事可以由第三方代持吗？",
  "ODI 备案需要准备哪些材料？",
  "整体设立预算大概多少？",
];

interface Props {
  onFollowUpQuestion?: (q: string) => void;
  empty?: boolean;
}

/**
 * AiSearchPanel
 *
 * 动效三：搜索结果分层进入
 * 顺序：搜索词 → 结论 → 相关结果（stagger 0.05）→ 追问
 * 时长：总~500ms | ease: power2.out
 * 触发：组件挂载或 empty→false 切换
 * 降级：reduced-motion 下只做快速淡入，无 y 位移
 */
export function AiSearchPanel({ empty, onFollowUpQuestion }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const conclusionRef = useRef<HTMLDivElement>(null);
  const relatedLabelRef = useRef<HTMLDivElement>(null);
  const relatedListRef = useRef<HTMLDivElement>(null);
  const followupsRef = useRef<HTMLDivElement>(null);

  // Layered entry animation when content is shown
  useGSAP(() => {
    if (empty || !containerRef.current) return;

    const mm = gsap.matchMedia();

    mm.add(`not ${REDUCED_MOTION_QUERY}`, () => {
      const tl = gsap.timeline({ defaults: { ease: EASE.out, overwrite: "auto" } });

      // 1. Question header
      if (questionRef.current) {
        tl.fromTo(questionRef.current,
          { autoAlpha: 0, y: DIST.entry },
          { autoAlpha: 1, y: 0, duration: DUR.searchIn }
        );
      }

      // 2. Conclusion
      if (conclusionRef.current) {
        tl.fromTo(conclusionRef.current,
          { autoAlpha: 0, y: DIST.entry },
          { autoAlpha: 1, y: 0, duration: DUR.searchIn },
          "-=0.08"
        );
      }

      // 3. Related label + cards (stagger)
      if (relatedLabelRef.current) {
        tl.fromTo(relatedLabelRef.current,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: DUR.searchCard },
          "-=0.05"
        );
      }
      if (relatedListRef.current) {
        const cards = relatedListRef.current.querySelectorAll(".result-card");
        tl.fromTo(cards,
          { autoAlpha: 0, y: DIST.entry - 2 },
          { autoAlpha: 1, y: 0, duration: DUR.searchCard, stagger: STAGGER.searchCards },
          "-=0.05"
        );
      }

      // 4. Follow-ups
      if (followupsRef.current) {
        tl.fromTo(followupsRef.current,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: DUR.searchCard },
          "-=0.05"
        );
      }
    });

    mm.add(REDUCED_MOTION_QUERY, () => {
      // Instant fade only
      const els = [questionRef.current, conclusionRef.current, relatedLabelRef.current, relatedListRef.current, followupsRef.current];
      gsap.set(els, { autoAlpha: 1, y: 0 });
    });

  }, { scope: containerRef, dependencies: [empty] });

  if (empty) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <SearchIcon size={20} color="#1a5bc6" />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 6 }}>等待提问</p>
        <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>提出问题后，结论与相关内容将在此展示。</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ height: "100%", overflowY: "auto", scrollbarWidth: "none", padding: "18px 16px 20px" }}>

      {/* 1. 搜索问题（主标题） */}
      <div ref={questionRef} style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 14 }}>
        <span style={{ marginTop: 3, flexShrink: 0, display: "flex" }}><SearchIcon size={16} color="#1a5bc6" /></span>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111827", lineHeight: 1.45, margin: 0 }}>{QUESTION}</h2>
      </div>

      {/* 2. 结论摘要 */}
      <div ref={conclusionRef} style={{ borderRadius: 12, border: "1px solid #dbe6fb", background: "linear-gradient(180deg,#f5f9ff,#ffffff)", padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1a5bc6" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1a5bc6", letterSpacing: 0.4 }}>智能结论</span>
        </div>
        <p style={{ fontSize: 13.5, color: "#1f2937", lineHeight: 1.75, margin: 0 }}>{CONCLUSION}</p>

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
          {KEY_POINTS.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ marginTop: 6, width: 5, height: 5, borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>{p}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. 相关结果列表 */}
      <div ref={relatedLabelRef} style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 10, paddingLeft: 2 }}>相关内容</div>
      <div ref={relatedListRef} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        {RELATED.map(r => (
          <div key={r.id}
            className="result-card"
            style={{ padding: "11px 13px", borderRadius: 11, border: "1px solid #eef2f7", background: "#fff", cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#bfdbfe"; e.currentTarget.style.boxShadow = "0 3px 12px rgba(26,64,140,0.07)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#eef2f7"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", lineHeight: 1.4, flex: 1 }}>{r.title}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: r.tagColor.color, background: r.tagColor.bg, borderRadius: 5, padding: "2px 7px", flexShrink: 0 }}>{r.tag}</span>
            </div>
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, margin: "0 0 6px" }}>{r.snippet}</p>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{r.org}</span>
          </div>
        ))}
      </div>

      {/* 追问建议 */}
      <div ref={followupsRef}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 10, paddingLeft: 2 }}>继续追问</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FOLLOW_UPS.map((q, i) => (
            <button key={i} onClick={() => onFollowUpQuestion?.(q)}
              style={{ fontSize: 12, color: "#1a5bc6", background: "#fff", border: "1px solid #dbe6fb", borderRadius: 20, padding: "6px 13px", cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#eff6ff")}
              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
            >{q}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SearchIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}
