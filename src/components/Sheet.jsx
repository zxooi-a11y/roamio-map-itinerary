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

    // Keep the sheet within the visible area: on phones the on-screen keyboard shrinks the visual
    // viewport without changing the layout viewport, so CSS units alone would let it be covered.
    const vv = window.visualViewport;
    const sync = () => dlg.style.setProperty('--vv-h', vv.height + 'px');
    if (vv) { sync(); vv.addEventListener('resize', sync); }

    return () => {
      vv?.removeEventListener('resize', sync);
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
