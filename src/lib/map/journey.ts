import { pointAt, stopOffsets } from "../predict";
import { distanceM } from "../glide";
import type { DrawnLine } from "./layers";

export interface JourneyLeg {
  line: string; variant: string; i: number; j: number;
  from: [number, number]; to: [number, number];
}

// Cut each selected direction at its boarding and alighting stops. Project the
// complete ordered stop sequence so repeated streets on loops stay in order.
export function journeyLines(lines: DrawnLine[], legs: JourneyLeg[]): DrawnLine[] {
  if (!legs.length) return lines;
  return legs.flatMap(leg => {
    const line = lines.find(l => l.id === leg.line);
    const v = line?.data.variants[leg.variant];
    if (!line || !v) return [];
    const stops = v.stops.map(id => line.data.stops[id]);
    let shape: [number, number][] = [];
    if (v.shape.length > 1 && stops.every(Boolean) && stops[leg.i] && stops[leg.j]
      && distanceM([stops[leg.i].lon, stops[leg.i].lat], [leg.from[1], leg.from[0]]) < 100
      && distanceM([stops[leg.j].lon, stops[leg.j].lat], [leg.to[1], leg.to[0]]) < 100) {
      const offsets = stopOffsets(v.shape, stops.map(s => [s.lon, s.lat]));
      const start = offsets[leg.i], end = offsets[leg.j];
      if (end > start) {
        const flip = ([lon, lat]: [number, number]): [number, number] => [lat, lon];
        shape = [flip(pointAt(v.shape, start))];
        let travelled = 0;
        for (let i = 1; i < v.shape.length; i++) {
          travelled += distanceM([v.shape[i - 1][1], v.shape[i - 1][0]], [v.shape[i][1], v.shape[i][0]]);
          if (travelled > start && travelled < end) shape.push(v.shape[i]);
        }
        shape.push(flip(pointAt(v.shape, end)));
      }
    }
    return [{ ...line, visible: new Set([leg.variant]), data: { ...line.data,
      variants: { [leg.variant]: { ...v, shape, stops: v.stops.slice(leg.i, leg.j + 1) } } } }];
  });
}
