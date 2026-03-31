"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BottomNav, DesktopNav } from "@/components/layout/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isImmersiveRecipePage = /^\/recipes\/[^/]+\/cook$/.test(pathname);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const updateStandalone = () => {
      const displayModeStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const iosStandalone =
        "standalone" in window.navigator &&
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

      setIsStandalone(displayModeStandalone || iosStandalone);
    };

    updateStandalone();
    window.addEventListener("resize", updateStandalone);

    return () => {
      window.removeEventListener("resize", updateStandalone);
    };
  }, []);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {!isImmersiveRecipePage && <DesktopNav />}
      <main
        className="app-main-shell"
        style={{
          flex: 1,
          paddingBottom: isImmersiveRecipePage ? 0 : isStandalone ? "92px" : "72px",
        }}
      >
        {children}
      </main>
      {!isImmersiveRecipePage && <BottomNav />}
    </div>
  );
}
