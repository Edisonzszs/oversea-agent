// ODI 项目 mock 列表 + 工厂(Task 4 + Task 7)。
// createGuideProject / createAssistProject 把统一字段池初始化为【空值池】:
//   allFieldDefs().map(d => emptyField(d.code, d.name, d.round, d.dept))
// Task 7:createGuideProject 新增可选第三参 mode:
//   - "快速体验":建空池后立即 applyPreset(pool, scene),返回预填池(R1-R6 示例值)。
//   - 不传 / "自定义体验":保持空池(向后兼容,Task 4 现有调用点不需改)。
// mode 选择器 UI + 把 mode 传给 createGuideProject 的接线,留给 Task 10。
// 类型直接 import(新模块内部无与旧 OdiProject 的同名冲突,故不用别名)。

import type { OdiProject, OdiScene } from "./types";
import { allFieldDefs } from "../field/odiFieldCatalog";
import { emptyField } from "./types";
import { applyPreset } from "./odiScenePresets";

/** 填表演示(guide):按场景建一个引导填报任务。
 *  mode="快速体验" 时把场景预设写入空池;默认(不传/"自定义体验")保持空池。 */
export function createGuideProject(
  name: string,
  scene: OdiScene,
  mode?: "快速体验" | "自定义体验",
): OdiProject {
  const emptyPool = allFieldDefs().map(def => emptyField(def.code, def.name, def.round, def.dept));
  const pool = mode === "快速体验" ? applyPreset(emptyPool, scene) : emptyPool;
  return {
    id: `o${Date.now()}`,
    name,
    service: "guide",
    scene,
    fieldPool: pool,
    uploadedFiles: [],
    validation: null,
    generatedDocs: [],
    status: "填报中",
    updatedAt: "刚刚",
  };
}

/** 申报助办(assist):建一个空字段池的上传校验任务。 */
export function createAssistProject(name: string): OdiProject {
  const pool = allFieldDefs().map(def => emptyField(def.code, def.name, def.round, def.dept));
  return {
    id: `o${Date.now()}`,
    name,
    service: "assist",
    fieldPool: pool,
    uploadedFiles: [],
    validation: null,
    generatedDocs: [],
    status: "待上传材料",
    updatedAt: "刚刚",
  };
}

/** mock 列表:工作台演示用 3 条(供 App.tsx odiProjects state 初值)。
 *  两条 guide(快速体验=预填池,展示进度/路径图)+ 一条 assist(空池,待上传)。 */
export const MOCK_ODI_PROJECTS_NEW: OdiProject[] = [
  { ...createGuideProject("越南新设智能装备生产基地(示例)", "新设独资", "快速体验"), id: "o-demo-vn" },
  { ...createGuideProject("德国并购工业设备制造商(示例)", "并购", "快速体验"), id: "o-demo-de", updatedAt: "昨天" },
  { ...createAssistProject("新加坡设立子公司(助办)"), id: "o-assist-sg", updatedAt: "2 天前" },
];
