import React, { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { DUR, EASE, REDUCED_MOTION_QUERY } from "../motionTokens";

gsap.registerPlugin(Flip);

export type Tab = "materials" | "review" | "confirm";
type ValidationState = "idle" | "running" | "done";

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  recognizeStatus: "recognizing" | "recognized";
  department: "shared" | "commerce" | "ndrc" | "pending";
  isNew?: boolean;
}

interface ValidationIssue {
  id: string;
  level: "consistency" | "missing" | "pass";
  name: string;
  department: "commerce" | "ndrc" | "shared";
  material: string;
  field: string;
  value?: string;
  suggestion: string;
}

const MOCK_FILES: UploadedFile[] = [
  { id: "m1", name: "营业执照.pdf", size: "1.2 MB", recognizeStatus: "recognized", department: "shared" },
  { id: "m2", name: "可行性研究报告.docx", size: "3.8 MB", recognizeStatus: "recognized", department: "shared" },
  { id: "m3", name: "境外投资备案申请表.docx", size: "0.9 MB", recognizeStatus: "recognized", department: "commerce" },
  { id: "m4", name: "境外投资项目备案表.docx", size: "1.1 MB", recognizeStatus: "recognized", department: "ndrc" },
  { id: "m5", name: "股东会决议.docx", size: "0.7 MB", recognizeStatus: "recognized", department: "shared" },
  { id: "m6", name: "审计财务报表.xlsx", size: "2.3 MB", recognizeStatus: "recognized", department: "shared" },
];

const SAMPLE_ISSUES: ValidationIssue[] = [
  { id: "c1", level: "pass",        department: "commerce", name: "投资国家",     field: "投资国家",     material: "境外投资备案申请表", suggestion: "字段已识别，值为：美国（美利坚合众国）" },
  { id: "c2", level: "pass",        department: "commerce", name: "投资方式",     field: "投资方式",     material: "境外投资备案申请表", suggestion: "字段已识别，值为：新设" },
  { id: "c3", level: "missing",     department: "commerce", name: "设立方式",     field: "设立方式",     material: "境外投资备案申请表", suggestion: "请在备案申请表中填写设立方式（独资/合资/合作）" },
  { id: "c4", level: "consistency", department: "commerce", name: "注册资本",     field: "注册资本",     material: "境外投资备案申请表 / 可行性研究报告", value: "备案申请表：500万美元 | 可行性研究报告：300万美元", suggestion: "两份材料注册资本数值不一致，请核实并统一" },
  { id: "c5", level: "missing",     department: "commerce", name: "投资总额",     field: "投资总额",     material: "境外投资备案申请表", suggestion: "请补充境外投资备案申请表中的投资总额字段" },
  { id: "c6", level: "pass",        department: "commerce", name: "中方股东和股比", field: "中方股东和股比", material: "境外投资备案申请表", suggestion: "字段已识别，值为：XX集团有限公司（100%）" },
  { id: "c7", level: "missing",     department: "commerce", name: "外方股东和股比", field: "外方股东和股比", material: "境外投资备案申请表", suggestion: "如存在外方股东请补充填写，若无请标注\"无\"" },
  { id: "n1",  level: "pass",        department: "ndrc", name: "投资主体名称",   field: "投资主体名称",   material: "营业执照 / 境外投资项目备案表", suggestion: "字段已识别，值为：XX（集团）有限公司" },
  { id: "n2",  level: "consistency", department: "ndrc", name: "项目名称",       field: "项目名称",       material: "可行性研究报告 / 境外投资项目备案表", value: "可研报告：XX智慧城市建设项目 | 备案表：XX数字城市基础设施项目", suggestion: "两份材料项目名称不一致，建议以境外投资项目备案表为准统一" },
  { id: "n3",  level: "pass",        department: "ndrc", name: "统一社会信用代码", field: "统一社会信用代码", material: "营业执照", suggestion: "字段已识别，值为：91310000XXXXXXXXXX" },
  { id: "n4",  level: "pass",        department: "ndrc", name: "注册地址",       field: "注册地址",       material: "营业执照", suggestion: "字段已识别，值为：上海市黄浦区XX路XX号" },
  { id: "n5",  level: "consistency", department: "ndrc", name: "注册资本",       field: "注册资本",       material: "营业执照 / 审计财务报表", value: "营业执照：1,000万元人民币 | 审计财务报表：1000万元（格式不一致）", suggestion: "数值一致但格式存在差异，建议统一为标准格式" },
  { id: "n6",  level: "pass",        department: "ndrc", name: "成立日期",       field: "成立日期",       material: "营业执照", suggestion: "字段已识别，值为：2010年03月15日" },
  { id: "n7",  level: "pass",        department: "ndrc", name: "企业类型",       field: "企业类型",       material: "营业执照", suggestion: "字段已识别，值为：有限责任公司" },
  { id: "n8",  level: "missing",     department: "ndrc", name: "经营范围",       field: "经营范围",       material: "境外投资项目备案表", suggestion: "请在备案表中补充与本次境外投资相关的经营范围描述" },
  { id: "n9",  level: "pass",        department: "ndrc", name: "总资产",         field: "总资产",         material: "审计财务报表", suggestion: "字段已识别，值为：2.80亿元人民币" },
  { id: "n10", level: "pass",        department: "ndrc", name: "净资产",         field: "净资产",         material: "审计财务报表", suggestion: "字段已识别，值为：1.22亿元人民币" },
  { id: "n11", level: "missing",     department: "ndrc", name: "主营业务收入",   field: "主营业务收入",   material: "审计财务报表", suggestion: "审计财务报表中未能识别主营业务收入，请确认报表格式或补充说明" },
  { id: "n12", level: "missing",     department: "ndrc", name: "净利润",         field: "净利润",         material: "审计财务报表", suggestion: "审计财务报表中未能识别净利润，请确认报表格式或补充说明" },
  { id: "n13", level: "missing",     department: "ndrc", name: "项目总投资额",   field: "项目总投资额",   material: "境外投资项目备案表", suggestion: "请在境外投资项目备案表中补充项目总投资额" },
  { id: "n14", level: "pass",        department: "ndrc", name: "投资方式",       field: "投资方式",       material: "境外投资项目备案表", suggestion: "字段已识别，值为：新设" },
];

