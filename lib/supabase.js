import { createClient } from "@supabase/supabase-js";

// Shared config: fall back to project defaults if .env.local is absent during Vercel builds
const DEFAULT_SUPABASE_URL = "https://fmiaiuhmmlyciafxgvna.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_3CszK-oOtR0ce83iCNU30g_-ZuSt8or";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Fetch all seats for an event from Supabase `seats` table.
 */
export async function sbFetchSeats(eventId) {
  if (!eventId) return [];
  try {
    const { data, error } = await supabase
      .from("seats")
      .select("*")
      .eq("event_id", String(eventId).trim())
      .range(0, 4999);

    if (error) {
      console.warn("sbFetchSeats error:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("sbFetchSeats exception:", err);
    return [];
  }
}

// Multiplexed realtime seats channels (keyed by eventId)
const realtimeSeatsChannels = new Map();
let realtimeSeatsSeq = 0;

/**
 * Subscribe to real-time seat changes for an event using Supabase Realtime broadcast/postgres_changes.
 * Returns unsubscribe function. Multiplexed so multiple components share the same channel.
 */
export function subscribeRealtimeSeats(eventId, onSeatChange) {
  if (!eventId || typeof window === "undefined") return () => {};

  const cleanEventId = String(eventId).trim();
  let entry = realtimeSeatsChannels.get(cleanEventId);

  if (!entry) {
    entry = {
      channel: null,
      listeners: new Set(),
      cleanupTimer: null,
    };
    realtimeSeatsChannels.set(cleanEventId, entry);
  }

  if (entry.cleanupTimer) {
    clearTimeout(entry.cleanupTimer);
    entry.cleanupTimer = null;
  }

  if (typeof onSeatChange === "function") {
    entry.listeners.add(onSeatChange);
  }

  if (!entry.channel) {
    const channelName = `realtime-seats-${cleanEventId}-${Date.now()}-${++realtimeSeatsSeq}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      entry.channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "seats",
            filter: `event_id=eq.${cleanEventId}`,
          },
          (payload) => {
            entry.listeners.forEach((listener) => {
              try {
                listener(payload);
              } catch (err) {
                console.error("Error in realtime seat listener:", err);
              }
            });
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("Failed to subscribe to realtime seats:", err);
    }
  }

  return () => {
    if (typeof onSeatChange === "function") {
      entry.listeners.delete(onSeatChange);
    }

    if (entry.listeners.size === 0 && entry.channel) {
      if (entry.cleanupTimer) {
        clearTimeout(entry.cleanupTimer);
      }
      entry.cleanupTimer = setTimeout(() => {
        if (entry.listeners.size === 0) {
          const ch = entry.channel;
          entry.channel = null;
          realtimeSeatsChannels.delete(cleanEventId);
          if (ch) {
            try {
              supabase.removeChannel(ch);
            } catch (err) {
              console.warn("Error removing realtime seats channel:", err);
            }
          }
        }
        entry.cleanupTimer = null;
      }, 1500);
    }
  };
}

// Multiplexed realtime events channel
let realtimeEventsChannel = null;
const realtimeEventListeners = new Set();
let realtimeEventsCleanupTimer = null;
let realtimeEventsSeq = 0;

/**
 * Subscribe to real-time event updates (e.g. status, dates, tickets sold).
 * Multiplexed so multiple components share a single channel and avoid duplicate subscriptions.
 */
export function subscribeRealtimeEvents(onEventChange) {
  if (typeof window === "undefined") return () => {};

  if (typeof onEventChange === "function") {
    realtimeEventListeners.add(onEventChange);
  }

  if (realtimeEventsCleanupTimer) {
    clearTimeout(realtimeEventsCleanupTimer);
    realtimeEventsCleanupTimer = null;
  }

  if (!realtimeEventsChannel) {
    const channelName = `realtime-events-${Date.now()}-${++realtimeEventsSeq}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      realtimeEventsChannel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "events" },
          (payload) => {
            realtimeEventListeners.forEach((listener) => {
              try {
                listener(payload);
              } catch (err) {
                console.error("Error in realtime event listener:", err);
              }
            });
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("Failed to subscribe to realtime events:", err);
    }
  }

  return () => {
    if (typeof onEventChange === "function") {
      realtimeEventListeners.delete(onEventChange);
    }

    if (realtimeEventListeners.size === 0 && realtimeEventsChannel) {
      if (realtimeEventsCleanupTimer) {
        clearTimeout(realtimeEventsCleanupTimer);
      }
      realtimeEventsCleanupTimer = setTimeout(() => {
        if (realtimeEventListeners.size === 0 && realtimeEventsChannel) {
          const ch = realtimeEventsChannel;
          realtimeEventsChannel = null;
          if (ch) {
            try {
              supabase.removeChannel(ch);
            } catch (err) {
              console.warn("Error removing realtime events channel:", err);
            }
          }
        }
        realtimeEventsCleanupTimer = null;
      }, 1500);
    }
  };
}

/**
 * Atomic seat hold in Supabase (10-minute hold TTL)
 */
export async function sbHoldSeat(eventId, seatId, sessionId) {
  if (!eventId || !seatId || !sessionId) return false;
  const cleanEvent = String(eventId).trim();
  const cleanSeat = String(seatId).trim();

  try {
    // Try atomic RPC if available
    const { data, error } = await supabase.rpc("hold_seat_atomic", {
      p_event_id: cleanEvent,
      p_seat_id: cleanSeat,
      p_session_id: sessionId,
    });

    if (!error && data?.success) {
      return true;
    }

    // Direct fallback update
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("seats")
      .update({
        status: "reserved",
        reserved_at: nowIso,
        reserved_by: sessionId,
        updated_at: nowIso,
      })
      .eq("event_id", cleanEvent)
      .or(`id.eq.${cleanSeat},seat_label.eq.${cleanSeat}`)
      .in("status", ["available", "reserved"]);

    return !updateError;
  } catch (err) {
    console.warn("sbHoldSeat exception:", err);
    return false;
  }
}

/**
 * Release a seat held by this session in Supabase
 */
export async function sbReleaseSeatHold(eventId, seatId, sessionId) {
  if (!eventId || !seatId) return false;
  const cleanEvent = String(eventId).trim();
  const cleanSeat = String(seatId).trim();

  try {
    const nowIso = new Date().toISOString();
    const filter = sessionId
      ? `reserved_by.eq.${sessionId}`
      : "status.eq.reserved";

    const { error } = await supabase
      .from("seats")
      .update({
        status: "available",
        reserved_at: null,
        reserved_by: null,
        updated_at: nowIso,
      })
      .eq("event_id", cleanEvent)
      .or(`id.eq.${cleanSeat},seat_label.eq.${cleanSeat}`)
      .eq("status", "reserved");

    return !error;
  } catch (err) {
    console.warn("sbReleaseSeatHold error:", err);
    return false;
  }
}

/**
 * Proactively release all expired seat holds in Supabase (> 10 minutes old)
 */
export async function sbReleaseExpiredHolds(eventId) {
  if (!eventId) return 0;
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("seats")
      .update({
        status: "available",
        reserved_at: null,
        reserved_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", String(eventId).trim())
      .eq("status", "reserved")
      .lt("reserved_at", tenMinutesAgo)
      .select("id");
    if (!error && Array.isArray(data)) {
      return data.length;
    }
  } catch (err) {
    console.warn("sbReleaseExpiredHolds error:", err?.message);
  }
  return 0;
}

/**
 * Save booking into Supabase `bookings`, `tickets`, and update `seats`
 */
export async function sbSaveBooking({
  bookingId,
  ticketNumber,
  eventId,
  eventName,
  customerName,
  customerPhone,
  customerEmail,
  ticketTypeId,
  ticketTypeName,
  quantity,
  unitPrice,
  amount,
  ticketAmount,
  baseAmount,
  convenienceFee,
  gstOnConvenienceFee,
  platformCharge,
  totalFees,
  finalCustomerAmount,
  source = "Online",
  paymentMethod = "UPI",
  date,
  time,
  block,
  seats = [],
  tickets = [],
}) {
  const nowIso = new Date().toISOString();

  try {
    const normPaymentMethod = (() => {
      const s = String(paymentMethod || "").toUpperCase();
      if (s.includes("CASH")) return "Cash";
      if (s.includes("CARD")) return "Card";
      return "UPI";
    })();

    let sanitizedTicketTypeId = null;
    if (ticketTypeId && typeof ticketTypeId === "string") {
      const cleanTid = ticketTypeId.trim();
      try {
        const { data: ttCheck } = await supabase
          .from("ticket_types")
          .select("id")
          .eq("id", cleanTid)
          .maybeSingle();
        if (ttCheck?.id) {
          sanitizedTicketTypeId = ttCheck.id;
        } else if (ticketTypeName) {
          const simpleName = ticketTypeName.split("(")[0].trim();
          const { data: ttNameCheck } = await supabase
            .from("ticket_types")
            .select("id")
            .ilike("name", simpleName)
            .maybeSingle();
          if (ttNameCheck?.id) {
            sanitizedTicketTypeId = ttNameCheck.id;
          }
        }
      } catch (e) {
        sanitizedTicketTypeId = null;
      }
    }

    // 1. Insert into bookings table
    const bookingRow = {
      id: bookingId,
      ticket_number: ticketNumber,
      event_id: eventId,
      event_name: eventName,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      ticket_type_id: sanitizedTicketTypeId,
      ticket_type_name: ticketTypeName || "General",
      quantity: Number(quantity) || 1,
      unit_price: Number(unitPrice) || 0,
      amount: Number(amount || finalCustomerAmount) || 0,
      ticket_amount: Number(ticketAmount || amount) || 0,
      base_amount: Number(baseAmount || ticketAmount) || 0,
      convenience_fee: Number(convenienceFee) || 0,
      gst_on_convenience_fee: Number(gstOnConvenienceFee) || 0,
      platform_charge: Number(platformCharge) || 0,
      total_fees: Number(totalFees) || 0,
      final_customer_amount: Number(finalCustomerAmount || amount) || 0,
      source: source || "Online",
      payment_method: normPaymentMethod,
      date: date || new Date().toISOString().slice(0, 10),
      time: time || "11:00 PM",
      status: "Confirmed",
      booking_status: "Confirmed",
      payment_status: "Successful",
      block: block || null,
      seats: seats,
      seat_number: seats.join(", "),
      seat_count: seats.length || Number(quantity) || 1,
      entered_count: 0,
      remaining_count: seats.length || Number(quantity) || 1,
      created_at: nowIso,
      updated_at: nowIso,
    };

    let { error: bookingError } = await supabase
      .from("bookings")
      .upsert([bookingRow]);

    if (bookingError) {
      console.warn("Supabase booking insert warning:", bookingError.message);
      if (bookingRow.ticket_type_id) {
        bookingRow.ticket_type_id = null;
        const retry = await supabase.from("bookings").upsert([bookingRow]);
        bookingError = retry.error;
      }
      if (bookingError) {
        console.error("Supabase booking insert failed:", bookingError.message);
        throw new Error(`Failed to save booking in Supabase: ${bookingError.message}`);
      }
    }

    // 2. Insert tickets rows
    if (Array.isArray(tickets) && tickets.length > 0) {
      const ticketRows = tickets.map((t, idx) => ({
        id: t.id || t.ticketId,
        ticket_id: t.ticketId || t.id,
        booking_id: ticketNumber,
        booking_doc_id: bookingId,
        ticket_index: t.ticketIndex || idx + 1,
        total_tickets: tickets.length,
        event_id: eventId,
        event_name: eventName,
        ticket_type_id: bookingRow.ticket_type_id || null,
        ticket_type_name: ticketTypeName || "General",
        seat: t.seat || (seats[idx] ? String(seats[idx]) : null),
        seat_index: idx + 1,
        seat_count: tickets.length,
        block: block || t.block || null,
        assigned_gate: t.assignedGate || (block ? `Block ${block}` : "Main Gate"),
        customer_name: customerName,
        customer_phone: customerPhone,
        serial_number: t.serialNumber || t.ticketId || `${ticketNumber}-${idx + 1}`,
        qr_token: t.qrToken || `${ticketNumber}-${idx + 1}`,
        status: "ACTIVE",
        date: date || new Date().toISOString().slice(0, 10),
        time: time || "11:00 PM",
        unit_price: Number(unitPrice) || 0,
        created_at: nowIso,
        updated_at: nowIso,
      }));

      let { error: ticketsError } = await supabase
        .from("tickets")
        .upsert(ticketRows);

      if (ticketsError) {
        console.warn("Supabase tickets insert warning:", ticketsError.message);
        const sanitizedRows = ticketRows.map((r) => ({ ...r, ticket_type_id: null }));
        const retryTix = await supabase.from("tickets").upsert(sanitizedRows);
        ticketsError = retryTix.error;
        if (ticketsError) {
          console.error("Supabase tickets insert failed:", ticketsError.message);
        }
      }
    }

    // 3. Mark seats as booked in Supabase
    if (Array.isArray(seats) && seats.length > 0) {
      for (const s of seats) {
        const seatKey = String(s).trim();
        await supabase
          .from("seats")
          .update({
            status: "booked",
            booked_at: nowIso,
            booking_id: ticketNumber,
            reserved_at: null,
            reserved_by: null,
            updated_at: nowIso,
          })
          .eq("event_id", eventId)
          .or(`id.eq.${seatKey},seat_label.eq.${seatKey}`);
      }
    }

    // 4. Increment tickets_sold and total_revenue on event
    try {
      const { data: eventData } = await supabase
        .from("events")
        .select("tickets_sold, total_revenue")
        .eq("id", eventId)
        .single();

      if (eventData) {
        const nextSold = (Number(eventData.tickets_sold) || 0) + (Number(quantity) || 1);
        const nextRev = (Number(eventData.total_revenue) || 0) + (Number(amount) || 0);
        await supabase
          .from("events")
          .update({
            tickets_sold: nextSold,
            total_revenue: nextRev,
            updated_at: nowIso,
          })
          .eq("id", eventId);
      }
    } catch (e) {
      /* ignore */
    }

    return true;
  } catch (err) {
    console.warn("sbSaveBooking exception:", err);
    return false;
  }
}

/**
 * Fetch bookings for a customer by mobile number
 */
export async function sbFetchBookingsByPhone(phone) {
  if (!phone) return [];
  const cleanPhone = String(phone).replace(/\D/g, "").slice(-10);

  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .ilike("customer_phone", `%${cleanPhone}%`)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("sbFetchBookingsByPhone error:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    return [];
  }
}

/**
 * Request real OTP for customer phone number via Fast2SMS server route
 * Enforces strict max 3 SMS per IST day and 5-minute expiry
 */
export async function requestCustomerOtp(mobile) {
  const clean = String(mobile || "").replace(/\D/g, "").slice(-10);
  if (clean.length !== 10) {
    throw new Error("Please enter a valid 10-digit mobile number.");
  }

  const res = await fetch("/api/auth/otp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile: clean }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to send verification code.");
  }

  return data;
}

/**
 * Reset daily SMS limit & active OTPs for testing or dev debugging
 */
export async function resetCustomerOtpLimit(mobile) {
  const clean = String(mobile || "").replace(/\D/g, "").slice(-10);
  if (clean.length !== 10) {
    throw new Error("Please enter a valid 10-digit mobile number.");
  }

  const res = await fetch("/api/auth/otp/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile: clean }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to reset limit.");
  }

  return data;
}

