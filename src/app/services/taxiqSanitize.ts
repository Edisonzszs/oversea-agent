/**
 * TaxIQ 答复来源表述净化（生产 taxiq_api.py 同源规则的 TS 移植）
 * ============================================================
 * 对应中经社生产侧 skills/taxiq_qa + custom_tools/taxiq_api.py 的两条硬契约：
 *  1. `_normalize_taxiq_user_visible_answer`：确定性剥离"根据TaxIQ的分析，"
 *     "基于知识库精准响应""平台检索结果显示""知识库中已收录…""依据现有资料/数据显示"
 *     等内部来源表述及其"但未提供/亦无"从句；业务内容（如"根据税收协定分析"）保留。
 *  2. `is_taxiq_no_direct_support_answer`：上游固定未覆盖契约答复
 *     （"抱歉，当前问题超出知识库覆盖范围，暂时无法解答。"）不得作为成功正文交付。
 *
 * 净化只发生在 TaxIQ 成功载荷边界（taxiqAgent 交付前），保证用户看到的是逐字净化的
 * 上游答复，而非模型改写；净化后为空或仍残留内部来源披露 → 按失败走兜底。
 */

/* ── 子句来源名词（TaxIQ / 知识库 / 平台检索 / 资料·数据 家族） ───────────── */
const SOURCE_CORE =
  "(?:" +
  "TaxIQ(?:平台)?" +
  "|(?:本|当前|现有|平台)?知识库(?:中|内|的)?(?:现有)?(?:(?:检索|查询)(?:结果)?|精准响应|分析|内容|信息|数据|资料|回答|结论)?" +
  "|平台(?:检索|查询)到的(?:结果|信息|资料|数据)" +
  "|检索结果" +
  "|(?:(?:现有|已有|相关|平台)\\s*)?(?:资料|数据)" +
  ")"

/** 子句开头的来源归属前缀（含结尾分隔符，整体剥离） */
const ATTRIBUTION_PREFIX_RE = new RegExp(
  "^\\s*(?:[-+*]\\s+|>\\s*)?(?:\\*\\*)?\\s*" +
    "(?:(?:本回答|该结论)\\s*(?:是|系|由)?\\s*)?" +
    "(?:" +
    // 根据/据/依据/基于/参考/结合/按照/依照 + 来源 + （的）（名词）（显示/表明/…）
    "(?:根据|据|依据|基于|参考|结合|按照|依照)\\s*" + SOURCE_CORE +
    "\\s*(?:返回|提供|给出)?\\s*的?\\s*(?:分析(?:结果)?|结果|信息|数据|资料|回答|结论)?\\s*(?:显示|表明|生成|得出|看|来看)?" +
    // 从 …（来看）
    "|从\\s*" + SOURCE_CORE + "\\s*的?\\s*(?:分析(?:结果)?|结果|信息|数据|资料|回答|结论)?\\s*(?:看|来看)" +
    // TaxIQ/知识库 …（的）… 显示/表明/认为（无引导动词）
    "|" + SOURCE_CORE + "\\s*的?\\s*(?:分析(?:结果)?|结果|信息|数据|资料|回答|结论)?\\s*(?:显示|表明|认为)" +
    // 经/通过 平台（知识库）检索（后）（结果）（显示/表明）
    "|(?:经|通过)\\s*平台(?:知识库)?\\s*(?:检索|查询)(?:后)?(?:结果)?\\s*(?:显示|表明)?" +
    // （据）平台检索（到的）（结果…）（显示/表明/可知/为）
    "|(?:据\\s*)?平台\\s*(?:检索|查询)(?:到的)?\\s*(?:结果|信息|资料|数据)?\\s*(?:显示|表明|可知|为)" +
    // （现有…）资料/数据（中）显示/表明/指出/提到/收录/覆盖/包含/提供
    "|(?:(?:现有|已有|相关|平台)\\s*)?(?:资料|数据)(?:中|内)?\\s*(?:显示|表明|指出|提到|已?收录|已?覆盖|已?包含|已?提供)" +
    // according to / based on TaxIQ …
    "|(?:according\\s+to|based\\s+on)\\s+TaxIQ(?:['’]s)?\\s*(?:analysis|results?|information|data|answer|conclusion)?" +
    ")" +
    "\\s*(?:\\*\\*)?\\s*[，,:：。]\\s*",
  "i",
)

