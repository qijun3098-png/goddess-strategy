# 女神攻略——从屌丝到海王的逆袭

移动端优先的 AI 虚拟女友聊天游戏。包含四位成年角色、文本对话、参考图自拍生成、TTS 语音和浏览器本地存档。

## 本地运行

1. 复制 `.env.example` 为 `.env.local`
2. 在 `.env.local` 填入服务端 API Key
3. 安装依赖：`pnpm install`
4. 启动：`pnpm dev`

未配置 API Key 时，聊天接口会进入本地演示模式；图片和语音会提示尚未配置服务。

## 安全

- 所有第三方 AI 请求均由 Next.js Route Handler 发起。
- API Key 不得添加 `NEXT_PUBLIC_` 前缀。
- `.env*` 已默认忽略，仅 `.env.example` 可提交。
