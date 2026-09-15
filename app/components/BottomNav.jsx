"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const tabs = [
  { id: "tickets", title: "My Tickets", icon: "fa-solid fa-ticket-simple", href: "/tickets" },
  { id: "events", title: "Events", icon: "fa-solid fa-calendar-days", href: "/events" },
  { id: "home", title: "Home", icon: "fa-solid fa-house", href: "/" },
  { id: "support", title: "Support", icon: "fa-solid fa-headset", href: "/support" },
  { id: "profile", title: "Profile", icon: "fa-regular fa-circle-user", href: "/profile" },
];

export default function BottomNav({ active }) {
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef(null);
  const borderRef = useRef(null);
  const glowRef = useRef(null);
  const [hidden, setHidden] = useState(false);
  const lastScroll = useRef(0);

  const currentPage = active || (pathname.startsWith("/tickets") ? "tickets" : pathname.startsWith("/events") ? "events" : pathname.startsWith("/support") ? "support" : pathname.startsWith("/profile") ? "profile" : "home");

  useEffect(() => {
    const onScroll = () => {
      const cur = window.scrollY;
      if (cur > lastScroll.current && cur > 50) setHidden(true);
      else if (cur < lastScroll.current) setHidden(false);
      lastScroll.current = cur;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const updatePositions = () => {
      const activeItem = menuRef.current?.querySelector(".active");
      if (activeItem && borderRef.current && menuRef.current) {
        const rect = activeItem.getBoundingClientRect();
        const menuRect = menuRef.current.getBoundingClientRect();
        const left = Math.floor(rect.left - menuRect.left - (borderRef.current.offsetWidth - rect.width) / 2) + "px";
        borderRef.current.style.transform = `translate3d(${left}, 0, 0)`;
      }

      if (glowRef.current && menuRef.current) {
        const activeItem = menuRef.current.querySelector(".active");
        if (activeItem) {
          const rect = activeItem.getBoundingClientRect();
          const menuRect = menuRef.current.getBoundingClientRect();
          const centerX = rect.left - menuRect.left + rect.width / 2;
          glowRef.current.style.transform = `translate3d(${centerX - 28}px, 0, 0)`;
        }
      }
    };

    updatePositions();
    window.addEventListener("resize", updatePositions);
    return () => window.removeEventListener("resize", updatePositions);
  }, [currentPage]);

  const handleTabChange = (tab) => {
    if (tab.href && tab.href !== "#") {
      router.push(tab.href);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className={`nav-wrapper fixed bottom-0 left-0 right-0 transition-transform duration-300 ${hidden ? "translate-y-full" : "translate-y-0"}`}>
      <menu className="menu" ref={menuRef}>
        <div className="glow-orb" ref={glowRef}>
          <div className="glow-orb__core" />
          <div className="glow-orb__ring" />
          <div className="glow-orb__pulse" />
        </div>

        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={`menu__item ${currentPage === tab.id ? "active" : ""} ${tab.id === "home" ? "home-always" : ""}`}
            onClick={() => handleTabChange(tab)}
            title={tab.title}
            aria-label={tab.title}
            aria-current={currentPage === tab.id ? "page" : undefined}
          >
            <span className="icon-wrapper">
              <i className={`${tab.icon} nav-icon ${tab.id === "home" ? "nav-icon-home" : ""}`} />
            </span>
            <span className="menu__label">{tab.title}</span>
          </button>
        ))}
        <div className="menu__border" ref={borderRef}></div>
      </menu>

      <div className="svg-container">
        <svg viewBox="0 0 202.9 45.5">
          <clipPath id="menu" clipPathUnits="objectBoundingBox" transform="scale(0.0049285362247413 0.021978021978022)">
            <path d="M6.7,45.5c5.7,0.1,14.1-0.4,23.3-4c5.7-2.3,9.9-5,18.1-10.5c10.7-7.1,11.8-9.2,20.6-14.3c5-2.9,9.2-5.2,15.2-7 c7.1-2.1,13.3-2.3,17.6-2.1c4.2-0.2,10.5,0.1,17.6,2.1c6.1,1.8,10.2,4.1,15.2,7c8.8,5,9.9,7.1,20.6,14.3c8.3,5.5,12.4,8.2,18.1,10.5 c9.2,3.6,17.6,4.2,23.3,4H6.7z" />
          </clipPath>
        </svg>
      </div>
    </div>
  );
}
