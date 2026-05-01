# AI Image Studio (Next.js 15)

现代化图片生成网站，支持文生图与图生图/改图，技术栈：Next.js 15 App Router + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion + React Dropzone + OpenAI Node SDK。

## 功能
- 聊天式图片生成工作台
- 文生图 `/api/images/generate`
- 图生图/改图 `/api/images/edit`
- 参数控制：size / quality / output_format
- 生成历史画廊 + 下载 + 复制prompt + 继续编辑
- 服务端保存图片到 `public/generated`
- 完整错误处理（Key缺失、请求错误、失败提示）

## 安装
```bash
npm install
cp .env.example .env.local
# 填写 OPENAI_API_KEY
npm run dev
```

## 运行与构建
```bash
npm run lint
npm run build
npm start
```

## 部署
推荐部署到 Vercel：
1. 导入仓库
2. 设置环境变量 `OPENAI_API_KEY`
3. Build Command: `npm run build`
4. Start Command: `npm start`
