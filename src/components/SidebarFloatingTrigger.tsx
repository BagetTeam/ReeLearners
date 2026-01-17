"use client";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

export default function SidebarFloatingTrigger() {
  const { state } = useSidebar();
  if (state !== "collapsed") {
    return null;
  }

  return (
    <div className="pointer-events-none fixed left-4 top-4 z-40">
      <SidebarTrigger className="pointer-events-auto bg-white shadow-sm dark:bg-black" />
    </div>
  );
}
