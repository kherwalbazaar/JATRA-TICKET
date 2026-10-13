"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BookingForm from "../components/BookingForm";
import { getSavedCustomerProfile } from "../../lib/supabase";

function BookContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId") ?? "";
  const eventName = searchParams.get("event") ?? "";
  const date = searchParams.get("date") ?? "";
  const time = searchParams.get("time") ?? "";
  const block = searchParams.get("block") ?? "";
  const seats = searchParams.get("seats") ?? "";
  const seatPrice = Number(searchParams.get("seatPrice")) || 0;
  const tier = searchParams.get("tier") ?? "vip";

  // Check if profile exists; if not, redirect immediately to /profile?redirect=...
  useEffect(() => {
    const profile = getSavedCustomerProfile();
    if (!profile || !profile.full_name) {
      if (typeof window !== "undefined") {
        const fullCurrentPath = window.location.pathname + window.location.search;
        router.push(`/profile?redirect=${encodeURIComponent(fullCurrentPath)}`);
      }
    }
  }, [router]);

  return (
    <BookingForm
      fullPage
      initialEventId={eventId}
      initialEventName={eventName}
      initialDate={date}
      initialTime={time}
      block={block}
      seats={seats}
      seatPrice={seatPrice}
      initialTierId={tier}
      onClose={() => router.back()}
    />
  );
}

export default function BookTicketsPage() {
  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <Suspense fallback={null}>
        <BookContent />
      </Suspense>
    </div>
  );
}