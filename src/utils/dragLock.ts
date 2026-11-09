import type Konva from 'konva';

/** Shift constraints like Photoshop: a drag with Shift moves only along the axis it moved most on, a line snaps to 45°. */

const starts = new WeakMap<Konva.Node, { x: number; y: number }>();

/** Call on dragstart of a draggable node. */
export const lockStart = (e: Konva.KonvaEventObject<DragEvent>) => void starts.set(e.target, e.target.position());

/** Call first in dragmove (before reading the node's position): with Shift held the other axis stays where it started. */
export function lockAxis(e: Konva.KonvaEventObject<DragEvent>) {
  const s = starts.get(e.target);
  if (!s || !e.evt?.shiftKey) return;
  const p = e.target.position();
  if (Math.abs(p.x - s.x) >= Math.abs(p.y - s.y)) e.target.y(s.y);
  else e.target.x(s.x);
}

/** `to` turned about `from` onto the nearest multiple of 45°, keeping its distance. */
export function snap45(from: [number, number], to: [number, number]): [number, number] {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return [Math.round((from[0] + len * Math.cos(a)) * 10) / 10, Math.round((from[1] + len * Math.sin(a)) * 10) / 10];
}

/** Rotation angles the transformers snap to while Shift is held. */
export const ROTATION_SNAPS = Array.from({ length: 24 }, (_, i) => i * 15);
