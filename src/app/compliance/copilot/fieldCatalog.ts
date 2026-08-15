import type { Mode } from "../logic/weights";
import type { WizardApi } from "../components/fields";

// kind：
//  select = 单选（radio/select），value 必须是 allowed 之一的 code
//  text   = 自由文本
//  multi  = 多选（checkbox），value 为「逗号拼接的 code」（如 "b1,b2"），write 时拆分批量写入
export interface ExtractField {
  key: string;
  label: string;
  kind: "select" | "text" | "multi";
  allowed?: { value: string; label: string }[];
  note?: string;
  write: (api: WizardApi, value: string) => void;
}
export interface ParsedCandidate {
  field: ExtractField;
  value: string; // multi 时为逗号拼接 code
  confidence: number;
  evidence: string;
  lowConf: boolean;
}

const IND_OPTS = [
  { value: "C", label: "制造业" }, { value: "I", label: "信息传输、软件和信息技术服务业" },
  { value: "G", label: "交通运输、仓储和邮政业" }, { value: "L", label: "租赁和商务服务业" },
  { value: "K", label: "房地产业" }, { value: "J", label: "金融业" },
  { value: "M", label: "科学研究和技术服务业" }, { value: "E", label: "建筑业" },
];

// ─── 模块〇 企业画像（step 1）─────────────────────────────────────────────────
const STEP1: ExtractField[] = [
  { key: "investMode", label: "投资方式", kind: "select", allowed: [
    { value: "new", label: "新设类（在境外设立新企业/绿地投资）" },
    { value: "ma", label: "并购类（取得既有标的公司股份）" },
    { value: "chg", label: "变更类（已获证项目载明事项变化）" },
  ], note: "对已获证项目的增资属变更类；通过增资首次入股他人既有公司属并购类", write: (api, v) => api.setMode(v as Mode) },
  { key: "country", label: "目的地国别", kind: "text", note: "拟投资最终目的地国别/地区", write: (api, v) => api.pickCountry(v) },
  { key: "amount", label: "拟投资总额", kind: "text", note: "含币种，如 5000 万美元", write: (api, v) => api.setSingle("p_amt", v) },
  { key: "ownership", label: "所有制类型", kind: "select", allowed: [
    { value: "民营", label: "民营" }, { value: "国有独资", label: "国有独资" },
    { value: "国有控股", label: "国有控股" }, { value: "外商投资", label: "外商投资" },
    { value: "混合所有制", label: "混合所有制" },
  ], write: (api, v) => api.setSingle("p_own", v) },
  { key: "industry", label: "拟投资行业类别", kind: "select", allowed: IND_OPTS, note: "GB/T 4754 门类，用 code 值", write: (api, v) => api.setSingle("p_ind2", v) },
  { key: "path", label: "投资路径", kind: "select", allowed: [
    { value: "direct", label: "直接投资至目的地" }, { value: "via", label: "经第三地（含港澳台）中转" },
  ], write: (api, v) => api.setSingle("p_path", v) },
];

