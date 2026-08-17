// ODI 统一字段池与项目数据模型(对应 spec §4)。

export type OdiDept = "commerce" | "ndrc" | "shared";
export type OdiFieldStatus =
  | "empty" | "recognized" | "pending_confirm" | "confirmed" | "conflict" | "missing";

export interface FieldSource {
  origin: "guide" | "upload" | "auth" | "ai" | "derived";
  material?: string;
  evidence?: string;
}

/** 材料键(统一字段池的多来源值 —— 流程文档 §9:同一字段多值全部保留,不自动覆盖) */
export type OdiMaterialKey = "备案表" | "营业执照" | "审计报告" | "承诺书" | "请示" | "资金证明";

/** 单份材料识别出的该字段值(供发改委跨材料一致性规则比对) */
export interface MaterialValue {
  material: OdiMaterialKey;
  value: string;
}

export interface OdiField {
  code: string;
  name: string;
  value: string;
  sources: FieldSource[];
  status: OdiFieldStatus;
  dept: OdiDept;
  round?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  confidence?: number;
  derived?: boolean;
  /** 多来源材料值(备案表/执照/审计/承诺书/请示各自识别值);无材料解析时缺省 */
  materialValues?: MaterialValue[];
  updatedAt: number;
}

export type OdiService = "guide" | "assist";
export type OdiScene = "新设独资" | "并购" | "增资变更";
export type OdiProjectStatus =
  | "填报中" | "待校验" | "校验中" | "待处理" | "可生成" | "已完成";

export interface GeneratedDoc {
  id: string;
  name: string;
  blobUrl?: string;
  generatedAt: string;
}

export interface OdiProject {
  id: string;
  name: string;
  service: OdiService;
  scene?: OdiScene;
  fieldPool: OdiField[];
  uploadedFiles: unknown[];
  validation: unknown | null;
  generatedDocs: GeneratedDoc[];
  status: OdiProjectStatus;
  materialVersion?: string;
  updatedAt: string;
}

export function emptyField(
  code: string, name: string, round: 1|2|3|4|5|6|7, dept: OdiDept,
): OdiField {
  return { code, name, value: "", sources: [], status: "empty", dept, round, updatedAt: 0 };
}
