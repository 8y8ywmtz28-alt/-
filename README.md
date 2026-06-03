# Local Image Studio

一个本地即可运行的 GPT 图片工作台。它把聊天式图片创作、图生图/改图、批量生成、本地队列、历史图库和 API Key 初始化向导放在同一个 Next.js 产品界面里。默认使用 SQLite + Prisma，不需要 Redis，不需要额外服务，适合直接在 VSCode 终端里启动。

> 说明：OpenAI 官方文档当前公开列出的 GPT Image 模型包含 `gpt-image-1.5`、`gpt-image-1`、`gpt-image-1-mini` 等。项目默认使用 `gpt-image-1.5`，如果你的账号已开放 `gpt-image-2`，可以在设置页或 `.env` 中把图片模型改成 `gpt-image-2`。

## 功能列表

- 文生图：`/api/images/generate`
- 图生图 / 改图：`/api/images/edit`
- 多轮连续改图：`/api/images/chat`
- Responses API + `image_generation` tool 的聊天式图像工作流
- SQLite + Prisma 本地轻量队列
- 独立 worker 进程消费任务
- 任务状态：`queued`、`running`、`completed`、`failed`、`canceled`
- 任务取消、失败重试、队列日志
- 同 prompt 多张生成
- 多行 prompt 批量排队
- 批次归档与 batch 查看
- 1024、1536、2K、4K、auto 分辨率预设
- low / medium / high / auto 画质
- png / jpeg / webp 输出格式
- 首次启动 `/setup` 一键配置 API Key
- 本地保存生成图、上传图、编辑图
- 浅色 / 深色 Material You 风格主题
- 图片悬浮、下载、复制 prompt、继续编辑、引用历史图

## 技术栈

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- Material Design 3 / Material You 自定义设计语言
- Framer Motion
- Prisma + SQLite
- OpenAI Node SDK
- React Dropzone
- concurrently + tsx
- lucide-react
- zod

## 目录结构

```text
.
├─ app/
│  ├─ api/
│  │  ├─ batches/
│  │  ├─ history/
│  │  ├─ images/
│  │  │  ├─ chat/
│  │  │  ├─ edit/
│  │  │  └─ generate/
│  │  ├─ queue/jobs/
│  │  ├─ settings/
│  │  └─ upload/
│  ├─ setup/
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ components/
│  ├─ setup/SetupWizard.tsx
│  └─ studio/StudioApp.tsx
├─ lib/
│  ├─ openai-executor.ts
│  ├─ openai.ts
│  ├─ prisma.ts
│  ├─ queue.ts
│  ├─ serializers.ts
│  ├─ settings.ts
│  ├─ storage.ts
│  └─ validation.ts
├─ prisma/schema.prisma
├─ public/
│  ├─ generated/
│  └─ uploads/
├─ scripts/setup.ts
├─ worker/index.ts
└─ package.json
```

## 安装步骤

```bash
npm install
npm run dev
```

`npm run dev` 会自动执行本地初始化，然后同时启动：

- Next.js 前端服务
- SQLite 队列 worker

默认访问地址：

```text
http://localhost:3000
```

## VSCode 中如何启动

1. 用 VSCode 打开本项目文件夹。
2. 打开 VSCode 自带终端。
3. 执行：

```bash
npm install
npm run dev
```

第一次运行时，如果没有检测到 `OPENAI_API_KEY`，首页会自动跳转到：

```text
http://localhost:3000/setup
```

## 首次配置 API Key

项目读取 API Key 的优先级：

1. 环境变量 `OPENAI_API_KEY`
2. 本地 SQLite 数据库里的设置项

推荐个人本地使用方式：

1. 运行 `npm run dev`
2. 打开 `/setup`
3. 输入 OpenAI API Key
4. 点击“测试连接”
5. 点击“保存并进入”

