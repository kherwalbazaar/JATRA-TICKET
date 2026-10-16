/**
 * Fast2SMS Helper for JATRA BAZAAR
 * Works seamlessly in both client-side components and server-side code.
 *
 * @param {Object} options
 * @param {string} [options.message] - The text message to send
 * @param {string|string[]} options.numbers - Single phone number or array of phone numbers
 * @param {'q'|'otp'} [options.route='q'] - Route 'q' for quick text / 'otp' for OTP code
 * @param {string|number} [options.variables_values] - OTP digits if using route 'otp'
 * @returns {Promise<{success: boolean, data?: any, error?: any}>}
 */
export async function sendSMS({ message, numbers, route = "q", variables_values }) {
  const formattedNumbers = Array.isArray(numbers)
    ? numbers.join(",")
    : String(numbers || "");

  // Server-side direct execution
  if (typeof window === "undefined" && process.env.FAST2SMS_API_KEY) {
    try {
      const cleanNumbers = formattedNumbers
        .split(",")
        .map((n) => n.replace(/\D/g, "").slice(-10))
        .filter((n) => n.length === 10)
        .join(",");

      if (!cleanNumbers) {
        return { success: false, error: "No valid 10-digit mobile number found." };
      }

      const payload = {
        route,
        language: "english",
        flash: 0,
        numbers: cleanNumbers,
      };

      if (route === "otp" && variables_values) {
        payload.variables_values = String(variables_values);
      } else {
        payload.message = message;
      }

      const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: process.env.FAST2SMS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.return) {
        return { success: true, data };
      }
      return { success: false, error: data.message || data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Client-side execution: calls the internal /api/send-sms endpoint
  try {
    const res = await fetch("/api/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        numbers: formattedNumbers,
        route,
        variables_values,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err) {
    return {
      success: false,
      error: err.message || "Failed to call SMS service",
    };
  }
}
