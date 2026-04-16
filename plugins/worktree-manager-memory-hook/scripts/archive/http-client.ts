import type { WorktreeInfo } from "../detect-worktree";

export type TriggerType = "pre-compact" | "session-end" | "manual";

export interface QueuePayload {
  sessionId: string;
  worktree: WorktreeInfo;
  conversation: string;
  timestamp: string;
  trigger: TriggerType;
}

export interface BuildPayloadInput {
  sessionId: string;
  worktree: WorktreeInfo;
  conversation: string;
  trigger: TriggerType;
}

export function buildPayload(input: BuildPayloadInput): QueuePayload {
  return {
    sessionId: input.sessionId,
    worktree: input.worktree,
    conversation: input.conversation,
    timestamp: new Date().toISOString(),
    trigger: input.trigger,
  };
}

export async function postToQueue(endpoint: string, payload: QueuePayload): Promise<void> {
  const url = `${endpoint}/api/memory/queue`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Queue POST failed: ${resp.status} ${resp.statusText} — ${body}`);
  }
}
