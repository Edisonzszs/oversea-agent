import { ORCHESTRATOR_PLANNER_PROMPT } from '../../app/prompts/systemPrompts'
import { requestJsonCompletion } from '../../app/services/deepseekApi'
import {
  COUNTRY_115,
  detectCompoundTaxiqIntent,
  detectOdiIntent,
  detectTaxiqIntent,
} from '../../app/services/intentDetector'
import type { AgentId, ExecutionPlan, PlannedTask } from './types'

export interface PlannerDeps {
  completeJson(prompt: string, signal: AbortSignal): Promise<unknown>
}

const AGENT_IDS = new Set<AgentId>(['consulting', 'taxiq', 'odi'])
const INTENTS = new Set<ExecutionPlan['intent']>([
  'direct',
  'single',
  'compound',
  'irrelevant',
  'sensitive',
])
const ILLEGAL_ACTION_PATTERN =
  /(洗钱|诈骗|伪造.{0,6}(材料|公章|证件)|偷税|逃税|制毒|制造.{0,4}(炸弹|爆炸物)|入侵.{0,8}系统|窃取.{0,8}(密码|数据)|行贿)/i
const DEFENSIVE_CONTEXT_PATTERN =
  /(防范|预防|识别|举报|合规|风险|避免)/i

export const deepseekPlannerDeps: PlannerDeps = {
  completeJson(prompt, signal) {
    return requestJsonCompletion({
      systemPrompt: ORCHESTRATOR_PLANNER_PROMPT,
      userPrompt: prompt,
      signal,
    })
  },
}

export interface PlannerConversationOptions {
  /** 近期会话上下文（2d 追问路由用：如"那新加坡呢"需借历史判 taxiq） */
  conversation?: Array<{ role: string; content: string }>
}

export async function createExecutionPlan(
  question: string,
  signal: AbortSignal,
  deps: PlannerDeps,
  options?: PlannerConversationOptions,
): Promise<ExecutionPlan> {
  if (signal.aborted) throw signal.reason
  try {
    const value = await deps.completeJson(buildPlannerInput(question, options?.conversation), signal)
    if (signal.aborted) throw signal.reason
    return validatePlan(value)
  } catch (error) {
    if (signal.aborted) {
      throw signal.reason !== undefined ? signal.reason : error
    }
    if (isAbortError(error)) throw error
    if (typeof console !== 'undefined') {
      console.warn('[planner] 模型计划校验失败，走正则兜底:', (error as Error)?.message)
    }
    return createFallbackPlan(question)
  }
}

export function validatePlan(value: unknown): ExecutionPlan {
  // 兼容两种模型输出：{"plan":{...}}（提示词口径）与扁平 {...}（模型常见省略）
  const root = requireRecord(value, '模型输出')
  const plan = 'plan' in root ? requireRecord(root.plan, 'plan') : root
  assertExactKeys(
    plan,
    [
      'intent',
      'directAnswerAllowed',
      'tasks',
      'aggregationRequired',
      'rationaleSummary',
      'directAnswer',
    ],
    'plan',
  )
  let intent = requireIntent(plan.intent)
  const directAnswerAllowed = requireBoolean(
    plan.directAnswerAllowed,
    'directAnswerAllowed',
  )
  let aggregationRequired = requireBoolean(
    plan.aggregationRequired,
    'aggregationRequired',
  )
  const rationaleSummary = requireNonEmptyString(
    plan.rationaleSummary,
    'rationaleSummary',
  )

  if (!Array.isArray(plan.tasks)) {
    throw new Error('plan.tasks 必须是数组')
  }
  if (plan.tasks.length > 3) {
    throw new Error('plan.tasks 最多允许 3 个任务')
  }

  const seen = new Set<AgentId>()
  const tasks: PlannedTask[] = []
  plan.tasks.forEach((taskValue, index) => {
    const task = validateTask(taskValue, index)
    if (!seen.has(task.agentId)) {
      seen.add(task.agentId)
      tasks.push(task)
    }
  })
  validateTaskOrder(tasks)

  // directAnswer 语义上是可选字段：模型常以 ""/null 占位（尤其 compound 计划），视同缺省
  const rawDirectAnswer = plan.directAnswer
  let directAnswer: string | undefined
  if (typeof rawDirectAnswer === 'string' && rawDirectAnswer.trim()) {
    directAnswer = requireNonEmptyString(rawDirectAnswer, 'directAnswer')
  }

  // 模型常见不自洽输出：compound 只配 1 任务 / compound 漏 aggregationRequired ——
  // 确定性纠正而非整体弃用（弃用会让 LLM 规划长期退化为正则兜底）
  if (intent === 'single' || intent === 'compound') {
    if (tasks.length === 1) {
      intent = 'single'
      aggregationRequired = false
    } else if (tasks.length >= 2 && !aggregationRequired) {
      aggregationRequired = true
    }
  }

  validateIntentShape({
    intent,
    directAnswerAllowed,
    aggregationRequired,
    tasks,
    directAnswer,
  })

  return {
    intent,
    directAnswerAllowed,
    tasks,
    aggregationRequired,
    rationaleSummary,
    ...(directAnswer !== undefined ? { directAnswer } : {}),
  }
}

