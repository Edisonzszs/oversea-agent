import { describe, it, expect } from "vitest";
import { ComplianceCopilotPanel } from "./ComplianceCopilotPanel";

describe("ComplianceCopilotPanel (smoke)", () => {
  it("is a renderable component function", () => {
    expect(typeof ComplianceCopilotPanel).toBe("function");
  });
});
