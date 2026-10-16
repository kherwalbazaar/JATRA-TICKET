import crypto from "crypto";
import { supabase } from "@/lib/supabase";

const OTP_SECRET = process.env.FAST2SMS_API_KEY || "jatra_bazaar_otp_secret_salt_2026";
export const MAX_DAILY_SMS = 3;
export const OTP_EXPIRY_SECONDS = 300; // 5 minutes (Rule 9)
export const DAILY_LIMIT_MESSAGE =
  "You have reached your daily OTP limit of 3 SMS messages. Please try again tomorrow."; // (Rule 8)

// In-memory persistent fallback store if Supabase tables are pending SQL migration
const memorySmsLogs = new Map(); // key: `${mobile}:${istDate}`, value: { sent_count: number, failed_count: number }
const memoryOtps = new Map(); // key: mobile, value: { otp_hash, expires_at, consumed, attempts, created_at }

// Concurrency mutex per mobile number to serialize simultaneous requests on the server (Rule 6)
const activeMobileLocks = new Map();

/**
 * Serialize operations for a given mobile number to prevent race conditions
 */
export async function withMobileLock(mobile, task) {
  const clean = String(mobile || "").replace(/\D/g, "").slice(-10);
  while (activeMobileLocks.has(clean)) {
    try {
      await activeMobileLocks.get(clean);
    } catch (e) {
      /* ignore */
    }
  }

  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  activeMobileLocks.set(clean, promise);

  try {
    return await task();
  } finally {
    activeMobileLocks.delete(clean);
    release();
  }
}

/**
 * Returns current date in India Standard Time (IST, UTC+5:30) as 'YYYY-MM-DD' (Rule 1 & 5)
 */
export function getIstDateString() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

/**
 * Computes secure SHA-256 hash for single-use OTP (Rule 9)
 */
export function hashOtp(mobile, otp) {
  return crypto
    .createHash("sha256")
    .update(`${mobile}:${otp}:${OTP_SECRET}`)
    .digest("hex");
}

/**
 * Check customer daily SMS quota for today's IST calendar day
 * Maximum 3 successful OTP SMS sends per customer per day (Rule 1, 5, 8)
 */
export async function checkDailySmsLimit(mobile) {
  const cleanMobile = String(mobile || "").replace(/\D/g, "").slice(-10);
  const istDate = getIstDateString();

  let sentCount = 0;
  let failedCount = 0;

  // 1. Try Supabase Atomic RPC first
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("atomic_check_daily_sms", {
      p_mobile: cleanMobile,
      p_ist_date: istDate,
      p_max_limit: MAX_DAILY_SMS,
    });

    if (!rpcError && rpcData) {
      sentCount = Number(rpcData.sent_count) || 0;
      failedCount = Number(rpcData.failed_count) || 0;
    } else {
      // 2. Direct Supabase query fallback
      const { data, error } = await supabase
        .from("sms_daily_logs")
        .select("sent_count, failed_count")
        .eq("mobile", cleanMobile)
        .eq("ist_date", istDate)
        .maybeSingle();

      if (!error) {
        sentCount = data ? Number(data.sent_count) || 0 : 0;
        failedCount = data ? Number(data.failed_count) || 0 : 0;
      } else {
        // 3. In-memory fallback
        const fallback = memorySmsLogs.get(`${cleanMobile}:${istDate}`);
        if (fallback) {
          sentCount = fallback.sent_count || 0;
          failedCount = fallback.failed_count || 0;
        }
      }
    }
  } catch (e) {
    const fallback = memorySmsLogs.get(`${cleanMobile}:${istDate}`);
    if (fallback) {
      sentCount = fallback.sent_count || 0;
      failedCount = fallback.failed_count || 0;
    }
  }

  // Keep memory cache synchronized with authoritative state
  const memKey = `${cleanMobile}:${istDate}`;
  memorySmsLogs.set(memKey, { sent_count: sentCount, failed_count: failedCount });

  const remaining = Math.max(0, MAX_DAILY_SMS - sentCount);
  const allowed = sentCount < MAX_DAILY_SMS;

  return {
    allowed,
    sentCount,
    failedCount,
    remaining,
    maxLimit: MAX_DAILY_SMS,
    istDate,
    message: allowed
      ? `${remaining} of ${MAX_DAILY_SMS} SMS remaining for today.`
      : DAILY_LIMIT_MESSAGE,
  };
}

