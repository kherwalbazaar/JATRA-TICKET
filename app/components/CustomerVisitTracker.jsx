"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordCustomerVisit } from "../../lib/supabase";

export default function CustomerVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // 1. Record visit on initial page mount or path navigation
    recordCustomerVisit();

    // 2. Record visit when tab becomes visible or receives focus (e.g. returning to browser)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        recordCustomerVisit();
      }
    };

    const handleFocus = () => {
      recordCustomerVisit();
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [pathname]);

  return null;
}