interface GeneratedDoc {
  id: string;
  name: string;
  type: "word" | "pdf";
  department: "commerce" | "ndrc" | "shared";
  status: "done" | "generating" | "idle";
  size?: string;
  isNew?: boolean;
}

const GENERATED_DOCS: GeneratedDoc[] = [
  { id: "g1", name: "综合材料校验报告", type: "pdf", department: "shared", status: "done", size: "1.4 MB" },
  { id: "g2", name: "待补充材料清单", type: "pdf", department: "shared", status: "done", size: "0.3 MB" },
  { id: "g3", name: "字段冲突清单", type: "pdf", department: "shared", status: "done", size: "0.2 MB" },
  { id: "g5", name: "境外投资备案申请表草稿", type: "word", department: "commerce", status: "done", size: "1.1 MB" },
  { id: "g6", name: "境外投资真实性承诺书草稿", type: "word", department: "commerce", status: "done", size: "0.6 MB" },
  { id: "g7", name: "境外并购事项前期报告表草稿", type: "word", department: "commerce", status: "idle" },
];

const DEPT_COLORS: Record<"shared" | "commerce" | "ndrc", { bg: string; color: string; border: string }> = {
  shared: { bg: "#f0f6ff", color: "#4b7cc8", border: "#bfdbfe" },
  commerce: { bg: "#eef6ff", color: "#1a5bc6", border: "#93c5fd" },
  ndrc: { bg: "#f0f0ff", color: "#5b4fc8", border: "#c4b5fd" },
};

const DEPT_LABELS: Record<"shared" | "commerce" | "ndrc", string> = { shared: "共用材料", commerce: "商务委", ndrc: "发改委" };

