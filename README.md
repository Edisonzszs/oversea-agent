# 出海合规智能体平台（ODI 单独平台）

面向企业境外投资（ODI）合规场景的智能体平台 POC。React 18 + TypeScript + Vite 6，无后端数据库（localStorage mock），AI 能力经服务端代理调用 DeepSeek。

## 功能模块

| 模块 | 说明 |
|---|---|
| **小海问答** | 出海合规问答助手（首页默认） |
| **ODI 工作台** | 境外投资备案流程工作台 |
| **合规自查专家** | 双版本：**速测版**（匿名 10-15min，就低判档 A/B/C/D）+ **完整版**（登录 40-60min，上传/齐备度/加权/PDF 报告） |
| **登录** | POC mock（手机号+验证码 / 法人一证通），localStorage 持久化 |

### 合规自查专家结构

```
首页 → 企业合规自查专家项目空间 → 新建 → 版本选择弹窗
  ├─ 速测版（无需登录）：使用说明 → 模块〇企业画像 → 模块一~五 → 自查报告（判档+升级入口）
  └─ 完整版（需登录）：NewComplianceProjectModal → 模块〇~五向导 + 右侧小海伴填 + 齐备度/PDF
```

判档规则：`worst()` 就低原则（A<B<C<D），信息项（I）不参与；敏感行业→核准路径、禁止类→D 档。

## 快速开始

```bash
npm i            # 若网络受限使用镜像: npm i --registry=https://registry.npmmirror.com
npm run dev      # 开发服务器（vite，base=/chuhai-test/）
npm test         # vitest（50 例）
npm run build    # 构建（注意: outDir 配置为 dist-prod，见 vite.config.ts 注释）
```

## 环境变量（不入库）

`src/server/copilot.ts` 在 dev server 上注册 `/api/copilot/*` 代理，需要 `.env`：

```ini
DEEPSEEK_API_KEY=sk-xxx        # 仅服务端使用，严禁加 VITE_ 前缀
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

无 `.env` 时前端界面/自查流程/判档/报告全部可用，仅小海 AI 对话无响应。

## 部署

- 生产：`vite build` → 产物拷至服务器，nginx `location /chuhai-test/` + `/api/copilot/` 反代 127.0.0.1:3100
- 线上实例：`http://106.14.220.128/chuhai-test/`

## 目录导览

```
src/
  main.tsx              # 入口
  server/copilot.ts     # copilot 代理（DeepSeek，服务端 only）
  app/
    App.tsx             # 模式路由（xiaohai/odi/compliance/login）
    auth/useAuth.ts     # 登录态 hook（localStorage mock）
    components/         # 平台外壳（顶栏/侧栏/登录页/版本弹窗…）
    quicktest/          # 速测版（questions 题库 / grade 判档 / Wizard / Report）
    compliance/         # 完整版（向导/判分/报告/copilot 面板）
    odi/                # ODI 工作台
docs/superpowers/       # 设计 specs 与实施 plans
```

## 安全红线

- DeepSeek API key 仅存在于服务端 `.env`（已 gitignore），永不进前端包
- 登录为 POC mock，不接真实凭证、无真实网络请求
