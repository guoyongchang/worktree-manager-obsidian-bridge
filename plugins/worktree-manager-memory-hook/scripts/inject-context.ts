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
  fileLog(`ENV DEMO: ${process.env.DEMO || "not set"}`);

  const worktree = await detectWorktree(cwd);

  if (!worktree) {
    fileLog("Not a worktree-manager workspace, skipping");
    return;
  }

  fileLog(`Detected worktree: branch=${worktree.branch}, req=${worktree.requirementId}`);

  const memory = await queryMemory(worktree);

  if (!memory.requirement && !memory.project && memory.concepts.length === 0) {
    fileLog("No memory found for this worktree");
    return;
  }

  fileLog(`Memory found: req=${!!memory.requirement}, project=${!!memory.project}, concepts=${memory.concepts.length}`);

  const context = buildContext(worktree, memory);

  fileLog(`Output length: ${context.length} chars`);

  // Output to stdout - Claude will receive this as context
  console.log(context);
}

main().catch((err) => {
  fileLog(`Error: ${err.message}`);
  console.error("worktree-memory-hook error:", err.message);
});
