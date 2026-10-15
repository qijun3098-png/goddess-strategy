# 开发与独立验收

## 本轮怎么交付

本轮开发在 `codex/account-isolation-and-acceptance` 分支，提交 PR 和 Vercel 预览。main 与生产数据库保持原样。本机现在执行，不创建凌晨定时器；锁屏通常不终止进程，但休眠/关机会使本机任务中断。电脑不运行时需要单独部署云端工作流程，不能靠这个聊天自动唤醒。

## 账号数据

文本存档键为 `goddess-strategy-v2:<认证用户ID>`，媒体数据库为 `goddess-strategy-media-v2:<认证用户ID>`。不按邮箱分配，邮箱变更不会换档。旧 `goddess-strategy-v1` 与旧共享媒体数据库保留，不自动迁移给任一用户。结构损坏的存档保留原文并停止自动写回；用户主动清空当前账号记录后才建立新存档。

此处实现浏览器内账号存档隔离，不是云端同步或本地数据加密；具有浏览器开发者工具/操作系统权限的人仍能访问本机存储。额度仍属于当前原型的本地额度，不是服务端计费系统。

## 命令

- `pnpm test`：回归测试与验收工具的自测；第三方请求使用模拟，不发送真实邮件或生成付费媒体。
- `pnpm check`：测试、类型、Lint、构建、源码/前端密钥扫描及 diff 检查。结果保存在 `.acceptance/checks.json`。构建用随机测试 Cookie Secret 和测试 Auth URL，不冒充真实登录验证。
- `pnpm acceptance`：必要时先检查，再创建排除凭据的代码快照，调用独立 `codex exec` 只读审查，JSON 报告在 `.acceptance/review.json`。耗用已登录 Codex 账号的用量，单次审查最多 4 分钟。CLI 未登录、服务不可用、超时或证据不足均不能算通过。
- `pnpm work:next`：当前版本领取已批准的验收任务，从当前提交建立独立 Git worktree，离线安装锁定依赖并运行独立验收；总时限 30 分钟。执行前仓库需干净，报告在 `.acceptance/work.json`。不复制 `.env`。暂不自动领取任意功能开发任务，不自动创建或合并 PR；本轮 PR 由当前已授权会话创建。

CI 在 push/PR 时自动执行 `pnpm check`，没有夜间本机调度，也不向 CI 注入生产密钥或 Codex 凭据。CI 不代替模型审查。

## Hook 激活

项目 Hook 为 `.codex/hooks.json`，可审查的模板在 `scripts/acceptance/hooks.template.json`。`UserPromptSubmit` 只记代码指纹，不保存原始提示词；`Stop` 对发生代码变化的开发任务调用验收。对没有代码变化的普通问答跳过。发现明确问题时限制继续修复次数，并通过 stop_hook_active 防止继续事件递归，仍有问题或运行异常时如实报告。

Codex 要求信任非托管 Hook。配置文件存在并不表示已启用：在本项目启动支持 Hook 的本地 Codex 客户端，通过 `/hooks` 审查并信任定义；配置变更后需重新信任。不同入口可能需要重开会话。用真实事件产生的 `.acceptance/hooks/<会话哈希>.json` 与审查报告确认触发，不能只手动运行脚本就声称客户端自动触发成功。

Hook 是辅助验收，不能代替 GitHub 分支保护。`.acceptance/` 报告对当前本机用户可写，不是防恶意篡改的审计系统。需要强制合并门槛时，应由仓库管理员另外启用必需检查。

## 防止旧问题复发

- 失败消息和待发送消息不得进入 AI 上下文；最新用户输入恰好一次。
- 异步回调绑定原账号/原角色；账号切换和退出后取消请求，忽略晚到响应。
- 重试复用消息 ID，失败或中断的请求退回本地额度。
- 修复必须补回归测试；测试之后再改代码，旧指纹的通过收据失效。
- GitHub 推送成功、Vercel 预览成功与真实生产验证分别记录，不能相互代替。

参考官方文档：<https://learn.chatgpt.com/docs/hooks>、<https://learn.chatgpt.com/docs/non-interactive-mode>。