/**
 * Verify real OTP and establish authentic Supabase customer identity
 */
export async function verifyCustomerOtp(mobile, otp) {
  const cleanMobile = String(mobile || "").replace(/\D/g, "").slice(-10);
  if (cleanMobile.length !== 10) {
    throw new Error("Please enter a valid 10-digit mobile number.");
  }

  const cleanOtp = String(otp || "").trim();
  if (!cleanOtp) {
    throw new Error("Please enter the verification code.");
  }

  const res = await fetch("/api/auth/otp/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile: cleanMobile, otp: cleanOtp }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "OTP verification failed.");
  }

  // Supabase Auth integration: Establish authenticated session for customer
  const email = `customer_${cleanMobile}@customer.jatrabazaar.com`;
  const password = `JbCust@${cleanMobile}#2026!`;

  let authUser = null;
  let session = null;

  try {
    const { data: signInData } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInData?.user) {
      authUser = signInData.user;
      session = signInData.session;
    }
  } catch (e) {
    /* ignore */
  }

  if (!authUser) {
    try {
      const { data: signUpData } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            mobile: cleanMobile,
            role: "customer",
          },
        },
      });

      if (signUpData?.user) {
        authUser = signUpData.user;
        session = signUpData.session;
        if (!session) {
          const { data: retrySignIn } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (retrySignIn?.session) {
            session = retrySignIn.session;
            authUser = retrySignIn.user;
          }
        }
      }
    } catch (e) {
      /* ignore */
    }
  }

  const userId = authUser?.id || data.user?.id || `cust_${cleanMobile}`;

  return {
    success: true,
    user: authUser || data.user || { id: userId, mobile: cleanMobile },
    session,
    profile: data.profile,
    isNew: data.isNew,
    message: data.message,
  };
}

