/**
 * Air vapour pressure deficit from a temperature and a relative humidity.
 * Tetens' formula. This is AIR VPD: leaf VPD needs a leaf temperature nobody
 * enters, so the charts say "air" and the number is not passed off as more.
 */
export function vpdKpa(tempF: number | undefined, rh: number | undefined): number | undefined {
  if (tempF === undefined || rh === undefined || !Number.isFinite(tempF + rh)) return undefined;
  const c = ((tempF - 32) * 5) / 9;
  const saturation = 0.6108 * Math.exp((17.27 * c) / (c + 237.3));
  return Math.round(saturation * (1 - rh / 100) * 100) / 100;
}
