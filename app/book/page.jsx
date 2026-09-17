"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BookingForm from "../components/BookingForm";
import { saveBooking } from "../../lib/bookings";

function BookContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tierId = searchParams.get("tier") ?? "vip";
  const eventId = searchParams.get("eventId") ?? "EVT-2026-001";

  return (
    <BookingForm
      fullPage
      initialTierId={tierId}
      eventId={eventId}
      onClose={() => router.back()}
      onProceed={async (data) => {
        try {
          await saveBooking({ ...data, eventId });
        } catch (err) {
          console.error("Failed to save booking", err);
        }
        router.push("/tickets");
      }}
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