// ─── 模块一 主体资格（step 2）z1..z6 ─────────────────────────────────────────
const STEP2: ExtractField[] = [
  { key: "z1", label: "自查1 股权架构及实际控制人", kind: "select", allowed: [
    { value: "a", label: "架构清晰、可追溯至实控人、各层持股有登记文件" },
    { value: "b", label: "架构完整但部分层级登记文件未齐" },
    { value: "c", label: "多层嵌套但能说明商业合理性" },
    { value: "d", label: "存在无商业实质安排或无法追溯至实控人" },
  ], write: (api, v) => api.setSingle("z1", v) },
  { key: "z2", label: "自查2 主营业务合规性及与标的关联性", kind: "select", allowed: [
    { value: "a", label: "主业不属限制/淘汰/两高且与标的相关" },
    { value: "b", label: "主业合规但与标的关系不明显" },
    { value: "c", label: "主业属限制类/两高但已完成合规改造" },
    { value: "d", label: "主业属淘汰类或限制/两高且未完成改造" },
  ], write: (api, v) => api.setSingle("z2", v) },
  { key: "z3", label: "自查3 企业规模与资金实力", kind: "select", allowed: [
    { value: "a", label: "实缴资本与所有者权益覆盖投资额且全为自有资金" },
    { value: "b", label: "能覆盖，含贷款等非自有但来源合法可说明" },
    { value: "c", label: "接近但未完全覆盖，需补充其他合法来源" },
    { value: "d", label: "明显不足且无其他合法来源" },
  ], write: (api, v) => api.setSingle("z3", v) },
  { key: "z4", label: "自查4 违法违规记录", kind: "select", allowed: [
    { value: "a", label: "近五年无刑事/重大处罚、未失信未受联合惩戒" },
    { value: "b", label: "曾有一般处罚且与境外投资无关" },
    { value: "c", label: "曾有相关处罚但已整改、影响已消除" },
    { value: "d", label: "有刑事记录或失信/联合惩戒/资格罚" },
  ], write: (api, v) => api.setSingle("z4", v) },
  { key: "z5", label: "自查5 负面舆情", kind: "select", allowed: [
    { value: "a", label: "公开检索无负面报道" },
    { value: "b", label: "有负面但与本次投资无关" },
    { value: "c", label: "有相关负面但已权威澄清/妥善处理" },
    { value: "d", label: "存在重大且未澄清的负面舆情" },
  ], write: (api, v) => api.setSingle("z5", v) },
  { key: "z6", label: "自查6 重大未决诉讼/仲裁/政府调查（近三年）", kind: "select", allowed: [
    { value: "a", label: "不存在未决诉讼/仲裁/调查" },
    { value: "b", label: "一般性诉讼、金额小、不影响经营" },
    { value: "c", label: "重大但不影响投资真实性与履约能力" },
    { value: "d", label: "重大诉讼/调查影响经营与投资真实性" },
  ], write: (api, v) => api.setSingle("z6", v) },
];

// ─── 模块二 投资方式（step 3）分支 + 共通 ────────────────────────────────────
const STEP3_COMMON: ExtractField[] = [
  { key: "g1", label: "共通1 项目团队行业经验", kind: "select", allowed: [
    { value: "a", label: "实控人/关键负责人具备相关行业经验，简历已备" },
    { value: "b", label: "简历尚未整理/部分缺失" },
    { value: "c", label: "不具备直接相关经验" },
  ], write: (api, v) => api.setSingle("g1", v) },
  { key: "g2", label: "共通2 关联交易核查", kind: "select", allowed: [
    { value: "a", label: "不涉及关联方" },
    { value: "a2", label: "涉及关联方，定价依据已说明" },
    { value: "b", label: "涉及关联方，定价依据说明待准备" },
    { value: "d", label: "涉及关联方但拟不披露" },
  ], write: (api, v) => api.setSingle("g2", v) },
  { key: "g3", label: "共通3 投资完成后控制权结构", kind: "select", allowed: [
    { value: "qz", label: "全资" }, { value: "kg", label: "控股" },
    { value: "gt", label: "共同控制" }, { value: "cg", label: "参股" },
  ], write: (api, v) => api.setSingle("g3", v) },
  { key: "g4", label: "共通4 特殊架构各层商业理由", kind: "select", allowed: [
    { value: "a", label: "各层商业理由能够说明" },
    { value: "b", label: "部分层级理由待整理" },
  ], note: "仅当采用特殊架构(SPV/多层/VIE)时适用", write: (api, v) => api.setSingle("g4", v) },
];

const STEP3_NEW: ExtractField[] = [
  { key: "n1", label: "A-1 是否已编制成本测算表", kind: "select", allowed: [
    { value: "a", label: "已编制，分周期、分科目列示" },
    { value: "b", label: "已编制，但未按周期或科目细分" },
    { value: "c", label: "尚未编制" },
  ], write: (api, v) => api.setSingle("n1", v) },
  { key: "n2", label: "A-2 主要支出科目是否有合同/意向书", kind: "select", allowed: [
    { value: "a", label: "主要科目均有对应合同或意向书" },
    { value: "b", label: "部分科目有" },
    { value: "c", label: "均无" },
  ], write: (api, v) => api.setSingle("n2", v) },
  { key: "n3", label: "A-3 成本测算总额与拟投资额是否匹配", kind: "select", allowed: [
    { value: "a", label: "基本匹配（差异可解释）" },
    { value: "c", label: "明显失配且暂无法解释" },
  ], write: (api, v) => api.setSingle("n3", v) },
];