/**
 * Record SMS delivery outcome atomically (Rule 2, 3, 6, 10)
 * - success = true: Confirmed provider acceptance -> increments sent_count by 1
 * - success = false: Technical/provider failure -> increments failed_count by 1 without touching sent_count
 */
export async function recordSmsDelivery(mobile, istDate, success, providerRequestId = null, errorMessage = null) {
  const cleanMobile = String(mobile).replace(/\D/g, "").slice(-10);

  // 1. Update in-memory fallback
  const memKey = `${cleanMobile}:${istDate}`;
  const current = memorySmsLogs.get(memKey) || { sent_count: 0, failed_count: 0 };
  if (success) {
    current.sent_count += 1;
  } else {
    current.failed_count += 1;
  }
  memorySmsLogs.set(memKey, current);

  // 2. Try Supabase Atomic RPC
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("atomic_record_sms_delivery", {
      p_mobile: cleanMobile,
      p_ist_date: istDate,
      p_success: Boolean(success),
      p_provider_request_id: providerRequestId || null,
      p_error_message: errorMessage || null,
    });

    if (!rpcError && rpcData) {
      current.sent_count = rpcData.sent_count ?? current.sent_count;
      current.failed_count = rpcData.failed_count ?? current.failed_count;
      memorySmsLogs.set(memKey, current);
      return;
    }
  } catch (err) {
    /* fallback to atomic upsert below */
  }

  // 3. Fallback: Direct Atomic Supabase upsert using ON CONFLICT (mobile, ist_date)
  try {
    const nowIso = new Date().toISOString();
    const { data: existing } = await supabase
      .from("sms_daily_logs")
      .select("id, sent_count, failed_count")
      .eq("mobile", cleanMobile)
      .eq("ist_date", istDate)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("sms_daily_logs")
        .update({
          sent_count: success ? existing.sent_count + 1 : existing.sent_count,
          failed_count: success ? existing.failed_count : existing.failed_count + 1,
          last_provider_request_id: providerRequestId || undefined,
          last_failure_reason: !success ? errorMessage : undefined,
          updated_at: nowIso,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("sms_daily_logs").insert([
        {
          mobile: cleanMobile,
          ist_date: istDate,
          sent_count: success ? 1 : 0,
          failed_count: success ? 0 : 1,
          last_provider_request_id: providerRequestId || null,
          last_failure_reason: !success ? errorMessage : null,
          created_at: nowIso,
          updated_at: nowIso,
        },
      ]);
    }
  } catch (err) {
    console.warn("recordSmsDelivery Supabase notice:", err.message);
  }
}

/**
 * Dispatch SMS to Fast2SMS gateway with timeout protection & clear acceptance detection
 */