/**
 * Fetch profile from public.profiles with Firestore and localStorage fallback
 */
export async function getCustomerProfile(userId) {
  if (!userId) return null;

  // 1. Try Supabase
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("jatra:customer_profile", JSON.stringify(data));
        } catch (e) {}
      }
      return data;
    }
  } catch (err) {
    console.warn("getCustomerProfile Supabase notice:", err?.message);
  }

  // 2. Try LocalStorage fallback
  if (typeof window !== "undefined") {
    try {
      const cached = window.localStorage.getItem("jatra:customer_profile");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.id === userId || !parsed.id)) return parsed;
      }
    } catch (e) {}
  }

  return null;
}

/**
 * Initiate Google OAuth authentication for customers
 */
export async function signInWithGoogle(redirectTarget = "/profile") {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirectTo = `${origin}${redirectTarget}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Sign in with Email/Gmail and Password
 */
export async function signInWithEmail(email, password) {
  if (!email || !password) throw new Error("Email and password are required");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Sign up with Email/Gmail and Password
 */
export async function signUpWithEmail(email, password, fullName = "") {
  if (!email || !password) throw new Error("Email and password are required");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        role: "customer",
      },
      emailRedirectTo: `${origin}/profile`,
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Send password reset email
 */
export async function resetPassword(email) {
  if (!email) throw new Error("Please enter your email address to reset password");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${origin}/profile`,
  });
  if (error) throw error;
  return data;
}

