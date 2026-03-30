"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, Home, LogOut, ShoppingBasket, UserRound } from "lucide-react";
import { useAuth } from "@/context/auth-context";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/grocery", label: "Grocery", icon: ShoppingBasket },
  { href: "/profile", label: "Profile", icon: UserRound },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="mobile-bottom-nav"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "white",
        borderTop: "1px solid rgb(var(--warm-200))",
        paddingBottom: "max(10px, env(safe-area-inset-bottom))",
      }}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
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
              padding: "12px 4px 14px",
              color: active ? "rgb(var(--terra-600))" : "rgb(var(--warm-500))",
              textDecoration: "none",
              transition: "color 0.15s",
              fontSize: "11px",
              fontWeight: active ? 600 : 400,
            }}
          >
            <Icon size={22} strokeWidth={active ? 2.3 : 2} />
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
          maxWidth: 1120,
          margin: "0 auto",
          padding: "14px 24px",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 24,
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
            src="/abovo_light_charcoal.png"
            alt="abovo"
            width={118}
            height={28}
            priority
            style={{
              width: "118px",
              height: "auto",
              display: "block",
            }}
          />
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 8, justifySelf: "center" }}>
          {NAV_ITEMS.map(({ href, label }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderRadius: 999,
                  color: active ? "rgb(var(--terra-600))" : "rgb(var(--warm-500))",
                  textDecoration: "none",
                  fontSize: 14,
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
              padding: "10px 14px",
              borderRadius: 999,
              border: "1px solid rgb(var(--warm-200))",
              background: "white",
              color: "rgb(var(--warm-600))",
              fontSize: 14,
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
