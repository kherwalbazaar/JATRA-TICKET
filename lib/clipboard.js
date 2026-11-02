/**
 * Clipboard write that survives the environments this app runs in.
 *
 * The Capacitor WebView and plain-HTTP contexts reject
 * `navigator.clipboard.writeText` with NotAllowedError, so callers must never
 * see an unhandled rejection — the legacy textarea/execCommand path is used as
 * the fallback and the result is returned as a boolean.
 */
export async function copyTextToClipboard(text) {
  const value = String(text ?? "");
  if (typeof window === "undefined") return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* falls through to the legacy path below */
  }

  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