const STEP3_MA: ExtractField[] = [
  { key: "m0a", label: "B-1 交易完成后类型", kind: "select", allowed: [
    { value: "bg", label: "并购（取得全部股权）" }, { value: "kg", label: "控股（过半数或实际控制）" },
    { value: "cg", label: "参股（不构成控制）" },
  ], write: (api, v) => api.setSingle("m0a", v) },
  { key: "m0b", label: "B-2 交易实现方式", kind: "select", allowed: [
    { value: "zr", label: "受让老股" }, { value: "zz", label: "增资认购新股" },
    { value: "hh", label: "转让+增资并用" },
  ], write: (api, v) => api.setSingle("m0b", v) },
  { key: "m1", label: "B-3 法律尽调/财务审计/估值报告齐备情况", kind: "select", allowed: [
    { value: "a", label: "三类报告齐备且机构资质完备" },
    { value: "b", label: "报告齐备，个别资质/签章待补" },
    { value: "c", label: "缺任一类报告" },
    { value: "na", label: "部分文件客观不适用（须填具体理由）" },
  ], write: (api, v) => api.setSingle("m1", v) },
  { key: "m1na_reason", label: "B-3 不适用具体理由", kind: "text", note: "仅当 B-3 选 na 时填", write: (api, v) => api.setSingle("m1na_reason", v) },
  { key: "m2", label: "B-4 估值可比区间与定价", kind: "select", allowed: [
    { value: "a", label: "有可比区间，定价落在区间内" },
    { value: "b", label: "有可比区间，定价偏离但有充分理由" },
    { value: "b2", label: "报告未含可比案例区间" },
    { value: "c", label: "定价偏离区间且无依据" },
  ], write: (api, v) => api.setSingle("m2", v) },
  { key: "m3", label: "B-5 交易协议惯常条款", kind: "select", allowed: [
    { value: "a", label: "惯常条款齐备" },
    { value: "b", label: "个别条款缺失，正在谈判补充" },
    { value: "c", label: "缺失关键内容或存在明显不利异常安排" },
  ], write: (api, v) => api.setSingle("m3", v) },
];

const STEP3_CHG: ExtractField[] = [
  { key: "c1", label: "C-1 证书载明事项变化（多选）", kind: "multi", allowed: [
    { value: "amt", label: "投资额变化" }, { value: "inv", label: "投资人变化" },
    { value: "cap", label: "投资资本构成变化" }, { value: "biz", label: "业务范围变化" },
    { value: "path", label: "投资路径变化" }, { value: "oth", label: "其他载明事项变化" },
  ], note: "无变化时省略本字段", write: (api, v) => api.setMulti("c1", v.split(",")) },
  { key: "c2", label: "C-6 变更申请办理情况", kind: "select", allowed: [
    { value: "a", label: "已在情形发生前申请并获同意" },
    { value: "b", label: "尚未申请" },
  ], write: (api, v) => api.setSingle("c2", v) },
  { key: "c3", label: "C-2 投资人变化情形（多选）", kind: "multi", allowed: [
    { value: "nd", label: "新增境内投资人" }, { value: "nf", label: "新增境外投资人" },
    { value: "rd", label: "减少既有投资人" },
  ], note: "仅当 C-1 含 inv 时填", write: (api, v) => api.setMulti("c3", v.split(",")) },
  { key: "c4", label: "C-3 投资人变化实现形式", kind: "select", allowed: [
    { value: "zg", label: "转股" }, { value: "zjz", label: "增资或减资" },
    { value: "tb", label: "转股与增资/减资同时进行" },
  ], write: (api, v) => api.setSingle("c4", v) },
  { key: "c5", label: "C-4 新增境内投资人申报主体确定", kind: "select", allowed: [
    { value: "a", label: "已由持股最大境内企业牵头联合申报" },
    { value: "b", label: "持股已测算，联合申报待落实" },
    { value: "c", label: "尚未测算持股比例" },
  ], note: "仅当 C-2 含 nd 时填", write: (api, v) => api.setSingle("c5", v) },
  { key: "c6", label: "C-5 投资额与持股比例联动核对", kind: "select", allowed: [
    { value: "a", label: "已核对并纳入变更申请" },
    { value: "b", label: "尚未核对" },
  ], write: (api, v) => api.setSingle("c6", v) },
];

