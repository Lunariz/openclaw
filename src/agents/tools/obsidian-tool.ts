import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../config/config.js";
import { runCommandWithTimeout } from "../../process/exec.js";
import { resolveSessionAgentId } from "../agent-scope.js";
import { resolveMemorySearchConfig } from "../memory-search.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";

const ObsidianSearchSchema = Type.Object({
  query: Type.String({ description: "Search query to run in the Obsidian vault." }),
  limit: Type.Optional(Type.Number({ description: "Optional max number of results." })),
});

const ObsidianBacklinksSchema = Type.Object({
  target: Type.String({
    description:
      "Target note path or title to inspect backlinks for (for example: note.md or Note Title).",
  }),
  limit: Type.Optional(Type.Number({ description: "Optional max number of results." })),
});

const ObsidianListSchema = Type.Object({
  limit: Type.Optional(Type.Number({ description: "Optional max number of results." })),
});

type ObsidianAction = "search" | "backlinks" | "orphans" | "dead-ends";

function resolveObsidianToolContext(options: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}) {
  const cfg = options.config;
  if (!cfg) {
    return null;
  }
  const agentId = resolveSessionAgentId({
    sessionKey: options.agentSessionKey,
    config: cfg,
  });
  const memory = resolveMemorySearchConfig(cfg, agentId);
  if (!memory?.obsidian.enabled) {
    return null;
  }
  return {
    command: memory.obsidian.cli.command,
    timeoutMs: memory.obsidian.cli.timeoutMs,
    vaultPath: memory.obsidian.vaultPath,
  };
}

function normalizeLimit(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(1, Math.floor(value));
}

function parseObsidianOutput(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
}

async function runObsidianAction(params: {
  command: string;
  timeoutMs: number;
  vaultPath: string;
  action: ObsidianAction;
  query?: string;
  target?: string;
  limit?: number;
}) {
  const argv = [params.command, params.action, "--vault", params.vaultPath];
  if (params.query) {
    argv.push("--query", params.query);
  }
  if (params.target) {
    argv.push("--target", params.target);
  }
  if (typeof params.limit === "number") {
    argv.push("--limit", String(params.limit));
  }
  argv.push("--json");

  const result = await runCommandWithTimeout(argv, {
    timeoutMs: params.timeoutMs,
  });
  if (result.termination !== "exit" || result.code !== 0) {
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    throw new Error(
      stderr || stdout || `Obsidian command failed (${params.action}, code=${result.code ?? "?"}).`,
    );
  }
  return {
    action: params.action,
    vaultPath: params.vaultPath,
    items: parseObsidianOutput(result.stdout),
  };
}

export function createObsidianTools(options: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}): AnyAgentTool[] {
  const ctx = resolveObsidianToolContext(options);
  if (!ctx) {
    return [];
  }
  const baseDescription =
    "Use Obsidian CLI over the configured vault for graph-aware memory inspection.";
  return [
    {
      label: "Obsidian Search",
      name: "obsidian_search",
      description: `${baseDescription} Search notes and links semantically/lexically using vault-native indexing.`,
      parameters: ObsidianSearchSchema,
      execute: async (_toolCallId, args) => {
        const query = readStringParam(args, "query", { required: true });
        const limit = normalizeLimit(readNumberParam(args, "limit", { integer: true }));
        const payload = await runObsidianAction({
          ...ctx,
          action: "search",
          query,
          limit,
        });
        return jsonResult(payload);
      },
    },
    {
      label: "Obsidian Backlinks",
      name: "obsidian_backlinks",
      description: `${baseDescription} Resolve backlinks to a target note for relationship-aware retrieval.`,
      parameters: ObsidianBacklinksSchema,
      execute: async (_toolCallId, args) => {
        const target = readStringParam(args, "target", { required: true });
        const limit = normalizeLimit(readNumberParam(args, "limit", { integer: true }));
        const payload = await runObsidianAction({
          ...ctx,
          action: "backlinks",
          target,
          limit,
        });
        return jsonResult(payload);
      },
    },
    {
      label: "Obsidian Orphans",
      name: "obsidian_orphans",
      description: `${baseDescription} List orphan notes with no inbound/outbound graph connections.`,
      parameters: ObsidianListSchema,
      execute: async (_toolCallId, args) => {
        const limit = normalizeLimit(readNumberParam(args, "limit", { integer: true }));
        const payload = await runObsidianAction({
          ...ctx,
          action: "orphans",
          limit,
        });
        return jsonResult(payload);
      },
    },
    {
      label: "Obsidian Dead Ends",
      name: "obsidian_dead_ends",
      description: `${baseDescription} List dead-end notes (no outgoing links) to improve graph connectivity.`,
      parameters: ObsidianListSchema,
      execute: async (_toolCallId, args) => {
        const limit = normalizeLimit(readNumberParam(args, "limit", { integer: true }));
        const payload = await runObsidianAction({
          ...ctx,
          action: "dead-ends",
          limit,
        });
        return jsonResult(payload);
      },
    },
  ];
}
