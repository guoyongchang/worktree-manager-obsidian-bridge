# worktree-manager-memory-hook 改进设计

**日期**: 2026-04-15  
**状态**: 待实现  
**版本**: v2.0.0（hook 机制根本性变更）  
**范围**: 改进现有插件，解决 SessionStart 触发问题 + 规范化安装/卸载方式

---

## 背景

`worktree-manager-memory-hook` 是一个 Claude Code 插件，在 session 开始时从 `.vault/memory/` 读取 Memory Wiki 上下文并注入 Claude，帮助 Claude 恢复当前 worktree 对应的需求和项目背景。

### 现有问题

| 问题 | 根因 |
|------|------|
| SessionStart hook 不触发 | Claude Code 插件系统的 `hooks.json` 不支持 `SessionStart` 事件，该事件仅在用户级 `~/.claude/settings.json` 中有效 |
| 安装复杂 | 用户需手动编辑 `known_marketplaces.json`、`installed_plugins.json`、`settings.json` 三个文件 |
| 状态日志不可见 | 脚本提前 return 导致日志行从未执行 |

### 调试发现

- 官方插件（security-guidance、hookify 等）均不使用 `SessionStart`，只用 `PreToolUse`、`PostToolUse`、`Stop`、`UserPromptSubmit`
- `SessionStart` 仅在 `~/.claude/settings.json` 的用户级 hooks 中有效
- claude-mem 的 `Setup` hook 在安装时被正确触发，格式已验证可用
- `CLAUDE_PLUGIN_ROOT` 仅在插件 hooks.json 的 hook 执行时由 Claude Code 注入，**不可用于 settings.json 的用户级 hook**

---

## 目标

1. `SessionStart` 在每次打开 Claude Code 时可靠触发
2. 安装/卸载自动化，用户无需手动改 JSON
3. 每次 session 开始时用户可见两行状态日志
4. 不依赖开发者本地路径，所有路径在 setup 时动态解析

---

## 架构

```
hooks.json
└── Setup hook（安装时触发一次）
    └── scripts/setup.sh $CLAUDE_PLUGIN_ROOT
        ├── 解析 $1 为绝对路径，写入 settings.json hooks.SessionStart
        └── 复制 uninstall.sh 到 ~/.claude/worktree-memory-uninstall.sh

~/.claude/settings.json
└── hooks.SessionStart（每次启动触发）
    └── bun run "<绝对路径>/scripts/inject-context.ts"
        ├── detect-worktree.ts   检测当前 worktree 和需求 ID
        ├── query-memory.ts      从 .vault/memory/ 读取上下文
        └── build-context.ts     构建注入内容
```

---

## 组件设计

### 1. `hooks.json`

仅保留 `Setup` hook，不再声明 `SessionStart`：

```json
{
  "hooks": {
    "Setup": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh\" \"${CLAUDE_PLUGIN_ROOT}\"",
            "timeout": 10000
          }
        ]
      }
    ]
  }
}
```

> **格式说明**: 使用 `{ matcher, hooks[] }` 嵌套形式，与 claude-mem 的 `Setup` hook 保持一致。`matcher: "*"` 表示无条件触发。

### 2. `scripts/setup.sh`

**职责**: 将 SessionStart hook 命令写入 `~/.claude/settings.json`，并复制 uninstall 脚本到固定位置。

**参数**: `$1` = `CLAUDE_PLUGIN_ROOT`（Setup hook 执行时由 Claude Code 注入的绝对路径）

**逻辑**:

1. 校验 `$1` 非空，否则打印错误退出
2. 解析 `PLUGIN_ROOT=$(cd "$1" && pwd)` 为绝对路径
3. 检查 `python3` 可用性，不可用则报错退出
4. 读取 `~/.claude/settings.json`（不存在则创建最小 JSON）
5. 调用 `python3` 内联脚本操作 JSON：
   - 查找 `hooks.SessionStart` 数组中是否已有包含 `worktree-manager-memory-hook` 标记的条目
   - **已有**: 替换该条目（支持插件更新后路径变更）
   - **没有**: append 到已有数组（不覆盖用户自定义的其他 SessionStart hook）
   - 写入的 hook 条目使用**解析后的绝对路径**（非 `$CLAUDE_PLUGIN_ROOT` 变量）：
     ```json
     {
       "hooks": [
         {
           "type": "command",
           "command": "# worktree-manager-memory-hook v2.0.0\nexport PATH=\"$HOME/.bun/bin:/usr/local/bin:/opt/homebrew/bin:$PATH\"; bun run \"/resolved/absolute/path/scripts/inject-context.ts\" 2>&1",
           "timeout": 10000
         }
       ]
     }
     ```
6. 写回 `~/.claude/settings.json`
7. 复制 `uninstall.sh` 到 `~/.claude/worktree-memory-uninstall.sh`（固定路径，不受 cache 清理影响）
8. 打印 `[worktree-manager-memory] setup complete.`

