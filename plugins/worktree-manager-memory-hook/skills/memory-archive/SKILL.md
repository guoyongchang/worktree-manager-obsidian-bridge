---
name: memory-archive
description: "归档 Memory Wiki：将 .memory-staging/organized/ 中的摘要通过 finalize 写入 memory/"
---

# Memory Archive

用户请求将已提炼的会话摘要归档到 Memory Wiki。

## 前置检查

1. 确认当前目录下存在 `.memory-staging/organized/` 且有 `.md` 文件
2. 确认当前目录下存在 `.memory-organizer.config.json`
3. 确认 `projects/vault-memory-organizer/src/index.ts` 存在（或调整路径）

## 运行 finalize

```bash
export PATH="$HOME/.bun/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

# 使用当前目录下的 organizer
bun run "projects/vault-memory-organizer/src/index.ts" \
  --finalize \
  --staging .memory-staging \
  --memory memory \
  --config .memory-organizer.config.json
```

如果 vault-memory-organizer 不在当前目录下，找到它的实际路径后替换 `"projects/vault-memory-organizer/src/index.ts"`。

## 输出处理

- 成功：显示 "Finalize complete: X applied, Y skipped. Staging cleaned up."
- 失败：显示错误信息，staging 保留以便重试

## 注意事项

- finalize 需要 `OPENAI_API_KEY` 环境变量
- 如果 staged 文件还没有运行过 `--accumulate`，先提示用户运行 accumulate
