import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://fmiaiuhmmlyciafxgvna.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_3CszK-oOtR0ce83iCNU30g_-ZuSt8or";

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_KEY;

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Cached server channels for fast, persistent broadcasts across clients
const serverChannels = new Map();

/**
 * Server-side broadcast helper to deliver real-time seat modifications
 * directly to all connected browser and mobile audience sessions across devices.
 * Uses persistent channel pooling and awaits delivery before returning.
 */
export async function serverBroadcastSeatChange(eventId, payload) {
  if (!eventId || !payload) return false;
  const cleanEvent = String(eventId).trim();
  const channelName = `realtime:seats:${cleanEvent}`;

  try {
    let entry = serverChannels.get(cleanEvent);
    if (!entry) {
      const ch = supabaseAdmin.channel(channelName, {
        config: { broadcast: { ack: false, self: true } },
      });
      entry = { channel: ch, status: "CONNECTING", promise: null };
      serverChannels.set(cleanEvent, entry);

      entry.promise = new Promise((resolve) => {
        ch.subscribe((status) => {
          entry.status = status;
          if (status === "SUBSCRIBED") {
            resolve(true);
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            serverChannels.delete(cleanEvent);
            resolve(false);
          }
        });
      });
    }

    if (entry.status !== "SUBSCRIBED") {
      // Wait up to 1200ms for subscription
      await Promise.race([
        entry.promise,
        new Promise((r) => setTimeout(() => r(false), 1200)),
      ]);
    }

    await entry.channel.send({
      type: "broadcast",
      event: "seat_change",
      payload,
    });
    return true;
  } catch (err) {
    console.warn("serverBroadcastSeatChange error:", err?.message);
    return false;
  }
}
