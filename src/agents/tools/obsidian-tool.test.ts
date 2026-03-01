import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { runCommandWithTimeout } from "../../process/exec.js";
import { createObsidianTools } from "./obsidian-tool.js";

vi.mock("../../process/exec.js", () => ({
  runCommandWithTimeout: vi.fn(),
}));

function createConfig(overrides?: Partial<OpenClawConfig>): OpenClawConfig {
  return {
    agents: {
      list: [{ id: "main", default: true }],
      defaults: {
        memorySearch: {
          enabled: true,
          obsidian: {
            enabled: true,
            vaultPath: "memory",
            promptHints: true,
            cli: {
              command: "obsidian",
              timeoutMs: 4000,
            },
          },
        },
      },
    },
    ...overrides,
  };
}

describe("createObsidianTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no tools when obsidian integration is disabled", () => {
    const tools = createObsidianTools({
      config: createConfig({
        agents: {
          list: [{ id: "main", default: true }],
          defaults: { memorySearch: { enabled: true, obsidian: { enabled: false } } },
        },
      }),
    });
    expect(tools).toHaveLength(0);
  });

  it("executes obsidian_search using allowlisted command arguments", async () => {
    vi.mocked(runCommandWithTimeout).mockResolvedValue({
      pid: 42,
      stdout: JSON.stringify([{ path: "notes/alpha.md" }]),
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
      termination: "exit",
      noOutputTimedOut: false,
    });

    const tools = createObsidianTools({ config: createConfig() });
    const search = tools.find((tool) => tool.name === "obsidian_search");
    if (!search?.execute) {
      throw new Error("obsidian_search tool missing");
    }

    const result = await search.execute("t1", { query: "alpha", limit: 3 });
    expect(vi.mocked(runCommandWithTimeout)).toHaveBeenCalledWith(
      ["obsidian", "search", "--vault", expect.any(String), "--query", "alpha", "--limit", "3", "--json"],
      { timeoutMs: 4000 },
    );
    expect(result.details).toEqual({
      action: "search",
      vaultPath: expect.any(String),
      items: [{ path: "notes/alpha.md" }],
    });
  });

  it("surfaces CLI failures for Obsidian commands", async () => {
    vi.mocked(runCommandWithTimeout).mockResolvedValue({
      pid: 42,
      stdout: "",
      stderr: "command not found",
      code: 1,
      signal: null,
      killed: false,
      termination: "exit",
      noOutputTimedOut: false,
    });

    const tools = createObsidianTools({ config: createConfig() });
    const backlinks = tools.find((tool) => tool.name === "obsidian_backlinks");
    if (!backlinks?.execute) {
      throw new Error("obsidian_backlinks tool missing");
    }
    await expect(backlinks.execute("t2", { target: "alpha.md" })).rejects.toThrow(
      /command not found/i,
    );
  });
});
