import { useState, useRef } from "react";
import { RobotAvatar, ChatInputBar } from "./WelcomeFrame";
import { DemoFormBubble } from "./DemoFormBubble";
import { ANALYSIS_ITEMS } from "./odiAssistantData";

interface Props {
  mode: "non-odi" | "odi";
  serviceType?: "助办" | "导办";
  onOdiClick: () => void;
  onDemoClick?: () => void;
  onDemoFieldChange?: (key: string, value: string) => void;
  showOdiAssistant?: boolean;
  showOdiDemo?: boolean;
  analyzedCount?: number;
  onItemAnalyzed?: (n: number) => void;
  onPhase2Done?: () => void;
  onGenerateMaterials?: () => void;
  initialMaterialsExpanded?: boolean;
}

const USER_AVATAR = (
  <div style={{
    width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
    background: "#1a5bc6", display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    <svg width="17" height="17" viewBox="0 0 17 17" fill="white">
      <circle cx="8.5" cy="6" r="3" />
      <path d="M2 15c0-3.5 2.9-6.5 6.5-6.5S15 11.5 15 15" />
    </svg>
  </div>
);

function QuickChip({ label }: { label: string }) {
  return (
    <button style={{
      padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
      borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
      borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
      borderTopColor: "#bfdbfe", borderRightColor: "#bfdbfe", borderBottomColor: "#bfdbfe", borderLeftColor: "#bfdbfe",
      background: "#eef4fe", color: "#1a5bc6", transition: "all 0.15s", whiteSpace: "nowrap",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#dbeafe"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "#eef4fe"; }}
    >{label}</button>
  );
}

function WordIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 28 34" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 0h16l9 9v22a3 3 0 01-3 3H3a3 3 0 01-3-3V3a3 3 0 013-3z" fill="#2B7CD3"/>
      <path d="M19 0l9 9h-6a3 3 0 01-3-3V0z" fill="#185ABD"/>
      <text x="4" y="26" fontSize="9" fill="white" fontWeight="bold" fontFamily="sans-serif">W</text>
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 28 34" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 0h16l9 9v22a3 3 0 01-3 3H3a3 3 0 01-3-3V3a3 3 0 013-3z" fill="#E2462F"/>
      <path d="M19 0l9 9h-6a3 3 0 01-3-3V0z" fill="#B52A1A"/>
      <text x="3" y="26" fontSize="7" fill="white" fontWeight="bold" fontFamily="sans-serif">PDF</text>
    </svg>
  );
}

/* ── Design-matched icon components ── */

function ThinkIcon() {
  return (
    <svg width="14" height="18" viewBox="0 0 22 28" fill="none" style={{ flexShrink: 0 }}>
      <path d="M11 1C6.03 1 2 5.03 2 10c0 3.1 1.56 5.84 3.97 7.52L5.5 23h11l-.47-5.48C18.44 15.84 20 13.1 20 10c0-4.97-4.03-9-9-9z" fill="#4281ED"/>
      <rect x="7" y="23.5" width="8" height="1.5" rx="0.75" fill="#4281ED" opacity="0.7"/>
      <rect x="8" y="25.5" width="6" height="1.5" rx="0.75" fill="#4281ED" opacity="0.5"/>
    </svg>
  );
}

function ChevronDown({ color = "#707070" }: { color?: string }) {
  return (
    <svg width="11" height="7" viewBox="0 0 12 8" fill="none" style={{ flexShrink: 0 }}>
      <path d="M1 1l5 5 5-5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function DocFileIcon({ ext }: { ext: string }) {
  const isDoc = ext === "doc" || ext === "docx" || ext === "word";
  const isPdf = ext === "pdf";
  const color = isDoc ? "#0F83FF" : isPdf ? "#E2462F" : "#0F83FF";
  const label = isDoc ? "W" : isPdf ? "PDF" : ext.toUpperCase().slice(0, 3);
  return (
    <svg width="14" height="17" viewBox="0 0 20 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2 0h11l7 7v15a2 2 0 01-2 2H2a2 2 0 01-2-2V2a2 2 0 012-2z" fill={color}/>
      <path d="M13 0l7 7h-5a2 2 0 01-2-2V0z" fill={color} opacity="0.6"/>
      <text x="3" y="19" fontSize={isPdf ? "5.5" : "7"} fill="white" fontWeight="bold" fontFamily="sans-serif">{label}</text>
    </svg>
  );
}

function SourceChip({ name, ext }: { name: string; ext: string }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 10px", borderRadius: 6,
      background: "#EFF3F8",
      fontSize: 12, color: "#1f1f1f",
    }}>
      <DocFileIcon ext={ext} />
      <span>{name}</span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="9" fill="#58D479"/>
      <path d="M5 9l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const SOURCE_FILES = [
  { name: "营业执照", ext: "jpg" },
  { name: "银行开具的", ext: "doc" },
  { name: "经审计的财务报表、最近一期公司财报", ext: "doc" },
  { name: "投资环境报告", ext: "doc" },
  { name: "可行性报告", ext: "doc" },
  { name: "股东会决议、董事会决议", ext: "doc" },
];

const TEMPLATE_DOCS = [
  { name: "境外投资备案申请表-空白表格（商务部门）", ext: "word", ok: true },
  { name: "境外投资真实性承诺书-分公司示例（商务部门）", ext: "word", ok: true },
  { name: "境外投资真实性承诺书-子公司空白（商务部门）", ext: "word", ok: true },
  { name: "境外投资备案申请表-示例表格（商务部门）", ext: "word", ok: true },
  { name: "境外投资真实性承诺书-分公司空白（商务部门）", ext: "word", ok: true },
  { name: "境外投资真实性承诺书-空白表格（发改部门）", ext: "word", ok: true },
  { name: "《境外并购事项前期报告表》-（示例表格）", ext: "word", ok: true },
  { name: "境外投资备案申请表-示例表格（发改部门）", ext: "word", ok: true },
  { name: "境外投资真实性承诺书-子公司示例（商务部门）", ext: "word", ok: true },
  { name: "企业项目申请备案的请示-空白表格（发改部门）", ext: "word", ok: true },
  { name: "《境外并购事项前期报告表》-空白表格", ext: "word", ok: true },
  { name: "境外投资备案申请表-空白表格（发改部门）", ext: "word", ok: false },
  { name: "境外投资真实性承诺书-示例表格（发改部门）", ext: "word", ok: false },
  { name: "股权架构图-示例表格（发改部门）", ext: "word", ok: false },
  { name: "股权架构图-空白表格（发改部门）", ext: "word", ok: false },
  { name: "企业项目申请备案的请示-示例表格（发改部门）", ext: "word", ok: false },
];

const SUPPLEMENT_FILES = [
  { label: "股权架构图", ok: true },
  { label: "统一社会信用代码证书", ok: true },
  { label: "注册资本验资报告", ok: true },
  { label: "境外投资备案申请表（发改部门）", ok: true },
  { label: "资金来源说明函", ok: true },
];

type UploadState = "idle" | "thinking" | "analyzing" | "done" | "thinking2" | "analyzing2" | "done2";

export function OdiQaFrame({ mode, serviceType = "助办", onOdiClick, onDemoClick, onDemoFieldChange, showOdiAssistant, showOdiDemo, analyzedCount = 0, onItemAnalyzed, onPhase2Done, onGenerateMaterials, initialMaterialsExpanded = false }: Props) {
  const [inputVal, setInputVal] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [fileName, setFileName] = useState("项目支撑材料");
  const [fileName2, setFileName2] = useState("补充材料包");
  const [analyzedCount2, setAnalyzedCount2] = useState(0);
  const [generateClicked, setGenerateClicked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isOdi = mode === "odi";

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFileName(file.name.replace(/\.[^/.]+$/, "") || "项目支撑材料");
    setUploadState("thinking");

    setTimeout(() => {
      setUploadState("analyzing");
      let count = 0;
      const tick = () => {
        count++;
        onItemAnalyzed?.(count);
        scrollToBottom();
        if (count < ANALYSIS_ITEMS.length) {
          setTimeout(tick, 700);
        } else {
          setUploadState("done");
          scrollToBottom();
        }
      };
      setTimeout(tick, 500);
    }, 1500);
  };

  const handleFile2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFileName2(file.name.replace(/\.[^/.]+$/, "") || "补充材料包");
    setUploadState("thinking2");
    scrollToBottom();

    setTimeout(() => {
      setUploadState("analyzing2");
      let count = 0;
      const tick = () => {
        count++;
        setAnalyzedCount2(count);
        scrollToBottom();
        if (count < SUPPLEMENT_FILES.length) {
          setTimeout(tick, 700);
        } else {
          setUploadState("done2");
          onPhase2Done?.();
          scrollToBottom();
        }
      };
      setTimeout(tick, 500);
    }, 1500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "14px 12px 0 4px" }}>
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8, scrollbarWidth: "none" }}>

        {/* User question bubble */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "flex-start" }}>
          <div style={{
            background: "linear-gradient(135deg,#2563eb,#1a4ca8)",
            borderRadius: 10, padding: "10px 18px",
            color: "#fff", fontSize: 14, fontWeight: 500, maxWidth: "72%",
          }}>
            {isOdi ? `ODI ${serviceType}` : "阿布扎比的投资政策怎么样？"}
          </div>
          {USER_AVATAR}
        </div>

        {/* AI reply card */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <RobotAvatar size={42} />
          <div style={{
            flex: 1, background: "#fff", borderRadius: 12, padding: "20px 24px",
            boxShadow: "0 2px 12px rgba(26,64,140,0.07)",
            border: "1px solid #e8f0fe",
          }}>
            {isOdi ? <OdiReplyContent onOdiClick={onOdiClick} onDemoClick={onDemoClick} serviceType={serviceType} initialClicked={initialMaterialsExpanded} /> : <NonOdiReplyContent />}
          </div>
        </div>

        {/* Second turn after clicking ODI助办 */}
        {isOdi && showOdiAssistant && (
          <>
            {/* ODI申报助办已启动 AI bubble */}
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: "fadeSlideIn 0.4s ease" }}>
              <RobotAvatar size={42} />
              <div style={{ flex: 1, background: "#fff", borderRadius: 12, padding: "18px 20px", boxShadow: "0 2px 12px rgba(26,64,140,0.07)", border: "1px solid #e8f0fe" }}>
                {/* Title row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="8" fill="#22c55e"/>
                      <path d="M5 8l2.5 2.5 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1a2744" }}>ODI 申报助办已启动</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1a5bc6", display: "inline-block" }} />
                    <span style={{ fontSize: 12, color: "#1a5bc6", fontWeight: 500 }}>申报助办 运行中</span>
                  </div>
                </div>

                {/* Body */}
                <div style={{ fontSize: 13, color: "#3a4f72", lineHeight: 1.85 }}>
                  <p style={{ marginBottom: 10 }}>
                    您已进入"申报助办"服务。本服务面向准备 ODI 备案申报的企业，提供申报前材料辅助整理、材料校验和材料草稿生成服务。您可在右侧 ODI 工作台上传相关材料，并根据提示完成材料校验、结果查看或辅助材料生成。
                  </p>
                  <p style={{ marginBottom: 10 }}>
                    平台将依法依规采取必要的数据安全保护措施。企业上传的材料仅用于本次申报助办服务中的材料识别、校验和草稿生成，不会用于与本次服务无关的其他用途，也不会对外泄露企业材料内容及相关隐私信息。
                  </p>
                  <p style={{ marginBottom: 6 }}>当前智能体主要支持两类服务方向：</p>
                  <p style={{ marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, color: "#1a2744" }}>一是商务委 ODI 申报助办。</span>
                    智能体可根据企业提供的材料对《境外投资项目备案表》《境外投资真实性承诺书》等进行完整性、字段一致性、金额逻辑和跨材料一致性校验，辅助企业在正式申报前发现材料缺失、信息冲突、金额不一致及需进一步核对完善的内容；如已上传可行性研究报告并满足生成条件，还可辅助生成《境外投资备案申请表》《境外投资真实性承诺书》等材料草稿。并购项目可根据材料情况辅助生成《境外并购事项前期报告表》草稿。
                  </p>
                  <p style={{ marginBottom: 12 }}>
                    <span style={{ fontWeight: 600, color: "#1a2744" }}>二是发改委境外投资项目申报助办。</span>
                    智能体当前提供材料校验能力，可对《境外投资项目备案表》《企业项目申请备案的请示》《境外投资真实性承诺书》、投资主体营业执照、经审计财务报表、资金来源支持文件等材料进行完整性、字段一致性、金额逻辑和跨材料一致性校验，辅助企业在正式申报前发现材料缺失、信息冲突、金额不一致及需进一步核对完善的内容。
                  </p>
                  <div style={{ padding: "9px 12px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", marginBottom: 12, fontSize: 12, color: "#92400e", lineHeight: 1.7 }}>
                    请注意，本服务不替代官方申报系统，不代表主管部门审核结论。系统生成内容和校验结果仅供申报准备参考，正式提交前请企业自行核验，并以主管部门相关备案审核要求为准。
                  </div>
                  <p style={{ color: "#1a5bc6", fontWeight: 500 }}>
                    您可以先在右侧 ODI 工作台上传材料，完成后点击"开始校验"。
                  </p>
                </div>
              </div>
            </div>


            {/* First analysis block */}
            {uploadState !== "idle" && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <RobotAvatar size={42} />
                <div style={{
                  flex: 1, background: "#fff", borderRadius: 12,
                  boxShadow: "0 2px 12px rgba(26,64,140,0.07)", border: "1px solid #e8f0fe",
                  overflow: "hidden",
                }}>
                  {/* "正在思考中" header row — always visible */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "12px 18px",
                    borderBottom: uploadState !== "thinking" ? "1px solid #f0f4ff" : "none",
                  }}>
                    <ThinkIcon />
                    <span style={{ fontSize: 13, color: "#222", flex: 1 }}>正在思考中</span>
                    {uploadState === "thinking" ? (
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        {[0, 1, 2].map(i => (
                          <span key={i} style={{
                            width: 5, height: 5, borderRadius: "50%", background: "#93a8c4",
                            display: "inline-block",
                            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                          }} />
                        ))}
                      </span>
                    ) : (
                      <ChevronDown />
                    )}
                  </div>

                  {/* Content — shown after thinking */}
                  {uploadState !== "thinking" && (
                    <div style={{ padding: "14px 18px" }}>

                      {/* "完整性检查" status sub-header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        {/* Status dot: blue while analyzing, orange if missing files, green if all ok */}
                        {uploadState === "analyzing" ? (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                            <circle cx="6" cy="6" r="6" fill="#4281ED"/>
                          </svg>
                        ) : TEMPLATE_DOCS.some(d => !d.ok) ? (
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                            <circle cx="8" cy="8" r="8" fill="#F09A37"/>
                            <text x="5.2" y="12" fontSize="10" fill="white" fontWeight="bold" fontFamily="sans-serif">!</text>
                          </svg>
                        ) : (
                          <CheckIcon />
                        )}
                        <span style={{ fontSize: 13, color: "#222", flex: 1 }}>
                          {uploadState === "analyzing"
                            ? "正在检查文件完整性..."
                            : TEMPLATE_DOCS.some(d => !d.ok)
                              ? "完整性检查未通过"
                              : "完整性检查通过"}
                        </span>
                        {uploadState !== "analyzing" && <ChevronDown />}
                      </div>

                      {/* File count line */}
                      {analyzedCount > 0 && (
                        <p style={{ fontSize: 13, color: "#1f1f1f", fontWeight: 600, marginBottom: 14 }}>
                          {uploadState === "done" || uploadState === "thinking2" || uploadState === "analyzing2" || uploadState === "done2"
                            ? "共解析出 17份文件，已校验完成"
                            : `共解析出 ${analyzedCount + 10}份文件，正在通过多模态大模型校验文件信息`}
                        </p>
                      )}

                      {/* Source file chips */}
                      {analyzedCount > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                          {SOURCE_FILES.map((f, i) => (
                            <SourceChip key={i} name={f.name} ext={f.ext} />
                          ))}
                        </div>
                      )}

                      {/* Template docs list */}
                      {analyzedCount > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          {TEMPLATE_DOCS.map((doc, i) => (
                            <div key={i} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "8px 0",
                              borderBottom: i < TEMPLATE_DOCS.length - 1 ? "1px solid #f3f4f6" : "none",
                              animation: `fadeSlideIn 0.3s ease ${i * 0.04}s both`,
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, marginRight: 10 }}>
                                <DocFileIcon ext={doc.ext} />
                                <span style={{ fontSize: 12, color: "#2d3644" }}>{doc.name}</span>
                              </div>
                              {doc.ok ? (
                                <CheckIcon />
                              ) : (
                                <span style={{ fontSize: 11, color: "#F09A37", fontWeight: 500, whiteSpace: "nowrap" }}>待补充</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* "申报材料齐全性" summary warning — shown once done */}
                      {(uploadState === "done" || uploadState === "thinking2" || uploadState === "analyzing2" || uploadState === "done2") && (
                        <div style={{
                          padding: "10px 14px", borderRadius: 8,
                          background: "#EDF0F5",
                          animation: "fadeSlideIn 0.4s ease",
                        }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "#1a60c6", marginBottom: 6 }}>申报材料齐全性</p>
                          <p style={{ fontSize: 11, color: "#3a4f72", lineHeight: 1.8 }}>
                            缺少&nbsp;<span style={{ color: "#e64444", fontWeight: 700 }}>5</span>&nbsp;项材料：境外投资备案申请表-空白表格（发改部门）、境外投资真实性承诺书-示例表格（发改部门）、股权架构图-空白表格（发改部门）、股权架构图-示例表格（发改部门）、企业项目申请备案的请示-示例表格（发改部门）
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Second upload prompt (Frame 7) */}
            {uploadState === "done" && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: "fadeSlideIn 0.4s ease" }}>
                <RobotAvatar size={42} />
                <div style={{
                  flex: 1, background: "#fff", borderRadius: 12, padding: "18px 22px",
                  boxShadow: "0 2px 12px rgba(26,64,140,0.07)", border: "1px solid #e8f0fe",
                }}>
                  <p style={{ fontSize: 13, color: "#2d3644", lineHeight: 1.8, marginBottom: 14 }}>
                    请将缺少的材料补充上传：
                  </p>
                  <label style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "9px 20px", borderRadius: 8, cursor: "pointer",
                    background: "linear-gradient(135deg,#2563eb,#1a4ca8)",
                    color: "#fff", fontSize: 13, fontWeight: 500,
                    boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    点击上传材料包
                    <input type="file" style={{ display: "none" }} onChange={handleFile2Change} />
                  </label>
                </div>
              </div>
            )}

            {/* Second ZIP chip shown (Frame 8) */}
            {(uploadState === "thinking2" || uploadState === "analyzing2" || uploadState === "done2") && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: "fadeSlideIn 0.3s ease" }}>
                <RobotAvatar size={42} />
                <div style={{
                  flex: 1, background: "#fff", borderRadius: 12, padding: "18px 22px",
                  boxShadow: "0 2px 12px rgba(26,64,140,0.07)", border: "1px solid #e8f0fe",
                }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1a2744", marginBottom: 12 }}>补充材料包</p>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 10,
                    padding: "8px 14px", borderRadius: 8,
                    background: "#f0f6fd", border: "1px solid #dbeafe",
                  }}>
                    <svg width="28" height="32" viewBox="0 0 35 40" fill="none">
                      <path d="M4 0h20l11 11v25a4 4 0 01-4 4H4a4 4 0 01-4-4V4a4 4 0 014-4z" fill="#467AFD"/>
                      <path d="M24 0l11 11H28a4 4 0 01-4-4V0z" fill="#234BB0"/>
                      <text x="6" y="30" fontSize="11" fill="white" fontWeight="bold" fontFamily="sans-serif">ZIP</text>
                    </svg>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#1f1f1f", margin: 0 }}>{fileName2}</p>
                      <p style={{ fontSize: 11, color: "#757678", margin: 0 }}>ZIP · 2.3M</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Second analysis block (Frame 9) — same card structure */}
            {(uploadState === "thinking2" || uploadState === "analyzing2" || uploadState === "done2") && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <RobotAvatar size={42} />
                <div style={{
                  flex: 1, background: "#fff", borderRadius: 12,
                  boxShadow: "0 2px 12px rgba(26,64,140,0.07)", border: "1px solid #e8f0fe",
                  overflow: "hidden",
                }}>
                  {/* "正在思考中" header */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "12px 18px",
                    borderBottom: uploadState !== "thinking2" ? "1px solid #f0f4ff" : "none",
                  }}>
                    <ThinkIcon />
                    <span style={{ fontSize: 13, color: "#222", flex: 1 }}>正在思考中</span>
                    {uploadState === "thinking2" ? (
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        {[0, 1, 2].map(i => (
                          <span key={i} style={{
                            width: 5, height: 5, borderRadius: "50%", background: "#93a8c4",
                            display: "inline-block",
                            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                          }} />
                        ))}
                      </span>
                    ) : (
                      <ChevronDown />
                    )}
                  </div>

                  {uploadState !== "thinking2" && (
                    <div style={{ padding: "14px 18px" }}>

                      {/* Status sub-header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        {uploadState === "done2" ? <CheckIcon /> : (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                            <circle cx="6" cy="6" r="6" fill="#4281ED"/>
                          </svg>
                        )}
                        <span style={{ fontSize: 13, color: "#222", flex: 1 }}>
                          {uploadState === "done2" ? "完整性检查通过" : "正在检查补充材料..."}
                        </span>
                        {uploadState === "done2" && <ChevronDown />}
                      </div>

                      {/* Summary */}
                      {analyzedCount2 > 0 && (
                        <p style={{ fontSize: 13, color: "#1f1f1f", fontWeight: 600, marginBottom: 14 }}>
                          {uploadState === "done2"
                            ? "共解析出 5份文件，已校验完成"
                            : `共解析出 ${analyzedCount2}份文件，正在校验...`}
                        </p>
                      )}

                      {/* Supplement file items */}
                      {SUPPLEMENT_FILES.slice(0, analyzedCount2).map((item, i) => (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 0",
                          borderBottom: i < Math.min(analyzedCount2, SUPPLEMENT_FILES.length) - 1 ? "1px solid #f3f4f6" : "none",
                          animation: `fadeSlideIn 0.3s ease ${i * 0.08}s both`,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <DocFileIcon ext="doc" />
                            <span style={{ fontSize: 12, color: "#2d3644" }}>{item.label}</span>
                          </div>
                          <CheckIcon />
                        </div>
                      ))}

                      {/* Generate / done footer */}
                      {uploadState === "done2" && !generateClicked && (
                        <div style={{
                          marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "10px 14px", borderRadius: 8,
                          background: "#f0fdf4", border: "1px solid #bbf7d0",
                          animation: "fadeSlideIn 0.4s ease",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <CheckIcon />
                            <span style={{ fontSize: 12, color: "#166534", fontWeight: 500 }}>您的材料文件完整性已通过</span>
                          </div>
                          <button
                            onClick={() => { setGenerateClicked(true); onGenerateMaterials?.(); scrollToBottom(); }}
                            style={{
                              padding: "6px 16px", borderRadius: 6,
                              background: "linear-gradient(135deg,#2563eb,#1a4ca8)",
                              color: "#fff", fontSize: 12, fontWeight: 600,
                              border: "none", cursor: "pointer", flexShrink: 0,
                              boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
                            }}
                          >生成材料</button>
                        </div>
                      )}
                      {uploadState === "done2" && generateClicked && (
                        <div style={{
                          marginTop: 16, display: "flex", alignItems: "center", gap: 8,
                          padding: "10px 14px", borderRadius: 8,
                          background: "#f0fdf4", border: "1px solid #bbf7d0",
                        }}>
                          <CheckIcon />
                          <span style={{ fontSize: 12, color: "#166534", fontWeight: 500 }}>您的材料文件完整性已通过</span>
                          <span style={{ fontSize: 12, color: "#6b8ab0", marginLeft: "auto" }}>已生成材料</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* After generate clicked: user bubble + AI reply (Design 10) */}
            {generateClicked && (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "flex-start", animation: "fadeSlideIn 0.3s ease" }}>
                  <div style={{
                    background: "linear-gradient(135deg,#2563eb,#1a4ca8)",
                    borderRadius: 10, padding: "10px 18px",
                    color: "#fff", fontSize: 14, fontWeight: 500,
                  }}>
                    生成材料
                  </div>
                  {USER_AVATAR}
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: "fadeSlideIn 0.4s ease" }}>
                  <RobotAvatar size={42} />
                  <div style={{
                    flex: 1, background: "#fff", borderRadius: 12, padding: "18px 22px",
                    boxShadow: "0 2px 12px rgba(26,64,140,0.07)", border: "1px solid #e8f0fe",
                  }}>
                    <p style={{ fontSize: 13, color: "#1a2744", lineHeight: 1.85 }}>
                      所有文件已生成完成，您可以在<span style={{ color: "#1a5bc6", fontWeight: 600 }}>【文件确认】</span>模块进行下载。
                    </p>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* (Demo mode chat 已删除:填报演示整体下线) */}
      </div>

      <ChatInputBar value={inputVal} onChange={setInputVal} onSend={() => { setInputVal(""); }} />
    </div>
  );
}


