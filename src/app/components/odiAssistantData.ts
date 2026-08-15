export type MaterialDepartment = "shared" | "commerce" | "ndrc";

export type MaterialStatus =
  | "not_uploaded"
  | "uploaded"
  | "recognizing"
  | "recognized"
  | "needs_confirmation"
  | "unsupported";

export interface OdiMaterial {
  id: string;
  name: string;
  department: MaterialDepartment;
  required: boolean;
  scenario?: "all" | "merger";
  description: string;
  status: MaterialStatus;
  supportsGeneration: boolean;
}

export const ODI_MATERIALS: OdiMaterial[] = [
  // Shared
  { id: "shared-1", name: "投资主体营业执照", department: "shared", required: true, scenario: "all", description: "投资主体的有效营业执照", status: "not_uploaded", supportsGeneration: false },
  { id: "shared-2", name: "投资决策文件", department: "shared", required: true, scenario: "all", description: "如股东会决议、董事会决议、执行董事决定等", status: "not_uploaded", supportsGeneration: false },
  { id: "shared-3", name: "可行性研究报告", department: "shared", required: true, scenario: "all", description: "境外投资项目可行性研究报告", status: "not_uploaded", supportsGeneration: false },
  { id: "shared-4", name: "经审计财务报表或近期财务报表", department: "shared", required: false, scenario: "all", description: "近期经审计的财务报表或公司财报", status: "not_uploaded", supportsGeneration: false },
  { id: "shared-5", name: "资金来源支持文件", department: "shared", required: false, scenario: "all", description: "如银行资信证明、资金来源说明函等", status: "not_uploaded", supportsGeneration: false },
  { id: "shared-6", name: "股权架构图", department: "shared", required: false, scenario: "all", description: "境外企业股权架构图", status: "not_uploaded", supportsGeneration: false },
  { id: "shared-7", name: "相关真实合规证明材料", department: "shared", required: false, scenario: "all", description: "其他合规证明文件", status: "not_uploaded", supportsGeneration: false },
  // Commerce
  { id: "commerce-1", name: "境外投资备案申请表", department: "commerce", required: true, scenario: "all", description: "商务委口径境外投资备案申请表", status: "not_uploaded", supportsGeneration: true },
  { id: "commerce-2", name: "境外投资真实性承诺书", department: "commerce", required: true, scenario: "all", description: "商务委口径境外投资真实性承诺书", status: "not_uploaded", supportsGeneration: true },
  { id: "commerce-3", name: "境外并购事项前期报告表", department: "commerce", required: false, scenario: "merger", description: "并购场景适用", status: "not_uploaded", supportsGeneration: true },
  // NDRC
  { id: "ndrc-1", name: "境外投资项目备案表", department: "ndrc", required: true, scenario: "all", description: "发改委口径境外投资项目备案表", status: "not_uploaded", supportsGeneration: false },
  { id: "ndrc-2", name: "企业项目申请备案的请示", department: "ndrc", required: true, scenario: "all", description: "发改委口径企业项目申请备案的请示", status: "not_uploaded", supportsGeneration: false },
  { id: "ndrc-3", name: "境外投资真实性承诺书（发改委口径）", department: "ndrc", required: true, scenario: "all", description: "发改委口径境外投资真实性承诺书", status: "not_uploaded", supportsGeneration: false },
];

// Kept for OdiQaFrame legacy chat animation
export const ANALYSIS_ITEMS = [
  { label: "投资主体营业执照", ok: true, fileType: "jpg" },
  { label: "股东会决议、董事会决议", ok: true, fileType: "doc" },
  { label: "股权架构图", ok: false, fileType: "doc" },
  { label: "经审计财务报表", ok: true, fileType: "doc" },
  { label: "资金来源证明", ok: true, fileType: "doc" },
  { label: "投资环境报告", ok: true, fileType: "doc" },
  { label: "可行性研究报告", ok: true, fileType: "doc" },
];
