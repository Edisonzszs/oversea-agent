/**
 * 出海智能体 Motion Tokens
 *
 * 动效设计原则：政务平台专业、稳定，用于解释层级和操作反馈，不做无意义装饰。
 * 所有动效均支持 prefers-reduced-motion 降级。
 *
 * 触发条件、时长、ease 和降级方式索引见下方注释。
 */

// ── 时长（ms）────────────────────────────────────────────────
export const DUR = {
  /** 按钮/图标微交互 */
  micro: 0.13,
  /** 星标收藏缩放序列 */
  star: 0.18,
  /** 侧边栏内容淡出/淡入 */
  sidebarFade: 0.14,
  /** 侧边栏 Flip 宽度过渡 */
  sidebarFlip: 0.26,
  /** 会话切换：旧内容淡出 */
  convOut: 0.12,
  /** 会话切换：新内容淡入 */
  convIn: 0.25,
  /** 搜索结果分层进入 */
  searchIn: 0.22,
  /** 搜索结果卡片 stagger 单项 */
  searchCard: 0.18,
  /** 文件卡片进入 */
  fileCard: 0.2,
  /** Tab 面板交叉淡化 */
  tabPanel: 0.18,
  /** 校验步骤切换 */
  step: 0.15,
  /** 生成完成勾选 */
  checkDone: 0.3,
  /** 窄屏/H5 缩减系数 */
  narrow: 0.6,
} as const;

// ── Eases ─────────────────────────────────────────────────────
export const EASE = {
  /** 通用进出（GSAP） */
  inOut: "power3.inOut",
  /** 元素进入（GSAP） */
  out: "power2.out",
  /** 元素退出（GSAP） */
  in: "power2.in",
  /** 星标弹性（GSAP，无强烈弹跳） */
  star: "back.out(1.4)",
} as const;

// ── CSS transition eases ──────────────────────────────────────
export const CSS_EASE = {
  /** 侧边栏展开/收起 CSS transition */
  inOut: "cubic-bezier(0.76, 0, 0.24, 1)",
} as const;

// ── 位移量（px）──────────────────────────────────────────────
export const DIST = {
  /** 搜索/会话结果进入 y 偏移 */
  entry: 7,
  /** 文件卡片进入 y 偏移 */
  fileEntry: 8,
} as const;

// ── Stagger 间隔 ──────────────────────────────────────────────
export const STAGGER = {
  /** 搜索结果卡片 stagger */
  searchCards: 0.05,
  /** 校验结果问题卡片 stagger */
  issueCards: 0.04,
} as const;

// ── gsap.matchMedia 降级 ─────────────────────────────────────
// 在 reduced-motion 环境下，所有位移 = 0，持续时间 ≤ 0.1s，移除 scale 动效。
// 使用方式：在 useGSAP 内部调用 gsap.matchMedia() 分支处理。

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** 根据 reduced-motion 返回实际时长 */
export function dur(base: number, reduced = false): number {
  return reduced ? Math.min(base, 0.08) : base;
}

/** 根据屏幕宽度缩减时长（<= 1024px 窄屏/H5） */
export function narrowDur(base: number): number {
  if (typeof window !== "undefined" && window.innerWidth <= 1024) {
    return base * DUR.narrow;
  }
  return base;
}
