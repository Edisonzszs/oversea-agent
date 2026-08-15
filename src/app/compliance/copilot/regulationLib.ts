export interface RegulationEntry { title: string; clauses: { id: string; point: string }[]; }
export const regulationLib: Record<string, RegulationEntry> = {
  z1: {
    title: "自查1 股权架构及实际控制人",
    clauses: [
      { id: "国务院令第837号 第二条", point: "（投资者及对外投资定义相关条款——以官方原文为准）" },
      { id: "商务部令2014年第3号 第九条、第十条", point: "（境外投资主体资格与申请材料相关条款）" },
      { id: "发改委令第11号", point: "（企业境外投资管理办法相关条款）" },
    ],
  },
  z3: {
    title: "自查3 企业规模与资金实力（前置门槛）",
    clauses: [
      { id: "商务部令2014年第3号 第十九条", point: "（投资资金来源真实性相关条款）" },
      { id: "国务院令第837号", point: "（真实性审查要求上升至行政法规层级）" },
    ],
  },
  z4: {
    title: "自查4 违法违规记录（前置门槛）",
    clauses: [
      { id: "商合发〔2018〕24号", point: "（对外投资备案（核准）报告暂行办法 + 联合惩戒机制）" },
      { id: "国务院令第837号 第十条", point: "（分类分级全过程监管）" },
    ],
  },
  ls: {
    title: "模块三 三套负面清单核对",
    clauses: [
      { id: "发改外资〔2018〕251号", point: "（境外投资敏感行业目录——清单A）" },
      { id: "国办发〔2017〕74号", point: "（限制类/禁止类——清单B/C）" },
    ],
  },
  s1a: {
    title: "模块四 出口管制与技术出境",
    clauses: [
      { id: "国务院令第837号 第十三条", point: "（涉管制物项/技术的跨境安排相关条款）" },
      { id: "中国禁止出口限制出口技术目录", point: "（目录及清单核对依据）" },
    ],
  },
  t4: {
    title: "模块三 风险国别",
    clauses: [
      { id: "商务部系统填表说明 第15条", point: "（需核准国别/地区范围）" },
      { id: "国办发〔2017〕74号", point: "（敏感国家（地区）投资限制类）" },
    ],
  },
};

export const QUESTION_LIST: { moduleId: number; moduleLabel: string; questionId: string; questionLabel: string }[] = [
  { moduleId: 1, moduleLabel: "模块一 主体资格", questionId: "z1", questionLabel: "股权架构及实控人" },
  { moduleId: 1, moduleLabel: "模块一 主体资格", questionId: "z3", questionLabel: "规模与资金实力" },
  { moduleId: 1, moduleLabel: "模块一 主体资格", questionId: "z4", questionLabel: "违法违规记录" },
  { moduleId: 3, moduleLabel: "模块三 标的", questionId: "ls", questionLabel: "三套负面清单核对" },
  { moduleId: 3, moduleLabel: "模块三 标的", questionId: "t4", questionLabel: "风险国别" },
  { moduleId: 4, moduleLabel: "模块四 安全审查", questionId: "s1a", questionLabel: "出口管制与技术出境" },
];

export function buildRegulationContext(questionId: string): string {
  const e = regulationLib[questionId];
  if (!e) return "";
  const cl = e.clauses.map(c => `- ${c.id}：${c.point}`).join("\n");
  return `问题：${e.title}\n可参考的法规依据（以下为口径要点,非逐字条文;正式材料须以官方原文为准）：\n${cl}`;
}
