import type { CityVehicle, Vehicle } from "./types";

// Only fresh, finite measurements contribute to quality and speed figures.
export function overview(vehicles: Pick<Vehicle | CityVehicle, "position_at" | "delay_s" | "speed">[], now: number) {
  const fresh = vehicles.filter(v => Number.isFinite(v.position_at) && v.position_at > 0 && now - v.position_at <= 120 && now >= v.position_at - 30);
  const measured = fresh.filter(v => v.delay_s != null && Number.isFinite(v.delay_s));
  const speeds = fresh.flatMap(v => v.speed != null && Number.isFinite(v.speed) && v.speed >= 0 ? [v.speed * 3.6] : []);
  return {
    total: vehicles.length, fresh: fresh.length, stale: vehicles.length - fresh.length,
    measured: measured.length, unknown: fresh.length - measured.length,
    onTime: measured.filter(v => v.delay_s! <= 120).length,
    late: measured.filter(v => v.delay_s! > 120).length,
    maxKmh: speeds.length ? Math.max(...speeds) : null, speedSamples: speeds.length,
  };
}
