// 合规自查向导 —— 7 个步骤组件。
// 题干与选项忠实移植自合规 HTML 第五版表单；条件必答与字段显隐由 wizardModel 谓词驱动。

import {
  QuestionBlock, RadioQ, CheckQ, FormRow, TextInput, SelectInput, FilesBlock,
  type WizardApi,
} from "./fields";
import { C } from "../complianceTheme";
import { val, checkedVals, hasArch } from "../logic/wizardModel";
import { isRiskCtry } from "../logic/country";
import { COUNTRY_OPTIONS } from "../logic/country";
import { FILE_MOD, fileSet, type FileId } from "../logic/weights";

const noteStyle: React.CSSProperties = {
  background: "#FFF9EC", border: "1px solid #EAD9A8", borderLeft: `4px solid ${C.warn}`,
  borderRadius: "0 7px 7px 0", padding: "8px 12px", margin: "8px 0", fontSize: 12.5, color: "#6B5417", lineHeight: 1.6,
};

// ─── 模块〇 企业画像 ──────────────────────────────────────────────────────────
export function StepProfile({ api }: { api: WizardApi }) {
  const s = api.state;
  return (
    <>
      <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.7, marginBottom: 10 }}>
        本模块采集基础信息，用于匹配后续自查分支与提示内容，<b>不参与评价</b>。
      </p>

      <FormRow label="企业名称/信用代码">
        <TextInput value={s.answers.single["p_name"] ?? ""} onChange={v => api.setSingle("p_name", v)} placeholder="（选填）" />
      </FormRow>

      <FormRow label="所有制类型" hint="国有企业另触发国资监管提示（中央企业适用国资委 35 号令）">
        <SelectInput value={s.answers.single["p_own"] ?? ""} onChange={v => api.setSingle("p_own", v)}>
          <option value="">请选择</option>
          {["国有独资", "国有控股", "民营", "外商投资", "混合所有制"].map(o => <option key={o}>{o}</option>)}
        </SelectInput>
      </FormRow>

      <FormRow label="拟投资行业类别" hint="联动模块五行业要点；审批按行业展开审查（境外设厂选 C 制造业；海外仓选 G 交通运输；咨询服务选 L 租赁和商务服务业）">
        <SelectInput value={s.answers.single["p_ind2"] ?? ""} onChange={v => api.setSingle("p_ind2", v)}>
          <option value="">请选择（GB/T 4754—2017）</option>
          {IND_OPTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </SelectInput>
      </FormRow>

      <FormRow label="最终目的地" hint="选定后弹出该国《对外投资提示事项》须确认已读；选定 22 个需核准国别（不丹、朝鲜、南苏丹等，填表说明第 15 条）将自动触发从严预警与模块三 3.3">
        <SelectInput value={s.answers.single["p_ctry"] ?? ""} onChange={v => api.pickCountry(v)}>
          <option value="">请选择国别（地区）</option>
          {COUNTRY_OPTIONS.map(o => <option key={o}>{o}</option>)}
        </SelectInput>
      </FormRow>

      <FormRow label="拟投资总额与币种">
        <TextInput value={s.answers.single["p_amt"] ?? ""} onChange={v => api.setSingle("p_amt", v)} placeholder="如：5,000 万美元（金额一律折美元填报）" />
      </FormRow>

      <FormRow label="投资路径" hint="目的地选港澳台即为投向港澳台；目的地为港澳台或经港澳台中转的，均参照适用（837 号令第三十二条）">
        <SelectInput value={s.answers.single["p_path"] ?? ""} onChange={v => api.setSingle("p_path", v)}>
          <option value="">请选择</option>
          <option value="direct">直接投资至目的地</option>
          <option value="via">经第三地（含港澳台）中转投资</option>
        </SelectInput>
      </FormRow>

      <FormRow label="是否采用特殊架构" />
      <CheckQ
        values={checkedVals(s, "p_arch")}
        options={[
          { v: "spv", label: "离岸 SPV" }, { v: "hk", label: "香港 SPV" }, { v: "eu", label: "欧洲控股" },
          { v: "vie", label: "VIE" }, { v: "multi", label: "多层嵌套" },
        ]}
        noneValue="none"
        onToggle={v => api.toggleMulti("p_arch", v)}
      />
      <label style={{ display: "inline-block", marginTop: 8, fontSize: 13, cursor: "pointer", color: checkedVals(s, "p_arch").includes("none") ? C.primary : C.sub }}>
        <input type="checkbox" checked={checkedVals(s, "p_arch").includes("none")} onChange={() => api.toggleMulti("p_arch", "none")} style={{ marginRight: 6 }} />无
      </label>

      <h3 style={{ margin: "22px 0 6px", fontSize: 15, color: C.ink }}>投资方式（决定模块二自查分支）</h3>
      <p style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>选定后仅呈现对应方式的题目。</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {([
          { m: "new", t: "新设类", d: "在境外设立新企业（绿地投资）。对已获证项目的增资属“变更类”；通过增资首次入股他人既有公司属“并购类”" },
          { m: "ma", t: "并购类", d: "取得既有境外标的公司股份，含并购、控股、参股；实现方式含受让老股、增资认购新股或两者并用" },
          { m: "chg", t: "变更类", d: "《企业境外投资证书》及核准/备案文件载明事项发生变化：投资额、投资人、资本构成、业务范围、投资路径等" },
        ] as const).map(o => {
          const sel = s.mode === o.m;
          return (
            <button key={o.m} onClick={() => api.setMode(o.m)}
              style={{ flex: "1 1 200px", background: sel ? C.primary : C.primaryBg, color: sel ? "#fff" : C.primary, border: `2px solid ${sel ? C.primary : C.primaryBorder}`, borderRadius: 8, padding: "14px 12px", fontSize: 15, cursor: "pointer", textAlign: "left", transition: "all .15s" }}>
              {o.t}
              <small style={{ display: "block", fontSize: 12, marginTop: 5, opacity: 0.85, fontWeight: 400 }}>{o.d}</small>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ─── 模块一 主体资格 ──────────────────────────────────────────────────────────
export function StepSubject({ api }: { api: WizardApi }) {
  const s = api.state;
  return (
    <>
      <p style={noteStyle}>
        本模块六项对应主管机关审查的六项主体资格子标准，其中第 <b>1、3、4</b> 项属"不予受理"前置门槛，务请重点对照。每题下方为"应准备文件"上传区（上传自愿 · 不作申报条件 · 可脱敏 · 上传即得分）。
      </p>
      {Z_QUESTIONS.map(q => (
        <QuestionBlock key={q.name} stem={q.stem} law={q.law}>
          <RadioQ name={q.name} value={val(s, q.name)} options={q.opts} onChange={v => api.setSingle(q.name, v)} />
          <FilesBlock fids={q.fids} mode={s.mode!} uploads={s.uploads} onUpload={api.uploadFile} onToggleMask={api.toggleMask} />
        </QuestionBlock>
      ))}
    </>
  );
}

// ─── 模块二 投资方式（分支 + 共通）──────────────────────────────────────────────
export function StepInvestMode({ api }: { api: WizardApi }) {
  const s = api.state;
  const mode = s.mode!;
  return (
    <>
      {mode === "new" && (
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
          <h2 style={h3Title}>分支 A　新设类：资金使用必要性与合理性</h2>
          <div style={noteStyle}><b>口径提示：</b>本分支仅适用于在境外设立新企业。对已获证境外企业的增资请改选"变更类"；通过增资认购他人既有公司新发行股份的请改选"并购类"。</div>
          <QuestionBlock stem="A-1　是否已编制成本测算表（以 1-3 年为一个用款周期、分科目列示）？">
            <RadioQ name="n1" value={val(s, "n1")} options={N1_OPTS} onChange={v => api.setSingle("n1", v)} />
            <FilesBlock fids={["f_n1"]} mode={mode} uploads={s.uploads} onUpload={api.uploadFile} onToggleMask={api.toggleMask} />
          </QuestionBlock>
          <QuestionBlock stem="A-2　主要支出科目（设备采购、雇员成本等大额项目）是否有对应的合同或合作意向书？">
            <RadioQ name="n2" value={val(s, "n2")} options={N2_OPTS} onChange={v => api.setSingle("n2", v)} />
            <FilesBlock fids={["f_n2"]} mode={mode} uploads={s.uploads} onUpload={api.uploadFile} onToggleMask={api.toggleMask} />
          </QuestionBlock>
          <QuestionBlock stem="A-3　成本测算总额与拟投资金额是否匹配？">
            <RadioQ name="n3" value={val(s, "n3")} options={N3_OPTS} onChange={v => api.setSingle("n3", v)} />
            <FilesBlock fids={["f_n3"]} mode={mode} uploads={s.uploads} onUpload={api.uploadFile} onToggleMask={api.toggleMask} />
          </QuestionBlock>
        </div>
      )}

      {mode === "ma" && (
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
          <h2 style={h3Title}>分支 B　并购类：交易结构、标的真实性与定价公允性</h2>
          <div style={noteStyle}><b>前置程序提示（商务部系统规则）：</b>设立方式为"并购"或"增资并购"的，必须先选择已填写或已通过的"并购事项前期报告表"（在系统"备案（核准）报告"应用中填报），方可继续填写境外投资申请表。请将前期报告纳入交易时间表。</div>
          <QuestionBlock stem="B-1　本次交易完成后，属于以下哪种类型？">
            <RadioQ name="m0a" value={val(s, "m0a")} options={M0A_OPTS} onChange={v => api.setSingle("m0a", v)} />
          </QuestionBlock>
          <QuestionBlock stem="B-2　本次交易通过何种方式实现？">
            <RadioQ name="m0b" value={val(s, "m0b")} options={M0B_OPTS} onChange={v => api.setSingle("m0b", v)} />
          </QuestionBlock>
          <QuestionBlock stem="B-3　是否已取得法律尽调、财务审计、第三方估值报告（机构有执业资质并加盖签章）？">
            <RadioQ name="m1" value={val(s, "m1")} options={M1_OPTS} onChange={v => api.setSingle("m1", v)} />
            {val(s, "m1") === "na" && (
              <div style={{ background: "#F7FAFD", border: `1px solid ${C.line}`, borderLeft: `4px solid ${C.primary}`, borderRadius: "0 8px 8px 0", padding: "10px 14px", margin: "8px 0" }}>
                <div style={{ fontWeight: 700, color: C.primary, fontSize: 13.5, marginBottom: 6 }}>客观不适用声明（理由向审批端披露，审批环节可复核）</div>
                <FormRow label="不适用文件"><span style={{ fontSize: 13.5, color: C.sub }}>标的公司财务审计报告</span></FormRow>
                <FormRow label="具体理由（必填）">
                  <TextInput value={val(s, "m1na_reason") ?? ""} onChange={v => api.setSingle("m1na_reason", v)} placeholder="如：标的公司为新设立企业，无历史财务数据，客观上无法出具财务审计报告" />
                </FormRow>
              </div>
            )}
            <FilesBlock fids={["f_m1a", "f_m1b", "f_m1c"]} mode={mode} uploads={s.uploads} onUpload={api.uploadFile} onToggleMask={api.toggleMask} />
          </QuestionBlock>
          <QuestionBlock stem="B-4　估值报告是否提供可比案例及估值区间？交易定价与区间关系如何？">
            <RadioQ name="m2" value={val(s, "m2")} options={M2_OPTS} onChange={v => api.setSingle("m2", v)} />
            <FilesBlock fids={["f_m2"]} mode={mode} uploads={s.uploads} onUpload={api.uploadFile} onToggleMask={api.toggleMask} />
          </QuestionBlock>
          <QuestionBlock stem="B-5　交易协议是否已包含惯常条款（标的描述、对价、陈述保证、先决条件、交割、违约、争议解决等）？">
            <RadioQ name="m3" value={val(s, "m3")} options={M3_OPTS} onChange={v => api.setSingle("m3", v)} />
            <FilesBlock fids={["f_m3"]} mode={mode} uploads={s.uploads} onUpload={api.uploadFile} onToggleMask={api.toggleMask} />
          </QuestionBlock>
        </div>
      )}

      {mode === "chg" && (
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
          <h2 style={h3Title}>分支 C　变更类：证书载明事项变化对照</h2>
          <div style={noteStyle}><b>口径提示：</b>变更类针对已核准/备案项目，对照《企业境外投资证书》载明事项逐项核查变化。</div>
          <QuestionBlock stem="C-1　对照证书载明事项，本项目发生了哪些变化（可多选）：">
            <CheckQ values={checkedVals(s, "c1")} options={C1_OPTS} noneValue="0" onToggle={v => api.toggleMulti("c1", v)} />
          </QuestionBlock>
          {checkedVals(s, "c1").filter(v => v !== "0").length > 0 && (
            <>
              <QuestionBlock stem="C-6　变更申请办理情况：">
                <RadioQ name="c2" value={val(s, "c2")} options={C2_OPTS} onChange={v => api.setSingle("c2", v)} />
              </QuestionBlock>
              {checkedVals(s, "c1").includes("inv") && (
                <>
                  <QuestionBlock stem="C-2　投资人变化的具体情形（可多选）：">
                    <CheckQ values={checkedVals(s, "c3")} options={C3_OPTS} onToggle={v => api.toggleMulti("c3", v)} />
                  </QuestionBlock>
                  <QuestionBlock stem="C-3　投资人变化的实现形式：">
                    <RadioQ name="c4" value={val(s, "c4")} options={C4_OPTS} onChange={v => api.setSingle("c4", v)} />
                  </QuestionBlock>
                  {checkedVals(s, "c3").includes("nd") && (
                    <QuestionBlock stem="C-4　新增境内投资人时，申报主体确定情况：">
                      <RadioQ name="c5" value={val(s, "c5")} options={C5_OPTS} onChange={v => api.setSingle("c5", v)} />
                    </QuestionBlock>
                  )}
                  <QuestionBlock stem="C-5　投资额与持股比例联动核对情况：">
                    <RadioQ name="c6" value={val(s, "c6")} options={C6_OPTS} onChange={v => api.setSingle("c6", v)} />
                  </QuestionBlock>
                </>
              )}
              <FilesBlock fids={["f_c1", "f_c2", "f_c3"]} mode={mode} uploads={s.uploads} onUpload={api.uploadFile} onToggleMask={api.toggleMask} />
            </>
          )}
        </div>
      )}

      {/* 共通项 */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
        <h2 style={h3Title}>共通项（各分支均填）</h2>
        <QuestionBlock stem="共通 1　项目团队行业经验：">
          <RadioQ name="g1" value={val(s, "g1")} options={G1_OPTS} onChange={v => api.setSingle("g1", v)} />
          <FilesBlock fids={["f_g1"]} mode={mode} uploads={s.uploads} onUpload={api.uploadFile} onToggleMask={api.toggleMask} />
        </QuestionBlock>
        <QuestionBlock stem="共通 2　关联交易核查：">
          <RadioQ name="g2" value={val(s, "g2")} options={G2_OPTS} onChange={v => api.setSingle("g2", v)} />
          <FilesBlock fids={["f_g2"]} mode={mode} uploads={s.uploads} onUpload={api.uploadFile} onToggleMask={api.toggleMask} />
        </QuestionBlock>
        <QuestionBlock stem="共通 3　投资完成后控制权结构：">
          <RadioQ name="g3" value={val(s, "g3")} options={G3_OPTS} onChange={v => api.setSingle("g3", v)} />
        </QuestionBlock>
        {hasArch(s) && (
          <QuestionBlock stem="共通 4　特殊架构（SPV/多层控股/VIE）各层商业理由能否说明？">
            <RadioQ name="g4" value={val(s, "g4")} options={G4_OPTS} onChange={v => api.setSingle("g4", v)} />
          </QuestionBlock>
        )}
      </div>
    </>
  );
}

// ─── 模块三 标的与负面清单 ─────────────────────────────────────────────────────
export function StepTarget({ api }: { api: WizardApi }) {
  const s = api.state;
  const mode = s.mode!;
  const mod3Fids = fileSet(mode).filter(f => FILE_MOD[f] === "模块三");
  return (
    <>
      <div style={noteStyle}><b>审批填报预告（商务部系统官方填表说明）：</b>申请表中“投资路径”仅指第一层级境外企业（作为投资平台、不从事具体经营业务，可通过“+”增加多家）；“最终目的地境外企业”另行单独填报，注册资本应与其章程约定一致。请按“第一层级平台+最终目的地企业”两层口径梳理架构信息。</div>
      {mode === "ma" && (
        <QuestionBlock stem="3.1-②　标的注册证明文件、股东名册、董事名册是否已取得？是否已备加盖公章的中文翻译件？" law="登记文件形式要件为审查环节统一要求（外文文件须附加盖公章的中文翻译件）；缺登记文件判档不得高于 C。">
          <RadioQ name="t2" value={val(s, "t2")} options={T2_OPTS} onChange={v => api.setSingle("t2", v)} />
        </QuestionBlock>
      )}
      {checkedVals(s, "p_arch").includes("vie") && (
        <QuestionBlock stem="3.1-③　（涉 VIE 或返程投资适用）境内创始人/股东是否已办理 37 号文外汇登记？" law="《国家外汇管理局关于境内居民通过特殊目的公司境外投融资及返程投资外汇管理有关问题的通知》（汇发〔2014〕37 号）。未登记的先补办登记再申报。">
          <RadioQ name="t3" value={val(s, "t3")} options={T3_OPTS} onChange={v => api.setSingle("t3", v)} />
        </QuestionBlock>
      )}

      <QuestionBlock stem="3.2　三套负面清单逐项核对（法律渊源不同，分别核对，不可混淆）" law="清单 A：敏感行业目录（2018）；清单 B：74 号文限制类；清单 C：74 号文禁止类。">
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: "8px 0 4px" }}>清单 A　敏感行业目录（2018）——本项目是否涉及（涉及后果：不分金额一律核准）</div>
        <CheckQ values={checkedVals(s, "lsA")} options={LSA_OPTS} onToggle={v => api.toggleMulti("lsA", v)} />
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: "12px 0 4px" }}>清单 B　74 号文限制类——本项目是否涉及（涉及后果：须经核准）</div>
        <CheckQ values={checkedVals(s, "lsB")} options={LSB_OPTS} onToggle={v => api.toggleMulti("lsB", v)} />
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: "12px 0 4px" }}>清单 C　74 号文禁止类——本项目是否涉及（涉及后果：不予批准/备案，自查判 D）</div>
        <CheckQ values={checkedVals(s, "lsC")} options={LSC_OPTS} onToggle={v => api.toggleMulti("lsC", v)} />
        <label style={{ display: "inline-block", marginTop: 10, fontSize: 13, cursor: "pointer", color: s.lsNone ? C.primary : C.sub, background: s.lsNone ? C.primaryBg : C.fieldBg, border: `1px solid ${s.lsNone ? C.primary : C.line}`, borderRadius: 7, padding: "6px 12px" }}>
          <input type="checkbox" checked={s.lsNone} onChange={e => api.setLsNone(e.target.checked)} style={{ marginRight: 6 }} />三套清单均不涉及
        </label>
      </QuestionBlock>

      {isRiskCtry(val(s, "p_ctry")) && (
        <QuestionBlock stem="3.3-①　该国别属需核准国别，上述风险防控能力证明材料是否已备妥？" law="该国别属从严核准范围。企业可提供境外风险识别与防控能力证明材料（风险评估报告、应急预案、当地合规资源安排等）供审查判断；是否核准由主管机关按从严原则裁量。官方口径参考：商务部系统填表说明列明“需要核准的国别/地区”共 22 个（不丹、斯威士兰、梵蒂冈、帕劳、马绍尔群岛、图瓦卢、海地、危地马拉、巴拉圭、伯利兹、圣基茨和尼维斯、圣卢西亚、圣文森特和格林纳丁斯、也门、朝鲜、利比亚、苏丹、索马里、刚果（金）、伊拉克、中非共和国、南苏丹；名单以商务部系统最新公布为准）。">
          <RadioQ name="t4" value={val(s, "t4")} options={T4_OPTS} onChange={v => api.setSingle("t4", v)} />
        </QuestionBlock>
      )}

      <FilesBlock title="模块三 应准备文件" fids={mod3Fids} mode={mode} uploads={s.uploads} onUpload={api.uploadFile} onToggleMask={api.toggleMask} />
    </>
  );
}

