/** Sensible auto-arrangement for a fan-out grid: roughly square, rounding the
 * column count up so a partially-filled last row is never wider than it is
 * tall. `0` and `1` sessions both get a single column (an empty or one-tile
 * grid has nothing to arrange). */
export function gridColumns(count: number): number {
  if (count <= 1) {
    return 1;
  }
  return Math.ceil(Math.sqrt(count));
}
