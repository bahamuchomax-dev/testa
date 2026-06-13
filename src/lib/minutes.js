/* Study-minutes validation.
 *
 * UIs use `min="1"`, but that is trivially bypassed (devtools, direct
 * writes), so every numeric study log must be validated in JS *and* in
 * Firestore Rules. This is the JS half.
 *
 * Behaviour (matches the original fix): round to the nearest whole
 * minute, then reject anything below 1. So 0.4 -> null (the old
 * `parsePositiveMinutes(0.4) === 0` bug), "" / NaN / negative -> null.
 * Note: because we round first, 0.6 -> 1 (accepted as one minute).
 */
export function parsePositiveMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return null;
  const rounded = Math.round(minutes);
  if (rounded < 1) return null;
  return rounded;
}
