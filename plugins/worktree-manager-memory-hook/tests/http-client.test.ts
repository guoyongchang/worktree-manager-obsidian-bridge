import { describe, test, expect } from "bun:test";
import { buildPayload, postToQueue } from "../scripts/archive/http-client";

describe("buildPayload", () => {
  test("constructs correct payload structure", () => {
    const payload = buildPayload({
      sessionId: "session-123",
      worktree: {
        cwd: "/Users/guo/Work/project",
        project: "my-project",
        branch: "feature-27118",
        requirementId: "ERP-27118",
      },
      conversation: "test conversation",
      trigger: "session-end",
    });

    expect(payload.sessionId).toBe("session-123");
    expect(payload.trigger).toBe("session-end");
    expect(payload.conversation).toBe("test conversation");
    expect(payload.worktree.branch).toBe("feature-27118");
    expect(payload.worktree.requirementId).toBe("ERP-27118");
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("accepts all trigger types", () => {
    for (const trigger of ["pre-compact", "session-end", "manual"] as const) {
      const payload = buildPayload({
        sessionId: "s1",
        worktree: { cwd: "/test" },
        conversation: "test",
        trigger,
      });
      expect(payload.trigger).toBe(trigger);
    }
  });
});

describe("postToQueue", () => {
  test("succeeds when server returns 202", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        return new Response(JSON.stringify({ id: "queue-1" }), { status: 202 });
      },
    });

    try {
      await postToQueue(`http://localhost:${server.port}`, buildPayload({
        sessionId: "s1",
        worktree: { cwd: "/test" },
        conversation: "test",
        trigger: "manual",
      }));
      // Should not throw
    } finally {
      server.stop();
    }
  });

  test("throws on non-OK response", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        return new Response("bad request", { status: 400 });
      },
    });

    try {
      await expect(
        postToQueue(`http://localhost:${server.port}`, buildPayload({
          sessionId: "s1",
          worktree: { cwd: "/test" },
          conversation: "test",
          trigger: "manual",
        }))
      ).rejects.toThrow("Queue POST failed: 400");
    } finally {
      server.stop();
    }
  });
});
