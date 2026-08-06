/** Rounds at a decimal precision with midpoint ties moving away from zero. */
export function roundNumber(value: number, precision: number): number | undefined {
  const factor = 10 ** precision;
  const scaled = value * factor;
  if (!Number.isFinite(factor) || factor === 0 || !Number.isFinite(scaled)) {
    return undefined;
  }

  const roundedMagnitude = Math.round(Math.abs(scaled));
  const rounded = (Math.sign(scaled) * roundedMagnitude) / factor;
  if (!Number.isFinite(rounded)) {
    return undefined;
  }
  return rounded === 0 ? 0 : rounded;
}
