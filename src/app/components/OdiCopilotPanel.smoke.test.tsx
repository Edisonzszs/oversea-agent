import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { OdiCopilotPanel } from "./OdiCopilotPanel";

const stripSsrComments = (html: string) => html.replace(/<!--\s*-->/g, "");

describe("OdiCopilotPanel (smoke)", () => {
  it("is a renderable component function", () => {
    expect(typeof OdiCopilotPanel).toBe("function");
  });

  it("renders the 小海·ODI 伴填 header + greeting + input in expanded mode", () => {
    const html = stripSsrComments(
      renderToString(
        <OdiCopilotPanel
          collapsed={false}
          onToggleCollapse={() => {}}
          context={{ projectId: "p1", projectName: "越南新设项目" }}
        />
      )
    );
    expect(html).toContain("小海·ODI 伴填");
    expect(html).toContain("ODI 备案伴填助手");
    expect(html).toContain("越南新设项目");
    expect(html).toContain("Enter 发送");
    // 输入框 placeholder(ODI 语境)
    expect(html).toContain("口径");
  });

  it("renders a collapsed floating button (no chat body)", () => {
    const html = stripSsrComments(
      renderToString(<OdiCopilotPanel collapsed onToggleCollapse={() => {}} />)
    );
    // 收起态:有展开按钮 title,不渲染输入区
    expect(html).toContain("展开小海·ODI 伴填");
    expect(html).not.toContain("Enter 发送");
  });
});
