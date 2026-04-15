# worktree-manager-memory-hook 原生 SessionStart 设计

**日期**: 2026-04-15
**状态**: 已确认
**版本**: v2.0.0
**范围**: 改为原生插件 `SessionStart`，保留 `Setup` 仅做环境检查

---

## 背景

`worktree-manager-memory-hook` 是一个 Claude Code 插件，在 session 开始时从 `.vault/memory/` 读取 Memory Wiki 上下文并注入 Claude，帮助 Claude 恢复当前 worktree 对应的需求和项目背景。

原生方案不写用户级 `~/.claude/settings.json`，直接依赖 Claude Code 插件自己的 hook 生命周期。

---

## 目标

1. 使用原生插件 `SessionStart`，不再改写用户 settings
2. 保留 `Setup` hook，但只做环境检查
3. 支持 `user` / `project` / `local` 安装 scope
4. 保持现有 Memory Wiki 注入逻辑不变

---

## 架构

```text
hooks/hooks.json
├── Setup
│   └── scripts/setup.sh $CLAUDE_PLUGIN_ROOT
│       ├── 提示 native SessionStart 已启用
│       └── 检查 bun 是否存在
└── SessionStart
    └── bun run "${CLAUDE_PLUGIN_ROOT}/scripts/inject-context.ts"
        ├── detect-worktree.ts
        ├── query-memory.ts
        └── build-context.ts
```

---

## 组件设计

### 1. `hooks/hooks.json`

声明两个原生 plugin hooks：

- `Setup`: 保留，用于诊断和迁移提示
- `SessionStart`: 核心入口，直接运行 `inject-context.ts`

`SessionStart` 使用 `${CLAUDE_PLUGIN_ROOT}` 引用插件内脚本，避免硬编码本地绝对路径。

### 2. `scripts/setup.sh`

`Setup` 不写 `~/.claude/settings.json`。职责是：

1. 校验 `CLAUDE_PLUGIN_ROOT` 参数存在
2. 打印插件已启用 native `SessionStart`
3. 检查 `bun` 是否存在，不存在则给出 warning

`Setup` 不生成、不复制、不删除任何用户级 hook 文件。

### 3. `scripts/inject-context.ts`

核心注入逻辑保持现状。继续：

- 检测当前 worktree
- 读取 `.vault/memory/`
- 输出上下文
- 末尾始终输出状态信息

---

## 安装和卸载

安装：

```bash
claude plugin marketplace add guoyongchang/worktree-manager-obsidian-bridge
claude plugin install worktree-manager-memory-hook@worktree-manager-obsidian-bridge
```

如果是刚启用插件，开启一个新的 Claude Code session 即可触发原生 `SessionStart`。

卸载：

```bash
claude plugin uninstall worktree-manager-memory-hook@worktree-manager-obsidian-bridge
```

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `hooks/hooks.json` | 修改 | 同时声明 `Setup` 和原生 `SessionStart` |
| `scripts/setup.sh` | 修改 | 改为检查，不写 settings |
| `README.md` | 修改 | 更新安装/卸载和行为说明 |
| `tests/native-sessionstart.sh` | 新增 | 校验原生 `SessionStart` 和 setup/no-op 行为 |

---

## 约束

- 不再改写 `~/.claude/settings.json`
- 不依赖开发者本地绝对路径
- `SessionStart` 通过插件原生 hooks 触发
- `Setup` 失败不应引入额外持久化副作用
