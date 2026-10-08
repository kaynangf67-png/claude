import { Minus, Plus, ArrowLeftRight, Minimize2, X, RotateCcw } from 'lucide-react';

export interface AvatarControlsProps {
  label: string;
  onSmaller: () => void;
  onLarger: () => void;
  onSwapSide: () => void;
  onReset: () => void;
  onCollapse: () => void;
  onClose: () => void;
  compact?: boolean;
}

/** Barra do intérprete: arrastar (pela barra), tamanho, lado, recolher, desligar. */
export function AvatarControls(p: AvatarControlsProps) {
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <div className="interp-bar" data-drag-handle>
      <span className="grip">{p.compact ? '' : p.label}</span>
      <button onPointerDown={stop} onClick={p.onSmaller} aria-label="Diminuir intérprete" title="Diminuir">
        <Minus size={15} />
      </button>
      <button onPointerDown={stop} onClick={p.onLarger} aria-label="Aumentar intérprete" title="Aumentar">
        <Plus size={15} />
      </button>
      {!p.compact && (
      <button onPointerDown={stop} onClick={p.onSwapSide} aria-label="Trocar de lado" title="Trocar de lado">
        <ArrowLeftRight size={15} />
      </button>
      )}
      {!p.compact && (
      <button onPointerDown={stop} onClick={p.onReset} aria-label="Posição e tamanho padrão" title="Restaurar padrão">
        <RotateCcw size={14} />
      </button>
      )}
      <button onPointerDown={stop} onClick={p.onCollapse} aria-label="Recolher intérprete" title="Recolher">
        <Minimize2 size={15} />
      </button>
      <button onPointerDown={stop} onClick={p.onClose} aria-label="Desligar intérprete" title="Desligar">
        <X size={15} />
      </button>
    </div>
  );
}