// ─── 模块四 安全审查 ──────────────────────────────────────────────────────────
export function StepSecurity({ api }: { api: WizardApi }) {
  const s = api.state;
  const s1a = val(s, "s1a");
  return (
    <>
      <p style={noteStyle}>安全审查是受理后的前置环节：主管机关受理申请后先进行安全审查，疑虑未消除的不予批准、不进入后续实质审查。本模块为事实采集与预警，不能替代主管机关安全审查。商务部备案系统在审批端同样设置四道敏感问答（一国以上利益/三项清单/石墨物项/稀土物项），本模块问答口径与商务部系统一致。</p>
      <QuestionBlock stem="4-1a　本次投资或后续运营中，是否存在人员/技术跨境安排（跨境派遣技术人员、组织人员赴境外工作、跨境提供技术指导、安排人员跨境培训，或向境外提供技术图纸、工艺流程、软件源代码、数据集等）？" law="837 号令第十三条；第十五条（境外投资安全审查制度）；《出口管制法》《两用物项出口管制条例》；《中国禁止出口限制出口技术目录》。涉禁止出口内容为“一条红线”，不得实施；涉限制出口内容须先取得许可。">
        <RadioQ name="s1a" value={s1a} options={[{ v: "n", label: "均无" }, { v: "y", label: "有上述一项或多项安排" }]} onChange={v => api.setSingle("s1a", v)} />
      </QuestionBlock>
      {s1a === "y" && (
        <>
          <QuestionBlock stem="4-1b　（有安排时）所涉内容领域（可多选，对照《中国禁止出口限制出口技术目录》）：">
            <CheckQ values={checkedVals(s, "s1b")} options={S1B_OPTS} noneValue="0" onToggle={v => api.toggleMulti("s1b", v)} />
          </QuestionBlock>
          <QuestionBlock stem="4-1c　是否已对照上述目录及“三项清单”（两用物项管制清单、禁止限制出口技术目录、核出口管制清单）完成核对？（商务部备案系统内嵌约 2000 条管制商品库，可按商品名称/编码检索查证）" law="《中国禁止出口限制出口技术目录》（2025 年第 28 号公告调整版）。">
            <RadioQ name="s1c" value={val(s, "s1c")} options={S1C_OPTS} onChange={v => api.setSingle("s1c", v)} />
          </QuestionBlock>
        </>
      )}

      <QuestionBlock stem="4-2a　涉及哪些数据出境场景（可多选）？">
        <CheckQ values={checkedVals(s, "s2a")} options={S2A_OPTS} noneValue="0" onToggle={v => api.toggleMulti("s2a", v)} />
      </QuestionBlock>
      <QuestionBlock stem="4-2c　数据出境合规路径状态：">
        <RadioQ name="s2c" value={val(s, "s2c")} options={S2C_OPTS} onChange={v => api.setSingle("s2c", v)} />
      </QuestionBlock>

      <QuestionBlock stem="4-3　是否属于关键领域（产业链供应链安全，834 号令，可多选）？">
        <CheckQ values={checkedVals(s, "s3")} options={S3_OPTS} noneValue="0" onToggle={v => api.toggleMulti("s3", v)} />
      </QuestionBlock>

      <QuestionBlock stem="4-4　是否存在外国域外管辖与证据调取要求（837 号令第二十二条 · 835 号令）？">
        <RadioQ name="s4" value={val(s, "s4")} options={[{ v: "n", label: "不存在相关情形" }, { v: "y", label: "存在或可能存在外国机构证据调取要求" }]} onChange={v => api.setSingle("s4", v)} />
      </QuestionBlock>

      <FilesBlock title="模块四 应准备文件" fids={["f_s1", "f_s2", "f_s3", "f_s4"]} mode={s.mode!} uploads={s.uploads} onUpload={api.uploadFile} onToggleMask={api.toggleMask} />
    </>
  );
}

