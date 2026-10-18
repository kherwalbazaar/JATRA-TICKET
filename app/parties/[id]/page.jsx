import PartyDetail from "./PartyDetail";

export const dynamic = "force-dynamic";

export default async function PartyDetailPage({ params }) {
  const { id } = await params;
  return <PartyDetail id={id} />;
}
