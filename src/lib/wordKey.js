/* Stable identity for a vocabulary word.
 *
 * Factory delete used to key only on `id`. Old records have no `id`,
 * so deleting one of them wiped *every* id-less word at once. Keying on
 * wordKey() fixes that, and also distinguishes the same English term
 * when it appears under a different category or stage.
 */
export function wordKey(word) {
  if (!word || typeof word !== "object") return "";
  if (word.id != null && word.id !== "") return "id:" + word.id;
  const en = (word.en ?? word.word ?? word.term ?? "").toString().trim().toLowerCase();
  const cat = (word.category ?? word.cat ?? "").toString().trim();
  const stage = (word.stage ?? "").toString().trim();
  return "w:" + en + "|c:" + cat + "|s:" + stage;
}
