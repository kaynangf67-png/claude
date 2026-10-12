/** Caminho de public/ → URL servida (respeita o `base` do Vite). */
export function asset(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${import.meta.env.BASE_URL}${path}`;
}

/** URL pública do cardápio: a configurada ou, na falta dela, a página atual sem query/hash. */
export function menuUrl(configured: string): string {
  if (configured) return `${configured}/`;
  return `${window.location.origin}${window.location.pathname}`;
}
