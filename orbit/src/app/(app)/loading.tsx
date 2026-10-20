export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4">
      <div className="h-7 w-48 animate-pulse rounded bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-surface" />)}</div>
      <div className="h-64 animate-pulse rounded-xl bg-surface" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
