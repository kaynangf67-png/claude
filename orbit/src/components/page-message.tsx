import { Alert } from "@/components/ui/primitives";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Shows ?msg= / ?err= set by server actions after a redirect. */
export function PageMessage({ params }: { params: Record<string, string | string[] | undefined> }) {
  const msg = first(params.msg);
  const err = first(params.err);
  if (!msg && !err) return null;
  return <div className="mb-5">{err ? <Alert tone="danger">{err}</Alert> : <Alert tone="success">{msg}</Alert>}</div>;
}
