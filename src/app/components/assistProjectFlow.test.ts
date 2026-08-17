import { describe, it, expect } from "vitest";
import {
  guessMaterialMeta,
  progressFromStatus,
  statusAfterValidation,
  seedAssistFieldPool,
} from "./odiProjectData";
import { validateOdiFull } from "../odi/validation/odiNdrcRules";

function totals(pool: ReturnType<typeof seedAssistFieldPool>) {
  const r = validateOdiFull(pool);
  const sum = (k: "passed" | "failed" | "missing") => r.summaries.reduce((n, s) => n + s[k], 0);
  return { passed: sum("passed"), failed: sum("failed"), missing: sum("missing") };
}

describe("guessMaterialMeta — 材料按文件名归类", () => {
  it("识别常见 ODI 材料类型与部门范围", () => {
    expect(guessMaterialMeta("境外投资备案申请表.pdf")).toEqual({ type: "政府申报表", scope: "商务委" });
    expect(guessMaterialMeta("境外投资真实性承诺书.pdf")).toEqual({ type: "合规承诺文件", scope: "商务委+发改委" });
    expect(guessMaterialMeta("企业营业执照副本.pdf")).toEqual({ type: "证照文件", scope: "商务委+发改委" });
    expect(guessMaterialMeta("审计报告及财务报表.pdf")).toEqual({ type: "财务报表", scope: "发改委" });
    expect(guessMaterialMeta("董事会决议.pdf")).toEqual({ type: "企业内部文件", scope: "商务委+发改委" });
    expect(guessMaterialMeta("银行存款证明.pdf")).toEqual({ type: "资金证明文件", scope: "发改委" });
    expect(guessMaterialMeta("可行性研究报告.pdf")).toEqual({ type: "企业内部文件", scope: "发改委" });
  });
  it("未命中关键词归为其他材料", () => {
    expect(guessMaterialMeta("其他说明.zip")).toEqual({ type: "其他材料", scope: "商务委+发改委" });
  });
});

describe("statusAfterValidation — 校验落库状态", () => {
  it("有问题 → 待处理；全通过 → 已完成", () => {
    expect(statusAfterValidation(1, 2)).toBe("待处理");
    expect(statusAfterValidation(0, 1)).toBe("待处理");
    expect(statusAfterValidation(0, 0)).toBe("已完成");
  });
});

describe("progressFromStatus — 五步办理进度推导", () => {
  it("五种状态均产出 5 步且首步 done", () => {
    for (const s of ["待上传材料", "待校验", "材料校验中", "待处理", "已完成"] as const) {
      const steps = progressFromStatus(s);
      expect(steps).toHaveLength(5);
      expect(steps[0]).toBe("done");
    }
  });
  it("各状态落点正确（原先写死 done,done,done,current,pending）", () => {
    expect(progressFromStatus("待上传材料")).toEqual(["done", "current", "pending", "pending", "pending"]);
    expect(progressFromStatus("待校验")).toEqual(["done", "done", "current", "pending", "pending"]);
    expect(progressFromStatus("材料校验中")).toEqual(["done", "done", "current", "pending", "pending"]);
    expect(progressFromStatus("待处理")).toEqual(["done", "done", "done", "issue", "pending"]);
    expect(progressFromStatus("已完成")).toEqual(["done", "done", "done", "done", "done"]);
  });
});

describe("seedAssistFieldPool — 助办演示字段池", () => {
  it("注入问题池：2 不通过 + 2 缺失（与 mock p1 计数口径一致,P2 含 NDRC）", () => {
    const t = totals(seedAssistFieldPool(true));
    expect(t.failed).toBe(2);   // 商务线 regcap(注册资本900>800) + NDRC-A-006(USCC 执照≠备案表)
    expect(t.missing).toBe(2);  // 项目说明、境外企业名 → 发改委/跨业务缺失
    expect(t.passed).toBe(29);
  });
  it("干净池：全部通过（与 mock p3 计数口径一致,P2 含 NDRC 8 条）", () => {
    const t = totals(seedAssistFieldPool(false));
    expect(t.failed).toBe(0);
    expect(t.missing).toBe(0);
    expect(t.passed).toBe(33);
  });
});