/**
 * Save new customer profile to Supabase with role = 'customer' and Firestore/localStorage backup
 */
export async function saveCustomerProfile({
  id,
  mobile = null,
  full_name,
  email = null,
  profile_photo = null,
}) {
  if (!id) throw new Error("Customer user ID is required");
  if (!full_name?.trim()) throw new Error("Full name is required");

  const cleanMobile = mobile ? String(mobile).replace(/\D/g, "").slice(-10) : null;
  const nowIso = new Date().toISOString();

  const payload = {
    id,
    mobile: cleanMobile || null,
    full_name: full_name.trim(),
    email: email?.trim() || null,
    profile_photo: profile_photo?.trim() || null,
    role: "customer",
    is_active: true,
    status: "active",
    last_login_at: nowIso,
    updated_at: nowIso,
  };

  // Immediate local cache
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("jatra:customer_profile", JSON.stringify(payload));
      window.localStorage.setItem("jatra:customer_auth_id", id);
      if (cleanMobile) {
        window.localStorage.setItem("jatra:customer_mobile", cleanMobile);
      }
    } catch (e) {}
  }

  // Supabase primary write
  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert([payload])
      .select()
      .single();

    if (error) {
      console.warn("saveCustomerProfile Supabase notice:", error.message);
      // If table doesn't exist yet in Supabase schema cache (PGRST205), return saved payload gracefully
      if (error.code === "PGRST205" || String(error.message || "").includes("profiles")) {
        return payload;
      }
      throw new Error(error.message);
    }

    if (data && typeof window !== "undefined") {
      try {
        window.localStorage.setItem("jatra:customer_profile", JSON.stringify(data));
      } catch (e) {}
    }

    return data || payload;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("profiles") || msg.includes("schema cache")) {
      return payload;
    }
    throw err;
  }
}

