// 合规自查项目数据模型 —— 独立于 ODI 项目（呼应"先独立"）。
// 镜像 odiProjectData.ts 的结构：类型 + 状态配色 + mock 种子。

import type { Mode } from "../logic/weights";
import type { WizardState } from "../logic/wizardModel";
import type { Grade } from "../logic/scoring";

export type ComplianceStatus = "待填写" | "填写中" | "待生成报告" | "已完成";

export interface ComplianceProject {
  id: string; // c{timestamp}
  name: string;
  status: ComplianceStatus;
  investBranch?: Mode; // 在向导步骤 1 选定
  snapshot?: WizardState; // 向导状态快照（可恢复编辑 / 可重算报告）
  grade?: Grade; // 最近一次报告档位
  coreCompleteness?: number; // 最近一次核心齐备度
  generatedReports: string[];
  updatedAt: string;
}

export const COMPLIANCE_STATUS_CONFIG: Record<
  ComplianceStatus,
  { color: string; bg: string; border: string }
> = {
  待填写: { color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe" },
  填写中: { color: "#92400e", bg: "#fff7ed", border: "#fed7aa" },
  待生成报告: { color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
  已完成: { color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
};

export const BRANCH_LABEL: Record<Mode, string> = {
  new: "新设类",
  ma: "并购类",
  chg: "变更类",
};

// ─── mock 种子 ────────────────────────────────────────────────────────────────
// 一条"已完成"（新设·新加坡，含完整快照，可重算报告）+ 一条"填写中"。
const doneSnapshot: WizardState = {
  mode: "new",
  answers: {
    single: {
      p_own: "民营", p_ind2: "C", p_ctry: "新加坡", p_path: "direct",
      z1: "a", z2: "a", z3: "c", z4: "a", z5: "b", z6: "a",
      n1: "c", n2: "b", n3: "a",
      g1: "b", g2: "a", g3: "qz",
      s1a: "n", s2c: "a", s4: "n",
      q52: "one", q53: "a", q54: "a",
    },
    multi: { p_arch: ["none"], s2a: ["0"], s3: ["0"] },
  },
  uploads: {
    f_z1a: { name: "股权架构图.pdf", masked: false },
    f_z2a: { name: "营业执照.pdf", masked: false },
    f_z2b: { name: "主营业务说明.pdf", masked: false },
    f_z4a: { name: "法律调查报告.pdf", masked: false },
    f_z4b: { name: "真实性承诺书.pdf", masked: false },
    f_n1: { name: "成本测算表.xlsx", masked: false },
    f_n2: { name: "设备采购意向书.pdf", masked: false },
    f_ls: { name: "三套清单核对记录.pdf", masked: false },
    f_s1: { name: "技术目录核对说明.pdf", masked: false },
    f_s2: { name: "数据出境合规说明.pdf", masked: false },
  },
  ctryAck: { ctry: "新加坡", time: "2026-08-04 10:12" },
  lsNone: true,
  curStep: 6,
  maxSeen: 6,
  generated: true,
};

export const MOCK_COMPLIANCE_PROJECTS: ComplianceProject[] = [
  {
    id: "c1",
    name: "新加坡设立智能装备子公司·合规自查",
    status: "已完成",
    investBranch: "new",
    snapshot: doneSnapshot,
    grade: "C",
    coreCompleteness: 64,
    generatedReports: ["自查报告", "文件齐备度明细", "缺件清单与行动建议"],
    updatedAt: "2026年8月4日",
  },
  {
    id: "c2",
    name: "德国并购工业软件公司·合规自查",
    status: "填写中",
    investBranch: "ma",
    snapshot: {
      mode: "ma",
      answers: { single: { p_ctry: "德国", p_own: "民营" }, multi: {} },
      uploads: {},
      ctryAck: { ctry: "德国", time: "2026-08-05 09:30" },
      lsNone: false,
      curStep: 2,
      maxSeen: 2,
      generated: false,
    },
    generatedReports: [],
    updatedAt: "今天 09:30",
  },
];
