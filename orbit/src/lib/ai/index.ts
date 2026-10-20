import "server-only";
import { aiConfigured, env } from "@/lib/env";
import { AnthropicProvider } from "./anthropic";
import type { AiProvider } from "./provider";

export function getAiProvider(): AiProvider | null {
  if (!aiConfigured()) return null;
  const e = env();
  return new AnthropicProvider(e.ANTHROPIC_API_KEY!, e.ORBIT_AI_MODEL);
}
