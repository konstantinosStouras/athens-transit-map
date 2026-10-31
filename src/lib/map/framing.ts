import type { LngLat } from "../glide";
import type { MetroLine } from "../metro";
import { bounds, type DrawnLine } from "./layers";

// One shared extent for selection changes, panel toggles and phone rotation.
// Rail coordinates are [lon, lat]; bounds() converts bus coordinates for us.
export function selectionBounds(bus: DrawnLine[], rail: MetroLine[], location?: LngLat): [LngLat, LngLat] | null {
  let frame = bounds(bus);
  const extend = ([lon, lat]: LngLat) => {
    if (!frame) frame = [[lon, lat], [lon, lat]];
    else {
      frame[0][0] = Math.min(frame[0][0], lon);
      frame[0][1] = Math.min(frame[0][1], lat);
      frame[1][0] = Math.max(frame[1][0], lon);
      frame[1][1] = Math.max(frame[1][1], lat);
    }
  };
  for (const line of rail) for (const path of line.paths) for (const point of path) extend(point);
  // With no selected geometry, leave the initial location/follow view alone.
  if (frame && location) extend(location);
  return frame;
}
