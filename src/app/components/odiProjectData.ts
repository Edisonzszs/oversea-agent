// ─── Service type ───────────────────────────────────────────────────────────
export type ServiceType = "assist" | "demo";

// ─── Assist (申报助办) ────────────────────────────────────────────────────────
export type AssistStatus =
  | "待上传材料"
  | "待校验"
  | "材料校验中"
  | "待处理"
  | "已完成";

export type OdiInvestmentType = "新设" | "并购" | "增资" | "变更";

export interface AssistProject {
  serviceType: "assist";
  id: string;
  name: string;
  status: AssistStatus;
  investmentType?: OdiInvestmentType;
  uploadedCount: number;
  mismatchCount: number;
  missingCount: number;
  passedCount: number;
  generatedCount: number;
  updatedAt: string;
  fromDemoId?: string; // 来源模拟任务 ID（仅显示"由一次模拟体验发起"，不复制字段）
}

// ─── Demo (ODI 模拟填报) ──────────────────────────────────────────────────────
export type DemoStatus = "进行中" | "已完成" | "已生成";
export type DemoScene = "新设独资" | "并购" | "增资变更";
export type DemoMode = "快速体验" | "自定义体验";
export type DemoStep = "项目方案" | "投资结构与资金" | "项目说明" | "材料结果";
export type DemoStepStatus = "pending" | "active" | "completed" | "warning";

export interface DemoProject {
  serviceType: "demo";
  id: string;
  name: string;
  status: DemoStatus;
  scene: DemoScene;
  mode: DemoMode;
  country: string;
  industry: string;
  investmentAmount: string;
  equityRatio: string;
  currentStep: number; // 0-3
  stepStatuses: DemoStepStatus[];
  warningCount: number; // 体验提示数量
  generatedCount: number;
  updatedAt: string;
}

export type OdiProject = AssistProject | DemoProject;

// ─── Status config ────────────────────────────────────────────────────────────
// Legacy alias kept for backward compat with OdiProjectDetailPage
export type OdiProjectStatus = AssistStatus;

export const PROJECT_STATUS_CONFIG: Record<AssistStatus, { color: string; bg: string; border: string }> = {
  "待上传材料": { color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
  "待校验":     { color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe" },
  "材料校验中": { color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
  "待处理":     { color: "#b45309", bg: "#fff7ed", border: "#fed7aa" },
  "已完成":     { color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
};

export const DEMO_STATUS_CONFIG: Record<DemoStatus, { color: string; bg: string; border: string }> = {
  "进行中": { color: "#92400e", bg: "#fff7ed", border: "#fed7aa" },
  "已完成": { color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  "已生成": { color: "#1a5bc6", bg: "#eff6ff", border: "#bfdbfe" },
};

// ─── Mock data ────────────────────────────────────────────────────────────────
export const MOCK_ODI_PROJECTS: OdiProject[] = [
  // 助办任务
  {
    serviceType: "assist",
    id: "p1",
    name: "越南新设智能装备生产基地项目",
    status: "材料校验中",
    investmentType: "新设",
    uploadedCount: 6,
    mismatchCount: 3,
    missingCount: 4,
    passedCount: 8,
    generatedCount: 2,
    updatedAt: "今天 14:32",
  },
  {
    serviceType: "assist",
    id: "p2",
    name: "新加坡研发中心项目",
    status: "待上传材料",
    investmentType: "新设",
    uploadedCount: 0,
    mismatchCount: 0,
    missingCount: 0,
    passedCount: 0,
    generatedCount: 0,
    updatedAt: "2026年7月20日",
  },
  {
    serviceType: "assist",
    id: "p3",
    name: "德国并购生产企业项目",
    status: "已完成",
    investmentType: "并购",
    uploadedCount: 8,
    mismatchCount: 0,
    missingCount: 0,
    passedCount: 12,
    generatedCount: 5,
    updatedAt: "2026年7月15日",
  },
  // 模拟任务
  {
    serviceType: "demo",
    id: "d1",
    name: "新加坡新设独资子公司模拟体验",
    status: "已完成",
    scene: "新设独资",
    mode: "快速体验",
    country: "新加坡",
    industry: "软件和信息技术服务业",
    investmentAmount: "500万美元",
    equityRatio: "100%",
    currentStep: 3,
    stepStatuses: ["completed", "completed", "completed", "completed"],
    warningCount: 1,
    generatedCount: 3,
    updatedAt: "今天 11:05",
  },
  {
    serviceType: "demo",
    id: "d2",
    name: "德国工业设备并购模拟体验",
    status: "进行中",
    scene: "并购",
    mode: "自定义体验",
    country: "德国",
    industry: "工业设备制造",
    investmentAmount: "1,000万美元",
    equityRatio: "80%",
    currentStep: 1,
    stepStatuses: ["completed", "active", "pending", "pending"],
    warningCount: 0,
    generatedCount: 0,
    updatedAt: "今天 09:30",
  },
];
