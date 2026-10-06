import type { ReactNode } from 'react';

/** Marca visualmente um conteúdo que ainda precisa ser preenchido pela clínica. */
export function Pending({ children }: { children: ReactNode }) {
  return (
    <span className="pending" title="Informação a ser preenchida pela clínica">
      {children}
    </span>
  );
}

/** Texto entre colchetes no config ("[Tratamento 01]") vira marcador. */
export function MaybePending({ text }: { text: string }) {
  return /^\[.*\]$/.test(text.trim()) ? <Pending>{text}</Pending> : <>{text}</>;
}
