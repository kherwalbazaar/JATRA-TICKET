import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  getDoc,
} from "firebase/firestore";
import { firestore } from "./firebase";

const EVENTS_COL = "events";

export async function fetchEvents() {
  console.log("fetchEvents: Starting to fetch from Firestore");
  console.log("fetchEvents: Firestore instance:", firestore);
  
  try {
    // Try without orderBy first to see if we can get any data
    const q = query(collection(firestore, EVENTS_COL));
    console.log("fetchEvents: Query created (no orderBy)");
    
    const snap = await getDocs(q);
    console.log("fetchEvents: Query snapshot size:", snap.size);
    console.log("fetchEvents: Query snapshot empty:", snap.empty);
    
    const data = snap.docs.map((d) => {
      const eventData = { key: d.id, ...d.data() };
      console.log("fetchEvents: Event data:", eventData);
      return eventData;
    });
    console.log("fetchEvents: Final data array:", data);
    return data;
  } catch (error) {
    console.error("fetchEvents: Error fetching events:", error);
    console.error("fetchEvents: Error code:", error.code);
    console.error("fetchEvents: Error message:", error.message);
    return [];
  }
}

export function subscribeEvents(callback) {
  console.log("subscribeEvents: Starting subscription to Firestore");
  console.log("subscribeEvents: Firestore instance:", firestore);
  
  try {
    // Try without orderBy first
    const q = query(collection(firestore, EVENTS_COL));
    console.log("subscribeEvents: Query created (no orderBy)");
    
    const unsubscribe = onSnapshot(q, (snap) => {
      console.log("subscribeEvents: Snapshot received, size:", snap.size);
      console.log("subscribeEvents: Snapshot empty:", snap.empty);
      
      const data = snap.docs.map((d) => {
        const eventData = { key: d.id, ...d.data() };
        console.log("subscribeEvents: Event data:", eventData);
        return eventData;
      });
      console.log("subscribeEvents: Calling callback with data:", data);
      callback(data);
    }, (error) => {
      console.error("subscribeEvents: Firestore subscription error:", error);
      console.error("subscribeEvents: Error code:", error.code);
      console.error("subscribeEvents: Error message:", error.message);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error("subscribeEvents: Error setting up subscription:", error);
    console.error("subscribeEvents: Error code:", error.code);
    console.error("subscribeEvents: Error message:", error.message);
    return () => {};
  }
}
