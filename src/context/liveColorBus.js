import { useEffect, useLayoutEffect, useRef } from 'react';

// Lets a color picker push color updates straight to the DOM via refs, bypassing React,
// so every icon showing a clipboard's color (sidebar, clipboards list, detail header,
// submenus) can track a drag at native mousemove speed. The store dispatch still runs
// alongside it to persist the real value — this bus is only the live visual preview.
const listeners = new Map(); // clipboardId -> Set<(hex) => void>

export function publishLiveColor(clipboardId, hex) {
  listeners.get(clipboardId)?.forEach((fn) => fn(hex));
}

function subscribeLiveColor(clipboardId, fn) {
  if (!listeners.has(clipboardId)) listeners.set(clipboardId, new Set());
  const set = listeners.get(clipboardId);
  set.add(fn);
  return () => {
    set.delete(fn);
    if (set.size === 0) listeners.delete(clipboardId);
  };
}

const applyColorStyle = (el, hex) => { el.style.color = hex; };

// Attach the returned ref to the element whose color should track a clipboard's color
// live — and don't also pass a `color`/`backgroundColor` style prop to that same
// element, or React will fight the ref for ownership of the property.
//
// `color` is the normal reactive fallback, applied via useLayoutEffect (before paint,
// so there's no flash of unstyled color on mount). Live-bus updates during a drag write
// the same way. Pass `apply` to set more than just `color` (e.g. a badge that also needs
// its background kept in sync) — defaults to `el.style.color = hex`.
export function useLiveClipboardColorRef(clipboardId, color, apply = applyColorStyle) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (ref.current) apply(ref.current, color);
  }, [color, apply]);

  useEffect(() => {
    if (!clipboardId) return undefined;
    return subscribeLiveColor(clipboardId, (hex) => {
      if (ref.current) apply(ref.current, hex);
    });
  }, [clipboardId, apply]);

  return ref;
}
