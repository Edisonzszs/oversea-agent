import { describe, it, expect } from "vitest";
import { emptyField, type OdiField } from "./types";

describe("ODI types", () => {
  it("emptyField 产出 status=empty、sources=[]、updatedAt=0 的空字段", () => {
    const f: OdiField = emptyField("investment_country", "投资国家", 1, "shared");
    expect(f.code).toBe("investment_country");
    expect(f.name).toBe("投资国家");
    expect(f.value).toBe("");
    expect(f.status).toBe("empty");
    expect(f.sources).toEqual([]);
    expect(f.round).toBe(1);
    expect(f.dept).toBe("shared");
    expect(f.updatedAt).toBe(0);
  });

  it("OdiField.status 可取 confirmed/conflict/missing 等", () => {
    const f = emptyField("x", "x", 1, "commerce");
    const confirmed: OdiField["status"] = "confirmed";
    const conflict: OdiField["status"] = "conflict";
    f.status = confirmed;
    expect(f.status).toBe("confirmed");
    f.status = conflict;
    expect(f.status).toBe("conflict");
  });
});
