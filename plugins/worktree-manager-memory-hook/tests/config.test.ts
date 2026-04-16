import { describe, test, expect } from "bun:test";
import { deepMerge, loadConfigFrom } from "../scripts/archive/config";

describe("deepMerge", () => {
  test("merges flat objects", () => {
    const base = { a: 1, b: 2 };
    const override = { b: 3, c: 4 };
    expect(deepMerge(base, override)).toEqual({ a: 1, b: 3, c: 4 });
  });

  test("merges nested objects", () => {
    const base = { outer: { a: 1, b: 2 } };
    const override = { outer: { b: 3 } };
    expect(deepMerge(base, override)).toEqual({ outer: { a: 1, b: 3 } });
  });

  test("override replaces non-object values", () => {
    const base = { a: "hello" };
    const override = { a: "world" };
    expect(deepMerge(base, override)).toEqual({ a: "world" });
  });

  test("returns base when override is empty", () => {
    const base = { a: 1 };
    expect(deepMerge(base, {})).toEqual({ a: 1 });
  });
});

describe("loadConfigFrom", () => {
  test("loads default config from plugin dir", () => {
    const pluginRoot = import.meta.dir + "/..";
    const config = loadConfigFrom(pluginRoot, undefined);
    expect(config.worktreeManager.endpoint).toBe("http://localhost:9399");
    expect(config.archive.autoOnSessionEnd).toBe(true);
  });

  test("returns defaults when no override exists", () => {
    const pluginRoot = import.meta.dir + "/..";
    const config = loadConfigFrom(pluginRoot, "/nonexistent/path");
    expect(config.worktreeManager.endpoint).toBe("http://localhost:9399");
  });
});
