# Neon 数据库迁移

本项目使用版本化 SQL migration 管理 Neon Postgres schema。每个迁移文件都进入 Git，数据库通过 `public.schema_migrations` 记录已执行版本、文件名、SHA-256 校验和、执行时间和耗时。

## 命令

```bash
pnpm db:migrate:status  # 查看 applied / pending / drift
pnpm db:migrate         # 按版本顺序执行全部 pending migration
pnpm db:migrate:down    # 只回滚最后一个已执行 migration
```

命令从 `.env.local` 读取 `DATABASE_URL_UNPOOLED`。Migration 必须使用直连地址；runner 会拒绝主机名包含 `-pooler` 的连接字符串。

## 文件格式

文件名必须为递增数字加描述：

```text
migrations/
├── 001_adopt_users.sql
├── 002_create_conversations.sql
├── 003_create_quotas_and_jobs.sql
└── 004_link_users_to_neon_auth.sql
```

每个文件必须同时提供正向和回滚 SQL：

```sql
-- migrate:up

ALTER TABLE public.users ADD COLUMN example text;

-- migrate:down

ALTER TABLE public.users DROP COLUMN example;
```

## 规则

1. 已执行的 migration 永远不能修改；需要变更时新增下一个编号。
2. Runner 会校验 SHA-256，发现 drift 时立即停止。
3. 每个 migration 在独立事务中执行；失败时自动回滚该文件。
4. Runner 使用 PostgreSQL advisory lock，防止两个部署并发迁移。
5. `down` 可能删除表或数据，只应在确认影响后执行。
6. 先在 Neon 临时分支测试，再应用到 production。
7. `004` 依赖该分支已经部署 Neon Managed Auth；密码、会话和验证码只保存在 `neon_auth` schema，`public.users` 只保存业务资料和 `auth_user_id`。
8. 应用 production 前先检查：

```bash
pnpm db:migrate:status
pnpm db:migrate
pnpm db:migrate:status
```

## Neon 分支测试示例

```bash
neon branches create \
  --name migration-test \
  --parent production \
  --expires-at 2026-10-09T18:00:00Z

DATABASE_URL_UNPOOLED="$(neon connection-string migration-test --database-name neondb)" \
  pnpm db:migrate
```

不要把连接字符串写进 Git、终端截图、Issue 或聊天记录。
