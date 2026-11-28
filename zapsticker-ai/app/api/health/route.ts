export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, service: "zapsticker-ai", version: "1.0.0", time: new Date().toISOString() });
}
