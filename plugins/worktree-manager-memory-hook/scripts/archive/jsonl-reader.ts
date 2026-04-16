import * as fs from "fs";
import * as path from "path";
import { homedir } from "os";

export interface CleanedConversation {
  sessionId?: string;
  conversation: string;
}

export function cwdToProjectDir(cwd: string): string {
  return cwd.replace(/\//g, "-");
}

function stripTags(text: string, tagNames: string[]): string {
  let result = text;
  for (const tag of tagNames) {
    const regex = new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, "g");
    result = result.replace(regex, "");
  }
  return result.trim();
}

export function cleanJsonl(raw: string): CleanedConversation {
  if (!raw.trim()) {
    return { conversation: "" };
  }

  const lines = raw.trim().split("\n");
  let sessionId: string | undefined;
  const parts: string[] = [];

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
        parts.push(`[User]: ${cleaned}`);
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
        parts.push(`[Assistant]: ${textParts.join("\n")}`);
      }
    }
  }

  return {
    sessionId,
    conversation: parts.join("\n\n"),
  };
}

export function findSessionJsonl(cwd: string): string | undefined {
  const projectDir = cwdToProjectDir(cwd);
  const claudeProjectsDir = path.join(homedir(), ".claude", "projects", projectDir);

  if (!fs.existsSync(claudeProjectsDir)) {
    return undefined;
  }

  // Try to find by session ID from environment
  const sessionId = process.env.CLAUDE_SESSION_ID;
  if (sessionId) {
    const exactPath = path.join(claudeProjectsDir, `${sessionId}.jsonl`);
    if (fs.existsSync(exactPath)) {
      return exactPath;
    }
  }

  // Fallback: most recently modified .jsonl file
  const files = fs.readdirSync(claudeProjectsDir)
    .filter(f => f.endsWith(".jsonl"))
    .map(f => ({
      name: f,
      path: path.join(claudeProjectsDir, f),
      mtime: fs.statSync(path.join(claudeProjectsDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files[0]?.path;
}

export function readCurrentSessionJsonl(cwd: string): CleanedConversation | undefined {
  const jsonlPath = findSessionJsonl(cwd);
  if (!jsonlPath) return undefined;

  const raw = fs.readFileSync(jsonlPath, "utf-8");
  return cleanJsonl(raw);
}
