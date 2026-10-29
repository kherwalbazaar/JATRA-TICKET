"use client";

import { useEffect } from "react";
import { warmCatalog, refreshStaleCatalog } from "../../lib/catalogStore";

export default function CatalogSync() {
  useEffect(() => {
    warmCatalog();

    const revalidate = () => refreshStaleCatalog();
    const onVisibility = () => {
      if (document.visibilityState === "visible") revalidate();
    };

    window.addEventListener("focus", revalidate);
    window.addEventListener("online", revalidate);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", revalidate);
      window.removeEventListener("online", revalidate);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
