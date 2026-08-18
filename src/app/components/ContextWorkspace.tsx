import { AiSearchPanel } from "./AiSearchPanel";
import { WebsiteSearchPanel } from "./WebsiteSearchPanel";

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** 网站搜索关键词:存在时右侧为走出去平台(segg.sh.gov.cn)的网站搜索结果,对话中保持不变 */
  searchKeyword?: string;
}

export function ContextWorkspace({ collapsed, onToggleCollapse, searchKeyword }: Props) {
  const websiteMode = !!searchKeyword?.trim();
  if (collapsed) {
    return (
      <div style={{ width: 36, flexShrink: 0, background: "#fff", borderLeft: "1px solid #e5eaf2", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", gap: 10 }}>
        <button onClick={onToggleCollapse} title="展开" style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #e5eaf2", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronIcon dir="left" />
        </button>
        <button onClick={onToggleCollapse} title={websiteMode ? "网站搜索结果" : "搜索结果"} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: 380, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px 12px 12px 0" }}>
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
        <div style={{ height: "100%", background: "#fff", borderRadius: 12, border: "1px solid #e5eaf2", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
          <button onClick={onToggleCollapse} title="收起" style={{ position: "absolute", top: 12, right: 12, zIndex: 5, width: 26, height: 26, borderRadius: 6, border: "1px solid #eef2f7", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronIcon dir="right" />
          </button>
          {websiteMode
            ? <WebsiteSearchPanel keyword={searchKeyword!} />
            : <AiSearchPanel empty={false} />}
        </div>
      </div>
    </div>
  );
}

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d={dir === "left" ? "M9 2L4 7l5 5" : "M5 2l5 5-5 5"} stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
