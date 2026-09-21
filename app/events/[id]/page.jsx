import EventDetail from "./EventDetail";

export function generateStaticParams() {
  return [{ id: "1" }, { id: "2" }, { id: "3" }];
}

export default async function EventDetailPage({ params }) {
  const { id } = await params;
  return <EventDetail id={id} />;
}