// ─── 模块五 行业国别（采集）────────────────────────────────────────────────────
export function StepIndustryCountry({ api }: { api: WizardApi }) {
  const s = api.state;
  return (
    <>
      <p style={noteStyle}>本模块采集行业与国别事实信息并即时输出提示，<b>不判档、不计文件分</b>。审批环节将按行业与国别要求提供更充分的资料论述，请提前准备。（行业与国别要点将持续完善扩充，提示内容以官方最新发布为准）</p>
      <FormRow label="行业细分（采集）">
        <TextInput value={s.answers.single["q51"] ?? ""} onChange={v => api.setSingle("q51", v)} placeholder="如：半导体集成电路制造" />
      </FormRow>
      <QuestionBlock stem="5-2　本次投资涉及的目的地国别情况：">
        <RadioQ name="q52" value={val(s, "q52")} options={[{ v: "one", label: "单一国别" }, { v: "multi", label: "涉及多个国别（地区）" }]} onChange={v => api.setSingle("q52", v)} />
        {val(s, "q52") === "multi" && (
          <FormRow label="涉及国别列举">
            <TextInput value={val(s, "q52list") ?? ""} onChange={v => api.setSingle("q52list", v)} placeholder="如：新加坡、印度尼西亚" />
          </FormRow>
        )}
      </QuestionBlock>
      <QuestionBlock stem="5-3　对目的地外资安全审查制度（CFIUS/FSR/SIRA 等）的了解程度：">
        <RadioQ name="q53" value={val(s, "q53")} options={Q53_OPTS} onChange={v => api.setSingle("q53", v)} />
      </QuestionBlock>
      <QuestionBlock stem="5-4　是否已取得国别风险参考资料：">
        <RadioQ name="q54" value={val(s, "q54")} options={Q54_OPTS} onChange={v => api.setSingle("q54", v)} />
      </QuestionBlock>
    </>
  );
}

