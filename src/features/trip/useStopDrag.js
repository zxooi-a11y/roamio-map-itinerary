import { useEffect, useRef, useState } from 'react';

const HOLD_MS = 350;        // press-and-hold time before a drag starts
const HOLD_SLOP = 8;        // px of finger movement that cancels a hold
const CLICK_GUARD_MS = 400; // swallow the click that follows a drop
const EDGE = 70, SPEED = 14;

/**
 * Drag-and-drop for stops, within a day or across days. Works with mouse, touch and pen.
 *
 * Drag from the grip straight away, or press and hold anywhere on a stop.
 * While dragging, the real <li> floats (position: fixed) and never leaves the DOM,
 * so touch browsers keep sending it events. React renders a placeholder where it will land.
 *
 * Returns:
 *  target                 { stopId, dayId, index, height } | null — placeholder position
 *                         (index counts the target day's stops excluding the dragged one)
 *  startDrag(e, stopId)   pointerdown on the grip
 *  armPress(e, stopId)    pointerdown on the row (drag starts after a hold)
 *  justDropped()          true right after a drop, so card clicks can be ignored
 */
export function useStopDrag({ onDrop, getTopEdge }) {
  const [target, setTarget] = useState(null);
  const opts = useRef({});
  opts.current = { onDrop, getTopEdge, setTarget };
  const [ctl] = useState(() => createDragController(opts));

  useEffect(() => ctl.install(), [ctl]);

  return { target, startDrag: ctl.startDrag, armPress: ctl.armPress, justDropped: ctl.justDropped };
}

/** Plain (non-React) controller; created once per hook so its handlers are stable. */
function createDragController(opts) {
  let drag = null;  // { li, stopId, pid, offY, x, y, height, raf }
  let press = null; // { li, stopId, pid, x, y, startX, startY, timer }
  let target = null;
  let lastDrop = 0;

  const setTarget = (t) => { target = t; opts.current.setTarget(t); };

  /* ---------- where would it land? ---------- */
  function updateTarget() {
    if (!drag) return;
    const hit = document.elementsFromPoint(drag.x, drag.y).find((n) => !drag.li.contains(n) && n.closest?.('[data-day-card]'));
    const card = hit?.closest('[data-day-card]');
    if (!card || card.classList.contains('collapsed')) return;
    const items = [...card.querySelectorAll('ol.stops > li.stop:not(.drag-float)')];
    let index = items.findIndex((it) => {
      const r = it.getBoundingClientRect();
      return drag.y < r.top + r.height / 2;
    });
    if (index < 0) index = items.length;
    const dayId = card.getAttribute('data-day-card');
    if (!target || target.dayId !== dayId || target.index !== index) {
      setTarget({ stopId: drag.stopId, dayId, index, height: drag.height });
    }
  }

  /* ---------- drag ---------- */
  function onMove(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    e.preventDefault();
    drag.x = e.clientX; drag.y = e.clientY;
    drag.li.style.top = e.clientY - drag.offY + 'px';
    updateTarget();
  }

  function autoScroll() {
    if (!drag) return;
    const topEdge = (opts.current.getTopEdge?.() ?? 0) + 50;
    if (drag.y < topEdge) window.scrollBy(0, -SPEED * Math.min(1, (topEdge - drag.y) / 100));
    else if (drag.y > window.innerHeight - EDGE) window.scrollBy(0, SPEED * (1 - (window.innerHeight - drag.y) / EDGE));
    updateTarget();
    drag.raf = requestAnimationFrame(autoScroll);
  }

  const preventTouchScroll = (e) => { if (drag) e.preventDefault(); };

  function begin(li, stopId, pid, x, y) {
    const rect = li.getBoundingClientRect();
    try { li.releasePointerCapture(pid); } catch { /* not captured */ }
    Object.assign(li.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px' });
    li.classList.add('drag-float');
    document.body.classList.add('is-dragging');
    drag = { li, stopId, pid, offY: y - rect.top, x, y, height: rect.height, raf: 0 };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    window.addEventListener('touchmove', preventTouchScroll, { passive: false });
    updateTarget();
    drag.raf = requestAnimationFrame(autoScroll);
  }

  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.pid)) return;
    cancelAnimationFrame(drag.raf);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
    window.removeEventListener('touchmove', preventTouchScroll);
    document.body.classList.remove('is-dragging');
    drag.li.classList.remove('drag-float');
    Object.assign(drag.li.style, { left: '', top: '', width: '' });
    const dropped = e ? target : null; // no drop when torn down (unmount)
    drag = null;
    lastDrop = Date.now();
    setTarget(null);
    if (dropped) opts.current.onDrop(dropped.stopId, dropped.dayId, dropped.index);
  }

  function startDrag(e, stopId) {
    if (drag || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault();
    const li = e.currentTarget.closest('li.stop');
    if (li) begin(li, stopId, e.pointerId, e.clientX, e.clientY);
  }

  /* ---------- press and hold ---------- */
  function onPressMove(e) {
    if (!press || e.pointerId !== press.pid) return;
    press.x = e.clientX; press.y = e.clientY;
    if (Math.hypot(press.x - press.startX, press.y - press.startY) > HOLD_SLOP) cancelPress();
  }

  function cancelPress() {
    if (!press) return;
    clearTimeout(press.timer);
    press.li.classList.remove('pressing');
    window.removeEventListener('pointermove', onPressMove);
    window.removeEventListener('pointerup', cancelPress);
    window.removeEventListener('pointercancel', cancelPress);
    press = null;
  }

  function armPress(e, stopId) {
    if (drag || press) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('.grip, .tag, .del, .pin')) return;
    const li = e.currentTarget;
    const p = { li, stopId, pid: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, timer: 0 };
    press = p;
    li.classList.add('pressing');
    p.timer = setTimeout(() => {
      cancelPress();
      try { navigator.vibrate?.(15); } catch { /* unsupported */ }
      begin(li, stopId, p.pid, p.x, p.y);
    }, HOLD_MS);
    window.addEventListener('pointermove', onPressMove);
    window.addEventListener('pointerup', cancelPress);
    window.addEventListener('pointercancel', cancelPress);
  }

  const justDropped = () => Date.now() - lastDrop < CLICK_GUARD_MS;

  /** Global listeners for the lifetime of the component; returns the cleanup. */
  function install() {
    const swallowClick = (e) => { if (justDropped()) { e.stopPropagation(); e.preventDefault(); } };
    document.addEventListener('click', swallowClick, true);
    return () => {
      document.removeEventListener('click', swallowClick, true);
      cancelPress();
      endDrag();
    };
  }

  return { startDrag, armPress, justDropped, install };
}
