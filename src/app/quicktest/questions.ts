// 速测版题库 —— 从「20260813-ODI合规自查工具-简化版(匿名快闪版)-v1.html」逐题抽象。
// 题号(z1/lsA/s1a…)与完整版 compliance 一致,以便「升级完整版」时按题号灌入。
// 本文件只定义题目 UI 数据 + 显隐条件;判档逻辑见 grade.ts。
// 复用 compliance 的 UI 原语(fields.tsx)与 country.ts(国别/风险国别口径一致)。

import { isRiskCtry } from "../compliance/logic/country";

// ─── 类型 ──────────────────────────────────────────────────────────────────
export type QType = "single" | "multi" | "text" | "select" | "mode" | "info";
export type Answers = Record<string, string>; // multi 题存逗号拼接,如 "spv,vie";mode 存 answers["mode"]

export interface Opt { v: string; label: string; }

export interface Question {
  id: string;
  module: number;       // 0=企业画像 1=主体资格 2=投资方式 3=标的 4=安全审查 5=行业国别
  stem: string;         // 题干 / 字段标签
  type: QType;
  opts?: Opt[];
  law?: string;
  hint?: string;
  placeholder?: string;
  noneOpt?: string;     // multi 互斥项(勾选清空其他)
  show?: (a: Answers) => boolean;
}

export interface ModuleDef { n: number; title: string; lead?: string; }

// ─── 选项常量 ──────────────────────────────────────────────────────────────
export const MODE_OPTS: Opt[] = [
  { v: "new", label: "新设类" },
  { v: "ma", label: "并购类" },
  { v: "chg", label: "变更类" },
];

export const IND_OPTS: Opt[] = [
  { v: "A", label: "A　农、林、牧、渔业" }, { v: "B", label: "B　采矿业" }, { v: "C", label: "C　制造业" },
  { v: "D", label: "D　电力、热力、燃气及水生产和供应业" }, { v: "E", label: "E　建筑业" }, { v: "F", label: "F　批发和零售业" },
  { v: "G", label: "G　交通运输、仓储和邮政业" }, { v: "H", label: "H　住宿和餐饮业" }, { v: "I", label: "I　信息传输、软件和信息技术服务业" },
  { v: "J", label: "J　金融业" }, { v: "K", label: "K　房地产业" }, { v: "L", label: "L　租赁和商务服务业" },
  { v: "M", label: "M　科学研究和技术服务业" }, { v: "N", label: "N　水利、环境和公共设施管理业" }, { v: "O", label: "O　居民服务、修理和其他服务业" },
  { v: "P", label: "P　教育" }, { v: "Q", label: "Q　卫生和社会工作" }, { v: "R", label: "R　文化、体育和娱乐业" },
  { v: "S", label: "S　公共管理、社会保障和社会组织" }, { v: "T", label: "T　国际组织" },
];

const OWN_OPTS: Opt[] = [
  { v: "国有独资", label: "国有独资" }, { v: "国有控股", label: "国有控股" }, { v: "民营", label: "民营" },
  { v: "外商投资", label: "外商投资" }, { v: "混合所有制", label: "混合所有制" },
];

const ORG_OPTS: Opt[] = [
  { v: "上海市商务委员会", label: "上海市商务委员会" },
  { v: "中国(上海)自由贸易试验区", label: "中国(上海)自由贸易试验区" },
  { v: "其他省(自治区、直辖市)商务主管部门", label: "其他省(自治区、直辖市)商务主管部门" },
  { v: "计划单列市商务主管部门", label: "计划单列市商务主管部门(大连、宁波、厦门、青岛等)" },
  { v: "集团下属企业", label: "集团下属企业(经集团公司归口申报)" },
];

const PATH_OPTS: Opt[] = [
  { v: "direct", label: "直接投资至目的地" },
  { v: "via", label: "经第三地(含港澳台)中转投资" },
];

const ARCH_OPTS: Opt[] = [
  { v: "spv", label: "离岸 SPV" }, { v: "hk", label: "香港 SPV" }, { v: "eu", label: "欧洲控股" },
  { v: "vie", label: "VIE(协议控制)" }, { v: "multi", label: "多层嵌套" }, { v: "none", label: "无" },
];

