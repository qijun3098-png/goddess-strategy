# 女神攻略——从屌丝到海王的逆袭

移动端优先的 AI 虚拟女友聊天游戏。包含邮箱注册登录、四位成年角色、文本对话、参考图自拍生成、TTS 语音和浏览器本地存档。

## 本地运行

1. 复制 `.env.example` 为 `.env.local`
2. 在 `.env.local` 填入服务端 API Key、目标分支的 Neon Postgres/Auth 变量，并生成 `NEON_AUTH_COOKIE_SECRET`
3. 安装依赖：`pnpm install`
4. 启动：`pnpm dev`

使用独立开发分支且不希望覆盖 `.env.local` 时：

```bash
neon env pull --branch <branch> --file .env.auth-dev -s postgres -s auth
pnpm dev:auth
```

`dev:auth` 只读取被 Git 忽略的 `.env.auth-dev`，并为本次本地进程生成临时 Cookie Secret；重启后已有本地会话会失效。正式部署必须设置稳定、随机且至少 32 字符的 `NEON_AUTH_COOKIE_SECRET`。

未配置 API Key 时，聊天接口会进入本地演示模式；图片和语音会提示尚未配置服务。

## 每日情话定时任务

在 `.env.local` 配置 `CRON_SECRET`，重启本地服务后，通过 `GET /api/cron/daily-email` 调用任务；请求头必须包含 `Authorization: Bearer <CRON_SECRET>`。密钥只放在私密环境配置中，不提交到 Git。

线上需在部署平台的生产环境中单独配置 `CRON_SECRET` 并重新部署。cron-job.org 使用相同的线上密钥，任务 URL 为 `https://goddess-strategy.vercel.app/api/cron/daily-email`。

目前只实现任务入口和鉴权，`src/lib/email.ts` 中的发送函数等待后续接入。密钥未配置或邮件服务未接入时返回 503，鉴权失败返回 401。邮件服务接入并验证完成后再启用定时任务。

## 安全

- 所有第三方 AI 请求均由 Next.js Route Handler 发起。
- 邮箱密码、会话和验证码由 Neon Managed Better Auth 管理，不写入 `public.users`。
- 游戏页和生成 API 都会在服务端校验会话。
- API Key 不得添加 `NEXT_PUBLIC_` 前缀。
- `.env*` 已默认忽略，仅 `.env.example` 可提交。
