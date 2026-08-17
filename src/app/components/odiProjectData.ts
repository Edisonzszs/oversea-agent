import { createGuideProject } from "../odi/data/odiProjects";
import { commitField } from "../odi/field/odiGuideLogic";
import type { OdiField } from "../odi/data/types";

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

/** 上传的材料文件行（POC：识别为演示态，未接 OCR） */
export interface AssistMaterialFile {
  id: string;
  name: string;
  type: string;  // 材料类型（按文件名推断）
  scope: string; // 所属范围
  uploadedAt: string;
  recog: "识别中" | "已识别";
  check: "待校验" | "通过" | "不通过" | "缺失";
}

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
  materials: AssistMaterialFile[]; // 已上传材料（空 = 未上传）
  materialVersion: number;        // 材料版本：上传/删除 +1（对应流程文档 material_version_hash）
  validatedVersion?: number;      // 已完成校验时的材料版本；= materialVersion 时禁止重复校验（硬边界③）
  validatedAt?: string;           // 最近校验时间（显示用）
  fieldPool?: OdiField[];         // 已解析字段池（未上传/未解析时缺省，校验引擎输入）
}

/** 按文件名推断材料类型/所属范围（POC 演示：未接 OCR，仅按名归类） */
export function guessMaterialMeta(name: string): { type: string; scope: string } {
  if (/备案|申请表/.test(name)) return { type: "政府申报表", scope: "商务委" };
  if (/承诺书/.test(name)) return { type: "合规承诺文件", scope: "商务委+发改委" };
  if (/营业|执照/.test(name)) return { type: "证照文件", scope: "商务委+发改委" };
  if (/审计|财务|资产负债|利润/.test(name)) return { type: "财务报表", scope: "发改委" };
  if (/决议/.test(name)) return { type: "企业内部文件", scope: "商务委+发改委" };
  if (/可行|可研/.test(name)) return { type: "企业内部文件", scope: "发改委" };
  if (/资金|存款|贷款/.test(name)) return { type: "资金证明文件", scope: "发改委" };
  return { type: "其他材料", scope: "商务委+发改委" };
}

/** 校验完成后的落库状态：有问题 → 待处理；全通过 → 已完成 */
export function statusAfterValidation(failed: number, missing: number): AssistStatus {
  return failed + missing > 0 ? "待处理" : "已完成";
}

/** 5 步办理进度按项目状态推导（原先写死 done,done,done,current,pending） */
export function progressFromStatus(status: AssistStatus): ("done" | "current" | "issue" | "pending")[] {
  switch (status) {
    case "待上传材料": return ["done", "current", "pending", "pending", "pending"];
    case "待校验":     return ["done", "done", "current", "pending", "pending"];
    case "材料校验中": return ["done", "done", "current", "pending", "pending"];
    case "待处理":     return ["done", "done", "done", "issue", "pending"];
    case "已完成":     return ["done", "done", "done", "done", "done"];
  }
}

/** 助办演示字段池：POC 未接 OCR，首次上传后按场景预设模拟"已解析"。
 *  injectIssues=true 时注入 3 处典型问题（注册资本>总额 / 项目说明缺失 / 境外企业名缺失）
 *  以演示三态校验；false 为干净池（全部通过，对应已完成项目）。 */
export function seedAssistFieldPool(injectIssues: boolean): OdiField[] {
  let pool = createGuideProject("助办(模拟已解析)", "新设独资", "快速体验").fieldPool;
  if (injectIssues) {
    pool = commitField(pool, "overseas_registered_capital", "900万美元", "upload"); // 注册资本>总额 → 商务委不通过
    pool = commitField(pool, "project_summary", "", "upload");                       // 项目说明缺失 → 发改委缺失
    pool = commitField(pool, "overseas_company_cn", "", "upload");                   // 境外企业名缺失 → 跨业务缺失
  }
  return pool;
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
  // 助办任务（校验计数与 seedAssistFieldPool(true) 的引擎实算结果保持一致）
  {
    serviceType: "assist",
    id: "p1",
    name: "越南新设智能装备生产基地项目",
    status: "材料校验中",
    investmentType: "新设",
    uploadedCount: 6,
    mismatchCount: 1,
    missingCount: 2,
    passedCount: 17,
    generatedCount: 2,
    updatedAt: "今天 14:32",
    materials: [
      { id: "m1", name: "境外投资备案申请表.pdf", type: "政府申报表", scope: "商务委", uploadedAt: "2026-07-27 14:30", recog: "已识别", check: "不通过" },
      { id: "m2", name: "可行性研究报告.pdf", type: "企业内部文件", scope: "发改委", uploadedAt: "2026-07-27 10:15", recog: "已识别", check: "通过" },
      { id: "m3", name: "董事会决议.pdf", type: "企业内部文件", scope: "商务委+发改委", uploadedAt: "2026-07-26 16:00", recog: "已识别", check: "通过" },
      { id: "m4", name: "企业营业执照副本.pdf", type: "证照文件", scope: "商务委+发改委", uploadedAt: "2026-07-26 15:45", recog: "已识别", check: "通过" },
      { id: "m5", name: "法人授权委托书.pdf", type: "授权文件", scope: "商务委", uploadedAt: "2026-07-25 09:00", recog: "识别中", check: "待校验" },
      { id: "m6", name: "资产负债表（最近3年）.xlsx", type: "财务报表", scope: "发改委", uploadedAt: "2026-07-24 17:30", recog: "已识别", check: "缺失" },
    ],
    materialVersion: 2,
    validatedVersion: 2,
    validatedAt: "今天 14:32",
    fieldPool: seedAssistFieldPool(true),
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
    materials: [],
    materialVersion: 0,
  },
  {
    serviceType: "assist",
    id: "p3",
    name: "德国并购生产企业项目",
    status: "已完成",
    investmentType: "并购",
    uploadedCount: 6,
    mismatchCount: 0,
    missingCount: 0,
    passedCount: 20,
    generatedCount: 5,
    updatedAt: "2026年7月15日",
    materials: [
      { id: "p3m1", name: "境外投资备案申请表.pdf", type: "政府申报表", scope: "商务委", uploadedAt: "2026-07-14 14:30", recog: "已识别", check: "通过" },
      { id: "p3m2", name: "境外投资真实性承诺书.pdf", type: "合规承诺文件", scope: "商务委+发改委", uploadedAt: "2026-07-14 11:20", recog: "已识别", check: "通过" },
      { id: "p3m3", name: "董事会决议.pdf", type: "企业内部文件", scope: "商务委+发改委", uploadedAt: "2026-07-13 16:00", recog: "已识别", check: "通过" },
      { id: "p3m4", name: "企业营业执照副本.pdf", type: "证照文件", scope: "商务委+发改委", uploadedAt: "2026-07-13 15:45", recog: "已识别", check: "通过" },
      { id: "p3m5", name: "审计报告及财务报表.pdf", type: "财务报表", scope: "发改委", uploadedAt: "2026-07-12 17:30", recog: "已识别", check: "通过" },
      { id: "p3m6", name: "银行存款证明.pdf", type: "资金证明文件", scope: "发改委", uploadedAt: "2026-07-12 10:00", recog: "已识别", check: "通过" },
    ],
    materialVersion: 3,
    validatedVersion: 3,
    validatedAt: "2026年7月15日",
    fieldPool: seedAssistFieldPool(false),
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
