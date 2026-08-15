// 文件齐备度双层计分 —— 核心层权重唯一来源。
// 忠实移植自合规 HTML 第五版（spec_v3 口径·第二节 双层计分制）。
// 注意：部分权重为对象型 { new, ma, chg }，随投资方式分支变化。

export type Mode = "new" | "ma" | "chg";

export const MODE_NAME: Record<Mode, string> = {
  new: "新设类",
  ma: "并购类",
  chg: "变更类",
};

export type FileId =
  | "f_z1a" | "f_z1b" | "f_z2a" | "f_z2b" | "f_z2c"
  | "f_z3a" | "f_z3b" | "f_z3c" | "f_z3d" | "f_z3e"
  | "f_z4a" | "f_z4b" | "f_z5" | "f_z6"
  | "f_n1" | "f_n2" | "f_n3"
  | "f_m1a" | "f_m1b" | "f_m1c" | "f_m2" | "f_m3"
  | "f_c1" | "f_c2" | "f_c3"
  | "f_g1" | "f_g2"
  | "f_t1a" | "f_t1b" | "f_t1c" | "f_t1ma" | "f_t2a" | "f_t2b" | "f_t2c"
  | "f_tc1" | "f_tc2"
  | "f_ls" | "f_t4"
  | "f_s1" | "f_s2" | "f_s3" | "f_s4";

type Weight = number | Partial<Record<Mode, number>>;

// 核心层权重表（对象型权重按分支取值）
export const FILE_W: Record<FileId, Weight> = {
  f_z1a: 7, f_z1b: 5, f_z2a: 1, f_z2b: 2, f_z2c: 1,
  f_z3a: 3, f_z3b: 2, f_z3c: 0, f_z3d: 0, f_z3e: 2,
  f_z4a: 7, f_z4b: { new: 5, ma: 4, chg: 4 }, f_z5: 0, f_z6: 0,
  f_n1: 9, f_n2: 6, f_n3: 3,
  f_m1a: 5, f_m1b: 3, f_m1c: 3, f_m2: 5, f_m3: 4,
  f_c1: 9, f_c2: 9, f_c3: 4,
  f_g1: 0, f_g2: { new: 2, ma: 1, chg: 0 },
  f_t1a: 7, f_t1b: 2, f_t1c: 2,
  f_t1ma: 5, f_t2a: 2, f_t2b: 2, f_t2c: 2,
  f_tc1: 7, f_tc2: 4,
  f_ls: { new: 14, ma: 14, chg: 13 }, f_t4: 3,
  f_s1: 7, f_s2: 6, f_s3: 2, f_s4: 2,
};

// 增强层文件（不提交不扣分，每提交 1 件 +1 分，受 ENH_CAP 上限约束）
export const FILE_ENH: Record<Mode, FileId[]> = {
  new: ["f_g1", "f_z3c", "f_z3d", "f_z5", "f_z6"],
  ma: ["f_g1", "f_z3c", "f_z3d", "f_z5", "f_z6"],
  chg: ["f_z3c", "f_z3d", "f_z5", "f_z6"],
};

export const ENH_CAP: Record<Mode, number> = { new: 5, ma: 5, chg: 4 };

