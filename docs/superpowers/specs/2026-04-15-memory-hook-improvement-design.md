# worktree-manager-memory-hook 改进设计

**日期**: 2026-04-15  
**状态**: 待实现  
**范围**: 改进现有插件，解决 SessionStart 触发问题 + 规范化安装方式

---

## 背景

`worktree-manager-memory-hook` 是一个 Claude Code 插件，在 session 开始时从 `.vault/memory/` 读取 Memory Wiki 上下文并注入 Claude，帮助 Claude 恢复当前 worktree 对应的需求和项目背景。

### 现有问题

| 问题 | 根因 |
|------|------|
| SessionStart hook 不触发 | Claude Code 插件系统的 `hooks.json` 不支持 `SessionStart` 事件，该事件仅在用户级 `~/.claude/settings.json` 中有效 |
| 安装复杂 | 用户需手动编辑 `known_marketplaces.json`、`installed_plugins.json`、`settings.json` 三个文件 |
| 状态日志不可见 | 脚本提前 return 导致日志行从未执行 |

---

## 目标

1. `SessionStart` 在每次打开 Claude Code 时可靠触发
2. 安装/卸载自动化，用户无需手动改 JSON
3. 每次 session 开始时用户可见两行状态日志

---

## 架构

```
hooks.json
└── Setup hook
    └── scripts/setup.sh <CLAUDE_PLUGIN_ROOT>
        └── 写入 ~/.claude/settings.json
            └── hooks.SessionStart
                └── scripts/inject-context.ts
                    ├── detect-worktree.ts   检测当前 worktree 和需求 ID
                    ├── query-memory.ts      从 .vault/memory/ 读取上下文
                    └── build-context.ts     构建注入内容
```

---

## 组件设计

### 1. `hooks.json`

移除 `SessionStart`（不再在插件层面声明），新增 `Setup` hook：

```json
{
  "hooks": {
    "Setup": [
      {
        "hooks": [{
          "type": "command",
          "command": "bash \"${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh\" \"${CLAUDE_PLUGIN_ROOT}\"",
          "timeout": 10000
        }]
      }
    ]
  }
}
```

### 2. `scripts/setup.sh`

**职责**: 将 SessionStart hook 命令写入 `~/.claude/settings.json`。

**逻辑**:
1. 接收 `$1` = `CLAUDE_PLUGIN_ROOT`（setup 时的有效路径）
2. 读取 `~/.claude/settings.json`
3. 检查是否已有 `# worktree-manager-memory-hook` 标记，避免重复写入
4. 用 `python3` 注入如下 SessionStart hook 条目：
   ```json
   {
     "hooks": [{
       "type": "command",
       "command": "# worktree-manager-memory-hook\nexport PATH=...; bun run \"<PLUGIN_ROOT>/scripts/inject-context.ts\" 2>&1",
       "timeout": 10000
     }]
   }
   ```
5. 写回 `~/.claude/settings.json`
6. 打印 `[worktree-manager-memory] setup complete. Hook written to settings.json`

**幂等性**: 运行多次不重复写入，通过注释标记识别已有条目。

### 3. `scripts/uninstall.sh`

**职责**: 从 `~/.claude/settings.json` 移除由 setup.sh 写入的 hook 条目。

**逻辑**:
1. 读取 `~/.claude/settings.json`
2. 找到包含 `# worktree-manager-memory-hook` 标记的 hook 条目并移除
3. 写回文件
4. 打印 `[worktree-manager-memory] uninstalled. Hook removed from settings.json`

### 4. `scripts/inject-context.ts`（已有，小改动）

已有逻辑保持不变。确认以下行为：

- 始终执行到函数末尾（不提前 return）
- 末尾始终输出状态日志：
  ```
  <display-to-user>
  [worktree-manager-memory] injected.
  [worktree-manager-memory] total: N lines.
  </display-to-user>
  ```
- 当无 worktree 或无 memory 时，`N = 0`

---

## 安装流程

```bash
# 通过 Claude Code 插件系统安装
claude plugin install worktree-manager-memory-hook@worktree-manager-obsidian-bridge

# Setup hook 自动触发 setup.sh，写入 settings.json
# 重启 Claude Code 后 SessionStart 生效
```

## 卸载流程

```bash
# 手动运行卸载脚本
bash ~/.claude/plugins/cache/.../scripts/uninstall.sh

# 然后卸载插件
claude plugin uninstall worktree-manager-memory-hook@worktree-manager-obsidian-bridge
```

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `hooks/hooks.json` | 修改 | 移除 SessionStart，新增 Setup hook |
| `scripts/setup.sh` | 新增 | 写入 settings.json 的 SessionStart hook |
| `scripts/uninstall.sh` | 新增 | 清除 settings.json 中的 hook |
| `scripts/inject-context.ts` | 小改 | 确认状态日志始终输出 |

---

## 错误处理

- `setup.sh`: 若 `~/.claude/settings.json` 不存在则创建；若 `jq`/`python3` 不可用则打印错误并退出
- `inject-context.ts`: 脚本任何路径下均输出状态日志，错误信息写入 `/tmp/worktree-memory-hook.log`

---

## 不在本次范围内

- 多 vault 路径支持（当前只支持 `.vault/memory/` 自动检测）
- 插件 GUI 配置界面
- `UserPromptSubmit` 方案（已排除）
