/**
 * 网站搜索结果工作区 —— 迁移自 Figma 设计源码(WebsiteSearchPanel.tsx),内容口径改为
 * 走出去平台 https://segg.sh.gov.cn/ 的网站内容。
 *
 * 这是官网现有的常规搜索能力，不是 AI 搜索：
 * · 结果只由首页带入的搜索词或对话中明确的「帮忙搜索网站」请求产生，面板内不提供改词重搜；
 * · 不读取智能体回答，也不会因回答来源被点击而刷新或切换 —— 对话过程中保持不变。
 */
export interface WebsiteResult {
  id: string;
  title: string;
  summary: string;
  /** 所属频道 */
  channel: string;
  updatedAt: string;
  url: string;
}

/** 走出去平台(segg.sh.gov.cn)栏目内容池(POC 模拟站点索引,真实接站内搜索 API 后替换) */
const SITE_RESULTS: WebsiteResult[] = [
  {
    id: "r1",
    title: "境外投资项目备案（核准）办事指南",
    summary: "适用于本市企业开展境外直接投资的备案申请，明确申请条件、提交材料、办理时限与受理窗口，含商务委与发展改革委两条业务线的分工说明。",
    channel: "办事指南",
    updatedAt: "2026-07-18",
    url: "https://segg.sh.gov.cn/bszn/odi-filing",
  },
  {
    id: "r2",
    title: "关于优化本市企业境外投资管理服务的实施意见",
    summary: "围绕简化备案流程、加强真实性审核、完善事中事后监管提出十六条措施，自发布之日起施行。",
    channel: "政策法规",
    updatedAt: "2026-06-30",
    url: "https://segg.sh.gov.cn/zcfg/odi-opinion",
  },
  {
    id: "r3",
    title: "境外投资备案常见问题解答（2026 年版）",
    summary: "汇总企业在填报境外投资备案申请表、真实性承诺书过程中的高频问题，包含股比、出资方式与资金来源的填写口径。",
    channel: "常见问题",
    updatedAt: "2026-05-12",
    url: "https://segg.sh.gov.cn/cjwt/odi-2026",
  },
  {
    id: "r4",
    title: "企业走出去服务窗口联系方式一览",
    summary: "各区商务主管部门境外投资业务咨询电话、地址与工作时间，含市级综合服务热线。",
    channel: "服务指引",
    updatedAt: "2026-04-08",
    url: "https://segg.sh.gov.cn/fwzy/contacts",
  },
  {
    id: "r5",
    title: "企业出海扶持政策汇总（2026 年申报指南）",
    summary: "市级层面支持企业开拓国际市场的专项资金、展会补贴、出口信用保险等政策的申报条件与办理入口汇总。",
    channel: "政策法规",
    updatedAt: "2026-07-02",
    url: "https://segg.sh.gov.cn/zcfg/support-2026",
  },
  {
    id: "r6",
    title: "对外投资国别指南：新加坡",
    summary: "新加坡市场准入、公司设立流程、税制与企业所得税率、用工规定及外资审查制度要点，供出海企业参考。",
    channel: "国别指南",
    updatedAt: "2026-06-15",
    url: "https://segg.sh.gov.cn/gbgz/sg",
  },
  {
    id: "r7",
    title: "境外投资真实性承诺书（模板下载）",
    summary: "商务部门、发展改革部门两版真实性承诺书模板及填报说明，含承诺要件与签章要求。",
    channel: "下载服务",
    updatedAt: "2026-03-20",
    url: "https://segg.sh.gov.cn/xzfw/commitment",
  },
  {
    id: "r8",
    title: "ODI 备案材料清单与填报口径说明",
    summary: "按商务委、发展改革委两条业务线分别列示备案申请材料清单，含备案表、请示、决议、审计报告与资金证明的填报口径。",
    channel: "办事指南",
    updatedAt: "2026-07-25",
    url: "https://segg.sh.gov.cn/bszn/odi-materials",
  },
];

/** 简易站点检索:按关键词分词打分排序,无命中回退全量(与官网常规搜索的宽松口径一致) */
function searchSite(term: string): WebsiteResult[] {
  const tokens = term.toLowerCase().split(/[\s，。、,.?？！！]+/).filter(t => t.length >= 2);
  if (tokens.length === 0) return SITE_RESULTS;
  const scored = SITE_RESULTS.map(r => {
    const hay = `${r.title}${r.summary}${r.channel}`.toLowerCase();
    const score = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
    return { r, score };
  }).sort((a, b) => b.score - a.score);
  return scored.some(x => x.score > 0) ? scored.filter(x => x.score > 0).map(x => x.r) : SITE_RESULTS;
}

export function WebsiteSearchPanel({ keyword = "" }: { keyword?: string }) {
  const term = keyword.trim();
  const results = term ? searchSite(term) : [];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* 只读检索词：结果来自进入时携带的搜索词或明确的搜站请求，面板内不支持重搜 */}
      <div style={{ padding: 14, borderBottom: "1px solid #eef2f8", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8698b6" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <p style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#1a2744", lineHeight: "19px", margin: 0, wordBreak: "break-all" }}>
            {term || "暂无搜索词"}
          </p>
        </div>
        <p style={{ fontSize: 11, color: "#8698b6", marginTop: 8, marginBottom: 0 }}>
          网站常规搜索结果 · 来自走出去平台 segg.sh.gov.cn
        </p>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
        {results.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <p style={{ fontSize: 11, color: "#8698b6", marginBottom: 10, marginTop: 0 }}>
              共 {results.length} 条结果
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {results.map(r => <ResultCard key={r.id} result={r} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: WebsiteResult }) {
  return (
    <a
      href={result.url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "block", textDecoration: "none",
        padding: 12, borderRadius: 10,
        border: "1px solid #e5eaf2", background: "#fff", transition: "all .15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#bfdbfe"; e.currentTarget.style.background = "#fbfdff"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5eaf2"; e.currentTarget.style.background = "#fff"; }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: "#1a5bc6", lineHeight: "20px", marginBottom: 6, marginTop: 0 }}>
        {result.title}
      </p>
      <p style={{
        fontSize: 12, color: "#5a6b88", lineHeight: "19px", marginBottom: 10, marginTop: 0,
        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>
        {result.summary}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{
          padding: "1px 7px", borderRadius: 4, background: "#f1f5fb",
          fontSize: 11, color: "#5a6b88",
        }}>{result.channel}</span>
        <span style={{ fontSize: 11, color: "#8698b6" }}>更新于 {result.updatedAt}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#1a5bc6", display: "flex", alignItems: "center", gap: 3 }}>
          查看
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </span>
      </div>
    </a>
  );
}

function EmptyState() {
  return (
    <div style={{ padding: "32px 14px", textAlign: "center" }}>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#c7d4e6" strokeWidth="1.6" strokeLinecap="round" style={{ marginBottom: 12 }}>
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
      <p style={{ fontSize: 13, color: "#5a6b88", marginBottom: 4, marginTop: 0 }}>
        暂无网站搜索结果
      </p>
      <p style={{ fontSize: 11, color: "#8698b6", lineHeight: "18px", margin: 0 }}>
        从门户首页发起搜索，或在对话中让小海帮忙搜索网站
      </p>
    </div>
  );
}
