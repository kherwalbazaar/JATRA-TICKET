import { notFound } from "next/navigation";
import TicketDetail from "./TicketDetail";

export const metadata = {
  title: "Ticket Details - Adim Lahah Mandawa",
};

const tickets = [
  { id: "NJ-TKT-501", name: "Balakram Tudu", category: "VIP", gate: "Gate C" },
  { id: "NJ-TKT-502", name: "Rakesh Murmu", category: "VIP", gate: "Gate C" },
  { id: "NJ-TKT-503", name: "Sanjay Hansda", category: "VIP", gate: "Gate C" },
  { id: "NJ-TKT-504", name: "Gita Tudu", category: "VIP", gate: "Gate C" },
];

export function generateStaticParams() {
  return tickets.map((t) => ({ id: t.id }));
}

export default async function TicketPage({ params }) {
  const { id } = await params;
  const index = tickets.findIndex((t) => t.id === id);
  if (index === -1) notFound();

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <TicketDetail ticket={tickets[index]} ticketNumber={index + 1} totalTickets={tickets.length} />
    </div>
  );
}