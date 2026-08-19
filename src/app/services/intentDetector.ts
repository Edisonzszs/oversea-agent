const ODI_WEAK_KEYWORDS = [
  'ODI',
  'odi',
  '备案',
  '境外投资',
  '走出去',
  '出海投资',
  '海外投资',
  '对外投资',
  '境外直接投资',
  '投资备案',
]

const ODI_STRONG_KEYWORDS = [
  '帮我办',
  '帮我准备',
  '材料准备',
  '备案申请',
  '我要办',
  '我要备案',
  '我想办理',
  '进入助办',
  '进入导办',
  '开始办',
  '帮我填',
  '辅助填报',
]

export function detectOdiIntent(userMessage: string): boolean {
  const lower = userMessage.toLowerCase()
  return [...ODI_WEAK_KEYWORDS, ...ODI_STRONG_KEYWORDS].some((kw) => lower.includes(kw.toLowerCase()))
}

export function detectOdiStrongIntent(userMessage: string): boolean {
  const lower = userMessage.toLowerCase()
  return ODI_STRONG_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))
}

/**
 * 材料类意图：仅当用户明确询问"材料/清单"时为 true。
 * 用于决定是否展示"ODI 备案材料清单"卡片。
 * 一般性政策/流程咨询（如"敏感行业怎么办""去越南设厂需要哪些手续"）不命中，正常问答即可。
 */
const MATERIAL_INTENT_KEYWORDS = ['材料', '清单', '准备哪些', '准备什么']
export function detectMaterialIntent(userMessage: string): boolean {
  const lower = userMessage.toLowerCase()
  return MATERIAL_INTENT_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))
}

/**
 * 自然语言切换申报助办 —— V2.2 §7
 * 仅在 guide（填报演示）模式下由上层调用，命中后弹"申报助办"切换卡。
 * 命中条件（满足任一）：
 *  1) 显式切换 / 直接材料上传意图短语；
 *  2) 前置必传材料名（可行性报告、投资环境报告、营业执照、投资决策文件、
 *     资金来源证明、前期工作报告等）+ 持有/上传信号共现。
 * 注意：纯咨询句（如"可行性报告怎么填""资金来源证明是什么"）因不含持有/上传
 * 信号，不会误触发，会正常走 AI 问答。
 */
const SWITCH_TO_ASSIST_KEYWORDS = [
  '我要正式申报', '进入申报助办', '开始办理正式材料', '切换到申报助办',
  '进行正式申报', '开始正式申报', '正式办理', '用申报助办',
  '给我申报助办', '不用填报演示了', '换到申报助办',
  '我有材料', '材料准备好了', '准备好材料', '准备好正式材料',
  '上传材料', '上传资料', '上传文件', '正式材料', '真实材料',
]

// 前置必传材料（共性区）+ 常见 ODI 申报材料名称
const PRE_UPLOAD_MATERIALS = [
  '可行性报告', '可行性研究报告', '投资环境报告', '投资环境分析',
  '营业执照', '注册登记证明', '登记证明',
  '投资决策文件', '投资决议', '决议文件', '董事会决议',
  '资金来源证明', '资金来源',
  '前期工作报告', '前期报告', '前期工作情况报告',
  '真实合规证明', '合规证明',
  '法人身份证', '法人代表身份证', '经办人身份证', '经办人',
  '项目申请报告', '申请报告', '并购报告', '尽调报告',
]

// 持有 / 上传 / 提供信号（与材料名共现才判定为切换意图）
const MATERIAL_POSSESSION_SIGNALS = [
  '我有', '已经有了', '已经有', '准备了', '准备好', '准备好了',
  '手上有', '手头有', '现成', '做好了', '做完了', '拿到了', '有了一份',
  '上传', '想上传', '要上传', '需要上传', '可以上传', '帮我上传', '上传一下',
  '提交', '想提交', '要提交', '需要提交',
  '提供', '可以提供', '我提供',
]

export function detectSwitchToAssist(userMessage: string): boolean {
  const lower = userMessage.toLowerCase()
  if (SWITCH_TO_ASSIST_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) return true
  const hasMaterial = PRE_UPLOAD_MATERIALS.some((m) => lower.includes(m.toLowerCase()))
  const hasSignal = MATERIAL_POSSESSION_SIGNALS.some((s) => lower.includes(s.toLowerCase()))
  return hasMaterial && hasSignal
}

export function extractOdiIntentFromAiResponse(aiContent: string): boolean {
  return aiContent.includes('[ODI_INTENT_DETECTED]')
}