export const FILE_LABEL: Record<FileId, string> = {
  f_z1a: "股权架构图",
  f_z1b: "境外各层级登记证明文件及中文译本",
  f_z2a: "营业执照",
  f_z2b: "近2年主营业务说明",
  f_z2c: "主业与标的关联性说明",
  f_z3a: "上一年度审计报告",
  f_z3b: "最近一期财务报表",
  f_z3c: "实缴注册资本验资报告",
  f_z3d: "股东出资证明书",
  f_z3e: "银行资金证明（商务、发改各一份）",
  f_z4a: "法律调查报告",
  f_z4b: "境外投资真实性承诺书（商务、发改各一份）",
  f_z5: "舆情说明（含检索记录）",
  f_z6: "诉讼仲裁及政府调查情况说明",
  f_n1: "成本测算表",
  f_n2: "大额科目合同或合作意向书",
  f_n3: "测算总额与拟投资额匹配性说明",
  f_m1a: "法律尽职调查报告",
  f_m1b: "标的公司财务审计报告",
  f_m1c: "资产评估/估值报告",
  f_m2: "估值可比案例区间说明",
  f_m3: "交易协议（SPA/增资认购协议）",
  f_c1: "原核准文件/备案通知书及《企业境外投资证书》",
  f_c2: "变更相关协议文件",
  f_c3: "投资额与持股比例同步核对说明",
  f_g1: "团队行业经验简历",
  f_g2: "关联交易及定价说明/无关联交易声明",
  f_t1a: "可行性研究报告（含“投资合理性”专节）",
  f_t1b: "拟设境外企业章程（草案）",
  f_t1c: "标的（项目）基本信息文件",
  f_t1ma: "可行性研究报告（含并购方案）",
  f_t2a: "标的注册证明文件",
  f_t2b: "股东名册",
  f_t2c: "董事名册",
  f_tc1: "变更事项逐项对照说明",
  f_tc2: "新旧架构图或更新登记文件",
  f_ls: "三套负面清单核对结果及检索记录",
  f_t4: "风险防控能力证明材料",
  f_s1: "技术目录核对说明（含商品库查证记录）",
  f_s2: "数据出境合规说明",
  f_s3: "供应链情况说明",
  f_s4: "域外证据调取情况说明",
};

export const FILE_MOD: Record<FileId, string> = {
  f_z1a: "模块一", f_z1b: "模块一", f_z2a: "模块一", f_z2b: "模块一", f_z2c: "模块一",
  f_z3a: "模块一", f_z3b: "模块一", f_z3c: "模块一", f_z3d: "模块一", f_z3e: "模块一",
  f_z4a: "模块一", f_z4b: "模块一", f_z5: "模块一", f_z6: "模块一",
  f_n1: "模块二", f_n2: "模块二", f_n3: "模块二",
  f_m1a: "模块二", f_m1b: "模块二", f_m1c: "模块二", f_m2: "模块二", f_m3: "模块二",
  f_c1: "模块二", f_c2: "模块二", f_c3: "模块二",
  f_g1: "模块二", f_g2: "模块二",
  f_t1a: "模块三", f_t1b: "模块三", f_t1c: "模块三",
  f_t1ma: "模块三", f_t2a: "模块三", f_t2b: "模块三", f_t2c: "模块三",
  f_tc1: "模块三", f_tc2: "模块三",
  f_ls: "模块三", f_t4: "模块三",
  f_s1: "模块四", f_s2: "模块四", f_s3: "模块四", f_s4: "模块四",
};

// 当前分支下该文件的权重
export function fw(fid: FileId, mode: Mode): number {
  const w = FILE_W[fid];
  if (typeof w === "object") return (w as Record<Mode, number>)[mode] ?? 0;
  return w as number;
}

export function isENH(fid: FileId, mode: Mode): boolean {
  return FILE_ENH[mode].includes(fid);
}

// 当前路径适用文件集（基础 + 分支追加 + 通用安全/清单）
export function fileSet(mode: Mode): FileId[] {
  const set: FileId[] = [
    "f_z1a", "f_z1b", "f_z2a", "f_z2b", "f_z2c",
    "f_z3a", "f_z3b", "f_z3c", "f_z3d", "f_z3e",
    "f_z4a", "f_z4b", "f_z5", "f_z6",
  ];
  if (mode === "new") set.push("f_n1", "f_n2", "f_n3", "f_g1", "f_g2", "f_t1a", "f_t1b", "f_t1c");
  if (mode === "ma") set.push("f_m1a", "f_m1b", "f_m1c", "f_m2", "f_m3", "f_g1", "f_g2", "f_t1ma", "f_t2a", "f_t2b", "f_t2c");
  if (mode === "chg") set.push("f_c1", "f_c2", "f_c3", "f_tc1", "f_tc2");
  set.push("f_ls", "f_t4", "f_s1", "f_s2", "f_s3", "f_s4");
  return set;
}
