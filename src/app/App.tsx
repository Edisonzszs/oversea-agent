import { useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Flip } from "gsap/Flip";

// Register GSAP plugins once at app level
gsap.registerPlugin(useGSAP, Flip);
import { PlatformTopBar, type PlatformAuthState } from "./components/PlatformTopBar";
import { PlatformNavBar } from "./components/PlatformNavBar";
import { WelcomeFrame } from "./components/WelcomeFrame";
import { ChatFrame } from "./components/ChatFrame";
import { CONVERSATIONS } from "./components/conversationData";
import { OdiQaFrame } from "./components/OdiQaFrame";
import { OdiWorkbenchFrame } from "./components/OdiWorkbenchFrame";
import { OdiDaibanPage } from "./components/OdiDaibanPage";
import { ConversationSidebar } from "./components/ConversationSidebar";
import { OdiProjectSidebar, type OdiSidebarView } from "./components/OdiProjectSidebar";
import { ContextWorkspace } from "./components/ContextWorkspace";
import { OdiProjectListPage } from "./components/OdiProjectListPage";
import { OdiProjectDetailPage } from "./components/OdiProjectDetailPage";
import { OdiDemoDetailPage } from "./components/OdiDemoDetailPage";
import { type AssistantContext } from "./components/OdiProjectAssistantPanel";
import { OdiCopilotPanel } from "./components/OdiCopilotPanel";
import { NewOdiProjectModal, type NewTaskResult } from "./components/NewOdiProjectModal";
import { MOCK_ODI_PROJECTS, type OdiProject, type AssistProject, type DemoProject, type DemoScene, type DemoMode } from "./components/odiProjectData";
import { MOCK_COMPLIANCE_PROJECTS, type ComplianceProject } from "./compliance/data/complianceProjects";
import { ComplianceSidebar, type ComplianceView } from "./compliance/components/ComplianceSidebar";
import { ComplianceListPage } from "./compliance/components/ComplianceListPage";
import { ComplianceDetailPage } from "./compliance/components/ComplianceDetailPage";
import { NewComplianceProjectModal } from "./compliance/components/NewComplianceProjectModal";
import { RenameModal, DeleteConfirmModal } from "./compliance/components/ComplianceItemMenu";
import { useAuth, type AuthUser } from "./auth/useAuth";
import { LoginPage } from "./components/LoginPage";
import { PortalHomePage } from "./components/PortalHomePage";
import { VersionSelectModal } from "./components/VersionSelectModal";
import { QuickTestWizard } from "./quicktest/QuickTestWizard";
import type { Answers } from "./quicktest/questions";

export type AppFrame =
  | "welcome"
  | "chat"
  | "non-odi"
  | "odi-qa"
  | "odi-daiban"
  | "odi-daiban-main"
  | "odi-auth"
  | "odi-preinfo"
  | "odi-materials"
  | "odi-project"
  | "odi-prereview";

type AppMode = "portal" | "xiaohai" | "odi-list" | "odi-project" | "odi-demo" | "compliance" | "login";

export type FileStatus = "上传中" | "已上传" | "识别中" | "已识别";
export type AttachedFile = { name: string; status: FileStatus; id: number };

const WORKBENCH_FRAMES: AppFrame[] = ["odi-preinfo", "odi-materials", "odi-project", "odi-prereview"];