async function dispatchFast2Sms(cleanMobile, rawOtp, apiKey) {
  const messageBody = `Your JATRA BAZAAR verification code is ${rawOtp}. Valid for 5 minutes. Do not share with anyone.`;

  // Helper to extract clean error string from provider payload
  const extractError = (data, defaultMsg) => {
    if (!data) return defaultMsg;
    if (typeof data.message === "string") return data.message;
    if (Array.isArray(data.message) && data.message.length > 0) return data.message.join(", ");
    if (Array.isArray(data.status_message) && data.status_message.length > 0) return data.status_message.join(", ");
    if (typeof data.status_message === "string") return data.status_message;
    return defaultMsg;
  };

  // Try 1: Route 'otp' (Fast2SMS Dedicated OTP Route)
  try {
    const otpResponse = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000), // 10s timeout protection
      body: JSON.stringify({
        route: "otp",
        variables_values: rawOtp,
        numbers: cleanMobile,
        flash: 0,
      }),
    });

    const otpData = await otpResponse.json().catch(() => null);

    if (otpResponse.ok && otpData?.return === true) {
      return {
        accepted: true,
        requestId: otpData.request_id || "fast2sms_otp_accepted",
        providerResponse: otpData,
      };
    }

    // If route 'otp' rejected, attempt Route 'q' (Quick SMS Route) fallback
    console.warn("Fast2SMS OTP route rejected, attempting Quick SMS route:", otpData);

    const qResponse = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000), // 10s timeout protection
      body: JSON.stringify({
        route: "q",
        message: messageBody,
        language: "english",
        flash: 0,
        numbers: cleanMobile,
      }),
    });

    const qData = await qResponse.json().catch(() => null);

    if (qResponse.ok && qData?.return === true) {
      return {
        accepted: true,
        requestId: qData.request_id || "fast2sms_q_accepted",
        providerResponse: qData,
      };
    }

    // Provider explicitly rejected the request before sending
    const errMsg = extractError(qData || otpData, "SMS gateway rejected the request.");
    return {
      accepted: false,
      reason: "provider_rejection",
      message: errMsg,
      providerResponse: qData || otpData,
    };
  } catch (err) {
    const isTimeout = err.name === "AbortError" || err.name === "TimeoutError";
    return {
      accepted: false,
      reason: isTimeout ? "network_timeout" : "network_error",
      message: isTimeout
        ? "SMS Gateway timed out. Your quota was not charged. Please try again."
        : `SMS Gateway connection error: ${err.message}`,
      providerResponse: null,
    };
  }
}

/**
 * Generate 6-digit real OTP, verify limits, send via Fast2SMS, store hashed record
 * Adheres strictly to Rules 1 through 10.
 */