// ─── 模块三 标的与负面清单（step 4）──────────────────────────────────────────
const STEP4: ExtractField[] = [
  { key: "lsA", label: "清单A 敏感行业目录（多选）", kind: "multi", allowed: [
    { value: "a1", label: "敏感行业目录（武器装备、跨境水资源开发利用等）" },
    { value: "a2", label: "新闻传媒" },
  ], note: "均不涉及则省略", write: (api, v) => api.setMulti("lsA", v.split(",")) },
  { key: "lsB", label: "清单B 74号文限制类（多选）", kind: "multi", allowed: [
    { value: "b1", label: "房地产" }, { value: "b2", label: "酒店、影城、娱乐业、体育俱乐部" },
    { value: "b3", label: "在境外设立无具体实业的股权投资基金/投资平台" },
  ], note: "均不涉及则省略", write: (api, v) => api.setMulti("lsB", v.split(",")) },
  { key: "lsC", label: "清单C 74号文禁止类（多选）", kind: "multi", allowed: [
    { value: "c1", label: "未经国家批准的军工或相关技术" },
    { value: "c2", label: "运用我国禁止出口的工艺/技术" },
    { value: "c3", label: "赌博业、色情业等" },
  ], note: "均不涉及则省略", write: (api, v) => api.setMulti("lsC", v.split(",")) },
  { key: "lsNone", label: "三套负面清单是否均不涉及", kind: "select", allowed: [
    { value: "true", label: "三套清单均不涉及" },
    { value: "false", label: "涉及（已逐项核对）" },
  ], write: (api, v) => api.setLsNone(v === "true") },
];

// ─── 模块四 安全审查（step 5）────────────────────────────────────────────────
const STEP5: ExtractField[] = [
  { key: "s1a", label: "4-1a 是否存在人员/技术跨境安排", kind: "select", allowed: [
    { value: "n", label: "不存在" }, { value: "y", label: "存在" },
  ], write: (api, v) => api.setSingle("s1a", v) },
  { key: "s1b", label: "4-1b 所涉领域（多选）", kind: "multi", allowed: [
    { value: "li1", label: "锂电池正极材料" }, { value: "li2", label: "锂矿提锂/金属锂制备" },
    { value: "re", label: "稀土提炼/永磁体" }, { value: "sc", label: "半导体/集成电路制造" },
    { value: "ai", label: "人工智能大模型/算法" }, { value: "bd", label: "北斗/卫星导航" },
    { value: "bio", label: "基因编辑/生物技术" }, { value: "uav", label: "无人机/反无人机" },
    { value: "p3d", label: "3D 打印/增材制造" }, { value: "cnc", label: "高档数控机床" },
    { value: "aero", label: "航空航天/燃气轮机" }, { value: "cf", label: "碳纤维/复合材料" },
    { value: "uhv", label: "特高压输变电" }, { value: "tcm", label: "中药饮片炮制/珍稀药材" },
  ], note: "均不涉及则省略；仅当 4-1a=y 时填", write: (api, v) => api.setMulti("s1b", v.split(",")) },
  { key: "s1c", label: "4-1c 出口技术目录核对", kind: "select", allowed: [
    { value: "ok", label: "已核对，不在禁限范围" },
    { value: "lic", label: "涉限制出口，已/正在申办许可" },
    { value: "not", label: "尚未对照目录核对" },
    { value: "nolic", label: "涉限制出口且未申办许可" },
    { value: "ban", label: "涉禁止出口（红线）" },
  ], note: "仅当 4-1a=y 时填", write: (api, v) => api.setSingle("s1c", v) },
  { key: "s2a", label: "4-2a 数据出境场景（多选）", kind: "multi", allowed: [
    { value: "b2c", label: "B2C 用户数据" }, { value: "b2b", label: "B2B 客户数据" },
    { value: "hr", label: "员工信息跨境" }, { value: "ops", label: "跨境运维" },
    { value: "rd", label: "跨境研发数据" },
  ], note: "均不涉及则省略", write: (api, v) => api.setMulti("s2a", v.split(",")) },
  { key: "s2c", label: "4-2c 数据出境合规路径", kind: "select", allowed: [
    { value: "a", label: "不涉及数据出境" },
    { value: "a2", label: "已完成数据出境安全评估等法定路径" },
    { value: "b", label: "未达申报门槛，已按标准合同备案/保护认证" },
    { value: "b2", label: "未达申报门槛，尚未作出合规路径安排" },
    { value: "c", label: "达到申报门槛尚未申报" },
  ], write: (api, v) => api.setSingle("s2c", v) },
  { key: "s3", label: "4-3 关键领域（多选）", kind: "multi", allowed: [
    { value: "ic", label: "集成电路与半导体设备" }, { value: "min", label: "关键矿产与稀土" },
    { value: "bat", label: "新能源电池与材料" }, { value: "biomed", label: "生物医药与医疗器械" },
    { value: "eq", label: "高端装备与数控机床" }, { value: "sw", label: "基础软件与工业软件" },
    { value: "aero", label: "航空航天与燃气轮机" }, { value: "net", label: "通信与网络设备" },
    { value: "pw", label: "特高压输变电与能源装备" }, { value: "mat", label: "碳纤维等关键新材料" },
  ], note: "均不属于则省略", write: (api, v) => api.setMulti("s3", v.split(",")) },
  { key: "s4", label: "4-4 外国域外管辖/证据调取", kind: "select", allowed: [
    { value: "n", label: "不存在相关情形" },
    { value: "y", label: "存在或可能存在外国机构证据调取要求" },
  ], write: (api, v) => api.setSingle("s4", v) },
];

