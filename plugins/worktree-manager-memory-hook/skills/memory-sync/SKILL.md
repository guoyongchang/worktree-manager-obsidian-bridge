---
name: memory-sync
description: "手动触发 Memory Wiki 归档，将当前对话写入 .memory-staging/session-XXX.json"
---

# Memory Sync

用户请求将当前对话提交到 Memory Wiki 归档 staging。

## 步骤

1. 运行归档脚本：

```bash
export PATH="$HOME/.bun/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
bun run "${CLAUDE_PLUGIN_ROOT}/scripts/archive-memory.ts" --trigger=manual
```

2. 脚本会：
   - 检测当前 worktree
   - 从 JSONL 读取并清洗当前对话
   - 写入 `.memory-staging/session-{timestamp}-{sessionId}.json`

3. 将脚本输出展示给用户

写入 staging 后，可运行 `vault-memory-organizer --accumulate` 提炼摘要，再运行 `/memory-archive` 归档到 Memory Wiki。