// ─── 使用说明（步骤 0，文案对齐 20260813 完整版对外发布稿 12 条）───────────────
export function StepIntro({ onStart }: { onStart: () => void }) {
  return (
    <div>
      <h3 style={{ color: C.primary, fontSize: 16, marginBottom: 10 }}>使用说明（企业必读）</h3>
      <ol style={{ margin: "0 0 14px 22px", fontSize: 13, color: C.ink, lineHeight: 1.9 }}>
        <li><b>本表定位。</b>本表供拟开展境外投资的企业自愿自查使用，帮助企业在正式申报前系统了解监管要求、对照准备材料、预判自身状态。完成自查并非申报的前置条件，任何档位均可依法申报。</li>
        <li><b>填写人建议。</b>本表宜由企业主管投资业务的部门人员填写（境外经营团队对投资安排相关章节通常不熟悉）。</li>
        <li><b>填写方式。</b>企业只需回答客观事实问题（是否、多少、有无），无需自行判断风险档位；各项评价档位由系统根据事实回答自动推导。全部问题附“分析依据”，点击可展开学习。</li>
        <li><b>双轨输出。</b>本表输出两项结果：<b>自查判断等级（ABCD）</b>——按事实回答推导、就低原则确定，回答“能不能报”；<b>文件齐备度</b>——按“核心+增强”双层制对各题“应准备文件”的上传情况计分（核心层按权重计分、各路径满分 100；增强层不提交不扣分、每提交 1 件加 1 分），回答“材料备到什么程度”。两轨相互独立、互不折算，报告页给出组合解读。</li>
        <li><b>文件上传与计分规则。</b>①上传自愿、不作申报条件：每件应准备文件旁设上传入口，上传与否不影响判档等级；不上传不得分，上传即按该件权重记分；②一题多件的，凑齐才记满分，缺一件扣一件的分；③完整文件与脱敏文件均可上传（可脱敏范围提示：商业秘密、个人信息、交易对手信息），脱敏文件同权重计分，但在报告中单独列示，并按 80% 口径给出折算参考分；④不适用的条件项记 0 分、分母固定 100，报告中注明本次实际可得上限；⑤申报材料实行“核心+增强”双层制——核心层材料按权重计分、各路径满分 100；增强层材料不提交不扣分、每提交一件加 1 分（新设类、并购类上限 5 分，变更类上限 4 分）。系统仅作形式接收、不核验文件内容真伪，分数仅反映材料齐备程度，不代表合规结论。</li>
        <li><b>评价档位含义。</b>A＝材料齐备，可直接申报；B＝基本具备，需补充材料；C＝存在需先解决的问题；D＝存在禁止性情形或重大缺陷，不建议申报。总档按“就低原则”确定。</li>
        <li><b>数据用途告知。</b>企业填报内容仅用于生成本次自查报告，不作为执法线索使用。上传文件仅用于本次自查计分与报告生成；登录用户可保存填报数据、修改后重新生成报告；数据存储位置、访问权限、保密责任与留存期限按平台公布的企业数据安全政策执行，企业可随时删除已上传文件。</li>
        <li><b>声明。</b>本自查结果不构成法律意见，亦不代表主管机关审批结论，最终以主管机关依法审查为准。涉及重大、复杂或敏感投资安排的，建议咨询专业机构（见报告页“我可以咨询谁”）。</li>
        <li><b>联盟服务引导。</b>本工具在若干节点嵌入“平台专业服务联盟机构”服务引导，遵循四条铁律：帮扶不推销（只指机构类别、不点名机构）；公共服务先行；名词统一；企业自主——是否使用服务与判档、计分完全脱钩。各专业服务事项按材料类型对应机构类别办理：审计、验资事项由会计师事务所办理；银行资金证明由银行出具；评估、估值事项由评估机构办理；法律调查、尽职调查及涉外法律咨询事项由律师事务所（含境内外律所）办理。</li>
        <li><b>法源标注。</b>本表所附法律依据中，《国务院关于对外投资的规定》（国务院令第 837 号）相关条文已经全文逐条核验；部门规章条文号沿用既有评审标准定稿口径。</li>
        <li><b>版本说明。</b>本工具为完整版：建议登录后使用，可保存填报数据、修改后重新生成报告，并获得平台专业服务联盟资源推荐；完整填写约需 40-60 分钟。另有简化版：无需登录，约 10-15 分钟，覆盖核心自查事项，适合快速初步自测。</li>
        <li><b>术语说明。</b>标注“前置门槛”的事项（自查 1、自查 3、自查 4）若不符合，申报将不被受理，建议优先处理。</li>
      </ol>
      <div style={{ textAlign: "right", marginTop: 16 }}>
        <button onClick={onStart} style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "10px 30px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>开始自查</button>
      </div>
    </div>
  );
}