你也可以创建 `.env`：

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=sk-your-key
OPENAI_IMAGE_MODEL=gpt-image-1.5
OPENAI_RESPONSES_MODEL=gpt-5
```

如果你确认账号已支持 `gpt-image-2`：

```env
OPENAI_IMAGE_MODEL=gpt-image-2
```

## 如何使用文生图

1. 选择左侧“文生图”。
2. 输入 prompt。
3. 选择分辨率、画质、输出格式。
4. 点击“加入生成队列”。
5. worker 完成后，图片会出现在中间画布和右侧历史图库。

## 如何使用图生图

1. 选择“图生图”。
2. 拖拽或点击上传参考图。
3. 输入你希望修改的内容。
4. 点击“加入生成队列”。
5. 生成结果会保留原图引用，并写入历史图库。

## 如何使用多轮聊天式改图

1. 选择“连续改图”。
2. 引用一张历史图，或上传一张参考图。
3. 输入修改指令，例如“保持构图，把背景换成夜晚城市”。
4. 点击“加入生成队列”。
5. 后续继续输入新的修改指令，项目会用 Responses API 的上下文继续处理。

## 如何使用批量生成

1. 选择“批量”。
2. 在多行输入框里输入 prompt，每行一条。
3. 设置“每条张数”。
4. 点击“加入生成队列”。
5. 每条 prompt 会生成独立任务，并归档到同一 batch。

## 如何查看队列状态

点击顶部“队列”按钮打开抽屉。你可以看到：

- 排队中数量
- 运行中数量
- 已完成数量
- 每个任务的 prompt、状态、日志、错误
- 取消任务
- 失败任务重试

worker 默认每 1.2 秒轮询 SQLite。并发数可在设置里选择 1 到 3。

## 如何切换分辨率与质量

左侧控制区提供：

- `1024x1024`
- `1536x1024`
- `1024x1536`
- `2048x2048`
- `2048x1152`
- `3840x2160`
- `2160x3840`
- `auto`

画质：

- `low`
- `medium`
- `high`
- `auto`

输出格式：

- `png`
- `jpeg`
- `webp`

4K 与部分 2K 输出属于实验性选项。若当前模型不支持，任务会失败并在队列日志中显示 API 错误。你可以切回 `1024x1024`、`1536x1024`、`1024x1536` 或 `auto`。

## 如何查看历史图库

右侧“历史图库”会显示：

- 上传参考图
- 文生图结果
- 改图结果
- 聊天式改图结果
- 批量生成结果

图片卡片支持：

- 下载
- 复制 prompt
- 继续编辑
- 引用历史图再次创作

## 本地文件存储

生成图片保存到：

```text
public/generated/yyyy-mm-dd/
```

上传图片保存到：

```text
public/uploads/yyyy-mm-dd/
```

文件名使用时间戳 + 随机串，避免冲突。数据库会保存 URL、文件路径、prompt、参数、batch、conversation、job 等信息。

## 数据库结构

Prisma schema 至少包含：

- `Setting`
- `GenerationJob`
- `GenerationBatch`
- `ImageAsset`
- `Conversation`
- `ConversationMessage`
- `QueueLog`

本项目为了保证 Windows + VSCode 本地启动稳定，`npm run setup` 会先执行 `prisma generate`，再用 Node 24 内置 SQLite 初始化表结构，然后继续用 Prisma Client 读写数据。

## npm 脚本

```bash
npm run dev
npm run build
npm run lint
npm run worker
npm run prisma:generate
npm run prisma:migrate
npm run setup
```

说明：

- `npm run dev`：初始化数据库，并同时启动 web + worker
- `npm run worker`：只启动队列 worker
- `npm run setup`：生成 Prisma Client，初始化 SQLite 表，写入默认设置
- `npm run prisma:migrate`：执行本地 SQLite 表结构初始化

## 常见报错与解决方法

### 1. 缺少 OPENAI_API_KEY

打开 `/setup` 输入 API Key，或在 `.env` 中写入：

```env
OPENAI_API_KEY=sk-your-key
```

### 2. 模型不支持某个分辨率

切换为：

- `1024x1024`
- `1536x1024`
- `1024x1536`
- `auto`

或者在设置中切换到你账号支持的图像模型。

### 3. 任务一直 queued

确认 `npm run dev` 是否同时启动了 worker。终端里应该看到 worker 进程输出。

也可以单独运行：

```bash
npm run worker
```

### 4. API Key 测试失败

检查：

- Key 是否完整
- 当前网络是否能访问 OpenAI API
- 账号是否有对应模型权限

### 5. 端口占用

Next.js 默认使用 3000。若端口占用，可以手动运行：

```bash
npx next dev -p 3001
```

## 生产环境可选升级方案

默认版本面向本地低门槛运行，不依赖 Redis。生产环境可以考虑：

- Redis + BullMQ 替换 SQLite 队列
- S3 / R2 / OSS 替换 `public/generated`
- 用户登录与多租户隔离
- API Key 加密存储
- 后台任务限流与配额
- WebSocket / SSE 实时推送队列状态
- CDN 图片分发
- 审计日志与管理员面板

## 截图占位说明

你可以在 README 后续加入截图：

```text
docs/screenshots/workspace.png
docs/screenshots/setup.png
docs/screenshots/queue.png
docs/screenshots/gallery.png
```

建议截图：

- 首页三栏工作台
- `/setup` 初始化向导
- 队列抽屉
- 历史图库悬浮操作

## 如何构建生产版本

```bash
npm run build
npm start
```

生产启动前建议先执行：

```bash
npm run setup
```

## 如何在本地测试

```bash
npm run setup
npm run lint
npm run build
npm run dev
```

无 API Key 时可以测试：

- `/setup` 页面
- 设置保存
- UI 主题切换
- 上传图片到本地
- 队列页面空状态

配置 API Key 后可以测试：

- 文生图
- 图生图
- 连续改图
- 批量生成
- 取消与重试