function DeptBadge({ dept }: { dept: "shared" | "commerce" | "ndrc" | "pending" }) {
  if (dept === "pending") return <span style={{ fontSize: 10, color: "#94a3b8", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px 6px" }}>待确认</span>;
  const c = DEPT_COLORS[dept];
  return <span style={{ fontSize: 10, color: c.color, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap" }}>{DEPT_LABELS[dept]}</span>;
}

function IssueIcon({ level }: { level: ValidationIssue["level"] }) {
  if (level === "consistency") return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="8" fill="#ef4444"/>
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
  if (level === "missing") return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="8" fill="#f59e0b"/>
      <text x="5.5" y="12" fontSize="9" fill="white" fontWeight="bold" fontFamily="sans-serif">!</text>
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="8" fill="#22c55e"/>
      <path d="M5 8l2.5 2.5 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FileIcon({ ext }: { ext: string }) {
  const isPdf = ext === "pdf";
  const isXls = ext === "xlsx" || ext === "xls";
  const fill = isPdf ? "#E2462F" : isXls ? "#1D7A45" : "#2B7CD3";
  const fillDark = isPdf ? "#B52A1A" : isXls ? "#155C34" : "#185ABD";
  const label = isPdf ? "PDF" : isXls ? "XLS" : "W";
  return (
    <svg width="13" height="15" viewBox="0 0 28 34" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 0h16l9 9v22a3 3 0 01-3 3H3a3 3 0 01-3-3V3a3 3 0 013-3z" fill={fill}/>
      <path d="M19 0l9 9h-6a3 3 0 01-3-3V0z" fill={fillDark}/>
      <text x={isPdf ? "3" : "4"} y="26" fontSize={isPdf ? "7" : "9"} fill="white" fontWeight="bold" fontFamily="sans-serif">{label}</text>
    </svg>
  );
}

/**
 * 文件卡片组件：
 * 动效六：新文件从 y 8, autoAlpha 0 进入
 * 触发：isNew=true 挂载时 | 时长：200ms | ease: power2.out | 降级：instant fade
 */
function FileCard({ file, onDelete }: { file: UploadedFile; onDelete: (id: string) => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const ext = file.name.split(".").pop() || "doc";

  useGSAP(() => {
    if (!cardRef.current || !file.isNew) return;
    const mm = gsap.matchMedia();
    mm.add(`not ${REDUCED_MOTION_QUERY}`, () => {
      gsap.fromTo(cardRef.current!,
        { autoAlpha: 0, y: DIST.fileEntry },
        { autoAlpha: 1, y: 0, duration: DUR.fileCard, ease: EASE.out, overwrite: "auto" }
      );
    });
    mm.add(REDUCED_MOTION_QUERY, () => {
      gsap.set(cardRef.current!, { autoAlpha: 1, y: 0 });
    });
  }, { scope: cardRef });

  return (
    <div ref={cardRef} style={{ padding: "8px 10px", borderRadius: 8, background: "#fafcff", border: "1px solid #e8f0fe", display: "flex", alignItems: "center", gap: 8 }}>
      <FileIcon ext={ext} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, color: "#1a2744", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{file.name}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>{file.size}</span>
          {file.recognizeStatus === "recognizing" ? (
            <span style={{ fontSize: 10, color: "#1a5bc6", background: "#eef4ff", border: "1px solid #bfdbfe", borderRadius: 4, padding: "1px 5px", transition: "opacity 0.15s" }}>识别中…</span>
          ) : (
            <span style={{ fontSize: 10, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, padding: "1px 5px", transition: "opacity 0.15s" }}>已识别</span>
          )}
          {file.department !== "pending" && <DeptBadge dept={file.department} />}
        </div>
      </div>
      <button
        onClick={() => onDelete(file.id)}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 3, color: "#94a3b8", flexShrink: 0 }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}

/**
 * 生成文档卡片：
 * 动效九：生成完成后展示轻量 SVG 勾选动效，新文档 Flip 加入列表
 * 触发：status 从 generating → done | 时长：300ms | ease: power2.out
 */
function DocItem({ doc, onGenerate }: { doc: GeneratedDoc; onGenerate: (id: string) => void }) {
  const ext = doc.type;
  const checkRef = useRef<SVGSVGElement>(null);
  const prevStatus = useRef(doc.status);

  useGSAP(() => {
    if (!checkRef.current) return;
    // Animate check path when newly done
    if (prevStatus.current === "generating" && doc.status === "done") {
      const mm = gsap.matchMedia();
      mm.add(`not ${REDUCED_MOTION_QUERY}`, () => {
        const path = checkRef.current!.querySelector("path");
        if (path) {
          const len = (path as SVGPathElement).getTotalLength?.() ?? 20;
          gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
          gsap.to(path, { strokeDashoffset: 0, duration: DUR.checkDone, ease: EASE.out });
        }
      });
    }
    prevStatus.current = doc.status;
  }, { dependencies: [doc.status] });

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
      borderRadius: 8, background: "#fff", border: "1px solid #e8f0fe",
    }}>
      <FileIcon ext={ext} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: "#2d3644", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</span>
        {doc.status === "done" && doc.size && (
          <span style={{ fontSize: 10, color: "#94a3b8" }}>{doc.size}</span>
        )}
      </div>
      {doc.status === "done" && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          {prevStatus.current === "generating" && (
            <svg ref={checkRef} width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#22c55e" strokeWidth="1.5"/>
              <path d="M5 8l2.5 2.5 4-4" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          <button style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #bfdbfe", background: "#f0f6ff", color: "#1a5bc6", fontSize: 11, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>
            下载
          </button>
        </div>
      )}
      {doc.status === "generating" && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span style={{ display: "inline-flex", gap: 3 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "#1a5bc6", display: "inline-block", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </span>
          <span style={{ fontSize: 10, color: "#1a5bc6" }}>生成中</span>
        </div>
      )}
      {doc.status === "idle" && (
        <button
          onClick={() => onGenerate(doc.id)}
          style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: "linear-gradient(135deg,#2563eb,#1a4ca8)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
        >
          生成
        </button>
      )}
    </div>
  );
}

function BlockedReason({ items }: { items: string[] }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "#3a4f72", marginBottom: 8 }}>当前尚未满足草稿生成条件，需解决以下问题：</p>
      {items.map((c, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "5px 0", borderBottom: i < items.length - 1 ? "1px solid #f3f4f6" : "none" }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="8" cy="8" r="8" fill="#f59e0b"/>
            <text x="5.5" y="12" fontSize="9" fill="white" fontWeight="bold" fontFamily="sans-serif">!</text>
          </svg>
          <span style={{ fontSize: 11, color: "#6b8ab0" }}>{c}</span>
        </div>
      ))}
    </div>
  );
}

