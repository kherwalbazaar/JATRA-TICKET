/**
 * Single source of truth for the QR payload every ticket screen prints.
 *
 * Each ticket card encodes its specific ticket number (e.g. NJ26-00001-1)
 * as `id`, along with `bookingId` (NJ26-00001) and `seat` (e.g. A-1).
 * This ensures that scanning 1 ticket checks in ONLY that individual ticket,
 * while leaving the remaining tickets in the booking active.
 */
export const QR_ENDPOINT = "https://api.qrserver.com/v1/create-qr-code/";

export function ticketQrPayload(ticket) {
  const source = ticket || {};
  // Prioritize the individual per-ticket ID (e.g. NJ26-00001-2)
  const ticketId =
    source.ticketId || source.ticketNumber || source.serial || "";
  const bookingNumber =
    source.bookingId || source.baseTicketNumber || "";
  const qrToken = source.qrToken || "";

  // Secure payload: individual ticket identifier + unique token, no sensitive personal info
  return encodeURIComponent(
    JSON.stringify({
      id: String(ticketId),
      token: String(qrToken),
      bookingId: String(bookingNumber),
      seat: source.seat || "",
    }),
  );
}

export function ticketQrUrl(ticket, size = 300) {
  return `${QR_ENDPOINT}?size=${size}x${size}&data=${ticketQrPayload(ticket)}`;
}
