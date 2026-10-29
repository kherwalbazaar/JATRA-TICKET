import { getCatalog, readCatalog, subscribeCatalog, refreshCatalog } from "./catalogStore";
import { isLogoUrl, getPartyKnownBanner } from "./events";

function buildBanners(bannerRows = [], eventRows = []) {
  const valid = bannerRows.filter((d) => !isLogoUrl(d.img || d.image || d.url));
  if (valid.length > 0) return valid.map((d) => ({ key: d.id, ...d }));

  const list = [];
  eventRows.forEach((ev) => {
    const rawBanners = Array.isArray(ev.additional_banners) ? ev.additional_banners : [];
    const candidates = [
      ...rawBanners,
      !isLogoUrl(ev.poster) ? ev.poster : null,
      getPartyKnownBanner(ev.party_name),
    ].filter((b) => Boolean(b) && !isLogoUrl(b));

    [...new Set(candidates)].forEach((b, idx) => {
      list.push({
        key: `${ev.id}_${idx}`,
        img: b,
        eventId: ev.id,
        title: ev.event_title || ev.name,
      });
    });
  });
  return list;
}

export async function fetchBanners() {
  try {
    const [bannerRows, eventRows] = await Promise.all([
      getCatalog("banners"),
      getCatalog("events"),
    ]);
    return buildBanners(bannerRows || [], eventRows || []);
  } catch (err) {
    console.warn("fetchBanners catalog warning:", err?.message);
  }
  return [];
}

export function subscribeBanners(callback) {
  if (typeof callback !== "function") return () => {};

  let bannerRows = readCatalog("banners") || [];
  let eventRows = readCatalog("events") || [];
  let lastJson = null;

  const emit = () => {
    const list = buildBanners(bannerRows, eventRows);
    const json = JSON.stringify(list);
    if (json === lastJson) return;
    lastJson = json;
    callback(list);
  };

  const unsubBanners = subscribeCatalog("banners", (rows) => {
    bannerRows = rows || [];
    emit();
  });
  const unsubEvents = subscribeCatalog("events", (rows) => {
    eventRows = rows || [];
    emit();
  });

  if (bannerRows.length || eventRows.length) emit();
  refreshCatalog("banners");
  refreshCatalog("events");

  return () => {
    unsubBanners();
    unsubEvents();
  };
}
