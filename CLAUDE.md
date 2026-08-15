# CLAUDE.md — 出海合规智能体平台 · 工作流程手册

> 本文件给后续 Claude 会话读：本地开发 → GitHub 管理 → 部署上线的完整流程与已知坑。
> 项目目录：`E:\claude\出海智能体-合规\出海智能体设计 (最新版-ODI单独平台)`

## 一、项目一句话

React 18 + TypeScript + Vite 6 高保真 POC（无数据库，localStorage mock），面向企业境外投资（ODI）合规场景。核心模块：小海问答 / ODI 工作台 / 合规自查专家（速测版 + 登录完整版双版本）/ 登录（mock）。

## 二、本地开发

```bash
npm i --registry=https://registry.npmmirror.com   # 必须 npmmirror 镜像
npm run dev      # vite dev，base=/chuhai-test/，含 /api/copilot/* dev 中间件
npm test         # vitest（当前 50 例），改动后必跑
npm run build    # vite build → outDir=dist-prod（不是 dist！见坑①）
```

- **dev server 命令行注意**：Git Bash 会把 `--base /chuhai-test/` 误转成 Windows 路径，**用 PowerShell 起**：`npx vite "--base=/chuhai-test/" --port 5173 --strictPort`；或直接 `npm run dev`（vite.config.ts 已配 base）。
- **`.env`**（gitignored，绝不入库）：`DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL`。无它则界面/自查/判档/报告全可用，仅小海 AI 对话无响应。key 只在服务端，**严禁加 `VITE_` 前缀**（会打进前端包）。
- **UI 验证**用 gstack `/browse`（headless browser），选项是 `<label onClick>` 的用 @c ref 或 js querySelectorAll 点击，别用中文关键字定位。
- **无 tsconfig**（esbuild transpile-only），类型错误不挡构建，靠 vitest + browse 把关。

### 已知环境坑

| # | 坑 | 处置 |
|---|---|---|
| ① | E 盘 exFAT 曾损坏 `dist/` 目录项（delete/rename 报 access denied） | build outDir 固定为 `dist-prod`（vite.config.ts 注释有说明），勿改回 dist |
| ② | E 盘偶发掉盘（errno -4094） | `Get-PSDrive` 查 E: 是否在；重连后文件都在，重启 dev server 即可 |
| ③ | 根目录堆了 20+ 个历史 `dist-*` 构建目录 | 全部已 gitignore（`dist-*/`），别误提交 |
| ④ | 本机网络对 `github.com:443` 间歇不可达（`api.github.com` 正常，gh 命令不受影响） | git push 报 connect timeout 时：remote 已配 ssh 备用协议 `git@github.com:Edisonzszs/oversea-agent.git`，等几分钟重试或直接 `git push`（当前 remote 即 ssh）；https 失效时可 `git remote set-url origin git@github.com:Edisonzszs/oversea-agent.git` |

## 三、GitHub 版本管理

- **仓库**：https://github.com/Edisonzszs/oversea-agent（`gh` 已登录 Edisonzszs，git 身份已配；remote 用 **ssh 协议** `git@github.com:Edisonzszs/oversea-agent.git`，见坑④）
- **分支**：`main` = 最新源码。日常：`git add -A && git commit -m "feat: xxx" && git push`
- **版本下载**（每种只有两种，**不出便携版**——用户已确认）：
  - `chuhai-deploy-*.zip` —— 服务器部署包（Release 附件）
  - Source code (zip) —— GitHub 自动生成的源码
- **红线**：`.env` / `*.pem` / `node_modules` / `dist-*` 已 gitignore；提交前 `git status` 确认无 .env

### 发版（每个可交付节点做一次）

```bash
./release.sh v20260901 "版本标题"          # 在项目根执行
```

脚本自动：① 检查工作区干净且已 push（脏则退出）→ ② `npm run build` → ③ 打 tag + 建 GitHub Release + 挂 `chuhai-deploy-20260901.zip`（ASCII 文件名，**别用中文文件名传 GitHub 资产，会被转成乱码点号**）→ ④ 输出 Release 链接。

任一历史版本从 https://github.com/Edisonzszs/oversea-agent/releases 下载。
现有 Release：`v20260815`（速测版+登录双版本首版；附 `chuhai-server-20260811-legacy.zip` = git 之前线上历史产物归档，无对应源码）。

## 四、部署上线

### 服务器信息

| 项 | 值 |
|---|---|
| 主机 | `106.14.220.128`（阿里云） |
| SSH | `ssh -i C:/Users/SHData/.ssh/aliyun-524.pem -p 22 root@106.14.220.128` |
| Web 根 | `/opt/chuhai-test/dist/`（nginx alias） |
| 访问入口 | `http://106.14.220.128:957/chuhai-test/`（nginx listen **957**，不是 80） |
| AI 后端 | `server.js`（Node，pm2 守护，名 `chuhai-copilot`，端口 3100，仅本机） |
| nginx 配置 | `/etc/nginx/conf.d/chuhai-test.conf`（`/chuhai-test/`→dist、`/api/copilot/`→127.0.0.1:3100、`/api/taxiq/`、`/api/deepseek/` 直连代理） |

### 部署步骤（发新版）

```bash
# 1. 本地构建并上传（PowerShell/bash 皆可）
npm run build                                   # 产物在 dist-prod/
scp -i C:/Users/SHData/.ssh/aliyun-524.pem -P 22 -r dist-prod/* root@106.14.220.128:/opt/chuhai-test/dist-new/

# 2. 服务器上原子切换（先备份旧版）
ssh -i C:/Users/SHData/.ssh/aliyun-524.pem root@106.14.220.128
cd /opt/chuhai-test
mv dist dist-bak-$(date +%s)        # 服务器上已有多个 dist-bak-*，是历史备份
mv dist-new dist
# 无需 reload nginx（纯静态文件）；浏览器端 Ctrl+F5 强刷（文件名带 hash，一般自动生效）

# 3. 验证
curl -s http://106.14.220.128:957/chuhai-test/ | head -5
```

### AI 后端（server.js）说明

- 部署在 `/opt/chuhai-test/server.js`，pm2 进程名 `chuhai-copilot`（`pm2 list` 查看 / `pm2 restart chuhai-copilot` 重启）
- **修改后重启**：`pm2 restart chuhai-copilot`
- 它是本地 `src/server/copilot.ts` 的独立 Node 版（dev 时 vite 中间件、线上 pm2），**两处逻辑改动要同步**
- 注意：server.js 内有 fallback 硬编码 key（历史遗留），线上环境变量优先；改动时别把 key 写进任何会提交的文件

## 五、速查：一次完整迭代

```
改代码 → npm test（50 例全过）→ /browse 验证 UI
  → git add -A && git commit -m "feat: xxx" && git push
  → 需要交付时: ./release.sh vYYYYMMDD "标题"
  → 需要上线时: npm run build → scp → 服务器 mv 切换 → curl 验证
```

## 六、历史背景（防止误判）

- 2026-08-11 之前线上跑的版本无源码快照（当时还没 git），只剩构建产物（本地 `dist-prod2/` 与线上 MD5 一致，已归档为 Release 里的 legacy 包）。**main 上的源码比 0811 线上版新**（含速测版、登录页、双版本弹窗）。
- 平台内"登录"是 POC mock（localStorage `chuhai_auth_user`），不接真实凭证。
- 速测版题库源：`E:\claude\出海智能体-合规\20260813交付稿\...简化版（匿名快闪版）-v1.html`；界面照该 HTML 政务皮肤（navy #00355F、宋体）。
