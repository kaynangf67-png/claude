import "server-only";
import { z } from "zod";

/**
 * Server-side configuration. Every integration is optional: when its
 * variables are missing the UI shows it as unconfigured instead of faking it.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  ORBIT_AI_PROVIDER: z.enum(["anthropic", "none"]).default("anthropic"),
  ORBIT_AI_MODEL: z.string().default("claude-opus-5-5"),
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  ORBIT_ENCRYPTION_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  CRON_SECRET: z.string().min(16).optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
export function env(): Env {
  if (!cached) {
    const raw = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]));
    cached = schema.parse(raw);
  }
  return cached;
}

export function supabaseConfigured(): boolean {
  const e = env();
  return Boolean(e.NEXT_PUBLIC_SUPABASE_URL && e.NEXT_PUBLIC_SUPABASE_ANON_KEY && e.SUPABASE_SERVICE_ROLE_KEY);
}

export function aiConfigured(): boolean {
  const e = env();
  return e.ORBIT_AI_PROVIDER === "anthropic" && Boolean(e.ANTHROPIC_API_KEY);
}

export function gmailConfigured(): boolean {
  const e = env();
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET && encryptionConfigured());
}

export function encryptionConfigured(): boolean {
  const k = env().ORBIT_ENCRYPTION_KEY;
  return Boolean(k && Buffer.from(k, "base64").length === 32);
}