// ─── 选项数据 ─────────────────────────────────────────────────────────────────
const h3Title: React.CSSProperties = { margin: "0 0 10px", fontSize: 16, fontWeight: 700, color: C.ink, paddingBottom: 7, borderBottom: `2px solid ${C.lineSoft}` };

const IND_OPTS: [string, string][] = [
  ["A", "A　农、林、牧、渔业"], ["B", "B　采矿业"], ["C", "C　制造业"], ["D", "D　电力、热力、燃气及水生产和供应业"],
  ["E", "E　建筑业"], ["F", "F　批发和零售业"], ["G", "G　交通运输、仓储和邮政业"], ["H", "H　住宿和餐饮业"],
  ["I", "I　信息传输、软件和信息技术服务业"], ["J", "J　金融业"], ["K", "K　房地产业"], ["L", "L　租赁和商务服务业"],
  ["M", "M　科学研究和技术服务业"], ["N", "N　水利、环境和公共设施管理业"], ["O", "O　居民服务、修理和其他服务业"],
  ["P", "P　教育"], ["Q", "Q　卫生和社会工作"], ["R", "R　文化、体育和娱乐业"], ["S", "S　公共管理、社会保障和社会组织"], ["T", "T　国际组织"],
];

const Z_QUESTIONS = [
  {
    name: "z1", stem: "自查 1　股权架构及实际控制人（前置门槛）", fids: ["f_z1a", "f_z1b"] as FileId[],
    law: "837 号令第二条；《境外投资管理办法》（商务部令 2014 年第 3 号）第九条、第十条；《企业境外投资管理办法》（发改委令第 11 号）。",
    opts: [
      { v: "a", label: "能绘制上穿至最终实际控制人（自然人/国资委/上市公司即止）的完整股权架构图，各层持股均有登记文件证明，最终实际权益比例已计算（各层相乘、多路径相加），且不存在无商业实质安排" },
      { v: "b", label: "能绘制完整架构图，但部分层级登记文件未齐" },
      { v: "c", label: "存在多层嵌套，但能说明商业合理性（真实历史沿革、合规税务筹划等）" },
      { v: "d", label: "存在纯离岸空转、拆分小额出境后境外汇聚等无商业实质安排，或无法追溯至最终实际控制人" },
    ],
  },
  {
    name: "z2", stem: "自查 2　主营业务合规性及与标的关联性", fids: ["f_z2a", "f_z2b", "f_z2c"] as FileId[],
    law: "《产业结构调整指导目录（2024 年本）》；关联性作为风险因素由审查环节综合判断。",
    opts: [
      { v: "a", label: "主业不属限制类/淘汰类或“两高”行业，且与标的业务相同、相似或存在上下游关系" },
      { v: "b", label: "主业不属上述类别，但与标的业务关联不明显（需补充商业合理性说明）" },
      { v: "c", label: "主业属限制类或“两高”行业，但已完成合规改造并可证明" },
      { v: "d", label: "主业属淘汰类，或属限制类/“两高”且未完成合规改造" },
    ],
  },
  {
    name: "z3", stem: "自查 3　企业规模与资金实力（前置门槛）", fids: ["f_z3a", "f_z3b", "f_z3c", "f_z3d", "f_z3e"] as FileId[],
    law: "《境外投资管理办法》（商务部令 2014 年第 3 号）第十九条；真实性审查要求（837 号令）。",
    opts: [
      { v: "a", label: "实缴注册资本与最近一期所有者权益均能覆盖拟投资金额，且全部为自有资金" },
      { v: "b", label: "能够覆盖，含贷款、第三方资金等非自有资金，但合法来源能够说明" },
      { v: "c", label: "接近但未完全覆盖，需补充其他合法资金来源证明" },
      { v: "d", label: "明显不足，且无其他合法来源证明" },
    ],
  },
  {
    name: "z4", stem: "自查 4　违法违规记录（前置门槛）", fids: ["f_z4a", "f_z4b"] as FileId[],
    law: "《对外投资备案（核准）报告暂行办法》（商合发〔2018〕24 号）及联合惩戒机制；837 号令第十条。",
    opts: [
      { v: "a", label: "本企业及法定代表人、实际控制人近五年无刑事处罚或重大行政处罚，未列入失信被执行人或联合惩戒名单，不处于资格罚限制期" },
      { v: "b", label: "曾有一般性行政处罚，但与境外投资无直接关联，可提供说明" },
      { v: "c", label: "曾有与境外投资相关的行政处罚，但影响已消除、有整改证明" },
      { v: "d", label: "存在刑事处罚记录，或在失信/联合惩戒名单，或处于资格罚限制期" },
    ],
  },
  {
    name: "z5", stem: "自查 5　负面舆情", fids: ["f_z5"] as FileId[],
    law: "主管机关操作口径：企业自我声明 + 法律调查报告佐证。",
    opts: [
      { v: "a", label: "以企业名称及实控人姓名检索公开渠道，不存在负面报道" },
      { v: "b", label: "存在负面报道，但与本次投资无关，可提供说明" },
      { v: "c", label: "存在与经营相关的负面舆情，但已有权威澄清或妥善处理" },
      { v: "d", label: "存在重大且未澄清的负面舆情" },
    ],
  },
  {
    name: "z6", stem: "自查 6　重大未决诉讼仲裁及政府调查（含涉外，近三年）", fids: ["f_z6"] as FileId[],
    law: "837 号令第二十二条；《反外国不当域外管辖条例》（国务院令第 835 号）。",
    opts: [
      { v: "a", label: "不存在未决诉讼、仲裁或正在接受的政府部门调查（含境外）" },
      { v: "b", label: "存在一般性诉讼仲裁，金额小，不影响正常经营" },
      { v: "c", label: "存在重大诉讼仲裁，但经评估不影响投资真实性与履约能力，可提供分析说明" },
      { v: "d", label: "存在可能影响正常经营及投资真实性认定的重大诉讼/调查" },
    ],
  },
];

