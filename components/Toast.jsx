import { useApp } from '../context/AppContext';
import { Icon } from './UI';

export default function Toasts() {
  const { toasts, dismiss } = useApp();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.message}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss"><Icon n="x" size={16} /></button>
        </div>
      ))}
    </div>
  );
}
