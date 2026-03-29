"use client";

import { usePathname } from "next/navigation";
import { BottomNav, DesktopNav } from "@/components/layout/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isImmersiveRecipePage = /^\/recipes\/[^/]+\/cook$/.test(pathname);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {!isImmersiveRecipePage && <DesktopNav />}
      <main
        className="app-main-shell"
        style={{ flex: 1, paddingBottom: isImmersiveRecipePage ? 0 : "72px" }}
      >
        {children}
      </main>
      {!isImmersiveRecipePage && <BottomNav />}
    </div>
  );
}
