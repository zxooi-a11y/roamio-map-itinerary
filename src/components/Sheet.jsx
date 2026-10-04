import { useEffect, useRef } from 'react';

/**
 * A modal pop-up built on <dialog> (a bottom sheet on phones).
 * It opens when mounted, so render it conditionally: `{open && <Sheet …/>}`.
 * That way every opening starts with fresh form state.
 * Closes via Esc, a backdrop click or the ✕ button, all of which call onClose.
 */
export function Sheet({ onClose, titleId, title, subtitle, footer, children, style }) {
  const ref = useRef(null);

  useEffect(() => {
    const dlg = ref.current;
    dlg.showModal();
    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
      if (dlg.open) dlg.close();
    };
  }, []);

  const onClick = (e) => {
    // Clicks on the ::backdrop land on the <dialog> itself, outside its box
    if (e.target !== ref.current) return;
    const r = ref.current.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
  };

  return (
    <dialog ref={ref} className="sheet" aria-labelledby={titleId} style={style}
      onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={onClick}>
      <div className="ad-head">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>✕</button>
      </div>
      <div className="ad-body">{children}</div>
      <div className="ad-foot">{footer}</div>
    </dialog>
  );
}