// ─── 模块定义 ──────────────────────────────────────────────────────────────
export const MODULES: ModuleDef[] = [
  { n: 0, title: "模块〇　企业画像", lead: "本模块采集基础信息,用于匹配后续自查分支与提示内容,不参与评价。" },
  { n: 1, title: "模块一　主体资格自查", lead: "本模块六项对应主管机关审查的六项主体资格子标准,其中第 1、3、4 项在审查环节属\"不予受理\"前置门槛,务请重点对照。每题下方为\"应准备文件\"上传区(上传自愿·不作申报条件·可脱敏·上传即得分)。" },
  { n: 2, title: "模块二　投资方式与投资行为自查", lead: "已按模块〇选定的投资方式进入对应分支,共通项全部填写。" },
  { n: 3, title: "模块三　境外标的与项目信息自查", lead: null as any },
  { n: 4, title: "模块四　安全审查与敏感要素自查(前置环节)", lead: "安全审查是受理后的前置环节:主管机关受理申请后先进行安全审查,疑虑未消除的不予批准、不进入后续实质审查。本模块为事实采集与预警,不能替代主管机关安全审查。商务部备案系统在审批端同样设置四道敏感问答(一国以上利益/三项清单/石墨物项/稀土物项),本模块问答口径与商务部系统一致。" },
  { n: 5, title: "模块五　行业与国别(信息采集)", lead: "本模块采集行业与国别事实信息并即时输出提示,不判档、不计文件分。审批环节将按行业与国别要求提供更充分的资料论述,请提前准备。" },
];

