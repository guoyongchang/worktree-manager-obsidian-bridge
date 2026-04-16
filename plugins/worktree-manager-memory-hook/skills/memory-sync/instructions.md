# Memory Sync

用户请求将当前对话提交到 Memory Wiki 归档队列。

## 步骤

1. 运行归档脚本：

```bash
export PATH="$HOME/.bun/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
bun run "${CLAUDE_PLUGIN_ROOT}/scripts/archive-memory.ts" --trigger=manual
```

2. 脚本会：
   - 检测当前 worktree
   - 从 JSONL 读取并清洗当前对话
   - POST 到 worktree-manager 待整理队列

3. 将脚本输出展示给用户

归档在 worktree-manager App 中异步执行，用户可在 App 里查看进度和结果。
需要 worktree-manager App 正在运行。如果 App 未启动，脚本会报错提示用户启动 App。