/* ════════════════════════════════════════════════════════════════════════
 * 国别税策意图检测（TaxIQ 路由）
 * 对应 国别智能体/systemprompt.md「步骤 1K」转交/禁止转交规则，
 * 与 TaxIQ 问题范围清单.docx 的"路由智能体建议提示词"同源。
 * 命中 → useStreamingChat 分流到 taxiqApi（国别智能体）回答。
 * ════════════════════════════════════════════════════════════════════════ */

/** 115 国 + 区域/对比词（实体命中用）。来源：systemprompt 1K 115 国清单。 */
export const COUNTRY_115: string[] = [
  // 亚洲
  '阿富汗', '巴基斯坦', '不丹', '朝鲜', '东帝汶', '菲律宾', '韩国', '柬埔寨', '老挝',
  '马尔代夫', '马来西亚', '蒙古国', '蒙古', '孟加拉国', '缅甸', '尼泊尔', '日本', '斯里兰卡',
  '泰国', '土耳其', '文莱', '新加坡', '伊朗', '印度尼西亚', '印尼', '印度', '越南',
  '中国澳门', '澳门', '中国台湾', '台湾', '中国香港', '香港',
  // 西亚非洲
  '阿尔及利亚', '阿联酋', '阿曼', '埃及', '埃塞俄比亚', '安哥拉', '巴勒斯坦', '巴林',
  '刚果', '加纳', '卡塔尔', '科威特', '肯尼亚', '黎巴嫩', '毛里求斯', '摩洛哥', '南非',
  '尼日利亚', '沙特阿拉伯', '沙特', '苏丹', '坦桑尼亚', '叙利亚', '也门', '伊拉克',
  '以色列', '约旦', '赞比亚', '乌干达', '纳米比亚', '津巴布韦',
  // 美洲大洋洲
  '阿根廷', '澳大利亚', '澳洲', '巴拿马', '秘鲁', '巴西', '加拿大', '美国', '墨西哥',
  '委内瑞拉', '新西兰', '牙买加', '开曼群岛', '智利', '哥伦比亚',
  // 欧洲
  '阿尔巴尼亚', '爱沙尼亚', '奥地利', '保加利亚', '北马其顿', '马其顿', '波黑', '波兰',
  '德国', '法国', '荷兰', '黑山', '捷克', '克罗地亚', '拉脱维亚', '立陶宛', '卢森堡',
  '罗马尼亚', '挪威', '瑞典', '瑞士', '塞尔维亚', '斯洛伐克', '斯洛文尼亚', '匈牙利',
  '意大利', '英国', '西班牙', '丹麦', '葡萄牙',
  // 欧亚
  '阿塞拜疆', '白俄罗斯', '俄罗斯', '格鲁吉亚', '哈萨克斯坦', '吉尔吉斯', '摩尔多瓦',
  '塔吉克斯坦', '土库曼斯坦', '乌克兰', '乌兹别克斯坦', '亚美尼亚',
]

/** 区域名 + 横向对比词（也算实体命中） */
const TAXIQ_REGION_OR_COMPARISON = [
  '东盟', '欧洲', '亚洲', '非洲', '美洲', '大洋洲', '欧亚', '欧盟',
  '全球', '哪些国家', '所有国家', '各国', '多国', '排名', '遍历', '对比',
]

/** 主题命中（任一即算）。来源：1K 主题领域 + 税种清单。 */
export const TAXIQ_TOPIC_KEYWORDS: string[] = [
  '宏观经济', 'GDP', '通胀', '通货膨胀', 'CPI', '贸易', '外汇', '汇率', '外汇管制',
  '外资准入', '负面清单', '公司注册', '注册公司', '设立公司', '企业所得税', '个人所得税',
  '增值税', '消费税', '流转税', '预提所得税', '预提税', '关税', '进口税', '资本利得税',
  '遗产税', '赠与税', '财富税', '税收优惠', '免税', '减税', '转让定价', '税收协定',
  '税务登记', '纳税申报', '报税', '反避税', '税收风险', '税制', '税率', '税种', '征税', '缴税', '税收',
]

/** 禁止转交：命中任一即不路由到 TaxIQ（改走本地问答）。 */
const TAXIQ_EXCLUDE_KEYWORDS = [
  '中国大陆', '中国国内', '国内税收', '国内GDP', '国内政策', '境内税收', '中国境内',
]

/**
 * 国别税策意图判定（1K 转交规则）。
 * 转交条件：实体命中(国别/区域/对比词) ∧ 主题命中(税收/宏观/外资等) ∧ 未命中禁止转交。
 * 注意：生产侧精确判定由提示词 1K 承担；此处为原型的客户端快速分流，规则同源。
 */