// ─── 题库 ──────────────────────────────────────────────────────────────────
export const QUESTIONS: Question[] = [

  // ── 模块〇 企业画像(信息采集,不判档)──
  { id: "p_name", module: 0, stem: "企业名称/信用代码", type: "text", placeholder: "(选填)" },
  { id: "p_own", module: 0, stem: "所有制类型", type: "select", opts: OWN_OPTS, hint: "国有企业另触发国资监管提示(中央企业适用国资委 35 号令)" },
  { id: "p_org", module: 0, stem: "申报归口", type: "select", opts: ORG_OPTS, hint: "按商务部系统口径:自贸试验区与市商务委并列为独立主管机关;集团下属企业须挂接集团公司归口申报" },
  { id: "p_ind1", module: 0, stem: "本企业主营行业", type: "select", opts: IND_OPTS, hint: "GB/T 4754—2017" },
  { id: "p_ind2", module: 0, stem: "拟投资行业类别", type: "select", opts: IND_OPTS, hint: "联动模块五行业要点采集与提示;审批环节将按行业展开审查(选择示例:境外设厂选 C 制造业;海外仓选 G 交通运输、仓储和邮政业;咨询服务选 L 租赁和商务服务业)" },
  { id: "p_ctry", module: 0, stem: "最终目的地(拟投资国别/地区)", type: "select", opts: [], hint: "选定后弹出该国《对外投资提示事项》须确认已读;选定 22 个需核准国别(不丹、朝鲜、南苏丹等,填表说明第 15 条)将自动触发从严预警与模块三 3.3" }, // opts 运行时从 COUNTRY_OPTIONS 填
  { id: "p_amt", module: 0, stem: "拟投资总额与币种", type: "text", placeholder: "如:5,000 万美元(金额一律折美元填报)" },
  { id: "p_path", module: 0, stem: "投资路径", type: "select", opts: PATH_OPTS, hint: "目的地选港澳台即为投向港澳台;目的地为港澳台或经港澳台中转的,均参照适用(837 号令第三十二条)" },
  { id: "p_arch", module: 0, stem: "是否采用特殊架构", type: "multi", opts: ARCH_OPTS, noneOpt: "none", hint: "勾选 VIE 会触发模块三 3.1-③(37 号文)题目" },
  { id: "mode", module: 0, stem: "投资方式(决定模块二分支)", type: "mode", opts: MODE_OPTS },

  // ── 模块一 主体资格(z1-z6,single a/b/c/d,判档=值大写)──
  { id: "z1", module: 1, stem: "自查 1　股权架构及实际控制人(前置门槛)", type: "single", law: "837 号令第二条;《境外投资管理办法》(商务部令 2014 年第 3 号)第九条、第十条;《企业境外投资管理办法》(发改委令第 11 号)。", opts: [
    { v: "a", label: "能绘制上穿至最终实际控制人的完整股权架构图,各层持股均有登记文件证明,最终实际权益比例已计算,且不存在无商业实质安排" },
    { v: "b", label: "能绘制完整架构图,但部分层级登记文件未齐" },
    { v: "c", label: "存在多层嵌套,但能说明商业合理性(真实历史沿革、合规税务筹划等)" },
    { v: "d", label: "存在纯离岸空转、拆分小额出境后境外汇聚等无商业实质安排,或无法追溯至最终实际控制人" },
  ]},
  { id: "z2", module: 1, stem: "自查 2　主营业务合规性及与标的关联性", type: "single", law: "《产业结构调整指导目录(2024 年本)》;关联性作为风险因素由审查环节综合判断。", opts: [
    { v: "a", label: "主业不属限制类/淘汰类或\"两高\"行业,且与标的业务相同、相似或存在上下游关系" },
    { v: "b", label: "主业不属上述类别,但与标的业务关联不明显(需补充商业合理性说明)" },
    { v: "c", label: "主业属限制类或\"两高\"行业,但已完成合规改造并可证明" },
    { v: "d", label: "主业属淘汰类,或属限制类/\"两高\"且未完成合规改造" },
  ]},
  { id: "z3", module: 1, stem: "自查 3　企业规模与资金实力(前置门槛)", type: "single", law: "《境外投资管理办法》(商务部令 2014 年第 3 号)第十九条;真实性审查要求(837 号令)。", opts: [
    { v: "a", label: "实缴注册资本与最近一期所有者权益均能覆盖拟投资金额,且全部为自有资金" },
    { v: "b", label: "能够覆盖,含贷款、第三方资金等非自有资金,但合法来源能够说明" },
    { v: "c", label: "接近但未完全覆盖,需补充其他合法资金来源证明" },
    { v: "d", label: "明显不足,且无其他合法来源证明" },
  ]},
  { id: "z4", module: 1, stem: "自查 4　违法违规记录(前置门槛)", type: "single", law: "《对外投资备案(核准)报告暂行办法》(商合发〔2018〕24 号)及联合惩戒机制;837 号令第十条。", opts: [
    { v: "a", label: "本企业及法定代表人、实际控制人近五年无刑事/重大行政处罚,未列入失信或联合惩戒名单,不处于资格罚限制期" },
    { v: "b", label: "曾有一般性行政处罚,但与境外投资无直接关联,可提供说明" },
    { v: "c", label: "曾有与境外投资相关的行政处罚,但影响已消除、有整改证明" },
    { v: "d", label: "存在刑事处罚记录,或在失信/联合惩戒名单,或处于资格罚限制期" },
  ]},
  { id: "z5", module: 1, stem: "自查 5　负面舆情", type: "single", law: "主管机关操作口径:企业自我声明 + 法律调查报告佐证。", opts: [
    { v: "a", label: "以企业名称及实际控制人姓名检索公开渠道,不存在负面报道" },
    { v: "b", label: "存在负面报道,但与本次投资无关,可提供说明" },
    { v: "c", label: "存在与经营相关的负面舆情,但已有权威澄清或妥善处理" },
    { v: "d", label: "存在重大且未澄清的负面舆情" },
  ]},
  { id: "z6", module: 1, stem: "自查 6　重大未决诉讼仲裁及政府调查(含涉外,近三年)", type: "single", law: "837 号令第二十二条;《反外国不当域外管辖条例》(国务院令第 835 号)。", opts: [
    { v: "a", label: "不存在未决诉讼、仲裁或正在接受的政府部门调查(含境外)" },
    { v: "b", label: "存在一般性诉讼仲裁,金额小,不影响正常经营" },
    { v: "c", label: "存在重大诉讼仲裁,但经评估不影响投资真实性与履约能力,可提供分析说明" },
    { v: "d", label: "存在可能影响正常经营及投资真实性认定的重大诉讼/调查" },
  ]},

  // ── 模块二 投资方式(分支 + 共通)──
  // 分支A 新设类
  { id: "n1", module: 2, stem: "A-1　是否已编制成本测算表(以 1-3 年为一个用款周期、分科目列示)?", type: "single", show: a => a["mode"] === "new", law: "《企业境外投资管理办法》(发改委令第 11 号)第十六条;《境外投资管理办法》(商务部令 2014 年第 3 号)第六条、第七条;837 号令第十二条。", opts: [
    { v: "a", label: "已编制,且分周期、分科目列示" }, { v: "b", label: "已编制,但未按周期或科目细分" }, { v: "c", label: "尚未编制" },
  ]},
  { id: "n2", module: 2, stem: "A-2　主要支出科目是否有对应的合同或合作意向书?", type: "single", show: a => a["mode"] === "new", law: "审查口径:多数预算科目应有对应的合同或合作意向书作为证明文件。", opts: [
    { v: "a", label: "主要科目均有对应合同或意向书" }, { v: "b", label: "部分科目有" }, { v: "c", label: "均无" },
  ]},
  { id: "n3", module: 2, stem: "A-3　成本测算总额与拟投资金额是否匹配?", type: "single", show: a => a["mode"] === "new", law: "投资额与项目所需支出的匹配性是新设类审查核心;明显失配将影响投资真实性、必要性认定。", opts: [
    { v: "a", label: "基本匹配(差异可解释)" }, { v: "c", label: "明显失配且暂无法解释" },
  ]},
  // 分支B 并购类
  { id: "m0a", module: 2, stem: "B-1　本次交易完成后属于哪种类型?(信息采集项)", type: "single", show: a => a["mode"] === "ma", law: "类型划分以交易完成后持股比例与控制状态为准。", opts: [
    { v: "bg", label: "并购——取得标的公司全部股权" }, { v: "kg", label: "控股——取得过半数股权或实际控制权" }, { v: "cg", label: "参股——取得部分股权且不构成控制" },
  ]},
  { id: "m0b", module: 2, stem: "B-2　本次交易通过何种方式实现?(信息采集项)", type: "single", show: a => a["mode"] === "ma", law: "老股转让核心文件为 SPA;增资入股核心文件为增资认购协议与增资决议。", opts: [
    { v: "zr", label: "受让既有股东股份(老股转让)" }, { v: "zz", label: "增资认购新发行股份(增资入股)" }, { v: "hh", label: "转让与增资同时进行" },
  ]},
  { id: "m1", module: 2, stem: "B-3　是否已取得法律尽职调查报告、财务审计报告、第三方资产评估/估值报告(出具机构有执业资质并加盖正式签章)?", type: "single", show: a => a["mode"] === "ma", law: "《境外投资管理办法》(商务部令 2014 年第 3 号)第十四条、第十五条。第三方专业报告须附执业资质证明并加盖正式签章,否则判档不得高于 C。", opts: [
    { v: "a", label: "三类报告齐备且机构资质完备" }, { v: "b", label: "报告齐备,个别资质证明或签章待补" }, { v: "c", label: "缺任一类报告" }, { v: "na", label: "部分文件客观不适用(须填理由),其余报告齐备" },
  ]},
  { id: "m1na_reason", module: 2, stem: "客观不适用声明:具体理由", type: "text", show: a => a["mode"] === "ma" && a["m1"] === "na", placeholder: "如:标的公司为新设立企业,无历史财务数据,客观上无法出具财务审计报告" },
  // 分支C 变更类
  { id: "c1", module: 2, stem: "C-1　对照证书载明事项,本项目发生了哪些变化?", type: "multi", show: a => a["mode"] === "chg", noneOpt: "0", law: "《企业境外投资管理办法》(发改委令第 11 号)第三十四条;《境外投资管理办法》(商务部令 2014 年第 3 号)第十五条。", opts: [
    { v: "amt", label: "投资额变化" }, { v: "inv", label: "投资人变化" }, { v: "cap", label: "投资资本构成变化" },
    { v: "biz", label: "业务范围变化" }, { v: "path", label: "投资路径变化" }, { v: "oth", label: "其他证书载明事项变化" }, { v: "0", label: "以上均未发生" },
  ]},
  { id: "c2", module: 2, stem: "C-2　如发生上述变化,是否已在情形发生前向原核准/备案机关申请变更?", type: "single", show: a => a["mode"] === "chg" && hasNonZero(a, "c1"), opts: [
    { v: "a", label: "已在情形发生前申请并获同意" }, { v: "c", label: "未在情形发生前申请或未获同意" },
  ]},
  // 共通项
  { id: "g2", module: 2, stem: "共通 2　关联交易:交易对手或中间层安排是否涉及关联方?", type: "single", law: "真实性审查与如实报告义务(837 号令);关联交易定价公允性属审查要素。", opts: [
    { v: "a", label: "不涉及关联方" }, { v: "a2", label: "涉及,定价依据已说明" }, { v: "b", label: "涉及,定价依据说明尚未准备" }, { v: "d", label: "涉及,但拟不作披露" },
  ]},
  { id: "g3", module: 2, stem: "共通 3　投资完成后本企业对境外标的的控制权安排?(信息采集项,不判档)", type: "single", opts: [
    { v: "qz", label: "全资" }, { v: "kg", label: "控股" }, { v: "gt", label: "共同控制" }, { v: "cg", label: "参股" },
  ]},

  // ── 模块三 标的 ──
  { id: "t3", module: 3, stem: "3.1-③(涉 VIE 或返程投资适用)境内创始人/股东是否已办理 37 号文外汇登记?", type: "single", show: a => hasArch(a, "vie"), law: "《国家外汇管理局关于境内居民通过特殊目的公司境外投融资及返程投资外汇管理有关问题的通知》(汇发〔2014〕37 号)。", opts: [
    { v: "a", label: "已办理登记" }, { v: "c", label: "尚未登记" },
  ]},
  { id: "lsA", module: 3, stem: "清单 A　敏感行业目录(2018):本项目是否涉及?(涉及后果:不分金额一律核准)", type: "multi", opts: [
    { v: "1", label: "武器装备的研制生产维修" }, { v: "2", label: "跨境水资源开发利用" }, { v: "3", label: "新闻传媒" },
  ]},
  { id: "lsB", module: 3, stem: "清单 B　74 号文限制类:本项目是否涉及?(涉及后果:须经核准)", type: "multi", opts: [
    { v: "1", label: "与未建交、战乱、受国际条约限制的敏感国家(地区)的投资" }, { v: "2", label: "房地产" }, { v: "3", label: "酒店" },
    { v: "4", label: "影城" }, { v: "5", label: "娱乐业" }, { v: "6", label: "体育俱乐部" }, { v: "7", label: "在境外设立无具体实业项目的股权投资基金或投资平台" },
  ]},
  { id: "lsC", module: 3, stem: "清单 C　74 号文禁止类:本项目是否涉及?(涉及后果:不予批准/备案,自查判 D)", type: "multi", opts: [
    { v: "1", label: "未经国家批准的军事工业核心技术和产品输出" }, { v: "2", label: "运用国家禁止出口的技术工艺产品" },
    { v: "3", label: "赌博业、色情业" }, { v: "4", label: "国际条约禁止的投资" }, { v: "5", label: "其他危害国家利益和安全的投资" },
  ]},
  { id: "lsNone", module: 3, stem: "经逐项核对,三套清单均不涉及", type: "single", opts: [{ v: "1", label: "确认:三套清单均不涉及" }] },
  { id: "t4", module: 3, stem: "3.3-①　该国别属需核准国别,上述风险防控能力证明材料是否已备妥?", type: "single", show: a => isRiskCtry(a["p_ctry"]), law: "该国别属从严核准范围。企业可提供境外风险识别与防控能力证明材料(风险评估报告、应急预案、当地合规资源安排等)供审查判断;是否核准由主管机关按从严原则裁量。官方口径参考:商务部系统填表说明列明\"需要核准的国别/地区\"共 22 个(不丹、斯威士兰、梵蒂冈、帕劳、马绍尔群岛、图瓦卢、海地、危地马拉、巴拉圭、伯利兹、圣基茨和尼维斯、圣卢西亚、圣文森特和格林纳丁斯、也门、朝鲜、利比亚、苏丹、索马里、刚果(金)、伊拉克、中非共和国、南苏丹;名单以商务部系统最新公布为准)。", opts: [
    { v: "b", label: "已备妥(风险评估报告+应急预案+当地合规资源安排)" }, { v: "c", label: "尚未备妥" },
  ]},

  // ── 模块四 安全审查 ──
  { id: "s1a", module: 4, stem: "4-1a　本次投资或后续运营中,是否存在人员/技术跨境安排(跨境派遣技术人员、组织人员赴境外工作、跨境提供技术指导、安排人员跨境培训,或向境外提供技术图纸、工艺流程、软件源代码、数据集等)?", type: "single", law: "837 号令第十三条;第十五条(境外投资安全审查制度);《出口管制法》《两用物项出口管制条例》;《中国禁止出口限制出口技术目录》。", opts: [
    { v: "n", label: "均无" }, { v: "y", label: "有上述一项或多项安排" },
  ]},
  { id: "s1c", module: 4, stem: "4-1c　是否已对照目录及\"三项清单\"(两用物项管制清单、禁止限制出口技术目录、核出口管制清单)完成核对?", type: "single", show: a => a["s1a"] === "y", opts: [
    { v: "ok", label: "已核对,所涉内容不在禁止/限制范围" }, { v: "lic", label: "涉限制出口内容,已取得或正在申办许可" },
    { v: "nolic", label: "涉限制出口内容,尚未申办许可" }, { v: "ban", label: "涉禁止出口内容" }, { v: "not", label: "尚未核对" },
  ]},
  { id: "s2a", module: 4, stem: "4-2a　境外业务涉及的数据场景(可多选):", type: "multi", noneOpt: "0", opts: [
    { v: "b2c", label: "B2C 终端用户数据" }, { v: "b2b", label: "B2B 客户数据" }, { v: "hr", label: "跨境员工管理" },
    { v: "ops", label: "跨境运维(境外远程访问境内系统)" }, { v: "rd", label: "跨境研发数据共享" }, { v: "0", label: "均不涉及" },
  ]},
  { id: "s2c", module: 4, stem: "4-2c　合规路径落实状态:", type: "single", law: "《数据出境安全评估办法》;《促进和规范数据跨境流动规定》(2024 年 3 月);《个人信息出境标准合同办法》。个人信息达到 100 万人须申报数据出境安全评估。", opts: [
    { v: "a", label: "不涉及数据出境" }, { v: "a2", label: "已完成数据出境安全评估等法定路径" },
    { v: "b", label: "未达申报门槛,已按标准合同备案或保护认证路径作出合规安排" }, { v: "b2", label: "未达申报门槛,尚未作出合规路径安排" }, { v: "c", label: "达到申报门槛,尚未申报" },
  ]},
  { id: "s3", module: 4, stem: "4-3　产业链供应链安全(834 号令):标的或项目所在领域(可多选,信息采集项)", type: "multi", noneOpt: "0", law: "《国务院关于产业链供应链安全的规定》(国务院令第 834 号)。", opts: [
    { v: "ic", label: "集成电路与半导体设备" }, { v: "min", label: "关键矿产与稀土" }, { v: "bat", label: "新能源电池与材料" },
    { v: "biomed", label: "生物医药与医疗器械" }, { v: "eq", label: "高端装备与数控机床" }, { v: "sw", label: "基础软件与工业软件" },
    { v: "aero", label: "航空航天与燃气轮机" }, { v: "net", label: "通信与网络设备" }, { v: "pw", label: "特高压输变电与能源装备" },
    { v: "mat", label: "碳纤维等关键新材料" }, { v: "0", label: "均不属于" },
  ]},

  // ── 模块五 行业国别(信息采集,不判档)──
  { id: "q52", module: 5, stem: "5-2　目的地国别情况:", type: "single", opts: [
    { v: "one", label: "单一国别(即模块〇所选)" }, { v: "multi", label: "涉及多个国别(地区)" },
  ]},
  { id: "q53", module: 5, stem: "5-3　对目的地外资安全审查/准入制度的了解程度:", type: "single", law: "主要法域外资安全审查参考:美国 CFIUS、欧盟 FSR、德国 AWV、新加坡 SIRA(2024 年起)。", opts: [
    { v: "a", label: "已了解并完成初步评估" }, { v: "b", label: "初步了解" }, { v: "c", label: "尚未了解" },
  ]},
];

// ─── helpers(grade.ts 与向导共用)──────────────────────────────────────────
export function val(a: Answers, id: string): string { return a[id] ?? ""; }
export function checkedVals(a: Answers, id: string): string[] { const v = a[id] ?? ""; return v ? v.split(",").filter(Boolean) : []; }
export function hasArch(a: Answers, code: string): boolean { return checkedVals(a, "p_arch").includes(code); }
export function hasNonZero(a: Answers, id: string): boolean { const vs = checkedVals(a, id); return vs.length > 0 && vs.every(x => x !== "0"); }
