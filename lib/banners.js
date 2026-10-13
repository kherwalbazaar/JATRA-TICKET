import { supabase } from "./supabase";

export async function fetchBanners() {
  try {
    const { data: bannerData, error } = await supabase
      .from("banners")
      .select("*")
      .order("display_order", { ascending: true });

    if (!error && Array.isArray(bannerData) && bannerData.length > 0) {
      return bannerData.map((d) => ({ key: d.id, ...d }));
    }

    // Fallback: extract banners from events in Supabase
    const { data: eventsData } = await supabase
      .from("events")
      .select("id, poster, additional_banners, event_title, name");

    if (Array.isArray(eventsData) && eventsData.length > 0) {
      const list = [];
      eventsData.forEach((ev) => {
        if (ev.poster) {
          list.push({ key: ev.id, img: ev.poster, eventId: ev.id, title: ev.event_title || ev.name });
        }
        if (Array.isArray(ev.additional_banners)) {
          ev.additional_banners.forEach((b, idx) => {
            if (b && b !== ev.poster) {
              list.push({ key: `${ev.id}_${idx}`, img: b, eventId: ev.id, title: ev.event_title || ev.name });
            }
          });
        }
      });
      if (list.length > 0) return list;
    }
  } catch (err) {
    console.warn("fetchBanners Supabase warning:", err?.message);
  }
  return [];
}

export function subscribeBanners(callback) {
  let disposed = false;

  const loadAndEmit = async () => {
    if (disposed) return;
    const list = await fetchBanners();
    if (!disposed && Array.isArray(list)) {
      callback(list);
    }
  };

  loadAndEmit();

  let channel = null;
  try {
    channel = supabase
      .channel(`banners-realtime-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "banners" },
        () => {
          if (!disposed) loadAndEmit();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          if (!disposed) loadAndEmit();
        }
      )
      .subscribe();
  } catch (e) {
    console.warn("subscribeBanners channel warning:", e?.message);
  }

  return () => {
    disposed = true;
    if (channel) supabase.removeChannel(channel);
  };
}
