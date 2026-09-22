import EventDetail from "./EventDetail";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }) {
  const { id } = await params;
  return <EventDetail id={id} />;
}