/** 整句即内部来源表述的子句（连标点前的内容整条丢弃） */
const INTERNAL_SOURCE_CLAUSE_RE = new RegExp(
  "^\\s*(?:⚠️?\\s*)?(?:(?:注意|提示)\\s*[：:]\\s*)?(?:\\*\\*)?\\s*" +
    "(?:" +
    // TaxIQ（平台）（返回的）分析/结果/… （显示/表明/认为）
    "TaxIQ(?:平台)?\\s*(?:返回|提供|给出)?\\s*的?\\s*(?:分析(?:结果)?|结果|信息|数据|资料|回答|结论)\\s*(?:显示|表明|认为)?" +
    // （目前/当前）（本/现有/平台）知识库（中/内）（仅/只/暂/无/未/…）（收录/覆盖/…）
    "|(?:(?:目前|当前)\\s*)?(?:(?:本|当前|现有|平台)\\s*)?知识库" +
    "(?:(?:中|内)\\s*(?:仅|只|暂|无|未|没有|覆盖|收录|包含|提供|显示)?|\\s*(?:覆盖|收录|显示|仅|只|暂|无|未|没有|包含|提供))" +
    // 平台（知识库）的检索结果/情况 显示/表明/返回/提供
    "|平台(?:知识库)?的?(?:检索|查询)(?:结果|情况)\\s*(?:显示|表明|返回|提供)" +
    // 经/通过 平台（知识库）检索（后）（结果）（显示/表明）
    "|(?:经|通过)\\s*平台(?:知识库)?\\s*(?:检索|查询)(?:后)?(?:结果)?\\s*(?:显示|表明)?" +
    // 从 TaxIQ/知识库/检索结果 看/来看
    "|从\\s*(?:TaxIQ(?:平台)?|(?:平台)?知识库|检索结果)\\s*(?:看|来看)" +
    // 我/我们/本助手 将严格根据 TaxIQ/知识库/资料
    "|(?:我|我们|本助手)\\s*(?:将|会|可|可以|能够)?\\s*(?:严格)?\\s*" +
    "(?:根据|依据|基于|参考|结合|按照|依照)\\s*" +
    "(?:TaxIQ(?:平台)?|(?:平台)?知识库|(?:(?:现有|已有|相关|平台)\\s*)?(?:资料|数据))" +
    // （现有…）资料/数据（中）显示/表明/收录…
    "|(?:(?:现有|已有|相关|平台)\\s*)?(?:资料|数据)(?:中|内)?\\s*(?:显示|表明|指出|提到|已?收录|已?覆盖|已?包含|已?提供)" +
    // 目前/当前 已可查询 N 个国家…
    "|(?:目前|当前)\\s*(?:已)?(?:可查询|可检索|覆盖|收录)\\s*\\d+\\s*个(?:国家|国家和地区|税收辖区)" +
    ")",
  "i",
)

/** 保留子句内的内嵌限定词（"TaxIQ知识库已收录的"），原地剥除 */
const EMBEDDED_QUALIFIER_RE =
  /(?:TaxIQ(?:平台)?|(?:平台)?知识库)(?:中|内)?(?:已|所)?(?:收录|覆盖|包含|提供)(?:的)?/i

/** 刚丢弃来源子句后，其后的"（但）无/未/没有…"限定从句一并丢弃 */
const DEPENDENT_LIMITATION_RE =
  /^\s*(?:(?:但|但是|且|并且|同时|亦|也)\s*)?(?:无|未|没有|不含|不提供|不覆盖|未收录)/

/** 丢弃来源子句后，下一子句开头的转折/顺接连词剥除 */
const LEADING_CONNECTOR_RE = /^\s*(?:但|但是|且|并且|同时|此外|因此|所以|据此)[，,]?\s*/

/** 子句切分（保留分隔符） */
const CLAUSE_DELIMITER_RE = /([，,；;。！？\n]+)/

/** 净化后仍残留内部来源披露的检测（兜底判据） */
const SOURCE_DISCLOSURE_RE = new RegExp(
  "(?:" +
    "TaxIQ|平台知识库|资料来源|数据来源" +
    "|(?:根据|据|依据|基于|参考|结合|按照|依照)\\s*(?:(?:本|当前|现有|平台)\\s*)?知识库" +
    "|平台\\s*(?:检索|查询)" +
    "|检索结果" +
    "|知识库(?:中|内|的)?\\s*(?:已|所)?\\s*(?:收录|覆盖|包含|提供|显示|无|未|没有|仅|只)" +
    "|(?:(?:现有|已有|相关|平台)\\s*)?(?:资料|数据)(?:中|内)?\\s*(?:显示|表明|指出|提到|已?收录|已?覆盖|已?包含|已?提供)" +
    "|(?:目前|当前)\\s*(?:已)?(?:可查询|可检索|覆盖|收录)\\s*\\d+\\s*个(?:国家|国家和地区|税收辖区)" +
    ")",
  "i",
)

