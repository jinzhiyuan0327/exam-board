# 考试看板 Exam Board

独立部署的考试大屏 + 管理后台，基于 React + Vite + Vercel Serverless。

## 功能
- 🖥️ **考试大屏**：全屏深色大时钟 + 实时倒计时 + 进度条 + 开考提醒
- ⚙️ **管理后台**：添加/编辑/排序/导入考试科目，一键同步到服务器
- 🕐 **网络校时**：自动通过 `/api/time` 校准时钟
- 🔔 **统一提醒**：五种设计各自匹配的全屏提醒浮层，支持自定义提醒
- 🛠️ **系统设置**：集中管理校时、默认设计、提醒与关于（内置 README）
- 📡 **实时同步**：大屏每 30 秒自动拉取最新考试数据

## 目录结构
```
├── api/                 # Vercel Serverless Functions
│   ├── exams.ts         # 考试数据读写
│   ├── login.ts         # 管理员登录
│   ├── time.ts          # 服务器时间
│   └── _auth.ts         # 鉴权工具
├── src/
│   ├── pages/           # 页面组件
│   │   ├── ExamPage.tsx     # 考试大屏
│   │   ├── AdminPage.tsx    # 管理后台
│   │   └── WelcomePage.tsx  # 首页
│   ├── hooks/           # React Hooks
│   ├── services/        # 接口服务
│   ├── utils/           # 工具函数（时间、校时、设置）
│   ├── styles/          # CSS 样式
│   └── types/           # TypeScript 类型
├── index.html
├── vite.config.ts
├── vercel.json
└── package.json
```

## 快速部署（Vercel，推荐：直接导入作者仓库）

> 推荐客户端部署时直接导入作者仓库 **`jinzhiyuan0327/exam-board`**（而非 Fork 到自己名下）。这样作者每次更新仓库时，Vercel 会自动重新构建部署，客户端无需任何 GitHub 操作，刷新网页即为新版本。

1. **登录 Vercel**（用 GitHub 账号登录，如首次使用需授权 Vercel 访问 GitHub）。
2. **新建项目**：Dashboard 右上角 **Add New… → Project**。
3. **导入作者仓库 `jinzhiyuan0327/exam-board`**：
   - 直接在顶部导航栏粘贴仓库地址 `https://github.com/jinzhiyuan0327/exam-board` 导入
   - **请勿 Fork 到自己仓库**；Fork 后作者的更新不会自动同步到你的 Fork。
4. **保持构建设置默认**：Framework 会自动识别为 **Vite**，Build Command / Output Directory 无需修改。
5. **设置环境变量（展开 Environment Variables，仅两个）**：
   - `DATABASE_URL` — Neon Postgres 连接串（必填）
   - `ADMIN_PASSWORD` — 管理端登录密码（必填；留空则免登录）
6. **点 Deploy**，等待构建完成后访问分配的域名即可使用。

### 后续更新（自动）
作者向 `jinzhiyuan0327/exam-board` 的 `main` 分支 push 新代码后，所有导入了该仓库的 Vercel 项目会**自动重新部署**，客户端无需处理；约 1–3 分钟后刷新网页即为新版本。若你是 Fork 自行维护的客户端，则需自行合并更新，或在设置页「🚀 版本与更新」点「一键重新部署」（需先配置 `VERCEL_DEPLOY_HOOK_URL`）。

> （自行维护代码时）：Fork 或上传本仓库到自己的 GitHub → 在 Vercel 导入自己的仓库 → 同样只需配 `DATABASE_URL` + `ADMIN_PASSWORD`。

## 本地开发

```bash
npm install
npm run dev
```

## 路由
- `/` — 首页（模式选择）
- `/exam` — 考试大屏
- `/admin` — 管理后台

## 数据持久化说明

本项目已接入 **Neon Postgres**，考试数据不会因 Vercel Serverless 冷启动、重新部署或实例切换而丢失。

### 数据存储方式

- 考试安排、科目/专业分组及后台维护的数据由 Vercel Serverless API 写入 Neon Postgres。
- 前端通过 `/api/exams` 读取和保存数据；考试大屏会定时同步服务端最新数据。
- 首次访问数据库时，服务端会自动检查并按需创建或迁移所需表结构，无需手动执行 SQL。
- 数据库客户端与迁移任务在同一个热 Serverless 实例内会被缓存：正常请求直接查询或更新数据，不会重复执行建表操作，从而减少跨区域数据库访问延迟。

## 导入考试数据格式

```json
[
  {
    "name": "语文",
    "startTime": "2026-06-07T09:00:00",
    "endTime": "2026-06-07T11:30:00",
    "enabled": true
  },
  {
    "name": "数学",
    "startTime": "2026-06-07T15:00:00",
    "endTime": "2026-06-07T17:00:00",
    "enabled": true
  }
]
```

## 使用遥测（匿名）

本应用内置匿名部署/运行遥测，用于作者统一掌握多方部署情况：

- **首次运行需同意**：首次打开会弹出数据收集须知，**不同意则无法使用**；同意后可随时在「系统设置 → 使用遥测」中暂停上报。
- **上报内容**：实例标识、版本、主机名、时区、语言、大致地区、匿名化 IP 哈希；**不含任何考试内容或个人身份信息**。
- **密钥内嵌**：收集器地址与上报密钥已内嵌在服务端函数 `api/telemetry.ts` 中（不会下发到浏览器）。**部署者仅需配置 `DATABASE_URL` 与 `ADMIN_PASSWORD`。**
- **数据流向**：浏览器 → 本实例 `/api/telemetry`（服务端补全地区/IP 哈希）→ 收集器 `https://telemetry.pikachu2026.space/api/collect`。


## 环境变量（部署配置）

考试看板在 Vercel 部署时可配置以下环境变量：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | Neon Postgres 连接串 |
| `ADMIN_PASSWORD` | 是 | 管理端登录密码（留空则免登录） |
| `TOKEN_SECRET` | 否（自动生成） | 令牌签名密钥。**无需客户端填写**，部署时由「后台密码 + 本项目生产域名」自动派生，同一项目内所有实例/多次重新部署保持一致；仅在需固定值时才显式设置以覆盖 |
| `VERCEL_DEPLOY_HOOK_URL` | 否 | Vercel Deploy Hook 地址；配置后可在「设置 → 版本与更新」一键拉取最新代码重新部署。生成路径：Vercel 项目 → Settings → Git → Deploy Hooks |
| `GITHUB_REPO` | 否 | 检查更新所用仓库，默认 `jinzhiyuan0327/exam-board`，格式 `owner/repo` |
| `GITHUB_TOKEN` | 否 | 提升 GitHub API 速率限制；私有仓库检查更新时必填 |

「检查更新」会读取 GitHub 仓库的最新 Release（无 Release 时回退到最大 tag），与当前构建版本做语义化版本比较；「一键拉取并重新部署」在配置了 `VERCEL_DEPLOY_HOOK_URL` 后触发 Vercel 从 GitHub 重新构建部署。
