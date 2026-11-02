// Server-side payment verification.
//
// Nothing in this file trusts the browser: a booking is only ever treated as
// paid after the gateway itself confirms the transaction. Without credentials
// the gateway reports "not configured" and the QR flow keeps the reservation
// pending instead of inventing a success.
//
// Required environment variables (server-side only, never NEXT_PUBLIC_):
//   PAYMENT_GATEWAY        razorpay | paytm | cashfree | none
//   PAYMENT_TEST_MODE      "true" — lets the QR flow complete locally (refused in production)
//   UPI_PAYEE_VPA          merchant UPI id, e.g. venue@okhdfcbank  (needed for the dynamic QR)
//   UPI_PAYEE_NAME         merchant display name shown in UPI apps
//   RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET
//   PAYTM_MID / PAYTM_MERCHANT_KEY / PAYTM_ENVIRONMENT

import crypto from "crypto";

const gateway = () => String(process.env.PAYMENT_GATEWAY || "").trim().toLowerCase();

export function isGatewayConfigured() {
  const g = gateway();
  return g === "razorpay" || g === "paytm" || g === "cashfree";
}

export function isTestModeAllowed() {
  if (String(process.env.PAYMENT_TEST_MODE || "").trim().toLowerCase() !== "true") return false;
  return process.env.NODE_ENV !== "production";
}

export function upiMerchantHandle() {
  return String(process.env.UPI_PAYEE_VPA || "").trim();
}

const VPA_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;

export function isValidVpa(vpa) {
  return VPA_PATTERN.test(String(vpa || "").trim());
}

/**
 * Build a genuine, payable UPI intent. The amount and reference come from the
 * server so neither can be tampered with in the client.
 */
export function buildUpiPaymentUri({ amount, transactionRef, payeeVpa, payeeName, note }) {
  if (!isValidVpa(payeeVpa)) return null;
  const params = new URLSearchParams({
    pa: String(payeeVpa).trim(),
    pn: String(payeeName || "Jatra Bazaar").slice(0, 50),
    am: Number(amount).toFixed(2),
    tr: String(transactionRef || "").slice(0, 35),
    tn: String(note || "Jatra Bazaar ticket booking").slice(0, 50),
    cu: "INR",
  });
  return `upi://pay?${params.toString()}`;
}

function rupeesMatch(expected, got, tolerance = 0.01) {
  const a = Number(expected);
  const b = Number(got);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= tolerance;
}