// ─── 模块五 行业国别（step 6）────────────────────────────────────────────────
const STEP6: ExtractField[] = [
  { key: "q51", label: "行业细分", kind: "text", note: "如：半导体集成电路制造", write: (api, v) => api.setSingle("q51", v) },
  { key: "q52", label: "5-2 目的地国别情况", kind: "select", allowed: [
    { value: "one", label: "单一国别" }, { value: "multi", label: "涉及多个国别（地区）" },
  ], write: (api, v) => api.setSingle("q52", v) },
  { key: "q53", label: "5-3 对目的地外资安审制度了解程度", kind: "select", allowed: [
    { value: "a", label: "已了解并完成初步评估" },
    { value: "b", label: "初步了解" },
    { value: "c", label: "尚未了解" },
  ], write: (api, v) => api.setSingle("q53", v) },
  { key: "q54", label: "5-4 是否已取得国别风险资料", kind: "select", allowed: [
    { value: "a", label: "已取得国别风险参考资料" },
    { value: "b", label: "尚未取得" },
  ], write: (api, v) => api.setSingle("q54", v) },
];

export function getFieldsForStep(step: number, mode: Mode | null): ExtractField[] {
  if (step === 1) return STEP1;
  if (step === 2) return STEP2;
  if (step === 3) {
    const branch = mode === "new" ? STEP3_NEW : mode === "ma" ? STEP3_MA : mode === "chg" ? STEP3_CHG : [];
    return [...branch, ...STEP3_COMMON];
  }
  if (step === 4) return STEP4;
  if (step === 5) return STEP5;
  if (step === 6) return STEP6;
  return [];
}

export function buildExtractSystemPrompt(step: number, mode: Mode | null): string {
  const fields = getFieldsForStep(step, mode);
  if (fields.length === 0) return "";
  const lines = fields.map((f, i) => {
    const allowed = f.allowed && f.allowed.length
      ? "；允许值：" + f.allowed.map(a => `${a.value}(${a.label})`).join("、")
      : "";
    const kind = f.kind === "multi" ? "（多选，value 用逗号拼接 code）" : f.kind === "text" ? "（文本）" : "";
    const note = f.note ? `；口径：${f.note}` : "";
    return `${i + 1}. ${f.key}（${f.label}）${kind}${allowed}${note}`;
  });
  return "字段清单（value 必须是允许值之一；不确定的字段整字段省略）：\n" + lines.join("\n");
}

// 把候选 value 规整：multi 拆分校验、select 校验、丢弃非法。
export function parseExtractResponse(content: string, fields: ExtractField[]): ParsedCandidate[] {
  let obj: Record<string, { value: unknown; confidence: number; evidence: string }>;
  try { obj = JSON.parse(content); } catch { return []; }
  const out: ParsedCandidate[] = [];
  for (const f of fields) {
    const v = obj[f.key];
    if (!v || v.value == null || v.value === "") continue;
    const conf = typeof v.confidence === "number" ? v.confidence : 0.5;
    const evidence = String(v.evidence ?? "");
    if (f.kind === "multi") {
      const codes = String(v.value).split(/[，,、\s]+/).map(s => s.trim()).filter(Boolean);
      const valid = f.allowed ? codes.filter(c => f.allowed!.some(a => a.value === c)) : codes;
      if (valid.length === 0) continue;
      out.push({ field: f, value: valid.join(","), confidence: conf, evidence, lowConf: conf < 0.8 });
    } else {
      const value = String(v.value);
      if (f.kind === "select" && f.allowed && !f.allowed.some(a => a.value === value)) continue;
      out.push({ field: f, value, confidence: conf, evidence, lowConf: conf < 0.8 });
    }
  }
  return out;
}