/**
 * Update permitted profile fields for the authenticated customer
 */
export async function updateCustomerProfile(userId, {
  full_name,
  email,
  profile_photo,
  mobile,
}) {
  if (!userId) throw new Error("User ID is required");
  if (!full_name?.trim()) throw new Error("Full Name cannot be empty");

  const cleanMobile = mobile !== undefined ? (mobile ? String(mobile).replace(/\D/g, "").slice(-10) : null) : undefined;

  const updates = {
    full_name: full_name.trim(),
    email: email?.trim() || null,
    profile_photo: profile_photo?.trim() || null,
    ...(cleanMobile !== undefined ? { mobile: cleanMobile } : {}),
    updated_at: new Date().toISOString(),
  };

  // Update local storage
  if (typeof window !== "undefined") {
    try {
      const existing = window.localStorage.getItem("jatra:customer_profile");
      const merged = existing ? { ...JSON.parse(existing), ...updates } : updates;
      window.localStorage.setItem("jatra:customer_profile", JSON.stringify(merged));
    } catch (e) {}
  }

  // Update Supabase
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST205" || String(error.message || "").includes("profiles")) {
        return updates;
      }
      throw new Error(error.message);
    }

    return data || updates;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("profiles") || msg.includes("schema cache")) {
      return updates;
    }
    throw err;
  }
}