**幂等性**: 通过注释标记 `# worktree-manager-memory-hook` 识别已有条目。重复运行时替换而非追加，保证更新后路径正确。

**版本标记**: 注释中包含版本号（`v2.0.0`），便于排查和未来升级识别。

### 3. `scripts/uninstall.sh`

**职责**: 从 `~/.claude/settings.json` 移除由 setup.sh 写入的 hook 条目。

**安装位置**: 
- 源文件: `<plugin>/scripts/uninstall.sh`
- 安装时复制到: `~/.claude/worktree-memory-uninstall.sh`

**逻辑**:
1. 读取 `~/.claude/settings.json`
2. 用 `python3` 在 `hooks.SessionStart` 数组中查找包含 `worktree-manager-memory-hook` 标记的条目并移除
3. 如果 `SessionStart` 数组变空，移除整个 `hooks.SessionStart` 键
4. 如果 `hooks` 对象变空，移除整个 `hooks` 键
5. 写回文件
6. 删除自身 `~/.claude/worktree-memory-uninstall.sh`
7. 打印 `[worktree-manager-memory] uninstalled.`

### 4. `scripts/inject-context.ts`（已有，小改动）

已有逻辑保持不变。修正以下行为：

- 重构为条件分支（不提前 return），确保始终执行到函数末尾
- 末尾始终输出状态日志：
  ```
  <display-to-user>
  [worktree-manager-memory] injected.
  [worktree-manager-memory] total: N lines.
  </display-to-user>
  ```
- 当无 worktree 或无 memory 时，`N = 0`
- `.catch()` 错误处理中也输出 `<display-to-user>` 状态块（`N = 0`），确保用户始终看到 hook 是否运行

---

## 安装流程

```bash
# 通过 Claude Code 插件系统安装（自动触发 Setup hook）
claude plugin install worktree-manager-memory-hook@worktree-manager-obsidian-bridge

# Setup hook 自动执行 setup.sh:
#   1. 写入 settings.json 的 SessionStart hook（绝对路径）
#   2. 复制 uninstall.sh 到 ~/.claude/worktree-memory-uninstall.sh
# 重启 Claude Code 后 SessionStart 生效
```

## 卸载流程

```bash
# 运行固定路径的卸载脚本（不依赖 cache 目录）
bash ~/.claude/worktree-memory-uninstall.sh

# 然后卸载插件
claude plugin uninstall worktree-manager-memory-hook@worktree-manager-obsidian-bridge
```

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `hooks/hooks.json` | 修改 | 移除 SessionStart，仅保留 Setup hook |
| `scripts/setup.sh` | 新增 | 写入 settings.json + 复制 uninstall 脚本 |
| `scripts/uninstall.sh` | 新增 | 清除 settings.json 中的 hook + 自删除 |
| `scripts/inject-context.ts` | 小改 | 确保状态日志始终输出（含 .catch 路径） |
| `package.json` | 修改 | 版本号 bump 到 2.0.0 |
| `.claude-plugin/plugin.json` | 修改 | 版本号 bump 到 2.0.0 |

---

## 错误处理

- `setup.sh`: 
  - `$1` 为空 → 打印错误并退出（exit 1）
  - `python3` 不可用 → 打印错误并退出
  - `~/.claude/settings.json` 不存在 → 创建最小 JSON `{}`
  - 已有 `SessionStart` hook → append 而非覆盖
- `uninstall.sh`:
  - `~/.claude/settings.json` 不存在 → 打印提示并退出
  - 找不到标记条目 → 打印 "nothing to remove" 并退出
- `inject-context.ts`:
  - 任何异常路径均输出 `<display-to-user>` 状态块（N=0）
  - 详细错误写入 `/tmp/worktree-memory-hook.log`

---

## 约束

- **不使用硬编码本地路径**: hooks.json 和提交的代码中不得包含开发者本地路径。所有路径在 setup.sh 运行时动态解析
- **不覆盖用户 hooks**: setup.sh append 到已有 SessionStart 数组，不替换用户自定义 hook
- **JSON 操作仅用 python3**: 不依赖 jq（macOS/Linux 上 python3 更通用）
- **幂等 setup**: 运行多次结果一致（通过标记识别 + 替换）
- **Shell 变量保持字面量**: 写入 settings.json 的命令中 `$HOME`、`$PATH` 等 shell 变量必须作为字面字符串写入 JSON，不得在 setup.sh 的 python3 脚本中提前展开
- **修改前备份 settings.json**: setup.sh 和 uninstall.sh 在写回 settings.json 之前，先复制到 `~/.claude/settings.json.bak`

---

## 不在本次范围内

- 多 vault 路径支持（当前只支持 `.vault/memory/` 自动检测）
- 插件 GUI 配置界面
- `UserPromptSubmit` 方案（已排除）
- `setup.sh --check` 诊断模式（可作为后续迭代）
