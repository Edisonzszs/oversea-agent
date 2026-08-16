// 弹窗 Esc 关闭 hook —— 挂载期间监听 Escape,触发 onClose。
// 支持嵌套弹窗:后挂载者先响应(栈序),用模块级计数器实现"只有最顶层弹窗吃掉 Esc"。

import { useEffect } from "react";

let escStack: ((() => void) | null)[] = [];

export function useEscapeClose(onClose: (() => void) | null) {
  useEffect(() => {
    if (!onClose) return;
    escStack.push(onClose);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const top = escStack[escStack.length - 1];
      top?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      escStack = escStack.filter(f => f !== onClose);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
}
