/** Staging file format (contract point 1) */
export interface StagingFile {
  version: string;
  trigger: "pre-compact" | "session-end" | "manual";
  timestamp: string;
  worktree: {
    name: string;
    branch: string;
    project: string;
    requirement_id: string | null;
  };
  conversation: Array<{ role: "user" | "assistant"; content: string }>;
  session_id: string;
  message_count: number;
  jsonl_path?: string;
}

/** Operations the LLM can return for finalize mode */
export type MemoryOp = "create" | "update" | "append_log";

export interface MemoryOperation {
  op: MemoryOp;
  path: string;
  content: string;
  section?: string; // for "update" op — which section to replace
  reason: string;
}

/** LLM provider config */
export interface LlmProviderConfig {
  provider: "openai" | "anthropic";
  model: string;
  base_url?: string;
  api_key_env: string;
}

/** Full organizer config */
export interface OrganizerConfig {
  llm: {
    accumulate: LlmProviderConfig;
    finalize: LlmProviderConfig;
  };
  staging: {
    max_conversation_tokens: number;
    truncate_strategy: "keep_recent" | "keep_both_ends";
  };
}
