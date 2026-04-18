#!/usr/bin/env bun
/**
 * Archive pipeline entry point.
 * Called by PreCompact hook, SessionEnd hook, or /memory-sync skill.
 *
 * Reads the current session JSONL, extracts conversation as {role, content}[],
 * and writes to .memory-staging/session-{timestamp}-{sessionId}.json
 *
 * Usage:
 *   bun run archive-memory.ts --trigger=pre-compact
 *   bun run archive-memory.ts --trigger=session-end
 *   bun run archive-memory.ts --trigger=manual
 */

import { detectWorktree } from "./detect-worktree";
import { findSessionJsonl } from "./archive/jsonl-reader";
import * as fs from "fs";
import * as path from "path";

const LOG_FILE = "/tmp/worktree-memory-archive.log";

function fileLog(message: string): void {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

type TriggerType = "pre-compact" | "session-end" | "manual";

interface ConversationEntry {
  role: "user" | "assistant";
  content: string;
}

function parseTrigger(): TriggerType {
  const triggerArg = process.argv.find((a) => a.startsWith("--trigger="));
  const value = triggerArg?.split("=")[1];
  if (value === "pre-compact" || value === "session-end" || value === "manual") {
    return value;
  }
  return "session-end";
}

function stripTags(text: string, tagNames: string[]): string {
  let result = text;
  for (const tag of tagNames) {
    const regex = new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, "g");
    result = result.replace(regex, "");
  }
  return result.trim();
}

/**
 * Read the session JSONL and extract conversation entries.
 */
function extractConversation(jsonlPath: string): {
  sessionId: string | undefined;
  conversation: ConversationEntry[];
} {
  const raw = fs.readFileSync(jsonlPath, "utf-8");
  const lines = raw.trim().split("\n");

  let sessionId: string | undefined;
  const conversation: ConversationEntry[] = [];

  for (const line of lines) {
    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (!sessionId && entry.type === "permission-mode" && entry.sessionId) {
      sessionId = entry.sessionId;
    }

    if (entry.type === "user") {
      if (entry.isMeta) continue;
      const content = entry.message?.content;
      if (typeof content !== "string") continue;
      const cleaned = stripTags(content, [
        "system-reminder",
        "local-command-caveat",
        "command-name",
        "command-message",
        "command-args",
        "local-command-stdout",
      ]);
      if (cleaned) {
        conversation.push({ role: "user", content: cleaned });
      }
    } else if (entry.type === "assistant") {
      const content = entry.message?.content;
      if (!Array.isArray(content)) continue;
      const textParts: string[] = [];
      for (const block of content) {
        if (block.type === "text" && block.text) {
          textParts.push(block.text);
        }
      }
      if (textParts.length > 0) {
        conversation.push({ role: "assistant", content: textParts.join("\n") });
      }
    }
  }

  return { sessionId, conversation };
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

  fileLog(`Worktree: branch=${worktree.branch}, project=${worktree.project}`);

  const jsonlPath = findSessionJsonl(cwd);
  if (!jsonlPath) {
    fileLog("No JSONL found for current session");
    return;
  }

  fileLog(`Reading JSONL: ${jsonlPath}`);

  const { sessionId, conversation } = extractConversation(jsonlPath);

  if (conversation.length === 0) {
    fileLog("No conversation entries found");
    return;
  }

  fileLog(`Extracted ${conversation.length} conversation entries, sessionId=${sessionId || "unknown"}`);

  // Build staging file
  const stagingDir = path.join(cwd, ".memory-staging");
  fs.mkdirSync(stagingDir, { recursive: true });

  const timestamp = new Date().toISOString();
  const safeSessionId = sessionId ? sessionId.slice(0, 8) : "unknown";
  const filename = `session-${timestamp.replace(/[:.]/g, "-")}-${safeSessionId}.json`;
  const outputPath = path.join(stagingDir, filename);

  const stagingPayload = {
    version: "1.0",
    trigger,
    timestamp,
    worktree: {
      name: worktree.branch || path.basename(cwd),
      branch: worktree.branch || "",
      project: worktree.project || "",
      requirement_id: worktree.requirementId || null,
    },
    conversation,
    session_id: sessionId || "unknown",
    message_count: conversation.length,
    jsonl_path: jsonlPath,
  };

  fs.writeFileSync(outputPath, JSON.stringify(stagingPayload, null, 2), "utf-8");

  fileLog(`Written staging file: ${outputPath}`);

  console.log("<display-to-user>");
  console.log(`Memory Wiki: ${conversation.length} messages archived to .memory-staging/${filename}`);
  console.log("</display-to-user>");
}

main().catch((err) => {
  fileLog(`Fatal error: ${err.message}`);
});
