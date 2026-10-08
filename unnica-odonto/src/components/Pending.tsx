import type { ReactNode } from 'react';
import { SHOW_PENDING } from '../config/clinic';

export const isPlaceholder = (text: string) => /^\[.*\]$/.test(text.trim());

/** Marca visualmente um conteúdo que ainda precisa ser preenchido pela clínica. */
export function Pending({ children }: { children: ReactNode }) {
  if (!SHOW_PENDING) return null;
  return (
    <span className="pending" title="Informação a ser preenchida pela clínica">
      {children}
    </span>
  );
}

/** Texto entre colchetes no config ("[Tratamento 01]") vira marcador. */
export function MaybePending({ text }: { text: string }) {
  return isPlaceholder(text) ? <Pending>{text}</Pending> : <>{text}</>;
}