const N1_OPTS = [{ v: "a", label: "已编制，且分周期、分科目列示" }, { v: "b", label: "已编制，但未按周期或科目细分" }, { v: "c", label: "尚未编制" }];
const N2_OPTS = [{ v: "a", label: "主要科目均有对应合同或意向书" }, { v: "b", label: "部分科目有" }, { v: "c", label: "均无" }];
const N3_OPTS = [{ v: "a", label: "基本匹配（差异可解释）" }, { v: "c", label: "明显失配且暂无法解释" }];
const M0A_OPTS = [{ v: "bg", label: "并购——取得标的公司全部股权" }, { v: "kg", label: "控股——取得过半数股权或实际控制权" }, { v: "cg", label: "参股——取得部分股权且不构成控制" }];
const M0B_OPTS = [{ v: "zr", label: "受让既有股东股份（老股转让）" }, { v: "zz", label: "增资认购新发行股份（增资入股）" }, { v: "hh", label: "转让与增资同时进行" }];
const M1_OPTS = [{ v: "a", label: "三类报告齐备且机构资质完备" }, { v: "b", label: "报告齐备，个别资质证明或签章待补" }, { v: "c", label: "缺任一类报告" }, { v: "na", label: "部分文件客观不适用（须填写具体理由），其余报告齐备" }];
const M2_OPTS = [{ v: "a", label: "有可比区间，定价落在区间内" }, { v: "b", label: "有可比区间，定价偏离但已备充分理由" }, { v: "b2", label: "报告未含可比案例区间" }, { v: "c", label: "定价偏离区间且无依据说明" }];
const M3_OPTS = [{ v: "a", label: "惯常条款齐备" }, { v: "b", label: "个别条款缺失，正在谈判补充" }, { v: "c", label: "缺失关键内容或存在明显不利异常安排" }];
const C1_OPTS = [
  { v: "amt", label: "投资额变化——增资、减资，或股权购买、出售引起的中方投资额增减" }, { v: "inv", label: "投资人变化——新增境内或境外投资人、减少既有投资人" }, { v: "cap", label: "投资资本构成变化——出资方式、股权/债权结构、币种等调整" },
  { v: "biz", label: "业务范围（经营范围）变化" }, { v: "path", label: "投资路径变化——中间层架构、持股链条调整" }, { v: "oth", label: "其他证书载明事项变化（投资地点、境外企业名称等）" }, { v: "0", label: "以上均未发生" },
];
const C2_OPTS = [{ v: "a", label: "已在情形发生前申请并获同意" }, { v: "c", label: "未在情形发生前申请或未获同意" }];
const C3_OPTS = [{ v: "nd", label: "新增境内投资人" }, { v: "nf", label: "新增境外投资人" }, { v: "rd", label: "减少既有投资人" }];
const C4_OPTS = [{ v: "zg", label: "转股" }, { v: "zjz", label: "增资或减资" }, { v: "tb", label: "转股与增资/减资同时进行" }];
const C5_OPTS = [{ v: "a", label: "已由持股比例最大的境内企业牵头办理联合申报" }, { v: "b", label: "持股比例已测算，联合申报安排待落实" }, { v: "c", label: "尚未测算各境内投资人持股比例——申报主体无法确定" }];
const C6_OPTS = [{ v: "a", label: "投资额及持股比例变化已核对并纳入变更申请" }, { v: "b", label: "尚未核对" }];
const G1_OPTS = [{ v: "a", label: "实控人及关键负责人具备相关行业经验，简历已备" }, { v: "b", label: "简历尚未整理/部分缺失" }, { v: "c", label: "不具备直接相关经验——建议补充团队配置或外部顾问" }];
const G2_OPTS = [{ v: "a", label: "不涉及关联方" }, { v: "a2", label: "涉及关联方，定价依据已说明" }, { v: "b", label: "涉及关联方，定价依据说明待准备" }, { v: "d", label: "涉及关联方但拟不披露（D 风险）" }];
const G3_OPTS = [{ v: "qz", label: "全资" }, { v: "kg", label: "控股" }, { v: "gt", label: "共同控制" }, { v: "cg", label: "参股" }];
const G4_OPTS = [{ v: "a", label: "各层商业理由能够说明" }, { v: "b", label: "部分层级理由待整理" }];
const T2_OPTS = [{ v: "a", label: "三类文件齐备，中文翻译件已备" }, { v: "c", label: "部分缺失或翻译件未备" }];
const T3_OPTS = [{ v: "a", label: "已办理登记" }, { v: "c", label: "尚未登记" }];
const T4_OPTS = [{ v: "b", label: "已备妥（风险评估报告+应急预案+当地合规资源安排）" }, { v: "c", label: "尚未备妥" }];
// 三套负面清单(交付稿口径:清单A 3项/B 7项/C 5项,数字值;与速测版一致以便升级直通)
const LSA_OPTS = [{ v: "1", label: "武器装备的研制生产维修" }, { v: "2", label: "跨境水资源开发利用" }, { v: "3", label: "新闻传媒" }];
const LSB_OPTS = [
  { v: "1", label: "与未建交、发生战乱、受国际条约限制的敏感国家（地区）的投资" }, { v: "2", label: "房地产" }, { v: "3", label: "酒店" },
  { v: "4", label: "影城" }, { v: "5", label: "娱乐业" }, { v: "6", label: "体育俱乐部" }, { v: "7", label: "在境外设立无具体实业项目的股权投资基金或投资平台" },
];
const LSC_OPTS = [
  { v: "1", label: "未经国家批准的军事工业核心技术和产品输出" }, { v: "2", label: "运用国家禁止出口的技术工艺产品" }, { v: "3", label: "赌博业、色情业" },
  { v: "4", label: "国际条约禁止的投资" }, { v: "5", label: "其他危害国家利益和安全的投资" },
];
const S1B_OPTS = [
  { v: "li1", label: "锂电池正极材料（磷酸铁锂/磷酸锰铁锂）" }, { v: "li2", label: "锂矿提锂/金属锂制备" }, { v: "re", label: "稀土提炼加工/永磁体" }, { v: "sc", label: "半导体/集成电路制造" },
  { v: "ai", label: "人工智能大模型/机器学习算法" }, { v: "bd", label: "北斗/卫星导航技术" }, { v: "bio", label: "基因编辑/生物技术" }, { v: "uav", label: "无人机/反无人机技术" },
  { v: "p3d", label: "3D 打印/增材制造" }, { v: "cnc", label: "高档数控机床" }, { v: "aero", label: "航空航天/燃气轮机" }, { v: "cf", label: "碳纤维/复合材料" },
  { v: "uhv", label: "特高压输变电" }, { v: "tcm", label: "中药饮片炮制/珍稀药材" }, { v: "0", label: "以上均不涉及" },
];
const S1C_OPTS = [
  { v: "ok", label: "已核对目录及三项清单，不在禁限范围" },
  { v: "lic", label: "涉限制出口内容，已取得或正在申办许可" },
  { v: "not", label: "尚未对照目录核对" },
  { v: "nolic", label: "涉限制出口内容且未申办许可" },
  { v: "ban", label: "涉禁止出口内容（一条红线）" },
];
const S2A_OPTS = [{ v: "b2c", label: "B2C 终端用户数据" }, { v: "b2b", label: "B2B 客户数据" }, { v: "hr", label: "跨境员工管理" }, { v: "ops", label: "跨境运维（境外远程访问境内系统）" }, { v: "rd", label: "跨境研发数据共享" }, { v: "0", label: "均不涉及" }];
const S2C_OPTS = [
  { v: "a", label: "不涉及数据出境" },
  { v: "a2", label: "已完成数据出境安全评估等法定路径" },
  { v: "b", label: "未达申报门槛，已按标准合同备案/保护认证" },
  { v: "b2", label: "未达申报门槛，尚未作出合规路径安排" },
  { v: "c", label: "达到申报门槛尚未申报" },
];
const S3_OPTS = [
  { v: "ic", label: "集成电路与半导体设备" }, { v: "min", label: "关键矿产与稀土" }, { v: "bat", label: "新能源电池与材料" }, { v: "biomed", label: "生物医药与医疗器械" },
  { v: "eq", label: "高端装备与数控机床" }, { v: "sw", label: "基础软件与工业软件" }, { v: "aero", label: "航空航天与燃气轮机" }, { v: "net", label: "通信与网络设备" },
  { v: "pw", label: "特高压输变电与能源装备" }, { v: "mat", label: "碳纤维等关键新材料" }, { v: "0", label: "均不属于" },
];
const Q53_OPTS = [{ v: "a", label: "已了解并完成初步评估" }, { v: "b", label: "初步了解" }, { v: "c", label: "尚未了解" }];
const Q54_OPTS = [{ v: "a", label: "已取得（商务部《对外投资合作国别（地区）指南》、中国信保《国家风险分析报告》评级、外交部领事提醒等）" }, { v: "b", label: "尚未取得" }];