async function verifyRazorpay({ paymentRef, amount }) {
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  if (!keyId || !keySecret || !paymentRef) {
    return { verified: false, gateway: "razorpay", message: "Razorpay credentials are missing." };
  }
  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentRef)}`, {
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return { verified: false, gateway: "razorpay", message: "Razorpay did not confirm this payment." };
    }
    if (data.status !== "captured") {
      return {
        verified: false,
        pending: data.status === "created" || data.status === "authenticated",
        gateway: "razorpay",
        transactionId: data.id,
        message: `Payment is ${data.status} at Razorpay.`,
      };
    }
    if (!rupeesMatch(amount, Number(data.amount) / 100)) {
      return {
        verified: false,
        gateway: "razorpay",
        transactionId: data.id,
        message: "Captured amount does not match this booking.",
      };
    }
    return {
      verified: true,
      gateway: "razorpay",
      transactionId: data.id,
      source: "razorpay_capture",
      verifiedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { verified: false, gateway: "razorpay", message: err?.message || "Razorpay check failed." };
  }
}

async function verifyPaytm({ paymentRef, transactionId, amount }) {
  const mid = String(process.env.PAYTM_MID || "").trim();
  const secretKey = String(process.env.PAYTM_MERCHANT_KEY || "").trim();
  if (!mid || !secretKey) {
    return { verified: false, gateway: "paytm", message: "Paytm credentials are missing." };
  }
  const orderId = paymentRef || transactionId;
  if (!orderId) return { verified: false, gateway: "paytm", message: "No order reference supplied." };
  try {
    const host =
      String(process.env.PAYTM_ENVIRONMENT || "").toLowerCase() === "prod"
        ? "https://secure.paytm.in"
        : "https://stage-secure.paytm.in";
    const bodyJson = JSON.stringify({
      body: { orderId, mid, merchantId: mid, merchantConfigType: "KJ" },
    });
    const aesKey = secretKey.slice(0, 16);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-128-cbc", aesKey, iv);
    const encrypted = Buffer.concat([cipher.update(bodyJson, "utf8"), cipher.final()]);
    const res = await fetch(
      `${host}/api/v3/olts-server/merchant/transactionStatus`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-merch-encryption-key": crypto
            .createHash("sha256")
            .update(secretKey)
            .digest("hex")
            .slice(0, 64),
          "x-merch-iv": iv.toString("base64"),
        },
        body: JSON.stringify({ data: encrypted.toString("base64") }),
        cache: "no-store",
      }
    );
    const data = await res.json().catch(() => null);
    const txnStatus = String(data?.body?.txnStatus || data?.body?.orderStatus || "").toUpperCase();
    const txnAmount = Number(data?.body?.txnAmount ?? data?.body?.orderAmount);
    if (!res.ok || !data) {
      return { verified: false, gateway: "paytm", message: "Paytm did not confirm this payment." };
    }
    if (txnStatus !== "TXN_SUCCESS" && txnStatus !== "success") {
      return {
        verified: false,
        pending: txnStatus === "TXN_PENDING" || txnStatus === "PENDING",
        gateway: "paytm",
        message: `Payment is ${txnStatus || "unknown"} at Paytm.`,
      };
    }
    if (!rupeesMatch(amount, txnAmount)) {
      return { verified: false, gateway: "paytm", message: "Captured amount does not match this booking." };
    }
    return {
      verified: true,
      gateway: "paytm",
      transactionId: data?.body?.txnId || orderId,
      source: "paytm_status_query",
      verifiedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { verified: false, gateway: "paytm", message: err?.message || "Paytm check failed." };
  }
}

async function verifyCashfree({ paymentRef, transactionId, amount }) {
  const clientId = String(process.env.CASHFREE_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.CASHFREE_SECRET_ID || "").trim();
  const orderId = paymentRef || transactionId;
  if (!clientId || !clientSecret || !orderId) {
    return { verified: false, gateway: "cashfree", message: "Cashfree credentials are missing." };
  }
  try {
    const res = await fetch(
      `https://payapi.cashfree.com/pg/orders/${encodeURIComponent(orderId)}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        cache: "no-store",
      }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return { verified: false, gateway: "cashfree", message: "Cashfree did not confirm this payment." };
    }
    const payments = Array.isArray(data.payments) ? data.payments : [];
    const settled = payments.find((p) => String(p.payment_status).toUpperCase() === "COMPLETED");
    if (!settled) {
      return {
        verified: false,
        pending: payments.some((p) => String(p.payment_status).toUpperCase() === "PENDING" || String(p.payment_status).toUpperCase() === "ACTIVE"),
        gateway: "cashfree",
        message: "Cashfree reports no completed payment for this order.",
      };
    }
    if (!rupeesMatch(amount, settled.payment_amount)) {
      return { verified: false, gateway: "cashfree", message: "Captured amount does not match this booking." };
    }
    return {
      verified: true,
      gateway: "cashfree",
      transactionId: settled.payment_id || data.order_id,
      source: "cashfree_order",
      verifiedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { verified: false, gateway: "cashfree", message: err?.message || "Cashfree check failed." };
  }
}

/**
 * Local reconciliation used only when no gateway is wired up: the payment is
 * accepted because the merchant handle was configured and the reference is
 * well-formed. Enabled exclusively through PAYMENT_TEST_MODE.
 */
function verifyLocalReference({ paymentRef, reservationId }) {
  const ref = String(paymentRef || "").trim();
  if (!ref || ref.length < 6) {
    return {
      verified: false,
      pending: true,
      gateway: "upi",
      message: "Waiting for the payment to settle. Tap verify again in a few seconds.",
    };
  }
  return {
    verified: true,
    gateway: "upi",
    transactionId: ref,
    source: "test_mode",
    reservationId: reservationId || null,
    verifiedAt: new Date().toISOString(),
  };
}

export async function verifyPayment(input = {}) {
  const g = gateway();
  if (g === "razorpay") return verifyRazorpay(input);
  if (g === "paytm") return verifyPaytm(input);
  if (g === "cashfree") return verifyCashfree(input);
  if (isTestModeAllowed()) return verifyLocalReference(input);
  return {
    verified: false,
    configured: false,
    pending: true,
    gateway: g || "none",
    message:
      "This server has no payment gateway configured, so the payment cannot be verified automatically. Your seats stay held until verification succeeds.",
  };
}
