/**
 * Canonical Payment Methods & Booking Parameters Module
 * JATRA BAZAAR Booking Engine
 *
 * Dimensions:
 * 1. Booking Channel / Source: 'Online' | 'Counter'
 * 2. Booking Method (UI): 'direct' | 'counter' | 'paytm'
 * 3. Payment Method (Financial Instrument): 'UPI' | 'Cash' | 'Card' | 'Net Banking' | 'Wallet' | 'Other'
 * 4. Payment Transaction Status: 'Successful' | 'Pending' | 'Failed' | 'Refunded' | 'Cancelled'
 */

export const CANONICAL_PAYMENT_METHODS = [
  "UPI",
  "Cash",
  "Card",
  "Net Banking",
  "Wallet",
  "Other",
];

export const CANONICAL_PAYMENT_STATUSES = [
  "Successful",
  "Pending",
  "Failed",
  "Refunded",
  "Cancelled",
];

export const CANONICAL_BOOKING_SOURCES = [
  "Online",
  "Counter",
];

const PAYMENT_METHOD_MAP = {
  // UPI
  "upi": "UPI",
  "gpay": "UPI",
  "google pay": "UPI",
  "googlepay": "UPI",
  "phonepe": "UPI",
  "paytm upi": "UPI",
  "bhim": "UPI",
  "direct": "UPI",
  "direct booking": "UPI",
  "direct instant booking": "UPI",
  "instant": "UPI",
  "online": "UPI",

  // Cash / Counter
  "cash": "Cash",
  "counter": "Cash",
  "pay at counter": "Cash",
  "pay at entry gate": "Cash",
  "pay at entry gate / counter": "Cash",
  "entry gate": "Cash",

  // Card
  "card": "Card",
  "debit card": "Card",
  "credit card": "Card",
  "pos": "Card",
  "debit": "Card",
  "credit": "Card",

  // Net Banking
  "netbanking": "Net Banking",
  "net banking": "Net Banking",
  "net_banking": "Net Banking",
  "internet banking": "Net Banking",
  "nb": "Net Banking",

  // Wallet
  "wallet": "Wallet",
  "paytm wallet": "Wallet",
  "paytm": "Wallet",
  "ppi": "Wallet",

  // Other
  "other": "Other",
  "offline": "Other",
  "cheque": "Other",
};

/**
 * Validates and maps an input payment method string into a canonical value.
 * Throws a descriptive error for invalid / unsupported methods (never silently defaults).
 */
export function resolveCanonicalPaymentMethod(input) {
  if (!input || typeof input !== "string" || !input.trim()) {
    throw new Error(
      `Payment method is required. Allowed values are: ${CANONICAL_PAYMENT_METHODS.join(", ")}`
    );
  }

  const trimmed = input.trim();

  // If already exactly a canonical value
  if (CANONICAL_PAYMENT_METHODS.includes(trimmed)) {
    return trimmed;
  }

  // Strip "Simulated" prefix from test UI and parentheticals like "(Google Pay)"
  const clean = trimmed
    .replace(/^simulated\s+/i, "")
    .replace(/\s*\([^)]*\)$/g, "")
    .toLowerCase()
    .trim();

  const mapped = PAYMENT_METHOD_MAP[clean];
  if (mapped && CANONICAL_PAYMENT_METHODS.includes(mapped)) {
    return mapped;
  }

  throw new Error(
    `Unsupported payment method: "${input}". Allowed canonical values are: ${CANONICAL_PAYMENT_METHODS.join(", ")}`
  );
}

/**
 * Checks whether a given string is a valid canonical payment method.
 */
export function isValidPaymentMethod(val) {
  return typeof val === "string" && CANONICAL_PAYMENT_METHODS.includes(val.trim());
}

/**
 * Resolves the booking method, payment status, channel, and source based on booking selection.
 */
export function resolveBookingParameters({
  bookingMethod = "direct",
  paymentMethodInput = "",
  isCounterSale = false,
}) {
  const methodKey = String(bookingMethod || (isCounterSale ? "counter" : "direct")).toLowerCase().trim();

  if (methodKey === "counter" || isCounterSale) {
    const rawMethod = paymentMethodInput || "Cash";
    const canonicalMethod = resolveCanonicalPaymentMethod(rawMethod);
    return {
      bookingMethod: "counter",
      canonicalMethod,
      // If customer booked online to pay at counter: Pending payment.
      // If booked physically at counter by staff: Successful payment.
      paymentStatus: isCounterSale ? "Successful" : "Pending",
      paymentChannel: "Counter",
      source: isCounterSale ? "Counter" : "Online",
      bookingStatus: "Confirmed",
      status: "Confirmed",
    };
  }

  if (methodKey === "paytm") {
    const rawMethod = paymentMethodInput || "UPI";
    const canonicalMethod = resolveCanonicalPaymentMethod(rawMethod);
    return {
      bookingMethod: "paytm",
      canonicalMethod,
      paymentStatus: "Pending", // S2S verification required
      paymentChannel: "Online",
      source: "Online",
      bookingStatus: "Pending",
      status: "Pending",
    };
  }

  // Direct Instant Booking (defaults to instant UPI if not specified)
  const rawMethod = paymentMethodInput || "UPI";
  const canonicalMethod = resolveCanonicalPaymentMethod(rawMethod);
  return {
    bookingMethod: "direct",
    canonicalMethod,
    paymentStatus: "Successful",
    paymentChannel: "Online",
    source: "Online",
    bookingStatus: "Confirmed",
    status: "Confirmed",
  };
}