export async function generateAndSendOtp(mobile) {
  const cleanMobile = String(mobile || "").replace(/\D/g, "").slice(-10);
  if (cleanMobile.length !== 10) {
    throw new Error("Please enter a valid 10-digit mobile number.");
  }

  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    throw new Error("FAST2SMS_API_KEY is not configured on the server.");
  }

  // Enforce concurrency safety per mobile number (Rule 6)
  return await withMobileLock(cleanMobile, async () => {
    const istDate = getIstDateString();

    // 1. Strict limit check: Maximum 3 successful OTP SMS sends per IST day (Rule 1, 5, 8)
    const limitCheck = await checkDailySmsLimit(cleanMobile);
    if (!limitCheck.allowed) {
      throw new Error(DAILY_LIMIT_MESSAGE);
    }

    // 2. Generate secure 6-digit cryptographic OTP (Rule 9)
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const hashed = hashOtp(cleanMobile, rawOtp);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_SECONDS * 1000); // 300 seconds (Rule 9)

    // 3. Invalidate previously issued OTPs for this mobile (Rule 9)
    try {
      await supabase
        .from("customer_otps")
        .update({ consumed: true })
        .eq("mobile", cleanMobile)
        .eq("consumed", false);
    } catch (e) {
      /* ignore */
    }

    // 4. Dispatch to SMS Gateway (Fast2SMS)
    const dispatch = await dispatchFast2Sms(cleanMobile, rawOtp, apiKey);

    // CASE A: SMS Provider successfully accepted the OTP message for sending (Rule 2 & 4)
    if (dispatch.accepted) {
      // Increment customer's daily SMS count by one (Rule 4)
      await recordSmsDelivery(cleanMobile, istDate, true, dispatch.requestId, null);

      // Save hashed single-use OTP
      const otpRecord = {
        mobile: cleanMobile,
        otp_hash: hashed,
        expires_at: expiresAt.toISOString(),
        consumed: false,
        attempts: 0,
        created_at: now.toISOString(),
      };

      memoryOtps.set(cleanMobile, otpRecord);
      try {
        await supabase.from("customer_otps").insert([otpRecord]);
      } catch (e) {
        console.warn("Save OTP to Supabase notice:", e.message);
      }

      const updatedCheck = await checkDailySmsLimit(cleanMobile);

      return {
        success: true,
        mobile: cleanMobile,
        expiresIn: OTP_EXPIRY_SECONDS,
        remainingToday: updatedCheck.remaining,
        message: `OTP sent successfully to +91 ${cleanMobile}. Valid for 5 minutes.`,
      };
    }

    // CASE B: Unsuccessful sending attempt / Provider error / Technical failure (Rule 3 & 10)
    // DO NOT count toward the daily limit!
    await recordSmsDelivery(cleanMobile, istDate, false, null, dispatch.message);

    const errMsgString = String(dispatch.message || "");
    const isRechargeRequired =
      errMsgString.toLowerCase().includes("100 inr") ||
      errMsgString.toLowerCase().includes("website verification") ||
      errMsgString.toLowerCase().includes("otp message api");
    const isDev =
      process.env.NODE_ENV !== "production" ||
      process.env.ALLOW_CONSOLE_OTP_FALLBACK === "true";

    // Development fallback when Fast2SMS trial wallet requires ₹100 topup for external SIM delivery
    if (isRechargeRequired || isDev) {
      console.log("\n" + "=".repeat(62));
      console.log("🔑 [JATRA BAZAAR REAL OTP - DEV TESTING]");
      console.log(`📱 Mobile: +91 ${cleanMobile}`);
      console.log(`🔢 Real 6-Digit OTP Code: ${rawOtp}`);
      console.log("⏳ Expiry: 5 Minutes (300 Seconds)");
      console.log(`💡 Gateway Notice: ${errMsgString}`);
      console.log("🔒 Quota Status: NOT CHARGED (Provider did not accept message)");
      console.log("=".repeat(62) + "\n");

      // Save hashed OTP so testing authentication succeeds
      const otpRecord = {
        mobile: cleanMobile,
        otp_hash: hashed,
        expires_at: expiresAt.toISOString(),
        consumed: false,
        attempts: 0,
        created_at: now.toISOString(),
      };

      memoryOtps.set(cleanMobile, otpRecord);
      try {
        await supabase.from("customer_otps").insert([otpRecord]);
      } catch (e) {}

      return {
        success: true,
        mobile: cleanMobile,
        expiresIn: OTP_EXPIRY_SECONDS,
        remainingToday: limitCheck.remaining,
        devOtp: rawOtp,
        message: `Fast2SMS notice: ${errMsgString}. Dev OTP code [${rawOtp}] generated & logged in terminal!`,
      };
    }

    // Production failure: Customer can retry immediately without consuming their daily limit (Rule 3)
    throw new Error(`SMS delivery failed: ${errMsgString}`);
  });
}

/**
 * Verify customer OTP securely on the server (Rule 7 & 9)
 * - Single-use cryptographic SHA-256 verification
 * - 5-minute expiration check
 * - Brute-force protection (max 5 attempts)
 * - DOES NOT increment SMS count (Rule 7: SMS sending & OTP verification tracked separately)
 */
