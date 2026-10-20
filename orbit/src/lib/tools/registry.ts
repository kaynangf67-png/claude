import type { ToolDefinition } from "./types";
import { emailCreateDraft, emailSend, recordsClassify, recordsSearch, reportsGenerate, workItemsCreate } from "./builtin";

/**
 * The only tools that can ever be executed. Anything an AI plan proposes that
 * is not listed here is rejected during plan review.
 */
const TOOLS = [recordsSearch, recordsClassify, workItemsCreate, reportsGenerate, emailCreateDraft, emailSend] as const;

// The registry erases the per-tool input type; inputs are re-validated with
// each tool's own Zod schema before `execute` is called.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = ToolDefinition<any, unknown>;

const REGISTRY: ReadonlyMap<string, AnyTool> = new Map(TOOLS.map((t) => [t.id, t as AnyTool]));

export function getTool(id: string): AnyTool | undefined {
  return REGISTRY.get(id);
}

export function listTools(): AnyTool[] {
  return [...REGISTRY.values()];
}

export type { AnyTool };