const MATERIALS_LEFT = [
  { name: "境外投资备案申请表（商务部门）", pages: "2-3页" },
  { name: "境外投资真实性承诺书（商务部门）", pages: "1-2页" },
  { name: "投资合同或协议书（或意向书）", pages: "1-2页" },
  { name: "股东会或董事会决议", pages: "1-2页" },
  { name: "被投资公司简介（或商业计划书）", pages: "1-2页" },
  { name: "投资资金来源说明", pages: "1-2页" },
  { name: "企业营业执照副本及章程", pages: "1-2页" },
  { name: "近期财务报表（审计报告）", pages: "1-2页" },
  { name: "境外项目可行性研究报告", pages: "1-2页" },
  { name: "境外投资合同有效期内的银行资信证明", pages: "1-2页" },
];

const MATERIALS_RIGHT = [
  { name: "境外投资项目核准/备案申请表（发改委）", pages: "2-3页" },
  { name: "境外投资项目情况报告", pages: "2-3页" },
  { name: "境外投资真实性承诺书（发改委）", pages: "1-2页" },
  { name: "境外企业股权架构图", pages: "1-2页" },
  { name: "近一年境外投资情况说明", pages: "1-2页" },
  { name: "企业项目申请备案的请示（发改委）", pages: "1-2页" },
];