export default function App() {
  // Mode state —— 默认进入"走出去服务平台"门户首页(Figma 设计线 Portal_Home_Desktop)
  const [mode, setMode] = useState<AppMode>("portal");
  // 门户首页 → 平台的携带问题(新对话落地自动发送);nonce 保证每次都重挂 ChatFrame
  const [chatSeed, setChatSeed] = useState<{ q: string; nonce: number } | null>(null);
  // 网站搜索关键词(走出去平台 segg.sh.gov.cn 常规搜索,非 AI 搜索):
  // 由门户首页带入,或对话中明确的「帮忙搜索网站」请求刷新;其余对话过程保持不变
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  // 登录往返:从门户/平台进登录页,成功或返回时回原处
  const [loginReturnMode, setLoginReturnMode] = useState<Exclude<AppMode, "login">>("xiaohai");

  // 登录态(POC:localStorage mock,不接真实后端)
  const { user: authUser, isAuthed, login, logout } = useAuth();

  // Xiaohai mode frame state
  const [frame, setFrame] = useState<AppFrame>("chat");
  // Conversation state
  const [activeConvId, setActiveConvId] = useState("new");

  // Sidebar collapse state
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [topCollapsed, setTopCollapsed] = useState(false);

  // ODI sidebar state
  const [odiSidebarView, setOdiSidebarView] = useState<OdiSidebarView>("overview");

  // Project state
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<OdiProject[]>(MOCK_ODI_PROJECTS);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  // ODI 项目重命名/删除(复用合规的 RenameModal/DeleteConfirmModal)。
  const [odiRenameId, setOdiRenameId] = useState<string | null>(null);
  const [odiDeleteId, setOdiDeleteId] = useState<string | null>(null);
  const odiRenameTarget = odiRenameId ? projects.find(p => p.id === odiRenameId) ?? null : null;
  const odiDeleteTarget = odiDeleteId ? projects.find(p => p.id === odiDeleteId) ?? null : null;

  // Compliance (合规自查) state — 独立于 ODI 项目（先独立）
  const [complianceProjects, setComplianceProjects] = useState<ComplianceProject[]>(MOCK_COMPLIANCE_PROJECTS);
  const [activeComplianceId, setActiveComplianceId] = useState<string | null>(null);
  const [complianceView, setComplianceView] = useState<ComplianceView>("all");
  const [showNewComplianceModal, setShowNewComplianceModal] = useState(false);
  // 版本选择弹窗(进入「ODI 合规自查专家」)+ 登录后回弹窗标记
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [pendingComplianceEntry, setPendingComplianceEntry] = useState(false);
  // 速测版:嵌入合规空间中央区(非独立全屏),与列表/详情页平级
  const [quickTestActive, setQuickTestActive] = useState(false);

  // ODI 新版平台 state —— 已撤 detour:ODI 统一走 Figma 设计线(odi-list/odi-project/odi-demo,见 handleEnterOdiWorkbench)。
  // odi/ 目录下的字段池/向导/生成等"进入后"逻辑保留备用,不再作为入口挂载。

  // Assistant panel state
  const [assistantCtx, setAssistantCtx] = useState<AssistantContext>({
    type: "project",
    projectId: "p1",
    projectName: "越南新设智能装备生产基地项目",
  });
  // ODI 伴填面板默认展开(Step 2:让合规那版伴填设计在 ODI 详情页右侧直接可见)。
  const [assistantCollapsed, setAssistantCollapsed] = useState(false);

  // ODI workbench state (for xiaohai workbench frames)
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [_generateState, setGenerateState] = useState<"idle" | "reviewing" | "done">("idle");
  const [investMethod, setInvestMethod] = useState("新设");
  const [entityType, setEntityType] = useState("子公司");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [preInfoConfirmed, setPreInfoConfirmed] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [materialGenerationStarted, setMaterialGenerationStarted] = useState(false);

  // ── Navigation handlers ──

  // 门户首页提交:携带问题落到小海新对话(自动发送),右侧展示该词的网站搜索结果
  const handlePortalSubmit = (question: string) => {
    setChatSeed({ q: question, nonce: Date.now() });
    setSearchKeyword(question);
    setRightCollapsed(false); // 落地即展示网站搜索结果
    setActiveConvId("new");
    setMode("xiaohai");
    setFrame("chat");
  };

  // 回门户首页(平台导航条「首页」)
  const handleBackToPortal = () => setMode("portal");

  // 门户右侧浮动栏「智能体」:直达出海智能体界面(新对话,不携带问题)
  const handleEnterAgent = () => {
    setChatSeed(null);
    setSearchKeyword("");
    setActiveConvId("new");
    setMode("xiaohai");
    setFrame("chat");
  };

  // ── 网站搜索(segg.sh.gov.cn)重搜:仅在用户明确要求「帮忙搜索网站」时刷新关键词 ──
  const isWebsiteSearchRequest = (text: string) =>
    /(搜索|搜一下|搜搜|查一下|查查|检索)/.test(text) && /(网站|官网|平台|网上|segg)/i.test(text);

  /** 从请求语剥离客套/指令词,提取检索词;剥完为空回退整句 */
  const extractSearchKeyword = (text: string): string => {
    let k = text;
    k = k.replace(/(请|麻烦|帮我|帮忙|给我|麻烦你|让你|再|重新|一下)/g, "");
    k = k.replace(/(在|去|到)?(网站|官网|平台上?|网上|segg\.sh\.gov\.cn)的?/gi, "");
    k = k.replace(/(搜索|搜一下|搜搜|查一下|查查|检索)/g, "");
    k = k.replace(/[\s，。？！、,.?！?]+/g, " ").trim();
    return k || text.trim();
  };

  const handleChatUserMessage = (text: string) => {
    if (isWebsiteSearchRequest(text)) {
      setSearchKeyword(extractSearchKeyword(text));
      setRightCollapsed(false);
    }
  };

  // 统一登录入口:记录当前模式,登录成功/返回时回原处(合规"完整版→去登录"走自己的 pending 流程)
  const enterLogin = () => { setLoginReturnMode(mode === "login" ? "xiaohai" : mode); setMode("login"); };

  const handleEnterOdiWorkbench = () => {
    setMode("odi-list");
    setActiveProjectId(null);
    setOdiSidebarView("overview");
  };

  const handleBackToXiaohai = () => {
    setMode("xiaohai");
  };

  const handleSelectProject = (id: string) => {
    const proj = projects.find(p => p.id === id);
    if (!proj) return;
    setActiveProjectId(id);
    setAssistantCollapsed(false); // Step 2:进入项目即展开 ODI 伴填面板
    if (proj.serviceType === "demo") {
      setMode("odi-demo");
    } else {
      setMode("odi-project");
      setAssistantCtx({ type: "project", projectId: proj.id, projectName: proj.name });
    }
  };

  const handleSelectView = (v: OdiSidebarView) => {
    setOdiSidebarView(v);
    setMode("odi-list");
    setActiveProjectId(null);
  };

  // ── Compliance handlers ──
  // 进入「企业合规自查专家」:直接进合规项目空间(列表页)——版本选择在"新建项目"时弹。
  const handleEnterCompliance = () => {
    setMode("compliance");
    setActiveComplianceId(null);
    setComplianceView("all");
    setQuickTestActive(false);
  };

  // 新建合规自查项目:先选版本(匿名:速测★/完整版去登录;登录:速测/完整版)。
  const handleNewCompliance = () => setShowVersionModal(true);

  const handleQuickTest = () => {
    setShowVersionModal(false);
    setActiveComplianceId(null);
    setQuickTestActive(true);
    setMode("compliance");
  };

  // 去完整版:匿名/登录都直接开始(照《企业合规自查流程.txt》,匿名项目存本机)。
  const handleVersionFull = () => {
    setShowVersionModal(false);
    setQuickTestActive(false);
    setMode("compliance");
    setShowNewComplianceModal(true);
  };

  // 匿名版弹窗「立即登录」:去登录页,登录成功后回合规空间并弹(登录版)选择弹窗。
  const handleVersionLogin = () => {
    setShowVersionModal(false);
    setPendingComplianceEntry(true);
    setMode("login");
  };

  // 登录成功:若是从"完整版→去登录"来,回合规空间并弹登录版选择弹窗;否则回进入登录前的位置。
  const handleLoginSuccess = (u: AuthUser) => {
    login(u);
    if (pendingComplianceEntry) {
      setPendingComplianceEntry(false);
      setMode("compliance");
      setShowVersionModal(true);
    } else {
      setMode(loginReturnMode);
    }
  };

  // 速测版 → 升级完整版:存速测作答(同题号体系,供完整版参考/灌入),未登录先登录。
  const handleQuickUpgrade = (quickAnswers: Answers) => {
    try { sessionStorage.setItem("chuhai_quick_answers", JSON.stringify(quickAnswers)); } catch { /* ignore */ }
    setShowVersionModal(false);
    // 匿名/登录都直接开完整版项目名弹窗(作答经 sessionStorage 预填灌入)。
    setQuickTestActive(false);
    setMode("compliance");
    setShowNewComplianceModal(true);
  };

  // (ODI detour 已撤:ODI 统一走 Figma 设计线 handleEnterOdiWorkbench → odi-list/odi-project/odi-demo)

  const handleSelectCompliance = (id: string) => {
    setActiveComplianceId(id);
    setQuickTestActive(false); // 侧栏点项目 → 离开速测,进项目详情
  };

  const handleSelectComplianceView = (v: ComplianceView) => {
    setComplianceView(v);
    setActiveComplianceId(null);
    setQuickTestActive(false); // 侧栏切分类 → 回列表
  };

  const handleCreateCompliance = (name: string) => {
    const p: ComplianceProject = {
      id: `c${Date.now()}`,
      name,
      status: "待填写",
      generatedReports: [],
      updatedAt: "刚刚",
    };
    setComplianceProjects(prev => [p, ...prev]);
    setShowNewComplianceModal(false);
    setActiveComplianceId(p.id);
  };

  const handleUpdateCompliance = (id: string, patch: Partial<ComplianceProject>) => {
    setComplianceProjects(prev => prev.map(p => (p.id === id ? { ...p, ...patch, updatedAt: "刚刚" } : p)));
  };

  const handleDeleteCompliance = (id: string) => {
    setComplianceProjects(prev => prev.filter(p => p.id !== id));
    if (activeComplianceId === id) setActiveComplianceId(null);
  };
  const handleRenameCompliance = (id: string, name: string) => {
    setComplianceProjects(prev => prev.map(p => p.id === id ? { ...p, name, updatedAt: "刚刚" } : p));
  };
  const handleDuplicateCompliance = (id: string) => {
    const orig = complianceProjects.find(p => p.id === id);
    if (!orig) return;
    const copy: ComplianceProject = { ...orig, id: `c${Date.now()}`, name: `${orig.name}（副本）`, updatedAt: "刚刚" };
    setComplianceProjects(prev => [copy, ...prev]);
  };

  const handleNewProject = () => {
    setShowNewProjectModal(true);
  };

  const handleCreateProject = (result: NewTaskResult) => {
    if (result.kind === "assist") {
      const p: AssistProject = {
        serviceType: "assist",
        id: `p${Date.now()}`,
        name: result.name,
        status: "待上传材料",
        investmentType: "新设",
        uploadedCount: 0,
        mismatchCount: 0,
        missingCount: 0,
        passedCount: 0,
        generatedCount: 0,
        updatedAt: "刚刚",
        materials: [],
        materialVersion: 0,
      };
      setProjects(prev => [p, ...prev]);
      setShowNewProjectModal(false);
      // 直接用本地的 p 设状态(不走 handleSelectProject 的 find —— 那里 projects 闭包过期,新建会找不到)。
      setActiveProjectId(p.id);
      setAssistantCollapsed(false);
      setAssistantCtx({ type: "project", projectId: p.id, projectName: p.name });
      setMode("odi-project");
    } else {
      const scene = result.scene as DemoScene;
      const mode = result.mode as DemoMode;
      const p: DemoProject = {
        serviceType: "demo",
        id: `d${Date.now()}`,
        name: `${scene}场景模拟体验`,
        status: "进行中",
        scene,
        mode,
        country: "待填写",
        industry: "待填写",
        investmentAmount: "待填写",
        equityRatio: "100%",
        currentStep: 0,
        stepStatuses: ["active", "pending", "pending", "pending"],
        warningCount: 0,
        generatedCount: 0,
        updatedAt: "刚刚",
      };
      setProjects(prev => [p, ...prev]);
      setShowNewProjectModal(false);
      setActiveProjectId(p.id);
      setAssistantCollapsed(false);
      setMode("odi-demo");
    }
  };

  // ODI 项目重命名/删除(侧栏与列表卡片菜单共用)。
  const handleRenameOdiProject = (id: string, name: string) => {
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, name } : p)));
  };
  const handleDeleteOdiProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProjectId === id) { setActiveProjectId(null); setMode("odi-list"); }
  };

  // ODI 助办项目增量更新(详情页上传/校验/状态机驱动)。patch 支持函数式,拿到最新 project,
  // 避免定时器回调里用旧闭包的 materials 数组覆盖并发上传。
  const handleUpdateOdiProject = (
    id: string,
    patch: Partial<AssistProject> | ((p: AssistProject) => Partial<AssistProject>),
  ) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== id || p.serviceType !== "assist") return p;
      const resolved = typeof patch === "function" ? patch(p) : patch;
      return { ...p, ...resolved, updatedAt: "刚刚" };
    }));
  };

  const handleAskAssistant = (ctx: AssistantContext) => {
    setAssistantCtx(ctx);
    setAssistantCollapsed(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConvId(id);
    setChatSeed(null); // 切走即清携带问题,避免残留 seed 影响后续新对话
    setSearchKeyword("");
    setMode("xiaohai");
    setFrame("chat");
  };

  const handleNewConversation = () => {
    setActiveConvId("new");
    setChatSeed(null);
    setSearchKeyword("");
    setMode("xiaohai");
    setFrame("chat");
  };

  const handlePreInfoConfirm = () => { setPreInfoConfirmed(true); setFrame("odi-materials"); };
  const handleContinueUpload = () => setFrame("odi-project");

  const goTo = (f: AppFrame) => setFrame(f);

  const isWorkbench = WORKBENCH_FRAMES.includes(frame);
  const isDaibanMain = frame === "odi-daiban-main";

  // Calculate pending ODI count — assist only
  const pendingOdiCount = projects.filter(p => p.serviceType === "assist" && ((p as AssistProject).mismatchCount + (p as AssistProject).missingCount) > 0).length;

  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) ?? null : null;
  const activeComplianceProject = activeComplianceId ? complianceProjects.find(p => p.id === activeComplianceId) ?? null : null;

  // 登录页:全屏覆盖,不渲染顶栏/侧栏。从"完整版→去登录"来的,返回时回合规空间。
  if (mode === "login") {
    return (
      <LoginPage
        onLogin={handleLoginSuccess}
        onBack={() => {
          if (pendingComplianceEntry) { setPendingComplianceEntry(false); setMode("compliance"); }
          else setMode(loginReturnMode);
        }}
      />
    );
  }

  // 门户首页(走出去服务平台):底图 + 智能输入卡,全屏独立渲染,不带平台外壳
  if (mode === "portal") {
    return (
      <div style={{ height: "100vh", width: "100%", overflow: "hidden", fontFamily: "'PingFang SC','Microsoft YaHei','Hiragino Sans GB',sans-serif" }}>
        <PortalHomePage
          onSubmit={(question) => handlePortalSubmit(question)}
          submitting={false}
          onLogin={enterLogin}
          onEnterAgent={handleEnterAgent}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100%", overflow: "hidden", fontFamily: "'PingFang SC','Microsoft YaHei','Hiragino Sans GB',sans-serif" }}>
      {showVersionModal && (
        <VersionSelectModal
          variant={isAuthed ? "loggedIn" : "anonymous"}
          onClose={() => setShowVersionModal(false)}
          onQuickTest={handleQuickTest}
          onFull={handleVersionFull}
          onLogin={handleVersionLogin}
        />
      )}
      {!topCollapsed && (
        <PlatformTopBar
          authState={authUser ? { isLoggedIn: true, ...authUser } : { isLoggedIn: false }}
          onLogin={enterLogin}
          onLogout={logout}
        />
      )}
      <PlatformNavBar currentFrame={frame} goTo={goTo} topCollapsed={topCollapsed} onToggleTop={() => setTopCollapsed(v => !v)} onHome={handleBackToPortal} />

      <div style={{ display: "flex", flex: 1, overflow: "hidden", background: "#F7F9FC" }}>

        {/* Left sidebar */}
        {mode === "xiaohai" && !isDaibanMain && (
          <ConversationSidebar
            collapsed={leftCollapsed}
            onToggleCollapse={() => setLeftCollapsed(v => !v)}
            activeConvId={activeConvId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onEnterOdiWorkbench={handleEnterOdiWorkbench}
            pendingOdiCount={pendingOdiCount}
            onEnterCompliance={handleEnterCompliance}
            user={authUser}
            onLogin={enterLogin}
          />
        )}
        {(mode === "odi-list" || mode === "odi-project" || mode === "odi-demo") && (
          <OdiProjectSidebar
            collapsed={leftCollapsed}
            onToggleCollapse={() => setLeftCollapsed(v => !v)}
            projects={projects}
            activeProjectId={activeProjectId}
            activeView={odiSidebarView}
            onSelectView={handleSelectView}
            onSelectProject={handleSelectProject}
            onNewProject={handleNewProject}
            onBackToXiaohai={handleBackToXiaohai}
            onRename={id => setOdiRenameId(id)}
            onDelete={id => setOdiDeleteId(id)}
            user={authUser}
            onLogin={enterLogin}
          />
        )}
        {mode === "compliance" && (
          <ComplianceSidebar
            collapsed={leftCollapsed}
            onToggleCollapse={() => setLeftCollapsed(v => !v)}
            projects={complianceProjects}
            activeProjectId={activeComplianceId}
            activeView={complianceView}
            onSelectView={handleSelectComplianceView}
            onSelectProject={handleSelectCompliance}
            onNew={handleNewCompliance}
            onBackToXiaohai={handleBackToXiaohai}
            onDelete={handleDeleteCompliance}
            onRename={handleRenameCompliance}
            onDuplicate={handleDuplicateCompliance}
            user={authUser}
            onLogin={enterLogin}
          />
        )}

        {/* Central content */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, overflow: "hidden", position: "relative", background: "#F7F9FC" }}>

          {/* Xiaohai mode */}
          {mode === "xiaohai" && (
            <>
              {frame === "chat" && (
                <ChatFrame
                  key={activeConvId === "new" && chatSeed ? `new-${chatSeed.nonce}` : activeConvId}
                  messages={activeConvId === "new" ? [] : (CONVERSATIONS.find(c => c.id === activeConvId)?.messages) ?? []}
                  onMessagesChange={(msgs) => { /* 实时更新由 ChatFrame 内部管理，预留接口 */ }}
                  onTitleUpdate={(title) => { /* 预留：更新对话标题 */ }}
                  initialQuestion={activeConvId === "new" && chatSeed ? chatSeed.q : undefined}
                  onUserMessage={handleChatUserMessage}
                />
              )}
              {frame === "welcome" && <WelcomeFrame goTo={goTo} onOdiAssistClick={() => setFrame("chat")} />}
              {frame === "non-odi" && <OdiQaFrame mode="non-odi" onOdiClick={() => {}} />}
              {(frame === "odi-qa" || frame === "odi-auth") && (
                <OdiQaFrame
                  mode="odi"
                  serviceType="助办"
                  onOdiClick={handleEnterOdiWorkbench}
                  onDemoClick={handleEnterOdiWorkbench}
                  onDemoFieldChange={() => {}}
                  analyzedCount={analyzedCount}
                  onItemAnalyzed={n => setAnalyzedCount(n)}
                  onPhase2Done={() => {}}
                  onGenerateMaterials={() => { setGenerateState("reviewing"); setTimeout(() => setGenerateState("done"), 1800); }}
                  initialMaterialsExpanded={false}
                />
              )}
              {frame === "odi-daiban" && (
                <OdiQaFrame
                  mode="odi"
                  serviceType="导办"
                  onOdiClick={() => goTo("odi-daiban-main")}
                  analyzedCount={analyzedCount}
                  onItemAnalyzed={n => setAnalyzedCount(n)}
                  onPhase2Done={() => {}}
                  onGenerateMaterials={() => { setGenerateState("reviewing"); setTimeout(() => setGenerateState("done"), 1800); }}
                />
              )}
              {frame === "odi-daiban-main" && (
                <OdiDaibanPage goTo={goTo} onSkipToUpload={handleEnterOdiWorkbench} />
              )}
              {isWorkbench && (
                <OdiWorkbenchFrame
                  frame={frame}
                  onFormConfirm={handlePreInfoConfirm}
                  onContinueUpload={handleContinueUpload}
                  investMethod={investMethod} setInvestMethod={setInvestMethod}
                  entityType={entityType} setEntityType={setEntityType}
                  destination={destination} setDestination={setDestination}
                  amount={amount} setAmount={setAmount}
                  preInfoConfirmed={preInfoConfirmed}
                  attachedFiles={attachedFiles} setAttachedFiles={setAttachedFiles}
                  materialGenerationStarted={materialGenerationStarted}
                  setMaterialGenerationStarted={setMaterialGenerationStarted}
                />
              )}
            </>
          )}

          {/* ODI list mode */}
          {mode === "odi-list" && (
            <OdiProjectListPage projects={projects} onEnterProject={handleSelectProject} onNewProject={handleNewProject} onRename={id => setOdiRenameId(id)} onDelete={id => setOdiDeleteId(id)} />
          )}

          {/* ODI assist project mode */}
          {mode === "odi-project" && activeProject && activeProject.serviceType === "assist" && (
            <OdiProjectDetailPage
              key={activeProject.id}
              project={activeProject as AssistProject}
              onUpdate={patch => handleUpdateOdiProject(activeProject.id, patch)}
              onBack={() => { setMode("odi-list"); setActiveProjectId(null); }}
              onGoToList={() => { setMode("odi-list"); setActiveProjectId(null); }}
              onAskAssistant={handleAskAssistant}
            />
          )}

          {/* ODI demo mode */}
          {mode === "odi-demo" && activeProject && activeProject.serviceType === "demo" && (
            <OdiDemoDetailPage
              project={activeProject as DemoProject}
              onBack={() => { setMode("odi-list"); setActiveProjectId(null); }}
            />
          )}

          {/* Compliance mode —— 合规自查（独立 shell，先独立）*/}
          {/* 速测版:嵌入合规空间中央区(左侧合规侧栏保留,同完整版外壳) */}
          {mode === "compliance" && quickTestActive && (
            <QuickTestWizard
              onUpgrade={handleQuickUpgrade}
              onBackHome={() => setQuickTestActive(false)}
            />
          )}
          {mode === "compliance" && !quickTestActive && !activeComplianceProject && (
            <ComplianceListPage projects={complianceProjects.filter(p => complianceView === "all" ? true : complianceView === "active" ? p.status !== "已完成" : p.status === "已完成")} totalCount={complianceProjects.length} activeCount={complianceProjects.filter(p => p.status !== "已完成").length} doneCount={complianceProjects.filter(p => p.status === "已完成").length} currentView={complianceView} onEnter={handleSelectCompliance} onNew={handleNewCompliance} onDelete={handleDeleteCompliance} onRename={handleRenameCompliance} onDuplicate={handleDuplicateCompliance} />
          )}
          {mode === "compliance" && !quickTestActive && activeComplianceProject && (
            <ComplianceDetailPage
              key={activeComplianceProject.id}
              project={activeComplianceProject}
              onUpdate={(patch) => handleUpdateCompliance(activeComplianceProject.id, patch)}
              onBack={() => { setActiveComplianceId(null); setComplianceView("all"); }}
            />
          )}

          {/* (ODI detour render 已撤:ODI 走 odi-list/odi-project/odi-demo,见上方各 mode 分支) */}
        </div>

        {/* Right panel */}
        {mode === "xiaohai" && !isDaibanMain && (
          <ContextWorkspace
            collapsed={rightCollapsed}
            onToggleCollapse={() => setRightCollapsed(v => !v)}
            searchKeyword={searchKeyword}
          />
        )}
        {mode === "odi-project" && activeProject?.serviceType === "assist" && (
          <OdiCopilotPanel
            collapsed={assistantCollapsed}
            onToggleCollapse={() => setAssistantCollapsed(v => !v)}
            context={{ projectId: activeProject.id, projectName: activeProject.name }}
          />
        )}
        {mode === "odi-demo" && activeProject?.serviceType === "demo" && (
          <OdiCopilotPanel
            collapsed={assistantCollapsed}
            onToggleCollapse={() => setAssistantCollapsed(v => !v)}
            context={{ projectId: activeProject.id, projectName: activeProject.name }}
          />
        )}
      </div>

      {/* New project modal */}
      {showNewProjectModal && (
        <NewOdiProjectModal
          onConfirm={handleCreateProject}
          onCancel={() => setShowNewProjectModal(false)}
        />
      )}

      {/* ODI 项目重命名/删除弹窗(复用合规组件) */}
      {odiRenameTarget && (
        <RenameModal
          initialName={odiRenameTarget.name}
          onConfirm={name => { handleRenameOdiProject(odiRenameTarget.id, name); setOdiRenameId(null); }}
          onCancel={() => setOdiRenameId(null)}
        />
      )}
      {odiDeleteTarget && (
        <DeleteConfirmModal
          projectName={odiDeleteTarget.name}
          onConfirm={() => { handleDeleteOdiProject(odiDeleteTarget.id); setOdiDeleteId(null); }}
          onCancel={() => setOdiDeleteId(null)}
        />
      )}

      {/* New compliance modal */}
      {showNewComplianceModal && (
        <NewComplianceProjectModal
          existingNames={complianceProjects.map(p => p.name)}
          onConfirm={handleCreateCompliance}
          onCancel={() => setShowNewComplianceModal(false)}
        />
      )}

      {/* (ODI detour 新建弹窗已撤:新建走 Figma 设计线 OdiProjectListPage 的 onNewProject → NewOdiProjectModal) */}
    </div>
  );
}
