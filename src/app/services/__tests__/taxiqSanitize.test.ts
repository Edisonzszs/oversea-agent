import { describe, expect, it } from "vitest";
import {
  hasTaxiqInternalSourceDisclosure,
  isTaxiqNoDirectSupportAnswer,
  sanitizeTaxiqAnswer,
} from "../taxiqSanitize";

// 生产 taxiq_api.py 来源表述净化的移植验证：内部来源表述剥离、业务内容保留、
// 未覆盖契约答复识别。全部纯函数，零网络调用。

describe("isTaxiqNoDirectSupportAnswer（未覆盖契约）", () => {
  it.each([
    ["抱歉，当前问题超出知识库覆盖范围，暂时无法解答。"],
    ["抱歉,当前问题超出知识库覆盖范围,暂时无法解答"],
    ["抱歉，当前问题超出知识库覆盖范围，暂时无法解答"],
    [" 抱歉，当前问题超出知识库覆盖范围，暂时无法解答。 "],
    ["抱歉，当前问题超出知识库覆盖范围，\n暂时无法解答。"],
  ])("识别契约答复：%j", (answer) => {
    expect(isTaxiqNoDirectSupportAnswer(answer)).toBe(true);
  });

  it.each([
    ["越南企业所得税标准税率为20%。"],
    ["抱歉，当前问题超出知识库覆盖范围，暂时无法解答，请换个问法。"],
    [""],
  ])("不误伤正常答复：%j", (answer) => {
    expect(isTaxiqNoDirectSupportAnswer(answer)).toBe(false);
  });

  it("非字符串输入返回 false", () => {
    expect(isTaxiqNoDirectSupportAnswer(null)).toBe(false);
    expect(isTaxiqNoDirectSupportAnswer(123)).toBe(false);
  });
});

describe("sanitizeTaxiqAnswer（来源表述净化）", () => {
  it("剥离开头的 TaxIQ 来源前缀，保留业务事实", () => {
    const answer = "根据TaxIQ的分析，越南企业所得税标准税率为20%，优惠税率可达15%。";
    expect(sanitizeTaxiqAnswer(answer)).toBe(
      "越南企业所得税标准税率为20%，优惠税率可达15%。",
    );
  });

  it("剥离知识库/平台检索来源表述", () => {
    expect(sanitizeTaxiqAnswer("基于知识库精准响应：越南增值税税率为10%。")).toBe(
      "越南增值税税率为10%。",
    );
    expect(sanitizeTaxiqAnswer("根据平台知识库检索结果，泰国企业所得税为20%。")).toBe(
      "泰国企业所得税为20%。",
    );
    expect(sanitizeTaxiqAnswer("平台检索到的信息显示，新加坡企业所得税为17%。")).toBe(
      "新加坡企业所得税为17%。",
    );
  });

  it("丢弃整句知识库覆盖能力表述及其紧随的'但未提供'从句", () => {
    const answer =
      "知识库中已收录相关内容，但未提供优惠税率细节。越南企业所得税税率为20%。";
    expect(sanitizeTaxiqAnswer(answer)).toBe("越南企业所得税税率为20%。");
  });

  it("保留业务内容（税收协定/申报资料不属来源表述）", () => {
    const answer = "根据中越税收协定，股息预提税税率为10%。申报资料包括财务报表。";
    expect(sanitizeTaxiqAnswer(answer)).toBe(answer);
  });

  it("丢弃来源子句后剥掉紧随句的转折连词", () => {
    const answer = "根据TaxIQ的分析，知识库暂未收录地方税费明细，但增值税税率为10%。";
    expect(sanitizeTaxiqAnswer(answer)).toBe("增值税税率为10%。");
  });

  it("业务句间隔后的残留披露不被净化吞掉（由披露检测兜底）", () => {
    // 生产语义：来源子句与残留句之间隔了业务事实时，残留句保留在净化结果中，
    // 由 hasTaxiqInternalSourceDisclosure 报警 → 上层走兜底，不静默改写业务内容。
    const answer =
      "TaxIQ平台的分析显示，越南税制以企业所得税为主。但 TaxIQ 知识库未收录地方税费明细。";
    const sanitized = sanitizeTaxiqAnswer(answer);
    expect(sanitized).toContain("越南税制以企业所得税为主。");
    expect(hasTaxiqInternalSourceDisclosure(sanitized)).toBe(true);
  });

  it("整段都是来源表述时返回空串（应兜底）", () => {
    expect(sanitizeTaxiqAnswer("根据TaxIQ的分析，")).toBe("");
    expect(sanitizeTaxiqAnswer("知识库中已收录115个国家和地区。")).toBe("");
  });

  it("开头多轮来源前缀（最多3轮）都被剥离", () => {
    const answer = "根据TaxIQ的分析，基于知识库精准响应，目前TaxIQ平台覆盖115个国家，越南企业所得税为20%。";
    const sanitized = sanitizeTaxiqAnswer(answer);
    expect(sanitized).not.toContain("TaxIQ");
    expect(sanitized).toContain("越南企业所得税为20%。");
  });
});

describe("hasTaxiqInternalSourceDisclosure（残留披露检测）", () => {
  it("净化后的干净正文不报警", () => {
    expect(
      hasTaxiqInternalSourceDisclosure("越南企业所得税标准税率为20%，建议以官方渠道核验。"),
    ).toBe(false);
  });

  it("残留 TaxIQ/知识库来源表述时报警", () => {
    expect(hasTaxiqInternalSourceDisclosure("详情可参考TaxIQ平台的说明。")).toBe(true);
    expect(hasTaxiqInternalSourceDisclosure("知识库中收录了相关政策。")).toBe(true);
    expect(hasTaxiqInternalSourceDisclosure("以上依据平台检索结果整理。")).toBe(true);
  });

  it("空串不报警", () => {
    expect(hasTaxiqInternalSourceDisclosure("")).toBe(false);
  });
});
