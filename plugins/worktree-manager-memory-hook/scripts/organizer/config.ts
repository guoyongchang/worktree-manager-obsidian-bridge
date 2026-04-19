import { readFileSync, existsSync } from "fs";
import type { OrganizerConfig, LlmProviderConfig } from "./types";

const VALID_PROVIDERS = ["openai", "anthropic"] as const;

const DEFAULTS = {
  max_conversation_tokens: 8000,
  truncate_strategy: "keep_recent" as const,
};

function validateProviderConfig(raw: unknown, label: string): LlmProviderConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Config: llm.${label} must be an object`);
  }

  const obj = raw as Record<string, unknown>;

  if (!VALID_PROVIDERS.includes(obj.provider as any)) {
    throw new Error(
      `Config: llm.${label}.provider must be one of: ${VALID_PROVIDERS.join(", ")}`
    );
  }

  if (typeof obj.model !== "string" || obj.model.length === 0) {
    throw new Error(`Config: llm.${label}.model is required`);
  }

  if (typeof obj.api_key_env !== "string" || obj.api_key_env.length === 0) {
    throw new Error(`Config: llm.${label}.api_key_env is required`);
  }

  const config: LlmProviderConfig = {
    provider: obj.provider as LlmProviderConfig["provider"],
    model: obj.model,
    api_key_env: obj.api_key_env,
  };

  if (obj.base_url !== undefined) {
    if (typeof obj.base_url !== "string") {
      throw new Error(`Config: llm.${label}.base_url must be a string`);
    }
    config.base_url = obj.base_url;
  }

  return config;
}

/** Load and validate organizer config from a JSON file */
export function loadConfig(filePath: string): OrganizerConfig {
  if (!existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (e) {
    throw new Error(`Config: failed to parse JSON — ${(e as Error).message}`);
  }

  if (!raw || typeof raw !== "object") {
    throw new Error("Config: root must be an object");
  }

  const root = raw as Record<string, unknown>;

  // Validate llm section
  if (!root.llm || typeof root.llm !== "object") {
    throw new Error("Config: llm section is required");
  }

  const llm = root.llm as Record<string, unknown>;

  const accumulate = validateProviderConfig(llm.accumulate, "accumulate");
  const finalize = validateProviderConfig(llm.finalize, "finalize");

  // Staging section with defaults
  const staging = (root.staging ?? {}) as Record<string, unknown>;

  const maxTokens =
    typeof staging.max_conversation_tokens === "number"
      ? staging.max_conversation_tokens
      : DEFAULTS.max_conversation_tokens;

  const truncateStrategy =
    staging.truncate_strategy === "keep_recent" ||
    staging.truncate_strategy === "keep_both_ends"
      ? staging.truncate_strategy
      : DEFAULTS.truncate_strategy;

  return {
    llm: { accumulate, finalize },
    staging: {
      max_conversation_tokens: maxTokens,
      truncate_strategy: truncateStrategy,
    },
  };
}