export function createFallbackPlan(question: string): ExecutionPlan {
  const normalized = question.trim()

  if (isSensitiveOrIllegal(normalized)) {
    return boundaryPlan(
      'sensitive',
      '该请求涉及敏感或违法内容，不能派发专业任务。',
      '抱歉，我不能协助处理该请求。您可以咨询合规的企业出海政策、办事流程和材料要求。',
    )
  }

  if (!normalized || isGreeting(normalized) || isCapabilityQuestion(normalized)) {
    return boundaryPlan(
      'direct',
      '这是问候或平台能力咨询，可直接答复。',
      '您好，我可以协助企业查询上海出海服务、国别税策以及ODI备案流程与材料。',
    )
  }

  const outboundContext =
    /(出海|海外|境外|跨境|走出去|对外投资|外汇登记|国际市场|目的国|设厂|建厂|开厂|办厂|开公司|设立公司|注册公司)/i.test(
      normalized,
    )
  const countryHit =
    COUNTRY_115.some((country) => normalized.includes(country)) ||
    /(东盟|欧盟|欧洲|亚洲|非洲|美洲|大洋洲|欧亚|各国|多国|哪些国家)/i.test(normalized)
  // 大陆境内税务不进 TaxIQ（生产 1K 排除口径，"在中国开公司要交多少税"类不建税策任务）
  const mainlandTax =
    /(中国大陆|中国境内|中国国内|境内税收|境内税务|国内税收|国内税务|在中国|在国内)/i.test(normalized)
  const odiMatched = detectOdiIntent(normalized)
  const compoundTaxiqMatched = detectCompoundTaxiqIntent(normalized)
  // 涉税必须走 taxiq（生产 taxiq_qa 路由口径）：有出海语境或国别实体 + 含"税"即建税策任务，
  // 避免"越南设厂涉及哪些税和备案手续"被 odi 单专家合并吞掉税收部分。
  const taxMatched =
    !mainlandTax &&
    (detectTaxiqIntent(normalized) ||
      (outboundContext && /税/i.test(normalized)) ||
      (countryHit && /税/i.test(normalized)))
  const policyText = normalized.replace(/(税收|税务)政策/gi, '')
  const policyOrServiceIntent =
    /(政策|公共服务|政务服务|政策服务|扶持|补贴|专项资金|资金补助|外汇登记)/i.test(
      policyText,
    )
  const knownOutboundServicePhrase =
    /(出海服务|走出去服务|境外投资公共服务|企业走出去综合服务平台)/i.test(
      normalized,
    )
  const explicitConsultingMatched =
    knownOutboundServicePhrase ||
    ((outboundContext || odiMatched) && policyOrServiceIntent)
  const consultingMatched =
    explicitConsultingMatched || (compoundTaxiqMatched && !odiMatched)
  const defensiveComplianceContext =
    ILLEGAL_ACTION_PATTERN.test(normalized) &&
    DEFENSIVE_CONTEXT_PATTERN.test(normalized)

  const matched = new Set<AgentId>()
  if (consultingMatched) matched.add('consulting')
  if (taxMatched) matched.add('taxiq')
  if (odiMatched) matched.add('odi')

  const obviouslyIrrelevant =
    /(冒泡排序|写代码|编程|装电脑|讲笑话|菜谱|做饭|星座|游戏攻略|体育比分|天气预报)/i.test(
      normalized,
    )
  if (matched.size === 0 && obviouslyIrrelevant && !outboundContext) {
    return boundaryPlan(
      'irrelevant',
      '该问题明显不属于企业出海服务范围。',
      '抱歉，该问题暂不属于本平台的企业出海服务范围。您可以咨询出海政策、国别税策或ODI办理问题。',
    )
  }

  if (matched.size === 0 && (outboundContext || defensiveComplianceContext)) {
    matched.add('consulting')
  }

  if (matched.size === 0) {
    return boundaryPlan(
      'irrelevant',
      '当前问题无法识别为企业出海相关需求。',
      '抱歉，该问题暂不属于本平台的企业出海服务范围。您可以咨询出海政策、国别税策或ODI办理问题。',
    )
  }

  const tasks = (['consulting', 'taxiq', 'odi'] as const)
    .filter((agentId) => matched.has(agentId))
    .map((agentId) => createFallbackTask(agentId))
  const compound = tasks.length > 1

  return {
    intent: compound ? 'compound' : 'single',
    directAnswerAllowed: false,
    tasks,
    aggregationRequired: compound,
    rationaleSummary: compound
      ? '该问题涉及多个专业领域，将由相关智能体协同处理。'
      : '该问题将交由对应的专业智能体处理。',
  }
}

