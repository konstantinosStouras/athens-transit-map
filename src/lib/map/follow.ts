/** Ignore GPS jitter that cannot move the map by even half a screen pixel. */
export function needsRecenter(target: { x: number; y: number }, center: { x: number; y: number }): boolean {
  return Math.hypot(target.x - center.x, target.y - center.y) >= 0.5;
}
