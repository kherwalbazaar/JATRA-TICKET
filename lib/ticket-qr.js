/**
 * Single source of truth for the QR payload every ticket screen prints.
 *
 * Both gate scanners resolve a payload to a booking through
 * `bookings.ticketNumber`:
 *   - SCANNER            -> verifyTicketNumber()
 *   - JATRA BAZAAR ADMIN -> validateAndRecordEntry()
 * so `id` MUST be the booking number (NJ26-00001), never the per-seat
 * serial (NJ26-00001-2) or the doc id — otherwise the scan comes back
 * "Ticket Not Found".
 */
export const QR_ENDPOINT = "https://api.qrserver.com/v1/create-qr-code/";

export function ticketQrPayload(ticket) {
  const source = ticket || {};
  const bookingNumber =
    source.baseTicketNumber || source.ticketNumber || source.serial || "";

  return encodeURIComponent(
    JSON.stringify({
      id: String(bookingNumber),
      seat: source.seat || "",
      event: source.eventName || source.event || "",
    }),
  );
}

export function ticketQrUrl(ticket, size = 300) {
  return `${QR_ENDPOINT}?size=${size}x${size}&data=${ticketQrPayload(ticket)}`;
}