function OdiReplyContent({ onOdiClick, onDemoClick, serviceType = "助办", initialClicked = false }: { onOdiClick: () => void; onDemoClick?: () => void; serviceType?: string; initialClicked?: boolean }) {
  const [clicked, setClicked] = useState(initialClicked);
  const [learnMore, setLearnMore] = useState(false);
  const [hasIntent, setHasIntent] = useState(false);

  const handleClick = () => {
    setClicked(true);
    onOdiClick();
  };

  const handleHasIntent = () => {
    setHasIntent(true);
  };

  return (
    <>
      <p style={{ fontSize: 13, color: "#1a2744", lineHeight: 1.85, marginBottom: 14 }}>
        ODI{serviceType}帮您在申请境外投资备案前，智能辅助生成申报材料，如果您已经准备好相关材料，我们也可以帮您对既有材料进行合规性、完整性审查，提升准备效率，降低退回风险。
      </p>

      {!clicked ? (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
          padding: "12px 16px", borderRadius: 10,
          background: "#f0f6ff",
          borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
          borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
          borderTopColor: "#dbeafe", borderRightColor: "#dbeafe", borderBottomColor: "#dbeafe", borderLeftColor: "#dbeafe",
          marginBottom: 14,
        }}>
          <p style={{ fontSize: 13, color: "#3a4f72", flex: 1, lineHeight: 1.7 }}>
            点击右侧按钮进入ODI备案{serviceType}
          </p>
          <button
            onClick={handleClick}
            style={{
              padding: "5px 16px", borderRadius: 20, flexShrink: 0,
              borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
              borderTopStyle: "solid", borderRightStyle: "solid", borderBottomStyle: "solid", borderLeftStyle: "solid",
              borderTopColor: "#1a5bc6", borderRightColor: "#1a5bc6", borderBottomColor: "#1a5bc6", borderLeftColor: "#1a5bc6",
              background: "#fff", color: "#1a5bc6",
              fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#e8f0fe"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
          >
            ODI{serviceType}
          </button>
        </div>
      ) : (
        <div style={{ animation: "fadeSlideIn 0.35s ease" }}>
          {/* Materials list card */}
          <MaterialsTable />

          {/* Question dialog / reply card */}
          {!learnMore && !hasIntent && (
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "#f8faff", border: "1px solid #dbeafe" }}>
              <p style={{ fontSize: 13, color: "#1a2744", lineHeight: 1.8, marginBottom: 14 }}>
                为了更准确地为你推荐后续路径，请问你目前是否已有明确的境外投资意向？
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={handleHasIntent} style={{ padding: "8px 18px", borderRadius: 8, background: "linear-gradient(135deg,#2563eb,#1a4ca8)", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.22)" }}>
                  是，我有境外投资意向
                </button>
                <button onClick={() => setLearnMore(true)} style={{ padding: "8px 18px", borderRadius: 8, background: "#fff", color: "#1a5bc6", fontSize: 12, fontWeight: 500, cursor: "pointer", border: "1px solid #bfdbfe" }}>
                  暂时，先了解基础材料
                </button>
              </div>
            </div>
          )}

          {hasIntent && (
            <div style={{ padding: "16px 18px", borderRadius: 10, background: "#f8faff", border: "1px solid #dbeafe", animation: "fadeSlideIn 0.3s ease" }}>
              {/* 填报演示按钮已删除(2026-08-21 需求):有明确意向直接进申报助办 */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <button
                  onClick={handleClick}
                  style={{ padding: "5px 14px", borderRadius: 7, background: "linear-gradient(135deg,#2563eb,#1a4ca8)", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", boxShadow: "0 2px 6px rgba(37,99,235,0.22)" }}
                >
                  申报助办
                </button>
                <span style={{ fontSize: 13, color: "#3a4f72", lineHeight: 1.7, paddingTop: 3 }}>用于已准备或正在准备正式材料的场景，系统将协助上传识别、缺项提示和材料生成。</span>
              </div>
            </div>
          )}

          {learnMore && !hasIntent && (
            <div style={{ padding: "16px 18px", borderRadius: 10, background: "#f8faff", border: "1px solid #dbeafe", animation: "fadeSlideIn 0.3s ease" }}>
              <p style={{ fontSize: 13, color: "#1a2744", lineHeight: 1.85, marginBottom: 12 }}>
                好的，你可以先了解 ODI 申报流程和材料准备要求。前面已为你展示商务委、发改委常见材料清单，可按需查看或下载模板。后续如果已有明确境外投资计划，随时告诉我即可。
              </p>
              <button onClick={handleHasIntent} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, color: "#1a5bc6", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>
                我已有境外投资意向，推荐后续路径 →
              </button>
            </div>
          )}
        </div>
      )}

    </>
  );
}

// ── ODI 备案材料清单 table ──

type TemplateTag = { label: string; filled: boolean };
type MatRow = {
  name: string;
  commerce: { text?: string; tags?: TemplateTag[]; sub?: { label: string; tags: TemplateTag[] }[] };
  ndrc: { text?: string; tags?: TemplateTag[]; sub?: { label: string; tags: TemplateTag[] }[] } | null;
  note?: string;
  expandable?: boolean;
};

const MAT_ROWS: MatRow[] = [
  {
    name: "境外投资备案申请表",
    commerce: { tags: [{ label: "示例表格", filled: true }, { label: "空白表格", filled: false }] },
    ndrc: { tags: [{ label: "示例表格", filled: true }, { label: "空白表格", filled: false }] },
    note: "—",
  },
  {
    name: "投资主体注册登记证明",
    commerce: { text: "营业执照" },
    ndrc: null,
    note: "—",
  },
  {
    name: "投资决策文件",
    commerce: { text: "股东会/董事会决议" },
    ndrc: { text: "股东会/董事会决议及其他文件" },
    note: "需与公司章程一致",
  },
  {
    name: "境外投资真实性声明书",
    commerce: {
      sub: [
        { label: "子公司：", tags: [{ label: "示例表格", filled: true }, { label: "空白表格", filled: false }] },
        { label: "分公司/办事处：", tags: [{ label: "示例表格", filled: true }, { label: "空白表格", filled: false }] },
      ],
    },
    ndrc: {
      sub: [
        { label: "子公司：", tags: [{ label: "示例表格", filled: true }] },
      ],
    },
    note: "—",
  },
  {
    name: "股权架构图",
    commerce: { text: "需尽量描述到实际控制人" },
    ndrc: { tags: [{ label: "示例表格", filled: true }, { label: "空白表格", filled: false }] },
    note: "—",
  },
  {
    name: "资金来源及境外使用计划相关材料",
    commerce: { text: "经审计财务报表及银行出具的境外投资授信额度（3亿美元以上需提供）" },
    ndrc: { text: "经审计财务报表及银行出具的授信证明（3亿美元以上）" },
    note: "—",
  },
  {
    name: "前期工作报告",
    commerce: { text: "可行性分析报告（含目标标的详述、投资规模、战略目标、投资领域、经营方式）" },
    ndrc: null,
    note: "—",
    expandable: true,
  },
  {
    name: "相关真实合规证明材料",
    commerce: { text: "数份/数件，N天之内出具的有效文件" },
    ndrc: { text: "投资标的生效法律协议（可提供意向协议）" },
    note: "投资标的生效法律协议，可提现同股同权约定",
  },
  {
    name: "企业经营申报备案要求",
    commerce: { tags: [{ label: "示例表格", filled: true }, { label: "空白表格", filled: false }] },
    ndrc: null,
    note: "—",
  },
];

function TemplateTags({ tags }: { tags: TemplateTag[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
      {tags.map((t, i) => (
        <span key={i} style={{
          fontSize: 10, padding: "1px 6px", borderRadius: 3, whiteSpace: "nowrap",
          background: t.filled ? "#1a5bc6" : "#fff",
          color: t.filled ? "#fff" : "#1a5bc6",
          border: "1px solid #1a5bc6",
          fontWeight: 500,
        }}>{t.label}</span>
      ))}
    </div>
  );
}

function CellContent({ cell }: { cell: MatRow["commerce"] }) {
  if (!cell) return <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>;
  return (
    <div>
      {cell.text && <span style={{ fontSize: 11, color: "#2d3644", lineHeight: 1.6 }}>{cell.text}</span>}
      {cell.tags && <TemplateTags tags={cell.tags} />}
      {cell.sub && cell.sub.map((s, i) => (
        <div key={i} style={{ marginBottom: i < cell.sub!.length - 1 ? 4 : 0 }}>
          <span style={{ fontSize: 10, color: "#6b8ab0" }}>{s.label}</span>
          <TemplateTags tags={s.tags} />
        </div>
      ))}
    </div>
  );
}

function MaterialsTable() {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showCommerceTemplates, setShowCommerceTemplates] = useState(false);
  const [showNdrcTemplates, setShowNdrcTemplates] = useState(false);

  const toggleRow = (i: number) => setExpandedRows(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const COL_NAME = "30%";
  const COL_DEPT = "27%";
  const COL_NOTE = "16%";

  const thStyle: React.CSSProperties = {
    padding: "7px 8px", fontSize: 11, fontWeight: 600,
    color: "#fff", background: "transparent",
    textAlign: "left", whiteSpace: "nowrap",
  };

  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #bfdbfe", marginBottom: 14 }}>
      {/* Header */}
      <div style={{ padding: "11px 14px 9px", background: "linear-gradient(135deg,#2563eb,#1a4ca8)" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 3 }}>ODI 备案材料清单</p>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
          以下展示上海市场的发改、发改备案常用的综合性概括性材料，具体材料以实际为准，前期建议按投资金额区分、并合投资类型区分、并合投资类型选取，行业投资类型、目的地情况而有差异。
        </p>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: COL_NAME }} />
            <col style={{ width: COL_DEPT }} />
            <col style={{ width: COL_DEPT }} />
            <col style={{ width: COL_NOTE }} />
          </colgroup>
          <thead>
            <tr style={{ background: "#eef4fe", borderBottom: "1px solid #dbeafe" }}>
              {["材料名称", "商务部门", "发改部门", "备注"].map((h, i) => (
                <th key={i} style={{ ...thStyle, color: "#1a5bc6", background: "transparent" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MAT_ROWS.map((row, i) => {
              const isExpanded = expandedRows.has(i);
              const isLast = i === MAT_ROWS.length - 1;
              return (
                <tr key={i} style={{ borderBottom: isLast ? "none" : "1px solid #f0f4fb", verticalAlign: "top" }}>
                  {/* 材料名称 */}
                  <td style={{ padding: "8px 8px", fontSize: 11, fontWeight: 600, color: "#1a2744", lineHeight: 1.55 }}>
                    {row.name}
                  </td>
                  {/* 商务部门 */}
                  <td style={{ padding: "8px 8px" }}>
                    {row.expandable ? (
                      <div>
                        <span style={{ fontSize: 11, color: "#2d3644", lineHeight: 1.6 }}>
                          {isExpanded ? row.commerce.text : (row.commerce.text || "").slice(0, 22) + "…"}
                        </span>
                        <button onClick={() => toggleRow(i)} style={{ display: "block", marginTop: 2, fontSize: 10, color: "#1a5bc6", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                          {isExpanded ? "收起" : "展开全部"}
                        </button>
                      </div>
                    ) : (
                      <CellContent cell={row.commerce} />
                    )}
                  </td>
                  {/* 发改部门 */}
                  <td style={{ padding: "8px 8px" }}>
                    <CellContent cell={row.ndrc} />
                  </td>
                  {/* 备注 */}
                  <td style={{ padding: "8px 8px", fontSize: 10, color: "#6b8ab0", lineHeight: 1.55 }}>
                    {row.note || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Download footer */}
      <div style={{ borderTop: "1px solid #e8f0fe", padding: "10px 12px", background: "#f8faff", display: "flex", gap: 10 }}>
        {/* Commerce templates */}
        <div style={{ flex: 1 }}>
          <button
            onClick={() => setShowCommerceTemplates(v => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 7, background: "#1a5bc6", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
          >
            <span>商务部门/模板</span>
            <svg width="10" height="6" viewBox="0 0 12 8" fill="none" style={{ transform: showCommerceTemplates ? "rotate(180deg)" : "none", transition: "0.15s", flexShrink: 0 }}>
              <path d="M1 1l5 5 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {showCommerceTemplates && (
            <div style={{ marginTop: 5, display: "flex", flexDirection: "column", gap: 4 }}>
              {["示例表格", "空白表格"].map(t => (
                <button key={t} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, background: "#fff", border: "1px solid #bfdbfe", cursor: "pointer", fontSize: 11, color: "#1a5bc6", fontWeight: 500 }}>
                  <svg width="11" height="12" viewBox="0 0 28 34" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M3 0h16l9 9v22a3 3 0 01-3 3H3a3 3 0 01-3-3V3a3 3 0 013-3z" fill="#2B7CD3"/>
                    <path d="M19 0l9 9h-6a3 3 0 01-3-3V0z" fill="#185ABD"/>
                    <text x="4" y="26" fontSize="9" fill="white" fontWeight="bold" fontFamily="sans-serif">W</text>
                  </svg>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* NDRC templates */}
        <div style={{ flex: 1 }}>
          <button
            onClick={() => setShowNdrcTemplates(v => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 7, background: "#fff", color: "#1a5bc6", border: "1px solid #1a5bc6", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
          >
            <span>发改部门/模板</span>
            <svg width="10" height="6" viewBox="0 0 12 8" fill="none" style={{ transform: showNdrcTemplates ? "rotate(180deg)" : "none", transition: "0.15s", flexShrink: 0 }}>
              <path d="M1 1l5 5 5-5" stroke="#1a5bc6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {showNdrcTemplates && (
            <div style={{ marginTop: 5, display: "flex", flexDirection: "column", gap: 4 }}>
              {["示例表格", "空白表格"].map(t => (
                <button key={t} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, background: "#fff", border: "1px solid #bfdbfe", cursor: "pointer", fontSize: 11, color: "#1a5bc6", fontWeight: 500 }}>
                  <svg width="11" height="12" viewBox="0 0 28 34" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M3 0h16l9 9v22a3 3 0 01-3 3H3a3 3 0 01-3-3V3a3 3 0 013-3z" fill="#2B7CD3"/>
                    <path d="M19 0l9 9h-6a3 3 0 01-3-3V0z" fill="#185ABD"/>
                    <text x="4" y="26" fontSize="9" fill="white" fontWeight="bold" fontFamily="sans-serif">W</text>
                  </svg>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NonOdiReplyContent() {
  return (
    <>
      <p style={{ fontSize: 13, color: "#1a2744", lineHeight: 1.85, marginBottom: 14 }}>
        阿布扎比（Abu Dhabi）是阿联酋七个酋长国中最大的一个，也是阿联酋的首都。近年来，阿布扎比积极推进经济多元化，出台了系列吸引外资政策：
      </p>

      {[
        { title: "一、外资准入政策", items: ["2020年起允许外资100%持股（特定行业除外）", "设立阿布扎比全球市场（ADGM）等自由区，享有独立法律体系", "为战略投资者提供土地、税收优惠"] },
        { title: "二、税收政策", items: ["企业所得税：一般行业为0%，石油行业例外", "个人所得税：0%", "增值税：5%（已与中国签署双边协定）"] },
        { title: "三、重点鼓励行业", items: ["旅游、金融科技、制造业、医疗健康、可再生能源"] },
      ].map((sec, si) => (
        <div key={si} style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#1a2744", marginBottom: 4 }}>{sec.title}</p>
          {sec.items.map((item, ii) => (
            <div key={ii} style={{ display: "flex", gap: 6, fontSize: 13, color: "#3a4f72", lineHeight: 1.8 }}>
              <span style={{ color: "#1a5bc6", flexShrink: 0 }}>·</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      ))}

      <div style={{ padding: "8px 12px", background: "#f0f6ff", borderRadius: 8, marginBottom: 14 }}>
        <p style={{ fontSize: 12, color: "#6b8ab0" }}>
          平台仅提供申报前辅助参考，不替代官方系统申请和主管部门审核。
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "#eef3fb", borderRightWidth: 0, borderRightStyle: "solid", borderRightColor: "transparent", borderBottomWidth: 0, borderBottomStyle: "solid", borderBottomColor: "transparent", borderLeftWidth: 0, borderLeftStyle: "solid", borderLeftColor: "transparent" }}>
        <QuickChip label="阿布扎比投资有哪些法律风险？" />
        <QuickChip label="中阿双边协定包含哪些条款？" />
        <QuickChip label="如何在阿布扎比注册公司？" />
      </div>
    </>
  );
}
