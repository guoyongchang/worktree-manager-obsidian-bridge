#!/usr/bin/env bun
/**
 * SessionStart hook: inject Memory Wiki context for the current worktree.
 */

import { detectWorktree } from "./detect-worktree";
import { queryMemory } from "./query-memory";
import { buildContext } from "./build-context";
import * as fs from "fs";

const LOG_FILE = "/tmp/worktree-memory-hook.log";

function fileLog(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

async function main() {
  const cwd = process.cwd();
  fileLog(`CWD: ${cwd}`);

  let injectedLines = 0;

  const worktree = await detectWorktree(cwd);

  if (!worktree) {
    fileLog("Not a worktree-manager workspace, skipping");
  } else {
    fileLog(`Detected worktree: branch=${worktree.branch}, req=${worktree.requirementId}`);

    const memory = await queryMemory(worktree);

    if (!memory.requirementDoc) {
      fileLog("No requirement doc found for this worktree");
    } else {
      fileLog(`Requirement doc found: ${memory.requirementDoc.path}`);

      const context = buildContext(worktree, memory);
      injectedLines = context.split("\n").length;
      fileLog(`Output length: ${context.length} chars, ${injectedLines} lines`);

      // Output to stdout - Claude will receive this as context
      console.log(context);
    }
  }

  // Always print status lines so user sees the hook ran
  console.log("<display-to-user>");
  console.log("[worktree-manager-memory] injected.");
  console.log(`[worktree-manager-memory] total: ${injectedLines} lines.`);
  console.log("</display-to-user>");
}

main().catch((err) => {
  fileLog(`Error: ${err.message}`);
  console.log("<display-to-user>");
  console.log("[worktree-manager-memory] injected.");
  console.log("[worktree-manager-memory] total: 0 lines.");
  console.log("</display-to-user>");
});
