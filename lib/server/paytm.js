import crypto from "crypto";
import PaytmChecksum from "paytmchecksum";

/**
 * Server-Side Paytm Payment Gateway Integration Module
 *
 * All credentials and merchant keys remain strictly server-side.
 * Staging vs Live Mode is controlled purely via environment variables:
 * - PAYTM_ENVIRONMENT: "STAGE" | "PROD" (defaults to "STAGE")
 * - PAYTM_MID: Merchant ID
 * - PAYTM_MERCHANT_KEY: 16-character Merchant Key
 * - PAYTM_WEBSITE: "WEBSTAGING" (staging) | "DEFAULT" (production)
 * - PAYTM_CHANNEL_ID: "WEB" or "WAP"
 * - PAYTM_INDUSTRY_TYPE_ID: "Retail"
 * - NEXT_PUBLIC_APP_URL or APP_URL: Base application URL
 */

export function getPaytmConfig() {
  const env = (process.env.PAYTM_ENVIRONMENT || "STAGE").trim().toUpperCase();
  const isProd = env === "PROD" || env === "PRODUCTION";

  const mid = (process.env.PAYTM_MID || "kskRuo11686059663003").trim();
  const merchantKey = (process.env.PAYTM_MERCHANT_KEY || "F3%G7f%YQPVCNIgp").trim();
  const website = (process.env.PAYTM_WEBSITE || (isProd ? "DEFAULT" : "WEBSTAGING")).trim();
  const channelId = (process.env.PAYTM_CHANNEL_ID || "WEB").trim();
  const industryTypeId = (process.env.PAYTM_INDUSTRY_TYPE_ID || "Retail").trim();

  // App Base URL for callbacks
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  // Staging vs Production endpoints
  const host = isProd ? "https://securegw.paytm.in" : "https://securegw-stage.paytm.in";

  return {
    isProd,
    environment: isProd ? "PROD" : "STAGE",
    mid,
    merchantKey,
    website,
    channelId,
    industryTypeId,
    appUrl,
    host,
    processTxnUrl: `${host}/theia/processTransaction`,
    initiateTxnUrl: (orderId) => `${host}/theia/api/v1/initiateTransaction?mid=${mid}&orderId=${orderId}`,
    showPaymentPageUrl: (orderId) => `${host}/theia/api/v1/showPaymentPage?mid=${mid}&orderId=${orderId}`,
    orderStatusUrl: `${host}/v3/order/status`,
    callbackUrl: `${appUrl}/api/payment/paytm/callback`,
  };
}

/**
 * Check if the staging simulator should handle checkout.
 */
export function isSimulatorMode() {
  const config = getPaytmConfig();
  if (config.isProd) return false;
  return process.env.PAYTM_USE_SIMULATOR === "true";
}

/**
 * Generate Paytm Checksum Signature for an object or JSON body string
 */
export async function generatePaytmChecksum(params) {
  const config = getPaytmConfig();
  if (!config.merchantKey) {
    throw new Error("PAYTM_MERCHANT_KEY is missing from server environment variables.");
  }
  return PaytmChecksum.generateSignature(params, config.merchantKey);
}

/**
 * Verify Paytm Checksum Signature
 */
export async function verifyPaytmChecksum(params, checksum) {
  const config = getPaytmConfig();
  if (!config.merchantKey) {
    throw new Error("PAYTM_MERCHANT_KEY is missing from server environment variables.");
  }
  if (!checksum) return false;

  try {
    if (typeof params === "string") {
      return PaytmChecksum.verifySignatureByString(params, config.merchantKey, checksum);
    }
    return PaytmChecksum.verifySignature(params, config.merchantKey, checksum);
  } catch (err) {
    console.error("Paytm checksum verification error:", err?.message);
    return false;
  }
}

/**
 * Initiate Paytm Payment Transaction
 * Returns form parameters with signature for standard Paytm processTransaction gateway
 */
