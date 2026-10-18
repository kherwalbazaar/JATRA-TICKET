"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PartyDetail from "../parties/[id]/PartyDetail";

function PartyDetailsContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  if (!id) {
    return null;
  }

  return <PartyDetail id={id} />;
}

export default function PartyDetailsPage() {
  return (
    <Suspense fallback={null}>
      <PartyDetailsContent />
    </Suspense>
  );
}
