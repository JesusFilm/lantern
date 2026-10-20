import { useRef, type PointerEvent } from "react";

/** A horizontal touch gesture is optional; callers always provide tap controls.
 * Native vertical scrolling and pinch zoom stay with the browser (pan-y pinch-zoom).
 */
export function useSwipeNavigation(enabled: boolean, previous: () => void, next: () => void) {
  const start = useRef<{ x: number; y: number } | undefined>(undefined);
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      start.current = undefined;
      if (!enabled || event.pointerType !== "touch" || !event.isPrimary ||
        event.clientX < 24 || event.clientX > innerWidth - 24 ||
        (event.target as Element).closest("button, a, input, select, textarea, summary")) return;
      start.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerCancel() { start.current = undefined; },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const from = start.current;
      start.current = undefined;
      if (!enabled || !from || !window.getSelection()?.isCollapsed) return;
      const dx = event.clientX - from.x, dy = event.clientY - from.y;
      if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0) previous(); else next();
      }
    },
  };
}
