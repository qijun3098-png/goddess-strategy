# 女神攻略——从屌丝到海王的逆袭

移动端优先的 AI 虚拟女友聊天游戏。包含邮箱注册登录、四位成年角色、文本对话、参考图自拍生成、TTS 语音和浏览器本地存档。

## 开发检查与账号存档

账号使用独立的本地聊天存档和媒体数据库。旧版未归属存档保留但不自动读取；这不包含跨设备同步。聊天发送失败可重试，失败提示不会作为角色回复加入 AI 上下文。

`pnpm test` 运行回归测试，`pnpm check` 执行完整自动检查，`pnpm acceptance` 启动独立 Codex 审查；`pnpm work:next` 现在执行已批准的验收任务。本机不配置凌晨任务。使用方法、Hook 信任步骤和限制见 [开发流程](docs/development-workflow.md)。

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

当前为 Resend 测试模式：必须在生产环境配置私密变量 `DAILY_EMAIL_TEST_RECIPIENT`，值为 Resend 账号邮箱。仅此邮箱会生成并接收每日邮件，其他用户计入 `skipped`，不调用 AI；变量留空时任务返回 503。验证自己的发件域名并调整发件人及收件人策略后，才能开放群发。

在 `.env.local` 配置 `CRON_SECRET`，重启本地服务后，通过 `GET /api/cron/daily-email` 调用任务；请求头必须包含 `Authorization: Bearer <CRON_SECRET>`。密钥只放在私密环境配置中，不提交到 Git。

线上需在部署平台的生产环境中单独配置 `CRON_SECRET` 并重新部署。cron-job.org 使用相同的线上密钥，任务 URL 为 `https://goddess-strategy.vercel.app/api/cron/daily-email`。

`src/lib/email.ts` 提供 `sendDailyLoveLetter(userEmail, userName)` 和 `sendDailyLoveLetterToAll()`，由 `src/lib/loveLetter.ts` 使用已有的 `ARK_API_KEY` / `ARK_CHAT_MODEL` 生成个性化早安情话，再通过 Resend 发送。AI 请求有 25 秒超时；AI 文案插入邮件前做 HTML 转义，邮件提供返回游戏的链接和纯文本版本。

群发按 ID 分页读取 `public.users` 中的游戏用户（注册后进入游戏才建立该档案），使用邮箱及用户名，不读取密码或会话。逐个发送、限速，单个失败继续处理其他用户。任务返回 `sent`（Resend 接受请求数，不代表最终投递）、`failed` 和 `skipped`；缺少配置返回 503，鉴权失败返回 401，部分发送失败返回 500。

每日邮件使用上海日期和邮箱哈希作为 Resend 幂等键，在其 24 小时保存窗口内防止重复发送。重复生成不同文案导致的幂等冲突计入 `skipped`；相同请求可能返回原邮件 ID，仍计入 `sent`，不会再次投递。没有永久发送记录或持久化任务队列。单次执行最多 300 秒；用户较多时需改为持久化队列再扩大规模。启用外部定时任务前，应先确认线上数据库连接、AI 配置和发件域名可用。

## 欢迎邮件工具

`src/lib/email.ts` 提供服务端函数 `sendWelcomeEmail(userEmail, userName)`，读取私密环境变量 `RESEND_API_KEY`，由 Resend 发送欢迎邮件并返回 `{ id }`。邮件 ID 表示 Resend 已接受发送请求，最终投递状态以 Resend 为准。

邮箱注册返回成功和有效的用户信息后，认证 API 使用 Next.js `after()` 在响应返回后尝试发送欢迎邮件。登录和失败注册不会触发；邮件发送失败只记录服务端日志，不改变注册响应及验证码流程。Resend 使用邮箱哈希作为幂等键，在 24 小时内对相同欢迎邮件请求去重，不保证永久只发送一次。Neon 对重复注册可能返回成功格式，超过去重窗口的重复注册仍可能触发欢迎邮件。后台任务未实现持久化重试。

当前发件人为 `女神攻略 <onboarding@resend.dev>`，只支持向 Resend 账号绑定的邮箱发送普通测试邮件。给其他用户发送前，需要在 Resend 验证自己的域名并更换发件人地址。

## 安全

- 所有第三方 AI 请求均由 Next.js Route Handler 发起。
- 邮箱密码、会话和验证码由 Neon Managed Better Auth 管理，不写入 `public.users`。
- 游戏页和生成 API 都会在服务端校验会话。
- API Key 不得添加 `NEXT_PUBLIC_` 前缀。
- `.env*` 已默认忽略，仅 `.env.example` 可提交。
