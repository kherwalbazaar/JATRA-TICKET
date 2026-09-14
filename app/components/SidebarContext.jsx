"use client";

import { createContext, useContext, useState, useCallback } from "react";

const SidebarContext = createContext();

export function SidebarProvider({ children }) {
  const [open, setOpen] = useState(false);

  const toggleSidebar = useCallback(() => setOpen((prev) => !prev), []);
  const closeSidebar = useCallback(() => setOpen(false), []);

  return (
    <SidebarContext.Provider value={{ open, toggleSidebar, closeSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