/**
 * TaxIQ 固定未覆盖契约答复识别（生产 is_taxiq_no_direct_support_answer）。
 * 命中 → 上游明确表示不覆盖该问题，必须按失败走兜底，不得当成功正文交付。
 */
const NO_DIRECT_SUPPORT_RE = /^抱歉[，,]当前问题超出知识库覆盖范围[，,]暂时无法解答[。.]?$/

export function isTaxiqNoDirectSupportAnswer(answer: unknown): boolean {
  if (typeof answer !== "string") return false
  return NO_DIRECT_SUPPORT_RE.test(answer.replace(/\s+/g, ""))
}

/**
 * 剥离 TaxIQ 答复中的内部来源表述，返回净化后的用户可见正文。
 * 返回空串表示整段都是来源表述（应按失败兜底，不得交付空答复）。
 */
export function sanitizeTaxiqAnswer(answer: string): string {
  let normalized = answer.trim()
  // 开头的来源前缀最多剥 3 轮（"根据TaxIQ的分析，基于知识库精准响应，……"）
  for (let round = 0; round < 3; round += 1) {
    const updated = normalized.replace(ATTRIBUTION_PREFIX_RE, "")
    if (updated === normalized) break
    normalized = updated.replace(/^\s+/, "")
  }

  const parts = normalized.split(CLAUSE_DELIMITER_RE)
  const retained: string[] = []
  let removedSourceClause = false

  for (let index = 0; index < parts.length; index += 2) {
    const clause = parts[index] ?? ""
    const delimiter = parts[index + 1] ?? ""
    const sentenceEnded = /[。！？\n]/.test(delimiter)
    const segment = clause + delimiter

    // 1) 子句内的来源前缀（含其后的分隔符）整体剥离
    const withoutPrefix = segment.replace(ATTRIBUTION_PREFIX_RE, "")
    if (withoutPrefix !== segment) {
      if (withoutPrefix.trim()) {
        retained.push(withoutPrefix)
        removedSourceClause = false
      } else {
        removedSourceClause = true
        if (retained.length > 0 && sentenceEnded) {
          closeRetained(retained, delimiter.slice(-1))
        }
      }
      continue
    }

    // 2) 整句即内部来源表述（"知识库中已收录115个国家"）→ 丢弃
    if (INTERNAL_SOURCE_CLAUSE_RE.test(clause)) {
      removedSourceClause = true
      if (retained.length > 0 && sentenceEnded) {
        closeRetained(retained, delimiter.slice(-1))
      } else if (retained.length > 0 && !delimiter) {
        closeRetained(retained, "。")
      }
      continue
    }

    let kept = clause.replace(EMBEDDED_QUALIFIER_RE, "")

    // 3) 刚丢弃来源子句时，其"（但）未提供/亦无…"限定从句一并丢弃
    if (removedSourceClause && DEPENDENT_LIMITATION_RE.test(kept)) {
      if (retained.length > 0 && sentenceEnded) {
        closeRetained(retained, delimiter.slice(-1))
      }
      continue
    }

    // 4) 丢弃来源子句后剥掉下一句开头的"但/因此/此外"
    if (removedSourceClause) {
      kept = kept.replace(LEADING_CONNECTOR_RE, "")
    }
    if (kept.trim()) {
      retained.push(kept + delimiter)
      removedSourceClause = false
    }
  }
  return retained.join("").trim()
}

/** 净化后是否仍残留内部来源披露（残留 → 按失败兜底） */
export function hasTaxiqInternalSourceDisclosure(answer: string): boolean {
  if (typeof answer !== "string" || !answer.trim()) return false
  if (SOURCE_DISCLOSURE_RE.test(answer)) return true
  const clauses = answer.split(CLAUSE_DELIMITER_RE)
  for (let index = 0; index < clauses.length; index += 2) {
    if (INTERNAL_SOURCE_CLAUSE_RE.test(clauses[index] ?? "")) return true
  }
  return false
}

/** 用句末标点收尾上一保留子句（丢弃来源子句后的衔接修复） */
function closeRetained(retained: string[], closing: string): void {
  const last = retained.length - 1
  retained[last] = retained[last]!.replace(/[，,；;]+\s*$/, closing)
}
