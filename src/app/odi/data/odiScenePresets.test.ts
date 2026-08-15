import { describe, it, expect } from "vitest";
import { SCENE_PRESETS, applyPreset } from "./odiScenePresets";
import { allFieldDefs } from "../field/odiFieldCatalog";
import { emptyField } from "./types";

describe("scene presets", () => {
  it("三场景都有预设值对象", () => {
    expect(SCENE_PRESETS["新设独资"]).toBeDefined();
    expect(SCENE_PRESETS["并购"]).toBeDefined();
    expect(SCENE_PRESETS["增资变更"]).toBeDefined();
  });
  it("applyPreset 把预设写入池(新设独资:越南/800万)", () => {
    const pool = allFieldDefs().map(d => emptyField(d.code, d.name, d.round, d.dept));
    const filled = applyPreset(pool, "新设独资");
    const get = (c: string) => filled.find(f => f.code === c)?.value;
    expect(get("investment_country")).toBe("越南");
    expect(get("investment_total")).toContain("800");
  });
});
