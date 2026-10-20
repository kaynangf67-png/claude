/**
 * Modo prévia: mostra itens ainda não confirmados (tratamentos, horários,
 * formação) com um marcador "aguardando confirmação".
 * Ativo em `npm run dev` ou ao abrir o site com ?previa no endereço.
 */
export const isPreview =
  import.meta.env.DEV ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('previa'));
