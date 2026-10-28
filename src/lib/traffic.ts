/** A traffic source must be an explicitly configured HTTPS XYZ raster template. */
export function trafficTileTemplate(value: string | undefined): string | null {
  const url = value?.trim() ?? "";
  return /^https:\/\//i.test(url) && ["{z}", "{x}", "{y}"].every(key => url.includes(key)) ? url : null;
}