export async function initiatePaytmTransaction({ orderId, amount, customerId, mobile, email }) {
  const config = getPaytmConfig();

  // Validate parameters
  if (!orderId || !amount) {
    throw new Error("orderId and amount are required to initiate transaction.");
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error(`Invalid payment amount: ${amount}`);
  }

  const formattedAmount = numAmount.toFixed(2);
  const cleanMobile = mobile ? String(mobile).replace(/\D/g, "").slice(-10) : "";
  const custId = customerId || `CUST_${cleanMobile || "GUEST"}_${Date.now()}`;

  // If in simulator mode in Staging, return simulation response
  if (isSimulatorMode()) {
    const simTxnToken = `SIM_TOKEN_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
    return {
      success: true,
      orderId,
      txnToken: simTxnToken,
      mid: config.mid,
      amount: formattedAmount,
      isSimulator: true,
      simulatorUrl: `/payment/paytm-simulator?orderId=${encodeURIComponent(orderId)}&txnToken=${encodeURIComponent(simTxnToken)}&amount=${formattedAmount}`,
      callbackUrl: `${config.callbackUrl}?orderId=${encodeURIComponent(orderId)}`,
      gatewayUrl: `${config.appUrl}/payment/paytm-simulator?orderId=${encodeURIComponent(orderId)}&txnToken=${encodeURIComponent(simTxnToken)}`,
    };
  }

  // Standard Paytm Checkout parameters
  const formParams = {
    MID: config.mid,
    WEBSITE: config.website,
    CHANNEL_ID: config.channelId,
    INDUSTRY_TYPE_ID: config.industryTypeId,
    ORDER_ID: String(orderId),
    CUST_ID: custId,
    TXN_AMOUNT: formattedAmount,
    CALLBACK_URL: `${config.callbackUrl}?orderId=${encodeURIComponent(orderId)}`,
  };

  if (cleanMobile) {
    formParams.MOBILE_NO = cleanMobile;
  }
  if (email && email.includes("@")) {
    formParams.EMAIL = email.trim();
  }

  // Generate checksum hash
  const checksum = await PaytmChecksum.generateSignature(formParams, config.merchantKey);
  formParams.CHECKSUMHASH = checksum;

  return {
    success: true,
    orderId,
    amount: formattedAmount,
    mid: config.mid,
    gatewayUrl: config.processTxnUrl,
    formParams,
    callbackUrl: formParams.CALLBACK_URL,
    isSimulator: false,
  };
}

/**
 * Server-to-Server Transaction Status Verification API (/v3/order/status)
 * Queries Paytm directly to verify order status, transaction ID, and amount.
 */
export async function verifyPaytmOrderStatus(orderId) {
  const config = getPaytmConfig();
  if (!orderId) {
    throw new Error("orderId is required to verify transaction status.");
  }

  // If in simulator mode in Staging
  if (isSimulatorMode()) {
    return {
      isSimulator: true,
      orderId,
      status: "CHECK_PAYTM_SIMULATOR",
    };
  }

  const paytmParams = {
    body: {
      mid: config.mid,
      orderId: String(orderId),
    },
  };

  const signature = await PaytmChecksum.generateSignature(
    JSON.stringify(paytmParams.body),
    config.merchantKey
  );
  paytmParams.head = { signature };

  const res = await fetch(config.orderStatusUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(paytmParams),
  });

  const data = await res.json();
  const body = data?.body || {};
  const resultInfo = body.resultInfo || {};

  return {
    raw: data,
    orderId: body.orderId || orderId,
    txnId: body.txnId || null,
    bankTxnId: body.bankTxnId || null,
    txnAmount: body.txnAmount || null,
    resultStatus: resultInfo.resultStatus, // "TXN_SUCCESS" | "TXN_FAILURE" | "PENDING"
    resultCode: resultInfo.resultCode,
    resultMsg: resultInfo.resultMsg,
    paymentMode: body.paymentMode || null,
    txnDate: body.txnDate || null,
    isSuccess: resultInfo.resultStatus === "TXN_SUCCESS",
    isPending: resultInfo.resultStatus === "PENDING",
    isFailure: resultInfo.resultStatus === "TXN_FAILURE",
  };
}
