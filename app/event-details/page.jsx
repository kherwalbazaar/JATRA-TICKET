"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import EventDetail from "../events/[id]/EventDetail";

function EventDetailsContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  if (!id) {
    return null;
  }

  return <EventDetail id={id} />;
}

export default function EventDetailsPage() {
  return (
    <Suspense fallback={null}>
      <EventDetailsContent />
    </Suspense>
  );
}
