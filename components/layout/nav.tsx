"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpenText, CalendarDays, CircleUser, Home, LogOut, ShoppingBag, Users } from "lucide-react";
import { useAuth } from "@/context/auth-context";

const MOBILE_NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/recipes", label: "Recipes", icon: BookOpenText },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/grocery", label: "Grocery", icon: ShoppingBag },
  { href: "/profile", label: "Profile", icon: CircleUser },
];

const DESKTOP_NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/recipes", label: "Recipes", icon: BookOpenText },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/kitchen", label: "Kitchen", icon: Users },
  { href: "/grocery", label: "Grocery", icon: ShoppingBag },
  { href: "/profile", label: "Profile", icon: CircleUser },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

export function BottomNav() {
  const pathname = usePathname();
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const updateStandalone = () => {
      const displayModeStandalone =
        typeof window !== "undefined" &&
        window.matchMedia("(display-mode: standalone)").matches;
      const iosStandalone =
        typeof window !== "undefined" &&
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
    <nav
      className="mobile-bottom-nav"
      data-standalone={isStandalone ? "true" : "false"}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "white",
        borderTop: "1px solid rgb(var(--warm-200))",
        paddingBottom: isStandalone
          ? "max(12px, env(safe-area-inset-bottom))"
          : "max(6px, env(safe-area-inset-bottom))",
        transform: "translateZ(0)",
      }}
    >
      {MOBILE_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActivePath(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "5px",
              padding: isStandalone ? "20px 4px 13px" : "20px 4px 13px",
              color: active ? "rgb(var(--terra-600))" : "rgb(var(--warm-500))",
              textDecoration: "none",
              transition: "color 0.15s",
              fontSize: "11px",
              fontWeight: active ? 600 : 400,
            }}
          >
            <Icon size={22} strokeWidth={active ? 2.0 : 1.7} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function DesktopNav() {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <header
      className="desktop-top-nav"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 45,
        background: "white",
        borderBottom: "1px solid rgb(var(--warm-200))",
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "12px 18px",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
          }}
          aria-label="abovo"
        >
          <Image
            src="/abovo_terracotta.png"
            alt="abovo"
            width={84}
            height={20}
            priority
            style={{
              width: "84px",
              height: "auto",
              display: "block",
            }}
          />
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 6, justifySelf: "center" }}>
          {DESKTOP_NAV_ITEMS.map(({ href, label }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "8px 11px",
                  borderRadius: 999,
                  color: active ? "rgb(var(--terra-600))" : "rgb(var(--warm-500))",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  transition: "color 0.15s, background 0.15s",
                  background: active ? "rgb(var(--terra-50))" : "transparent",
                }}
              >
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{ justifySelf: "end" }}>
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Sign out"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgb(var(--warm-200))",
              background: "white",
              color: "rgb(var(--warm-600))",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s, background 0.15s",
            }}
          >
            <LogOut size={16} strokeWidth={2.1} />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function TopBar({
  title,
  right,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(250,248,246,0.95)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgb(var(--warm-200))",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {title && (
        <div style={{ flex: 1, fontWeight: 600, fontSize: "17px", color: "rgb(var(--warm-900))" }}>
          {title}
        </div>
      )}
      {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
    </header>
  );
}