/**
 * Clear customer authentication session
 */
export async function logoutCustomer() {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem("jatra:customer_profile");
      window.localStorage.removeItem("jatra:customer_auth_id");
      window.localStorage.removeItem("jatra:customer_mobile");
    } catch (e) {
      /* ignore */
    }
  }
}

/**
 * Synchronous check whether customer has a saved, valid profile locally
 */
export function getSavedCustomerProfile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("jatra:customer_profile");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.full_name || parsed.name) && (parsed.mobile || parsed.phone)) {
        return {
          id: parsed.id || window.localStorage.getItem("jatra:customer_auth_id") || "",
          full_name: String(parsed.full_name || parsed.name || "").trim(),
          mobile: String(parsed.mobile || parsed.phone || "").replace(/\D/g, "").slice(-10),
          email: parsed.email || "",
          profile_photo: parsed.profile_photo || null,
        };
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Async check or fetch customer profile from local cache, Supabase auth, or DB
 */
export async function getActiveCustomerProfile() {
  const local = getSavedCustomerProfile();
  if (local && local.full_name && local.mobile) return local;

  if (typeof window === "undefined") return null;

  try {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    const authId = user?.id || window.localStorage.getItem("jatra:customer_auth_id");
    if (authId) {
      const dbProfile = await getCustomerProfile(authId);
      if (dbProfile && (dbProfile.full_name || dbProfile.name)) {
        return {
          id: dbProfile.id || authId,
          full_name: String(dbProfile.full_name || dbProfile.name || "").trim(),
          mobile: String(dbProfile.mobile || dbProfile.phone || user?.user_metadata?.mobile || "").replace(/\D/g, "").slice(-10),
          email: dbProfile.email || user?.email || "",
          profile_photo: dbProfile.profile_photo || null,
        };
      }
    }
  } catch (e) {}

  return null;
}