export function detectTaxiqIntent(userMessage: string): boolean {
  const lower = userMessage.toLowerCase()

  // 禁止转交优先
  if (TAXIQ_EXCLUDE_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) return false

  // 实体命中
  const entityHit =
    COUNTRY_115.some((c) => lower.includes(c.toLowerCase())) ||
    TAXIQ_REGION_OR_COMPARISON.some((c) => lower.includes(c.toLowerCase()))
  if (!entityHit) return false

  // 主题命中
  const topicHit = TAXIQ_TOPIC_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))
  return topicHit
}

/** 平台本地政策/办事类关键词（与税种区分；复合问题 = 税策 + 本地政策/办事） */
export const LOCAL_POLICY_KEYWORDS: string[] = [
  'ODI', 'odi', '备案', '核准', '申报', '材料', '清单', '补贴', '扶持', '资金补助',
  '办事', '流程', '手续', '商务委', '发改委', '外汇登记', '办事指南', '导办', '助办',
  '走出去', '境外直接投资', '申报表', '承诺书', '扶持政策', '专项资金', '平台', '政策',
]

/**
 * 复合国别税策意图：既命中税策(detectTaxiqIntent)，又含平台本地政策/办事部分。
 * 命中 → 并行调用 TaxIQ(国别税策) + 本地问答(政策/办事)，整合输出（多智能体协同）。
 */
export function detectCompoundTaxiqIntent(userMessage: string): boolean {
  if (!detectTaxiqIntent(userMessage)) return false
  const lower = userMessage.toLowerCase()
  return LOCAL_POLICY_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))
}

/* ════════════════════════════════════════════════════════════════════════
 * 单材料模板按需下发：用户只要某一个具体模板（"投资备案申请表给我，怎么用"）
 * → 正常回答 + 底部该文件卡片。区别于"有哪些材料"（全部清单）。
 * ════════════════════════════════════════════════════════════════════════ */

export interface SingleMaterialHit { id: string; label: string }

/** 5 类高频材料的关键词映射（id 与前端 MATERIAL_FILES 对应） */
const MATERIAL_NAME_MAP: { id: string; label: string; names: string[] }[] = [
  { id: 'form', label: '境外投资备案申请表', names: ['备案申请表', '投资备案申请表', '境外投资备案申请表'] },
  { id: 'commitment', label: '境外投资真实性承诺书', names: ['真实性承诺书', '承诺书'] },
  { id: 'equity', label: '股权架构图', names: ['股权架构图', '股权结构图'] },
  { id: 'merger', label: '境外并购事项前期报告表', names: ['并购事项前期报告表', '并购报告表', '前期报告表'] },
  { id: 'request', label: '企业项目申请备案的请示', names: ['申请备案的请示', '项目申请备案的请示', '项目请示'] },
]

/** 索取/咨询单模板的信号词（与材料名共现才命中） */
const SINGLE_MATERIAL_REQUEST_SIGNALS = [
  '给我', '发我', '发给我', '模板', '怎么用', '如何用', '怎么填', '如何填',
  '有没有', '有吗', '来一份', '来个', '下载', '可以吗', '能给我', '能发',
  '提供', '份模板', '样表', '空白表', '来份', '发份',
]

/**
 * 单材料模板索取意图。命中条件：含索取信号 ∧ 含某材料名。
 * 注意：不含"材料/清单"等全部清单词，故与 detectMaterialIntent(全部清单) 不冲突。
 */
export function detectSingleMaterial(userMessage: string): SingleMaterialHit | null {
  const lower = userMessage.toLowerCase()
  if (!SINGLE_MATERIAL_REQUEST_SIGNALS.some((s) => lower.includes(s))) return null
  for (const m of MATERIAL_NAME_MAP) {
    if (m.names.some((n) => lower.includes(n.toLowerCase()))) {
      return { id: m.id, label: m.label }
    }
  }
  return null
}

/**
 * Classify user intent within an active ODI task session.
 * - 'task': message relates to ODI field filling, confirmation, file upload, etc.
 * - 'general': general policy/tax/legal/trivia question — answer normally then resume task
 * - 'download': user wants to download/preview materials
 */
export type InTaskIntent = 'task' | 'general' | 'download'

const TASK_ACTION_KEYWORDS = [
  '确认', '补充', '填写', '提供', '上传', '跳过', '是的', '没问题', '对的',
  '正确', '确认下', '修改', '更正', ' regenerate', '重新生成',
  '投资方式', '主体类型', '目的地', '投资金额', '经营范围', '经营模式',
  '项目简况', '项目意义', '决策机构', '标的企业', '资金来源',
  '可行性', '承诺书', '备案表', '申请表', '决议',
]

