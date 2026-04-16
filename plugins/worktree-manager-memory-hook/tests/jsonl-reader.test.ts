import { describe, test, expect } from "bun:test";
import { cleanJsonl, cwdToProjectDir } from "../scripts/archive/jsonl-reader";
import * as path from "path";
import * as fs from "fs";

describe("cwdToProjectDir", () => {
  test("converts absolute path to Claude project dir name", () => {
    expect(cwdToProjectDir("/Users/guo/Work/my-project")).toBe(
      "-Users-guo-Work-my-project"
    );
  });

  test("handles trailing slash", () => {
    expect(cwdToProjectDir("/Users/guo/Work/")).toBe("-Users-guo-Work-");
  });
});

describe("cleanJsonl", () => {
  const fixturePath = path.join(import.meta.dir, "fixtures/sample-session.jsonl");
  const rawContent = fs.readFileSync(fixturePath, "utf-8");

  test("extracts sessionId", () => {
    const result = cleanJsonl(rawContent);
    expect(result.sessionId).toBe("test-session-001");
  });

  test("filters out non-message types", () => {
    const result = cleanJsonl(rawContent);
    expect(result.conversation).not.toContain("file-history-snapshot");
    expect(result.conversation).not.toContain("permission-mode");
    expect(result.conversation).not.toContain("last-prompt");
    expect(result.conversation).not.toContain("queue-operation");
  });

  test("filters out isMeta user messages", () => {
    const result = cleanJsonl(rawContent);
    expect(result.conversation).not.toContain("local-command-caveat");
  });

  test("keeps real user messages", () => {
    const result = cleanJsonl(rawContent);
    expect(result.conversation).toContain("帮我修复登录页面的bug");
    expect(result.conversation).toContain("还有一个问题关于样式");
  });

  test("keeps assistant text blocks only", () => {
    const result = cleanJsonl(rawContent);
    expect(result.conversation).toContain("我来看一下登录页面的代码");
    expect(result.conversation).toContain("找到问题了");
    expect(result.conversation).toContain("好的，你说说看样式的问题是什么");
  });

  test("strips thinking blocks from assistant", () => {
    const result = cleanJsonl(rawContent);
    expect(result.conversation).not.toContain("Let me look at the login page");
  });

  test("strips tool_use and tool_result blocks", () => {
    const result = cleanJsonl(rawContent);
    expect(result.conversation).not.toContain("tool_use");
    expect(result.conversation).not.toContain("file content here");
  });

  test("strips system-reminder tags from user messages", () => {
    const result = cleanJsonl(rawContent);
    expect(result.conversation).not.toContain("system-reminder");
    expect(result.conversation).not.toContain("Remember to use tests");
  });

  test("returns empty conversation for empty input", () => {
    const result = cleanJsonl("");
    expect(result.sessionId).toBeUndefined();
    expect(result.conversation).toBe("");
  });
});