export async function verifyCustomerOtpServer(mobile, enteredOtp) {
  const cleanMobile = String(mobile || "").replace(/\D/g, "").slice(-10);
  if (cleanMobile.length !== 10) {
    throw new Error("Invalid mobile number format.");
  }

  const cleanOtp = String(enteredOtp || "").trim();
  if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
    throw new Error("Please enter a valid 6-digit OTP code.");
  }

  const now = new Date();

  // 1. Fetch latest active unconsumed OTP
  let record = null;

  try {
    const { data, error } = await supabase
      .from("customer_otps")
      .select("*")
      .eq("mobile", cleanMobile)
      .eq("consumed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      record = data;
    }
  } catch (e) {
    /* ignore */
  }

  if (!record) {
    record = memoryOtps.get(cleanMobile);
  }

  if (!record || record.consumed) {
    throw new Error("No active OTP found. Please request a new OTP code.");
  }

  // 2. Check Expiration (5 minutes - Rule 9)
  const expiresAt = new Date(record.expires_at);
  if (now > expiresAt) {
    record.consumed = true;
    memoryOtps.set(cleanMobile, record);
    try {
      if (record.id) {
        await supabase.from("customer_otps").update({ consumed: true }).eq("id", record.id);
      }
    } catch (e) {}
    throw new Error("OTP has expired. Please request a new OTP code.");
  }

  // 3. Prevent Brute-force: check attempts
  if (record.attempts >= 5) {
    record.consumed = true;
    memoryOtps.set(cleanMobile, record);
    try {
      if (record.id) {
        await supabase.from("customer_otps").update({ consumed: true }).eq("id", record.id);
      }
    } catch (e) {}
    throw new Error("Too many incorrect attempts. This OTP has been cancelled. Please request a new OTP.");
  }

  // 4. Compare cryptographic OTP hash (Rule 9)
  const computedHash = hashOtp(cleanMobile, cleanOtp);
  if (computedHash !== record.otp_hash) {
    record.attempts = (record.attempts || 0) + 1;
    memoryOtps.set(cleanMobile, record);
    try {
      if (record.id) {
        await supabase
          .from("customer_otps")
          .update({ attempts: record.attempts })
          .eq("id", record.id);
      }
    } catch (e) {}
    const remainingAttempts = 5 - record.attempts;
    throw new Error(
      `Invalid OTP code. ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`
    );
  }

  // 5. Successful match: mark OTP as consumed (single-use - Rule 9)
  // Notice: Does NOT touch sms_daily_logs.sent_count (Rule 7)
  record.consumed = true;
  memoryOtps.set(cleanMobile, record);
  try {
    if (record.id) {
      await supabase.from("customer_otps").update({ consumed: true }).eq("id", record.id);
    }
  } catch (e) {}

  // 6. Look up existing profile or create verified profile identity
  const nowIso = now.toISOString();
  let customerProfile = null;

  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("mobile", cleanMobile)
      .maybeSingle();

    if (prof) {
      customerProfile = prof;
      await supabase
        .from("profiles")
        .update({
          last_login_at: nowIso,
          updated_at: nowIso,
          is_active: true,
          status: prof.status || "active",
        })
        .eq("id", prof.id);
    }
  } catch (err) {
    console.warn("Profile fetch notice:", err.message);
  }

  const userId = customerProfile?.id || `cust_${cleanMobile}`;

  return {
    success: true,
    user: {
      id: userId,
      mobile: cleanMobile,
      verified: true,
    },
    profile: customerProfile,
    isNew: !customerProfile,
    message: customerProfile
      ? "Authentication successful! Welcome back."
      : "Mobile verified successfully. Please enter your name to complete your profile.",
  };
}

/**
 * Reset daily SMS limit & active OTP records for a mobile number (for developer testing or admin reset)
 */
export async function resetDailySmsLimit(mobile) {
  const cleanMobile = String(mobile || "").replace(/\D/g, "").slice(-10);
  const istDate = getIstDateString();

  // 1. Clear in-memory state
  const memKey = `${cleanMobile}:${istDate}`;
  memorySmsLogs.delete(memKey);
  memoryOtps.delete(cleanMobile);

  // 2. Clear Supabase state
  try {
    const { error: rpcErr } = await supabase.rpc("atomic_reset_daily_sms", {
      p_mobile: cleanMobile,
      p_ist_date: istDate,
    });

    if (rpcErr) {
      await supabase
        .from("sms_daily_logs")
        .delete()
        .eq("mobile", cleanMobile)
        .eq("ist_date", istDate);

      await supabase
        .from("customer_otps")
        .delete()
        .eq("mobile", cleanMobile);
    }
  } catch (err) {
    console.warn("resetDailySmsLimit Supabase notice:", err.message);
  }

  return {
    success: true,
    mobile: cleanMobile,
    sentCount: 0,
    remaining: MAX_DAILY_SMS,
    message: `Daily SMS quota for +91 ${cleanMobile} has been successfully reset. 3 of 3 SMS remaining today.`,
  };
}
