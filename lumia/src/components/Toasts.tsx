import { useApp } from '@/context/AppContext';

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-tone={t.tone}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
