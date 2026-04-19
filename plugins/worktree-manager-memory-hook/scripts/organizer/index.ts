#!/usr/bin/env bun
import { loadConfig } from "./config";
import { runAccumulate } from "./commands/accumulate";
import { runFinalize } from "./commands/finalize";

function parseArgs(): {
  command: "accumulate" | "finalize";
  staging: string;
  memory?: string;
  config: string;
} {
  const args = process.argv.slice(2);

  let command: "accumulate" | "finalize" | null = null;
  let staging = "";
  let memory = "";
  let config = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--accumulate") command = "accumulate";
    else if (args[i] === "--finalize") command = "finalize";
    else if (args[i] === "--staging" && args[i + 1]) staging = args[++i];
    else if (args[i] === "--memory" && args[i + 1]) memory = args[++i];
    else if (args[i] === "--config" && args[i + 1]) config = args[++i];
  }

  if (!command) {
    console.error("Usage: vault-memory-organizer --accumulate|--finalize --staging <dir> [--memory <dir>] --config <file>");
    process.exit(1);
  }

  if (!staging) {
    console.error("--staging is required");
    process.exit(1);
  }

  if (!config) {
    console.error("--config is required");
    process.exit(1);
  }

  if (command === "finalize" && !memory) {
    console.error("--memory is required for finalize");
    process.exit(1);
  }

  return { command, staging, memory: memory || undefined, config };
}

async function main() {
  const args = parseArgs();
  const config = loadConfig(args.config);

  if (args.command === "accumulate") {
    await runAccumulate(args.staging, config);
  } else {
    await runFinalize(args.staging, args.memory!, config);
  }
}

main().catch((err) => {
  console.error(`[organizer] Fatal: ${err.message}`);
  process.exit(1);
});