function CategoryLabel({ level }: { level: ValidationIssue["level"] }) {
  if (level === "consistency") return (
    <span style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", background: "#fff2f2", border: "1px solid #fecaca", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" }}>一致性异常</span>
  );
  if (level === "missing") return (
    <span style={{ fontSize: 10, fontWeight: 700, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" }}>字段缺失</span>
  );
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" }}>通过</span>
  );
}

function ReviewSection({ title, color, bg, border, headerBg, stats, issues }: {
  title: string; color: string; bg: string; border: string; headerBg: string;
  stats: { pass: number; missing: number; consistency: number };
  issues: ValidationIssue[];
}) {
  const [open, setOpen] = useState(true);

  const consistencyItems = issues.filter(i => i.level === "consistency");
  const missingItems = issues.filter(i => i.level === "missing");
  const passItems = issues.filter(i => i.level === "pass");

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 13px", background: headerBg, border: "none", cursor: "pointer" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "一致性", value: stats.consistency, color: "#dc2626" },
              { label: "缺失", value: stats.missing, color: "#b45309" },
              { label: "通过", value: stats.pass, color: "#16a34a" },
            ].map(s => (
              <span key={s.label} style={{ fontSize: 11 }}>
                <span style={{ fontWeight: 700, color: s.color }}>{s.value}</span>
                <span style={{ color: color, opacity: 0.6, marginLeft: 2 }}>{s.label}</span>
              </span>
            ))}
          </div>
          <svg width="11" height="7" viewBox="0 0 12 8" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "0.2s", flexShrink: 0 }}>
            <path d="M1 1l5 5 5-5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>
      {open && (
        <div style={{ padding: "0 13px 10px", borderTop: `1px solid ${border}` }}>
          {[
            { items: consistencyItems, cardBg: "#fff2f2", cardBorder: "#fecaca", textColor: "#7f1d1d" },
            { items: missingItems, cardBg: "#fffbeb", cardBorder: "#fde68a", textColor: "#78350f" },
            { items: passItems, cardBg: "#f0fdf4", cardBorder: "#bbf7d0", textColor: "#14532d" },
          ].map(({ items, cardBg, cardBorder, textColor }) =>
            items.map(issue => (
              <div key={issue.id} style={{ padding: "8px 10px", borderRadius: 7, background: cardBg, border: `1px solid ${cardBorder}`, marginTop: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <IssueIcon level={issue.level} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1a2744", flex: 1 }}>{issue.field}</span>
                  <CategoryLabel level={issue.level} />
                </div>
                <p style={{ fontSize: 11, color: "#6b8ab0", marginBottom: 2 }}>来源：{issue.material}</p>
                {issue.value && (
                  <p style={{ fontSize: 11, color: textColor, background: cardBg, borderRadius: 4, padding: "3px 6px", marginBottom: 2, lineHeight: 1.6 }}>{issue.value}</p>
                )}
                <p style={{ fontSize: 11, color: "#3a4f72" }}>建议：{issue.suggestion}</p>
              </div>
            ))
          )}
          {issues.length === 0 && <p style={{ fontSize: 11, color: "#6b8ab0", padding: "8px 0" }}>暂无问题。</p>}
        </div>
      )}
    </div>
  );
}

