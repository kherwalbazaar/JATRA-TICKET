/**
 * Local copy of the customer's booked tickets.
 *
 * Every confirmed booking is written here right after payment so "My Tickets"
 * and the ticket/QR detail page can render instantly (and offline) before the
 * database list arrives. Database records always override the local copy.
 */

const STORAGE_KEY = "jatra_my_tickets_v1";
const MAX_BOOKINGS = 50;

function readRecords() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((r) => r && r.booking) : [];
  } catch {
    return [];
  }
}

function writeRecords(records) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_BOOKINGS)));
  } catch (err) {
    console.warn("myTickets save failed:", err?.message || err);
  }
}

export function saveBookedTickets(booking, tickets = []) {
  if (!booking || typeof window === "undefined") return;
  const bookingNumber = String(
    booking.ticket_number || booking.ticketNumber || booking.bookingId || ""
  ).trim();
  if (!bookingNumber) return;

  const record = {
    bookingNumber,
    orderId: booking.id || "",
    savedAt: new Date().toISOString(),
    booking,
    tickets: Array.isArray(tickets) ? tickets : [],
  };

  const records = readRecords().filter(
    (r) => String(r.bookingNumber || "").toUpperCase() !== bookingNumber.toUpperCase()
  );
  records.unshift(record);
  writeRecords(records);
}

function toBookingView(record) {
  const b = record.booking || {};
  const seats = Array.isArray(b.seats) ? b.seats.filter(Boolean) : [];
  return {
    ...b,
    key: b.id || record.orderId,
    id: b.id || record.orderId,
    bookingId: b.ticket_number || record.bookingNumber,
    ticketNumber: b.ticket_number || record.bookingNumber,
    eventId: b.event_id || b.eventId,
    eventName: b.event_name || b.eventName,
    customerName: b.customer_name || b.customerName,
    customerPhone: b.customer_phone || b.customerPhone,
    customerEmail: b.customer_email || b.customerEmail,
    status: "Confirmed",
    bookingStatus: b.booking_status || "Confirmed",
    paymentStatus: b.payment_status || "Successful",
    seats,
    quantity: Number(b.quantity) || seats.length || 1,
    date: b.date,
    time: b.time,
    block: b.block,
    amount: b.amount,
    unitPrice: b.unit_price,
    paymentMethod: b.payment_method,
    source: b.source,
    local: true,
  };
}

function toTicketView(record, row) {
  const t = row || {};
  return {
    ...t,
    key: t.ticket_id || t.id,
    id: t.ticket_id || t.id,
    ticketId: t.ticket_id || t.id,
    ticketNumber: t.ticket_id || t.id,
    bookingId: t.booking_id || record.bookingNumber,
    bookingDocId: t.booking_doc_id || record.orderId,
    baseTicketNumber: t.booking_id || record.bookingNumber,
    eventId: t.event_id,
    eventName: t.event_name,
    seat: t.seat,
    seatIndex: t.seat_index,
    seatCount: t.seat_count,
    ticketIndex: t.ticket_index,
    totalTickets: t.total_tickets,
    ticketTypeName: t.ticket_type_name,
    block: t.block,
    assignedGate: t.assigned_gate,
    customerName: t.customer_name,
    customerPhone: t.customer_phone,
    serialNumber: t.serial_number,
    qrToken: t.qr_token,
    status: t.status || "ACTIVE",
    date: t.date,
    time: t.time,
    unitPrice: t.unit_price,
    local: true,
  };
}

export function readLocalBookings() {
  return readRecords().map(toBookingView);
}

export function readLocalTickets() {
  const tickets = [];
  readRecords().forEach((record) => {
    (record.tickets || []).forEach((row) => tickets.push(toTicketView(record, row)));
  });
  return tickets;
}

/**
 * Flattened booking + seat ticket for /tickets/[id], where `id` may be the
 * booking number (`NJ26-00001`), an order id, or a per-seat ticket number.
 */
export function findLocalTicketView(id) {
  const needle = String(id || "").trim().toUpperCase();
  if (!needle) return null;

  const records = readRecords();
  for (const record of records) {
    const rows = record.tickets || [];
    const bookingNumber = String(record.bookingNumber || "").toUpperCase();
    const orderId = String(record.orderId || "").toUpperCase();

    const matchedRow = rows.find((row) => {
      const ticketId = String(row.ticket_id || row.id || "").toUpperCase();
      return ticketId === needle || ticketId.replace(/-\d+$/, "") === needle;
    });

    if (matchedRow) {
      const bookingView = toBookingView(record);
      return { ...bookingView, ...toTicketView(record, matchedRow), seats: bookingView.seats };
    }

    if (bookingNumber === needle || orderId === needle) {
      const bookingView = toBookingView(record);
      return {
        ...bookingView,
        ...(rows[0] ? toTicketView(record, rows[0]) : {}),
        seats: bookingView.seats,
      };
    }
  }
  return null;
}

export function mergeBookings(local = [], remote = []) {
  const map = new Map();
  const put = (booking) => {
    const key = String(
      booking?.bookingId || booking?.ticketNumber || booking?.id || booking?.key || ""
    ).toUpperCase();
    if (key) map.set(key, booking);
  };
  local.forEach(put);
  remote.forEach(put);
  return Array.from(map.values());
}

export function mergeTickets(local = [], remote = []) {
  const map = new Map();
  const put = (ticket) => {
    const key = String(
      ticket?.ticketId || ticket?.ticketNumber || ticket?.id || ""
    ).toUpperCase();
    if (key) map.set(key, ticket);
  };
  local.forEach(put);
  remote.forEach(put);
  return Array.from(map.values());
}