function buildPlannerInput(
  question: string,
  conversation?: Array<{ role: string; content: string }>,
): string {
  const hist = (conversation ?? [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-6)
    .map(m => `${m.role === 'user' ? '用户' : '助手'}：${m.content.replace(/\s+/g, ' ').slice(0, 120)}`)
    .join('\n')
  return `请为以下用户问题生成执行计划。\n\n用户问题：${question}${hist ? `\n\n近期会话上下文（仅供理解指代与省略，规划以用户问题为准）：\n${hist}` : ''}`
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path} 必须是 JSON 对象`)
  }
  return value as Record<string, unknown>
}

function requireIntent(value: unknown): ExecutionPlan['intent'] {
  if (typeof value !== 'string' || !INTENTS.has(value as ExecutionPlan['intent'])) {
    throw new Error('plan.intent 必须是 direct、single、compound、irrelevant 或 sensitive')
  }
  return value as ExecutionPlan['intent']
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`plan.${path} 必须是布尔值`)
  return value
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`plan.${path} 必须是非空字符串`)
  }
  return value
}

function validateTask(value: unknown, index: number): PlannedTask {
  const path = `tasks[${index}]`
  const task = requireRecord(value, path)
  assertExactKeys(
    task,
    ['agentId', 'title', 'instruction', 'expectedOutput'],
    path,
  )
  if (typeof task.agentId !== 'string' || !AGENT_IDS.has(task.agentId as AgentId)) {
    throw new Error(`plan.${path}.agentId 必须是 consulting、taxiq 或 odi`)
  }
  return {
    agentId: task.agentId as AgentId,
    title: requireNonEmptyString(task.title, `${path}.title`),
    instruction: requireNonEmptyString(task.instruction, `${path}.instruction`),
    expectedOutput: requireNonEmptyString(task.expectedOutput, `${path}.expectedOutput`),
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
): void {
  const allowed = new Set(allowedKeys)
  const unknownKey = Object.keys(value).find((key) => !allowed.has(key))
  if (unknownKey !== undefined) {
    throw new Error(`${path} 包含未知字段: ${unknownKey}`)
  }
}

function validateTaskOrder(tasks: readonly PlannedTask[]): void {
  const rank: Record<AgentId, number> = {
    consulting: 0,
    taxiq: 1,
    odi: 2,
  }
  for (let index = 1; index < tasks.length; index += 1) {
    const previous = tasks[index - 1]
    const current = tasks[index]
    if (previous && current && rank[previous.agentId] > rank[current.agentId]) {
      throw new Error('plan.tasks 必须按 consulting、taxiq、odi 的规范顺序排列')
    }
  }
}

function validateIntentShape(plan: {
  intent: ExecutionPlan['intent']
  directAnswerAllowed: boolean
  aggregationRequired: boolean
  tasks: PlannedTask[]
  directAnswer: string | undefined
}): void {
  if (plan.intent === 'direct' || plan.intent === 'irrelevant' || plan.intent === 'sensitive') {
    if (!plan.directAnswerAllowed || plan.tasks.length !== 0 || plan.aggregationRequired) {
      throw new Error(
        `${plan.intent} intent 必须允许直接答复、包含零个 tasks 且不需要 aggregation`,
      )
    }
    return
  }

  if (plan.directAnswer !== undefined) {
    throw new Error(`${plan.intent} intent 不得包含 directAnswer`)
  }
  if (plan.directAnswerAllowed) {
    throw new Error(`${plan.intent} intent 不允许直接答复`)
  }
  if (plan.intent === 'single') {
    if (plan.tasks.length !== 1 || plan.aggregationRequired) {
      throw new Error('single intent 必须恰好包含一个任务且不需要 aggregation')
    }
    return
  }
  if (plan.tasks.length < 2 || plan.tasks.length > 3 || !plan.aggregationRequired) {
    throw new Error('compound intent 必须包含 2-3 个任务且需要 aggregation')
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

function boundaryPlan(
  intent: 'direct' | 'irrelevant' | 'sensitive',
  rationaleSummary: string,
  directAnswer: string,
): ExecutionPlan {
  return {
    intent,
    directAnswerAllowed: true,
    tasks: [],
    aggregationRequired: false,
    rationaleSummary,
    directAnswer,
  }
}

function isGreeting(question: string): boolean {
  return /^(你好|您好|嗨|hi|hello|早上好|下午好|晚上好|在吗|谢谢|再见)([,，\s]*(小海|平台|助手))?[!！,.，。?？~～\s]*$/i.test(
    question,
  )
}

function isCapabilityQuestion(question: string): boolean {
  return (
    /(平台|小海|你).{0,10}(能做什么|可以做什么|有什么功能|提供什么|有哪些服务|怎么用|如何使用|能力)/i.test(
      question,
    ) || /(怎么|如何)使用.{0,6}(平台|小海)/i.test(question)
  )
}

function isSensitiveOrIllegal(question: string): boolean {
  const hasIllegalAction = ILLEGAL_ACTION_PATTERN.test(question)
  const explicitEvasion =
    hasIllegalAction &&
    /(绕过|规避|逃避).{0,8}(监管|审查|检查|税务|海关)/i.test(question)
  if (explicitEvasion) return true
  return hasIllegalAction && asksForUnsafeAction(question)
}

function asksForUnsafeAction(question: string): boolean {
  const occurrencePattern = new RegExp(ILLEGAL_ACTION_PATTERN.source, 'gi')
  const strongActionPattern =
    /(教我|帮我|替我|告诉我|指导我|如何实施|怎么操作|怎么做|不被发现)/i
  for (const match of question.matchAll(occurrencePattern)) {
    const start = match.index
    if (start === undefined) continue
    const matchedText = match[0]
    const end = start + matchedText.length
    const before = question.slice(Math.max(0, start - 20), start)
    const after = question.slice(end, end + 20)

    const defensiveBefore =
      /(防范|预防|识别|举报|避免|阻止|打击).{0,10}$/i.test(before)
    const defensiveAfter =
      /^.{0,4}风险.{0,10}(防范|预防|识别|举报|避免|阻止|打击)/i.test(after)
    if (defensiveBefore || defensiveAfter) continue

    const strongActionBefore = strongActionPattern.test(before.slice(-12))
    const strongActionAfter = strongActionPattern.test(after.slice(0, 12))
    const directQuestionBefore =
      /(如何|怎样|怎么).{0,12}$/i.test(before)
    const directQuestionAfter =
      /^.{0,4}(怎么弄|如何弄|怎样弄|咋弄|怎么操作|怎么做)/i.test(after)
    const asksForMethod = /^.{0,4}(方法|步骤)/i.test(after)

    if (
      strongActionBefore ||
      strongActionAfter ||
      directQuestionBefore ||
      directQuestionAfter ||
      asksForMethod
    ) {
      return true
    }
  }
  return false
}

function createFallbackTask(agentId: AgentId): PlannedTask {
  switch (agentId) {
    case 'consulting':
      return {
        agentId,
        title: '出海政策与服务咨询',
        instruction: '结合用户问题梳理适用的出海政策、公共服务和行动建议。',
        expectedOutput: '政策服务要点、适用条件与下一步建议',
      }
    case 'taxiq':
      return {
        agentId,
        title: '国别税策分析',
        instruction: '分析用户所问国家或地区的相关税制、税率、优惠与合规风险。',
        expectedOutput: '国别税策要点、风险提示与参考依据',
      }
    case 'odi':
      return {
        agentId,
        title: 'ODI办理指引',
        instruction: '根据用户问题说明ODI备案或核准的流程、材料与办理注意事项。',
        expectedOutput: '办理路径、材料清单与关键注意事项',
      }
  }
}
