/**
 * Gateway-Independent Customer Charge Calculation System
 *
 * Designed to separate pricing and customer charge calculation from any payment gateway.
 * A payment gateway (e.g. Razorpay, Cashfree, PhonePe, Paytm, Stripe) can be integrated
 * later without altering this customer charge calculation system.
 *
 * Charge structure:
 *   Ticket Amount
 *   + Convenience Fee (2.70% of Ticket Amount)
 *   + GST on Convenience Fee (18% on Convenience Fee only)
 *   + Platform Charge (₹8.00 fixed per booking)
 *   = Final Customer Amount
 */

export const PRICING_CONFIG = {
  // Convenience Fee: 2.70% of total ticket amount
  CONVENIENCE_FEE_PERCENTAGE: 2.7,
  CONVENIENCE_FEE_RATE: 0.027,

  // GST: 18% applied strictly to the convenience fee only
  CONVENIENCE_FEE_GST_PERCENTAGE: 18,
  CONVENIENCE_FEE_GST_RATE: 0.18,

  // Platform Charge: Fixed ₹8 per booking
  PLATFORM_CHARGE: 8.0,

  CURRENCY: "INR",
  CURRENCY_SYMBOL: "₹",
};

/**
 * Standard financial rounding to 2 decimal places (paise)
 */
export function roundToPaise(value) {
  const num = Number(value) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Formats an amount as INR currency (e.g. ₹523.93)
 */
export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `₹${num.toFixed(2)}`;
}

/**
 * Core customer charge calculation engine.
 *
 * @param {number} ticketAmount - The raw ticket amount (seatPrice * seatCount or unitPrice * quantity)
 * @returns {object} Full itemized breakdown and final customer amount
 */
export function calculateCustomerCharges(ticketAmount) {
  const baseTicket = Math.max(0, roundToPaise(Number(ticketAmount) || 0));

  if (baseTicket === 0) {
    return {
      ticketAmount: 0,
      convenienceFee: 0,
      gstOnConvenienceFee: 0,
      platformCharge: 0,
      totalConvenienceFeeWithGst: 0,
      totalFees: 0,
      finalCustomerAmount: 0,
      finalAmountInPaise: 0,
      rates: {
        convenienceFeePercentage: PRICING_CONFIG.CONVENIENCE_FEE_PERCENTAGE,
        gstPercentage: PRICING_CONFIG.CONVENIENCE_FEE_GST_PERCENTAGE,
        platformCharge: PRICING_CONFIG.PLATFORM_CHARGE,
      },
      formatted: {
        ticketAmount: "₹0.00",
        convenienceFee: "₹0.00",
        gstOnConvenienceFee: "₹0.00",
        platformCharge: "₹0.00",
        totalFees: "₹0.00",
        finalCustomerAmount: "₹0.00",
      },
    };
  }

  // 1. Convenience Fee: 2.70% of total ticket amount
  const convenienceFee = roundToPaise(baseTicket * PRICING_CONFIG.CONVENIENCE_FEE_RATE);

  // 2. GST: 18% strictly on the convenience fee only
  const gstOnConvenienceFee = roundToPaise(convenienceFee * PRICING_CONFIG.CONVENIENCE_FEE_GST_RATE);

  // 3. Platform Charge: Fixed ₹8 per booking
  const platformCharge = PRICING_CONFIG.PLATFORM_CHARGE;

  // Subtotals
  const totalConvenienceFeeWithGst = roundToPaise(convenienceFee + gstOnConvenienceFee);
  const totalFees = roundToPaise(convenienceFee + gstOnConvenienceFee + platformCharge);

  // 4. Final Customer Amount:
  // Ticket Amount + Convenience Fee + GST on Convenience Fee + Platform Charge
  const finalCustomerAmount = roundToPaise(baseTicket + totalFees);

  // Ready for payment gateways (standard payment gateways require amount in smallest currency unit / paise)
  const finalAmountInPaise = Math.round(finalCustomerAmount * 100);

  return {
    ticketAmount: baseTicket,
    convenienceFee,
    gstOnConvenienceFee,
    platformCharge,
    totalConvenienceFeeWithGst,
    totalFees,
    finalCustomerAmount,
    finalAmountInPaise,
    rates: {
      convenienceFeePercentage: PRICING_CONFIG.CONVENIENCE_FEE_PERCENTAGE,
      gstPercentage: PRICING_CONFIG.CONVENIENCE_FEE_GST_PERCENTAGE,
      platformCharge: PRICING_CONFIG.PLATFORM_CHARGE,
    },
    formatted: {
      ticketAmount: formatCurrency(baseTicket),
      convenienceFee: formatCurrency(convenienceFee),
      gstOnConvenienceFee: formatCurrency(gstOnConvenienceFee),
      platformCharge: formatCurrency(platformCharge),
      totalFees: formatCurrency(totalFees),
      finalCustomerAmount: formatCurrency(finalCustomerAmount),
    },
  };
}

/**
 * Gateway-independent order builder.
 * Any payment gateway (Razorpay, Cashfree, PhonePe, Paytm, Stripe) can call this
 * adapter function to receive order payload with proper amounts without touching
 * the charge calculation engine.
 */
export function buildGatewayOrderData({
  ticketAmount,
  bookingId,
  customer = {},
  notes = {},
}) {
  const charges = calculateCustomerCharges(ticketAmount);

  return {
    orderId: bookingId,
    amount: charges.finalAmountInPaise, // In paise (e.g. 52393 for ₹523.93)
    amountInRupees: charges.finalCustomerAmount,
    currency: PRICING_CONFIG.CURRENCY,
    customer: {
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
    },
    chargesBreakdown: {
      ticketAmount: charges.ticketAmount,
      convenienceFee: charges.convenienceFee,
      gstOnConvenienceFee: charges.gstOnConvenienceFee,
      platformCharge: charges.platformCharge,
      totalFees: charges.totalFees,
      finalCustomerAmount: charges.finalCustomerAmount,
    },
    notes: {
      ...notes,
      bookingId,
      convenienceFee: String(charges.convenienceFee),
      gstOnConvenienceFee: String(charges.gstOnConvenienceFee),
      platformCharge: String(charges.platformCharge),
      ticketAmount: String(charges.ticketAmount),
    },
  };
}
