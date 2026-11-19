import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, PointerEvent } from 'react';
import { GripVertical } from 'lucide-react';

type GoalItem = { key: string };
type Drag = {
  key: string;
  pointer: number;
  startY: number;
  scrollY: number;
  offset: number;
  target: number;
  rows: { key: string; top: number; height: number }[];
};

export function GoalOrder<T extends GoalItem>({ items, onReorder, children }: {
  items: T[];
  onReorder: (key: string, index: number) => void;
  children: (item: T, index: number) => ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  const active = useRef<Drag | null>(null);
  const dropPositions = useRef<Map<string, number> | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  useLayoutEffect(() => {
    const positions = dropPositions.current;
    if (!positions || !list.current) return;
    dropPositions.current = null;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const element of list.current.children) {
      const previous = positions.get(element.getAttribute('data-goal-key')!);
      if (previous === undefined) continue;
      // A preview transition can still contribute its old transform after the
      // DOM moves. Measure the new layout only after cancelling that animation.
      element.getAnimations().forEach(animation => animation.cancel());
      const offset = previous - element.getBoundingClientRect().top;
      if (Math.abs(offset) < 1) continue;
      element.animate([
        { transform: `translateY(${offset}px)` },
        { transform: 'translateY(0)' },
      ], { duration: 160, easing: 'ease-out' });
    }
  });

  function start(event: PointerEvent<HTMLButtonElement>, key: string) {
    if (event.button !== 0 || !event.isPrimary || active.current) return;
    const rows = Array.from(list.current!.children).map((element, index) => {
      element.getAnimations().forEach(animation => animation.cancel());
      const rect = element.getBoundingClientRect();
      return { key: items[index]!.key, top: rect.top, height: rect.height };
    });
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    active.current = { key, pointer: event.pointerId, startY: event.clientY,
      scrollY: window.scrollY, offset: 0, target: items.findIndex(item => item.key === key), rows };
    setDrag(active.current);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = active.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (event.clientY < 70) window.scrollBy(0, -16);
    else if (event.clientY > window.innerHeight - 70) window.scrollBy(0, 16);
    const offset = event.clientY - current.startY + window.scrollY - current.scrollY;
    const row = current.rows.find(row => row.key === current.key)!;
    const center = row.top + row.height / 2 + offset;
    const target = current.rows.filter(row => row.key !== current.key && center > row.top + row.height / 2).length;
    active.current = { ...current, offset, target };
    setDrag(active.current);
  }
  function finish(event: PointerEvent<HTMLButtonElement>, save: boolean) {
    const current = active.current;
    if (!current || current.pointer !== event.pointerId) return;
    dropPositions.current = new Map(Array.from(list.current!.children).map(element => [
      element.getAttribute('data-goal-key')!, element.getBoundingClientRect().top,
    ]));
    active.current = null;
    setDrag(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (save) onReorder(current.key, current.target);
  }

  const source = drag ? items.findIndex(item => item.key === drag.key) : -1;
  const distance = drag ? drag.rows[source]!.height + 14 : 0;
  return <div ref={list} className={`week-goal-list${drag ? ' is-reordering' : ''}`}>
    {items.map((item, index) => {
      const moving = drag?.key === item.key;
      const offset = moving ? drag.offset : drag && index > source && index <= drag.target ? -distance
        : drag && index < source && index >= drag.target ? distance : 0;
      return <div key={item.key} data-goal-key={item.key} className={`week-goal-row${moving ? ' is-dragging' : ''}`}
        style={{ transform: `translateY(${offset}px)` }}>
        <button type="button" className="week-goal-grip" disabled={items.length < 2}
          aria-label={`Reorder goal ${index + 1}`} title="Drag to reorder · Arrow keys to move"
          onPointerDown={event => start(event, item.key)} onPointerMove={move}
          onPointerUp={event => finish(event, true)} onPointerCancel={event => finish(event, false)}
          onLostPointerCapture={event => finish(event, false)}
          onKeyDown={event => {
            if (event.key === 'Escape') { active.current = null; setDrag(null); }
            if (!active.current && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
              event.preventDefault();
              onReorder(item.key, Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1))));
            }
          }}><GripVertical size={18} /></button>
        {children(item, index)}
      </div>;
    })}
  </div>;
}