const DOWNLOAD_KEYWORDS = [
  '下载', '导出', '生成材料', '材料包', '模板包', '打包', '预览材料',
  '下载材料', '生成文件', '生成文档',
]

const GENERAL_QA_PATTERNS = [
  /^(什么|什么是|为何|为什么|怎么|如何|哪|哪些|能不能|可以|是否|有没有|区别|对比|要求|条件|流程|步骤|期限|时间|费用|成本|风险|政策|法规|法律|税|外汇|汇率|合规)/,
  /^(请问|咨询|了解|查询|查一下|告诉我|解释|说明|介绍)/,
]

export function classifyInTaskIntent(userMessage: string): InTaskIntent {
  const msg = userMessage.trim()

  // Check download intent first (higher priority)
  if (DOWNLOAD_KEYWORDS.some(kw => msg.includes(kw))) {
    return 'download'
  }

  // Check if clearly a general QA
  const isGeneralPattern = GENERAL_QA_PATTERNS.some(p => p.test(msg))

  // Check if message contains task-related keywords
  const hasTaskKeyword = TASK_ACTION_KEYWORDS.some(kw => msg.includes(kw))

  // Short confirmations / field values are task-related
  if (msg.length <= 20 && hasTaskKeyword) return 'task'
  if (msg.length <= 10 && !isGeneralPattern) return 'task' // short answers like field values

  // General QA patterns without task keywords
  if (isGeneralPattern && !hasTaskKeyword) return 'general'

  // If contains task keywords, treat as task
  if (hasTaskKeyword) return 'task'

  // Default: if odi project active and message is short, lean task; long and question-like, lean general
  return msg.length > 40 && isGeneralPattern ? 'general' : 'task'
}

export function stripMarkers(content: string): {
  cleanContent: string
  hasOdiIntent: boolean
  quickQuestions: string[]
  materialsList: unknown | null
  reviewResult: unknown | null
} {
  let clean = content
  const hasOdiIntent = clean.includes('[ODI_INTENT_DETECTED]')
  clean = clean.replace('[ODI_INTENT_DETECTED]', '').trim()

  let quickQuestions: string[] = []
  const qMatch = clean.match(/\[QUICK_QUESTIONS:\s*([^\]]+)\]/)
  if (qMatch) {
    quickQuestions = qMatch[1].split('|').map((q) => q.trim()).filter(Boolean)
    clean = clean.replace(qMatch[0], '').trim()
  }

  let materialsList = null
  const mMatch = clean.match(/\[MATERIALS_LIST:\s*([\s\S]*?)\]/)
  if (mMatch) {
    try { materialsList = JSON.parse(mMatch[1]) } catch { /* skip */ }
    clean = clean.replace(mMatch[0], '').trim()
  }

  let reviewResult = null
  const rMatch = clean.match(/\[REVIEW_RESULT:\s*([\s\S]*?)\]/)
  if (rMatch) {
    try { reviewResult = JSON.parse(rMatch[1]) } catch { /* skip */ }
    clean = clean.replace(rMatch[0], '').trim()
  }

  // 清理其余结构化标记，防止原始标记文本泄漏给用户
  // 简单逗号列表类（内容无 ]）
  clean = clean.replace(/\[MISSING_FIELDS:\s*[^\]]*\]/g, '').trim()
  clean = clean.replace(/\[CONFIRM_FIELDS:\s*[^\]]*\]/g, '').trim()
  // JSON 数组/对象类（内容含 ]，匹配到结尾的 ] 或 } 后的 ])
  clean = clean.replace(/\[EXTRACTED_FIELDS:\s*[\s\S]*?\]\]/g, '').trim()
  clean = clean.replace(/\[TODO_ITEMS:\s*[\s\S]*?\]\]/g, '').trim()
  // ASK_USER: 对象 } 后跟标记 ]，前瞻排除 inputs 数组内的 }]
  clean = clean.replace(/\[ASK_USER:\s*\{[\s\S]*?\}\s*\](?=\s*(?:\[[A-Z_]|$))/g, '').trim()
  // ODI 填报演示完成标记（无冒号，单独移除）
  clean = clean.replace(/\[ODI_GUIDE_DONE\]/g, '').trim()
  // 兜底：移除残留的方括号大写标记
  clean = clean.replace(/\s*\[[A-Z_]{3,}:[^\n]*\]\s*/g, ' ').trim()

  return { cleanContent: clean, hasOdiIntent, quickQuestions, materialsList, reviewResult }
}
