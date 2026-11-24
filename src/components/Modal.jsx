import { useEffect } from 'react';
import { Icon } from './UI';

export default function Modal({ title, onClose, children, footer, isOpen = true }) {
  if (isOpen === false) return null;
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', f);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', f); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon n="x" /></button></header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}
