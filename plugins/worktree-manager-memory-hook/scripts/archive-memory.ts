#!/usr/bin/env bun
/**
 * Archive pipeline entry point.
 * Called by PreCompact hook, SessionEnd hook, or /memory-sync skill.
 *
 * Usage:
 *   bun run archive-memory.ts --trigger=pre-compact
 *   bun run archive-memory.ts --trigger=session-end
 *   bun run archive-memory.ts --trigger=manual
 */

import { detectWorktree } from "./detect-worktree";
import { readCurrentSessionJsonl } from "./archive/jsonl-reader";
import { buildPayload, postToQueue } from "./archive/http-client";
import { loadConfig } from "./archive/config";
import type { TriggerType } from "./archive/http-client";
import * as fs from "fs";

const LOG_FILE = "/tmp/worktree-memory-archive.log";
const MAX_LOG_SIZE = 1024 * 1024; // 1MB

function fileLog(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;

  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > MAX_LOG_SIZE) {
      const content = fs.readFileSync(LOG_FILE, "utf-8");
      const lines = content.split("\n");
      fs.writeFileSync(LOG_FILE, lines.slice(-500).join("\n") + "\n");
    }
  } catch {
    // Ignore rotation errors
  }

  fs.appendFileSync(LOG_FILE, line);
}

function parseTrigger(): TriggerType {
  const triggerArg = process.argv.find(a => a.startsWith("--trigger="));
  const value = triggerArg?.split("=")[1];
  if (value === "pre-compact" || value === "session-end" || value === "manual") {
    return value;
  }
  return "session-end";
}

async function main() {
  const trigger = parseTrigger();
  fileLog(`Archive triggered: ${trigger}`);

  const cwd = process.cwd();
  const worktree = await detectWorktree(cwd);

  if (!worktree) {
    fileLog("Not a worktree-manager workspace, skipping");
    return;
  }

  const config = loadConfig(worktree.vaultPath);

  if (trigger !== "manual" && !config.archive.autoOnSessionEnd) {
    fileLog("Auto-archive disabled, skipping");
    return;
  }

  fileLog(`Worktree: branch=${worktree.branch}, project=${worktree.project}`);

  const result = readCurrentSessionJsonl(cwd);

  if (!result || !result.conversation) {
    fileLog("No conversation found in JSONL");
    return;
  }

  fileLog(`Conversation: ${result.conversation.length} chars, sessionId=${result.sessionId}`);

  const payload = buildPayload({
    sessionId: result.sessionId || "unknown",
    worktree,
    conversation: result.conversation,
    trigger,
  });

  try {
    await postToQueue(config.worktreeManager.endpoint, payload);
    fileLog(`Posted to queue: ${config.worktreeManager.endpoint}`);

    console.log("<display-to-user>");
    console.log(`Memory Wiki: 对话已提交到 worktree-manager 待整理队列 (${trigger})`);
    console.log("</display-to-user>");
  } catch (err: any) {
    fileLog(`POST failed: ${err.message}`);
    console.log("<display-to-user>");
    console.log(`Memory Wiki: 提交失败 — ${err.message}`);
    console.log("</display-to-user>");
  }
}

main().catch((err) => {
  fileLog(`Fatal error: ${err.message}`);
});
