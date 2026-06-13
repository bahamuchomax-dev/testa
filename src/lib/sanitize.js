/* Firestore rejects writes that contain `undefined`. Instead of sending
 * `role: undefined` / `isTeacher: undefined`, strip those keys entirely
 * before saving. Recurses into nested objects/arrays.
 */
export function stripUndefined(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripUndefined);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    out[k] = v && typeof v === "object" ? stripUndefined(v) : v;
  }
  return out;
}
