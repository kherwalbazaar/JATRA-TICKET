/**
 * Contact numbers can arrive as a single string holding several numbers
 * (e.g. "+91 6372859599 / +91 9437123456") or as separate party fields.
 * Split them into a clean, de-duplicated list for card-style rendering.
 */
export function splitPhoneNumbers(...values) {
  const parts = values
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
    .flatMap((value) => String(value).split(/[/|]/))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(parts));
}
