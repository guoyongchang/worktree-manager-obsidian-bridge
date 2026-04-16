import * as fs from "fs";
import * as path from "path";

export interface ArchiveConfig {
  worktreeManager: {
    endpoint: string;
  };
  archive: {
    autoOnSessionEnd: boolean;
  };
}

export function deepMerge(base: any, override: any): any {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (
      override[key] &&
      typeof override[key] === "object" &&
      !Array.isArray(override[key]) &&
      base[key] &&
      typeof base[key] === "object" &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

export function loadConfigFrom(pluginRoot: string, vaultPath: string | undefined): ArchiveConfig {
  const defaultPath = path.join(pluginRoot, "config", "memory-hook.config.json");
  let config: any = {};

  if (fs.existsSync(defaultPath)) {
    config = JSON.parse(fs.readFileSync(defaultPath, "utf-8"));
  }

  if (vaultPath) {
    const overridePath = path.join(vaultPath, "memory-hook.config.json");
    if (fs.existsSync(overridePath)) {
      const override = JSON.parse(fs.readFileSync(overridePath, "utf-8"));
      config = deepMerge(config, override);
    }
  }

  return config as ArchiveConfig;
}

export function loadConfig(vaultPath?: string): ArchiveConfig {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(import.meta.dir, "../..");
  return loadConfigFrom(pluginRoot, vaultPath);
}
