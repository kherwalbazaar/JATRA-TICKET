import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { firestore } from "./firebase";

const FIRESTORE_TICKET_TYPES = "ticketTypes";

function mapDocs(snap) {
  return snap.docs.map((d) => ({ key: d.id, id: d.id, ...d.data() }));
}

/**
 * Ticket types (tier name + price) are authored in JATRA BAZAAR ADMIN and
 * stored in the root `ticketTypes` collection. The customer app must read
 * them so the prices it charges always match the admin panel.
 *
 * `eventId` is optional — without it every tier for every event is returned.
 */
export async function fetchTicketTypes(eventId = "") {
  try {
    const q = eventId
      ? query(
          collection(firestore, FIRESTORE_TICKET_TYPES),
          where("eventId", "==", eventId),
        )
      : query(collection(firestore, FIRESTORE_TICKET_TYPES));
    const snap = await getDocs(q);
    return mapDocs(snap);
  } catch (error) {
    console.error("fetchTicketTypes failed:", error?.code, error?.message);
    return [];
  }
}

export function subscribeTicketTypes(callback, eventId = "") {
  try {
    const q = eventId
      ? query(
          collection(firestore, FIRESTORE_TICKET_TYPES),
          where("eventId", "==", eventId),
        )
      : query(collection(firestore, FIRESTORE_TICKET_TYPES));
    return onSnapshot(
      q,
      (snap) => callback(mapDocs(snap)),
      (error) => {
        console.error("subscribeTicketTypes error:", error);
        callback([]);
      },
    );
  } catch (error) {
    console.error("subscribeTicketTypes setup failed:", error);
    return () => {};
  }
}