function DocSection({ title, titleColor, bg, headerBg, border, badge, children }: {
  title: string; titleColor: string; bg: string; headerBg: string; border: string;
  badge?: { text: string; color: string; bg: string; border: string };
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "9px 13px", background: headerBg, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: titleColor }}>{title}</span>
        {badge && (
          <span style={{ fontSize: 10, color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`, borderRadius: 4, padding: "1px 6px" }}>{badge.text}</span>
        )}
      </div>
      <div style={{ padding: "10px 13px" }}>{children}</div>
    </div>
  );
}

const TAB_LABELS: Record<Tab, string> = { materials: "材料上传", review: "材料校验中心", confirm: "生成管理" };

/**
 * OdiAssistantWorkbench
 *
 * 动效五：Tab 激活指示线（Flip 平滑移动）
 *   触发：切换 Tab | 时长：180ms | ease: power3.inOut | 降级：instant
 * 动效五：面板内容交叉淡化
 *   触发：切换 Tab | 时长：180ms | ease: power2.out
 * 动效六：文件卡片进入 y 8, autoAlpha 0
 *   触发：新文件上传 | 时长：200ms | ease: power2.out
 * 动效九：生成完成勾选 SVG 路径动效
 *   触发：status generating→done | 时长：300ms | ease: power2.out
 */
export function OdiAssistantWorkbench({ onClose, initialTab, fullWidth }: { onClose?: () => void; initialTab?: Tab; fullWidth?: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "review");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(MOCK_FILES);
  const [validationState, setValidationState] = useState<ValidationState>("done");
  const [validationProgress, setValidationProgress] = useState(100);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDoc[]>(GENERATED_DOCS);

  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tabIndicatorRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const prevTabRef = useRef<Tab>(activeTab);

  // Tab indicator Flip animation + panel crossfade
  useGSAP(() => {
    if (!tabsContainerRef.current || !tabIndicatorRef.current) return;

    const prevTab = prevTabRef.current;
    if (prevTab === activeTab) return;

    const mm = gsap.matchMedia();

    mm.add(`not ${REDUCED_MOTION_QUERY}`, () => {
      // Panel crossfade: fade out old, fade in new
      if (panelRef.current) {
        gsap.fromTo(panelRef.current,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: DUR.tabPanel, ease: EASE.out, overwrite: "auto" }
        );
      }

      // Tab indicator Flip
      const tabs = tabsContainerRef.current!.querySelectorAll("[data-tab]");
      const activeEl = tabsContainerRef.current!.querySelector(`[data-tab="${activeTab}"]`);
      if (activeEl && tabIndicatorRef.current) {
        const state = Flip.getState(tabIndicatorRef.current);
        // Move indicator under active tab
        (activeEl as HTMLElement).appendChild(tabIndicatorRef.current);
        Flip.from(state, {
          duration: DUR.tabPanel * 1.5,
          ease: EASE.inOut,
          overwrite: "auto",
        });
      }
      void tabs; // suppress unused warning
    });

    mm.add(REDUCED_MOTION_QUERY, () => {
      if (panelRef.current) gsap.set(panelRef.current, { autoAlpha: 1 });
    });

    prevTabRef.current = activeTab;
  }, { scope: containerRef, dependencies: [activeTab] });

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const deptCycle: ("shared" | "commerce" | "ndrc")[] = ["shared", "commerce", "ndrc", "shared", "shared"];
    const newFiles: UploadedFile[] = Array.from(files).map((f, i) => ({
      id: `f-${Date.now()}-${i}`,
      name: f.name,
      size: f.size > 0 ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : "—",
      recognizeStatus: "recognizing" as const,
      department: "pending" as const,
      isNew: true,
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach((file, i) => {
      setTimeout(() => {
        setUploadedFiles(prev => prev.map(f =>
          f.id === file.id ? { ...f, recognizeStatus: "recognized", department: deptCycle[i % deptCycle.length] } : f
        ));
      }, 1200 + i * 500);
    });
    e.target.value = "";
  };

  const handleStartValidation = () => {
    if (validationState === "running") return;
    setValidationState("running");
    setValidationProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += 12;
      const capped = Math.min(p, 100);
      setValidationProgress(capped);
      if (capped >= 100) {
        clearInterval(iv);
        setValidationState("done");
        setActiveTab("review");
      }
    }, 150);
  };

  const handleGenerateDoc = (docId: string) => {
    setGeneratedDocs(prev => prev.map(d => d.id === docId ? { ...d, status: "generating" } : d));
    setTimeout(() => {
      setGeneratedDocs(prev => prev.map(d =>
        d.id === docId ? { ...d, status: "done", size: "1.0 MB", isNew: true } : d
      ));
    }, 2000);
  };

  const handleDeleteFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const hasFiles = uploadedFiles.length > 0;

  const commerceIssues = SAMPLE_ISSUES.filter(i => i.department === "commerce");
  const ndrcIssues = SAMPLE_ISSUES.filter(i => i.department === "ndrc");

  const commerceStats = {
    pass: commerceIssues.filter(i => i.level === "pass").length,
    missing: commerceIssues.filter(i => i.level === "missing").length,
    consistency: commerceIssues.filter(i => i.level === "consistency").length,
  };
  const ndrcStats = {
    pass: ndrcIssues.filter(i => i.level === "pass").length,
    missing: ndrcIssues.filter(i => i.level === "missing").length,
    consistency: ndrcIssues.filter(i => i.level === "consistency").length,
  };

  return (
    <div ref={containerRef} style={{ width: fullWidth ? "100%" : 400, height: "100%", background: "#fff", borderRadius: fullWidth ? 0 : 16, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: fullWidth ? "none" : "0 2px 20px rgba(26,64,140,0.12)" }}>

      {/* Header */}
      <div style={{ padding: "12px 14px 0", borderBottom: "1px solid #e8f0fe", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "linear-gradient(135deg,#2563eb,#1a4ca8)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1a2744", flex: 1 }}>ODI 工作台</span>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
            {[0, 1, 2].map(i => <span key={i} style={{ display: "block", width: 13, height: 1.5, background: "#6b8ab0", borderRadius: 1 }} />)}
          </button>
        </div>

        {/* Status row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, padding: "5px 8px", background: "#f8faff", borderRadius: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#1a2744", flex: 1 }}>ODI 申报助办</span>
          <span style={{ fontSize: 11, color: validationState === "done" ? "#16a34a" : validationState === "running" ? "#1a5bc6" : "#6b8ab0" }}>
            {validationState === "done" ? "校验已完成" : validationState === "running" ? "校验中…" : "材料准备中"}
          </span>
        </div>

        {/* Tabs with Flip indicator */}
        <div ref={tabsContainerRef} style={{ display: "flex", position: "relative" }}>
          {(["materials", "review", "confirm"] as Tab[]).map(tab => {
            const active = activeTab === tab;
            return (
              <div key={tab} data-tab={tab} style={{ flex: 1, position: "relative" }}>
                <button
                  onClick={() => setActiveTab(tab)}
                  style={{
                    width: "100%", padding: "7px 0", fontSize: 12, fontWeight: active ? 700 : 400,
                    color: active ? "#1a5bc6" : "#6b8ab0",
                    background: "transparent", border: "none", cursor: "pointer",
                    borderBottom: active ? "2px solid #1a5bc6" : "2px solid transparent",
                    transition: "color 0.15s, border-color 0.15s",
                    display: "block",
                  }}
                >
                  {TAB_LABELS[tab]}
                </button>
              </div>
            );
          })}
          {/* GSAP Flip indicator: invisible, used only for position tracking */}
          <div ref={tabIndicatorRef} style={{ position: "absolute", bottom: 0, height: 2, background: "transparent", pointerEvents: "none" }} />
        </div>
      </div>

      {/* Content panel */}
      <div ref={panelRef} style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* ══ 材料上传 ══ */}
        {activeTab === "materials" && (
          <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "none", padding: "12px 14px 8px" }}>
            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 6, padding: "16px 12px", borderRadius: 10, marginBottom: 10,
              border: "1.5px dashed #93c5fd", background: "#f8fbff", cursor: "pointer",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "#eef4fe")}
              onMouseLeave={e => (e.currentTarget.style.background = "#f8fbff")}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a5bc6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1a2744" }}>点击或拖拽上传材料</span>
              <span style={{ fontSize: 11, color: "#6b8ab0", textAlign: "center" }}>系统将自动识别材料类型和适用部门</span>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>单文件不超过 40MB · DOCX / XLSX / PDF</span>
              <input type="file" multiple accept=".docx,.xlsx,.pptx,.pdf" style={{ display: "none" }} onChange={handleUpload} />
            </label>

            {uploadedFiles.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#1a2744", marginBottom: 8 }}>已上传文件（{uploadedFiles.length}）</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {uploadedFiles.map(file => (
                    <FileCard key={file.id} file={file} onDelete={handleDeleteFile} />
                  ))}
                </div>
              </div>
            )}

            {uploadedFiles.length === 0 && (
              <div style={{ padding: "14px", borderRadius: 8, background: "#f8faff", border: "1px solid #e8f0fe", textAlign: "center" }}>
                <p style={{ fontSize: 12, color: "#6b8ab0" }}>尚未上传材料，请在上方上传区域添加文件。</p>
              </div>
            )}

            <div style={{ padding: "10px 0 2px", borderTop: "1px solid #e8f0fe", marginTop: 14 }}>
              {validationState === "running" && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#1a5bc6" }}>校验中…</span>
                    <span style={{ fontSize: 11, color: "#1a5bc6" }}>{validationProgress}%</span>
                  </div>
                  <div style={{ height: 4, background: "#e2eaf5", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${validationProgress}%`, height: "100%", background: "linear-gradient(90deg,#2563eb,#1a4ca8)", transition: "width 0.15s" }} />
                  </div>
                </div>
              )}
              <button
                disabled={!hasFiles || validationState === "running"}
                onClick={handleStartValidation}
                style={{
                  width: "100%", padding: "10px 0", borderRadius: 8, border: "none",
                  cursor: hasFiles && validationState !== "running" ? "pointer" : "default",
                  background: hasFiles && validationState !== "running" ? "linear-gradient(135deg,#2563eb,#1a4ca8)" : "#e2eaf5",
                  color: hasFiles && validationState !== "running" ? "#fff" : "#94a3b8",
                  fontSize: 13, fontWeight: 700,
                  boxShadow: hasFiles && validationState !== "running" ? "0 2px 8px rgba(37,99,235,0.25)" : "none",
                  transition: "all 0.15s", marginBottom: 6,
                }}
              >
                {validationState === "running" ? "校验中…" : validationState === "done" ? "重新校验" : "开始校验"}
              </button>
              <p style={{ fontSize: 11, color: "#6b8ab0", textAlign: "center" }}>
                {hasFiles ? "将分别执行商务委材料校验和发改委材料校验（共性材料各自比对）。" : "请至少上传一份材料，再点击开始校验。"}
              </p>
            </div>
          </div>
        )}

        {/* ══ 材料校验中心 ══ */}
        {activeTab === "review" && (
          <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "none", padding: "12px 14px 16px" }}>
            {validationState !== "done" ? (
              <div style={{ padding: "32px 16px", borderRadius: 12, background: "#f8faff", border: "1px solid #e8f0fe", textAlign: "center" }}>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ margin: "0 auto 12px", display: "block" }}>
                  <circle cx="20" cy="20" r="20" fill="#eef4fe"/>
                  <path d="M13 20h14M20 27V13" stroke="#93a8c4" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1a2744", marginBottom: 6 }}>尚未开始校验</p>
                <p style={{ fontSize: 12, color: "#6b8ab0", lineHeight: 1.7 }}>请先在"材料上传"中添加材料，完成材料识别后点击"开始校验"。</p>
                <button onClick={() => setActiveTab("materials")} style={{ marginTop: 14, padding: "7px 20px", borderRadius: 8, background: "linear-gradient(135deg,#2563eb,#1a4ca8)", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>
                  前往材料上传
                </button>
              </div>
            ) : (
              <>
                <div style={{ padding: "10px 12px", background: "#f8faff", border: "1px solid #e8f0fe", borderRadius: 10, marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#1a2744" }}>已识别材料</span>
                    <span style={{ fontSize: 10, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, padding: "1px 6px" }}>{uploadedFiles.length} 份</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {uploadedFiles.map(f => (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 5, background: "#fff", border: "1px solid #e2eaf5", fontSize: 11, color: "#3a4f72" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: f.department === "commerce" ? "#3b82f6" : f.department === "ndrc" ? "#8b5cf6" : "#22c55e" }} />
                        {f.name.split(".")[0]}
                      </div>
                    ))}
                  </div>
                </div>

                <ReviewSection
                  title="商务委材料校验结果"
                  color="#1a5bc6" bg="#eef6ff" border="#93c5fd" headerBg="linear-gradient(135deg,#dbeafe,#bfdbfe)"
                  stats={commerceStats}
                  issues={commerceIssues}
                />
                <ReviewSection
                  title="发改委材料校验结果"
                  color="#5b4fc8" bg="#f4f0ff" border="#c4b5fd" headerBg="linear-gradient(135deg,#ede9fe,#ddd6fe)"
                  stats={ndrcStats}
                  issues={ndrcIssues}
                />
              </>
            )}
          </div>
        )}

        {/* ══ 生成管理 ══ */}
        {activeTab === "confirm" && (
          <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "none", padding: "12px 14px 16px" }}>
            <DocSection
              title="商务委材料"
              titleColor="#1a5bc6"
              bg="#f8faff" headerBg="#eef4fe" border="#e8f0fe"
              badge={{ text: "支持生成", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" }}
            >
              {validationState !== "done" ? (
                <BlockedReason items={[
                  "尚未上传可行性研究报告",
                  "关键项目信息（投资金额、境外企业名称）尚未识别",
                  "存在待确认的跨材料金额冲突",
                ]} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {generatedDocs.filter(d => d.department === "commerce").map(doc => (
                    <DocItem key={doc.id} doc={doc} onGenerate={handleGenerateDoc} />
                  ))}
                  <button
                    onClick={() => {
                      generatedDocs.filter(d => d.department === "commerce" && d.status === "idle").forEach(d => handleGenerateDoc(d.id));
                    }}
                    style={{ marginTop: 4, width: "100%", padding: "9px 0", borderRadius: 8, background: "linear-gradient(135deg,#2563eb,#1a4ca8)", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.2)" }}
                  >
                    生成所有商务委草稿
                  </button>
                </div>
              )}
            </DocSection>

            {/* 发改委：仅支持材料校验，不支持生成 */}
            <DocSection
              title="发改委材料"
              titleColor="#5b4fc8"
              bg="#f9f8ff" headerBg="#ede9fe" border="#ddd6fe"
              badge={{ text: "暂不支持生成", color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" }}
            >
              <div style={{ padding: "10px 4px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="8" cy="8" r="8" fill="#e5e7eb"/>
                  <path d="M8 5v3M8 11v0.5" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.7, margin: 0 }}>
                  当前仅支持材料校验，暂不支持材料生成。
                </p>
              </div>
            </DocSection>
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmTabContent({ generateState: _gs }: { generateState: string; hideUploaded?: boolean }) {
  return null;
}
