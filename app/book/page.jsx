"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BookingForm from "../components/BookingForm";
import { saveBooking } from "../../lib/bookings";
import { markSeatsBooked } from "../../lib/seats";

function BookContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId") ?? "EVT-2026-001";
  const block = searchParams.get("block") ?? "";
  const seats = searchParams.get("seats") ?? "";
  const seatPrice = Number(searchParams.get("seatPrice")) || 100;
  const seatCount = seats ? seats.split(",").filter(Boolean).length : 0;
  const totalAmount = seatPrice * seatCount;

  return (
    <BookingForm
      fullPage
      block={block}
      seats={seats}
      seatPrice={seatPrice}
      onClose={() => router.back()}
      onProceed={async (data) => {
        const params = new URLSearchParams({
          eventId,
          block,
          seats,
          seatPrice: String(seatPrice),
          paymentMethod: data.paymentMethod,
        });
        router.push(`/payment?${params.toString()}`);
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