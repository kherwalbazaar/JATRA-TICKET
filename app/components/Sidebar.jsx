"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSidebar } from "./SidebarContext";

const navItems = [
  { id: "home", title: "Home", icon: "fa-solid fa-house", href: "/" },
  { id: "tickets", title: "My Tickets", icon: "fa-solid fa-ticket-simple", href: "/tickets" },
  { id: "events", title: "Events", icon: "fa-solid fa-calendar-days", href: "/events" },
  { id: "seats", title: "Seat Selection", icon: "fa-solid fa-chair", href: "/seats" },
  { id: "book", title: "Book Tickets", icon: "fa-solid fa-ticket", href: "/book" },
  { id: "support", title: "Support", icon: "fa-solid fa-headset", href: "/support" },
  { id: "profile", title: "Profile", icon: "fa-regular fa-circle-user", href: "/profile" },
];

export default function Sidebar() {
  const { open, closeSidebar } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();

  const current =
    pathname.startsWith("/tickets")
      ? "tickets"
      : pathname.startsWith("/events")
      ? "events"
      : pathname.startsWith("/seats")
      ? "seats"
      : pathname.startsWith("/book")
      ? "book"
      : pathname.startsWith("/support")
      ? "support"
      : pathname.startsWith("/profile")
      ? "profile"
      : "home";

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleNav = (href) => {
    closeSidebar();
    router.push(href);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`sidebar-overlay ${open ? "sidebar-overlay--open" : ""}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* Sidebar drawer */}
      <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
        {/* Brand header */}
        <div className="p-5 pb-4 border-b border-white/10">
          <h1 className="text-xl font-black tracking-wide font-brand uppercase">
            <span className="text-amber-400">JATRA </span>
            <span className="text-white">BAZAAR</span>
          </h1>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Online Ticket System 2026</p>
        </div>

        {/* User card */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-lg font-bold shadow-lg">
              <i className="fa-solid fa-user" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">Guest User</p>
              <p className="text-[11px] text-slate-400 truncate">
                <i className="fa-solid fa-location-dot text-amber-400 mr-1" />
                Bahanada, Khunta
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 no-scrollbar">
          {navItems.map((item) => {
            const active = current === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.href)}
                className={`sidebar-nav-item ${active ? "sidebar-nav-item--active" : ""}`}
              >
                <span className="sidebar-nav-icon">
                  <i className={item.icon} />
                </span>
                <span className="sidebar-nav-label">{item.title}</span>
                {active && <span className="sidebar-nav-active-dot" />}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-5 border-t border-white/10">
          <p className="text-[10px] text-slate-500 text-center font-medium">
            JATRA BAZAAR &copy; 2026
          </p>
        </div>
      </aside>
    </>
  );
}
