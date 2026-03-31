"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, ExternalLink, Mail, Smartphone, UserRound } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [recipeCount, setRecipeCount] = useState<number | null>(null);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installMessage, setInstallMessage] = useState("");
  const [isStandalone, setIsStandalone] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const loadProfileStats = async () => {
      const res = await fetch("/api/recipes?limit=1&ownedOnly=true", {
        credentials: "same-origin",
      });
      if (!res.ok || cancelled) return;

      const json = await res.json();
      if (!cancelled) {
        setRecipeCount(json.data?.total ?? 0);
      }
    };

    void loadProfileStats();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkStandalone = () => {
      const standaloneMatch = window.matchMedia("(display-mode: standalone)").matches;
      const iosStandalone = "standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
      setIsStandalone(standaloneMatch || iosStandalone);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstallPromptEvent(null);
      setInstallMessage("abovo is installed on this device.");
      checkStandalone();
    };

    checkStandalone();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!user) return null;

  const handleInstall = async () => {
    if (isStandalone) {
      setInstallMessage("abovo is already installed on this device.");
      return;
    }

    if (installPromptEvent) {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      setInstallPromptEvent(null);
      setInstallMessage(
        choice.outcome === "accepted"
          ? "Install started. Check your home screen."
          : "Install dismissed for now."
      );
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);

    if (isIos && typeof window.navigator.share === "function") {
      try {
        await window.navigator.share({
          title: "abovo",
          text: "Add abovo to your home screen.",
          url: window.location.origin,
        });
        setInstallMessage("In the share sheet, choose Add to Home Screen.");
        return;
      } catch {
        setInstallMessage("In Safari, tap Share and then Add to Home Screen.");
        return;
      }
    }

    setInstallMessage(
      isIos
        ? "In Safari, tap Share and then Add to Home Screen."
        : "Open your browser menu and choose Install app or Add to Home Screen."
    );
  };

  const ua = typeof window !== "undefined" ? window.navigator.userAgent.toLowerCase() : "";
  const isIos = /iphone|ipad|ipod/.test(ua);
  const installSteps = isStandalone
    ? []
    : isIos
      ? ["Tap the Share button in Safari", "Choose Add to Home Screen", "Tap Add"]
      : installPromptEvent
        ? ["Tap Add to Home Screen below", "Confirm the install prompt", "Open abovo from your home screen"]
        : ["Open your browser menu", "Choose Install app or Add to Home Screen", "Confirm the install"];

  return (
    <div style={S.page} className="profile-page">
      <div style={S.header} className="profile-header">
        <div style={S.avatar}>
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.displayName || user.username}
              fill
              unoptimized
              sizes="72px"
              style={S.avatarImg}
            />
          ) : (
            <div style={S.avatarPlaceholder}>
              {(user.displayName || user.username).charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="profile-meta">
          <h1 style={S.name}>{user.displayName || user.username}</h1>
          <p style={S.username}>@{user.username}</p>
          {user.bio && <p style={S.bio}>{user.bio}</p>}
        </div>
      </div>

      <div style={S.statsRow} className="profile-stats">
        <div style={S.stat}>
          <span style={S.statNum}>{recipeCount ?? user._count?.recipes ?? 0}</span>
          <span style={S.statLabel}>Recipes</span>
        </div>
      </div>

      <div style={S.section}>
        <h2 style={S.sectionTitle}>Account</h2>
        <div style={S.menuList}>
          <MenuItem icon={Mail} label="Email" value={user.email} />
          <MenuItem icon={UserRound} label="Username" value={`@${user.username}`} />
          <MenuItem icon={CalendarDays} label="Member since" value={new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })} />
        </div>
      </div>

      <div style={S.section}>
        <h2 style={S.sectionTitle}>App</h2>
        <div style={S.menuList}>
          <div style={S.installCard}>
            <div style={S.installIcon}>
              <Smartphone size={18} strokeWidth={2} />
            </div>
            <div style={S.installInfo}>
              <span style={S.installLabel}>Add abovo to Home Screen</span>
              <span style={S.installValue}>
                {isStandalone
                  ? "Already installed on this device"
                  : installPromptEvent
                    ? "Use your browser's install prompt"
                    : "Use Add to Home Screen from your browser"}
              </span>
            </div>
            <button onClick={() => void handleInstall()} style={S.installBtn}>
              {isStandalone ? "Installed" : "Add to Home Screen"}
            </button>
          </div>
        </div>
        {!isStandalone && (
          <div style={S.installGuide}>
            <div style={S.installGuideHeader}>
              <span style={S.installGuideTitle}>How to install</span>
              {isIos && (
                <span style={S.installGuideBadge}>
                  <ExternalLink size={12} strokeWidth={2.2} />
                  <span>Safari</span>
                </span>
              )}
            </div>
            <div style={S.installStepList}>
              {installSteps.map((step, index) => (
                <div key={step} style={S.installStep}>
                  <span style={S.installStepNum}>{index + 1}</span>
                  <span style={S.installStepText}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {installMessage && <p style={S.installMessage}>{installMessage}</p>}
      </div>

      <button onClick={logout} style={S.logoutBtn}>
        Sign out
      </button>

      <p style={S.version}>v0.1.0</p>
    </div>
  );
}

function MenuItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: string }) {
  return (
    <div style={MI.row}>
      <span style={MI.icon}><Icon size={18} strokeWidth={2} /></span>
      <div style={MI.info}>
        <span style={MI.label}>{label}</span>
        {value && <span style={MI.value}>{value}</span>}
      </div>
    </div>
  );
}

const MI: Record<string, React.CSSProperties> = {
  row: { display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid rgb(var(--warm-100))" },
  icon: { width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "rgb(var(--terra-600))", flexShrink: 0 },
  info: { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  label: { fontSize: 14, fontWeight: 500, color: "rgb(var(--warm-800))" },
  value: { fontSize: 12, color: "rgb(var(--warm-400))" },
};

const S: Record<string, React.CSSProperties> = {
  page: { padding: "24px 16px", minHeight: "100dvh", background: "rgb(var(--warm-50))" },
  header: { gap: 16, marginBottom: 24 },
  avatar: { flexShrink: 0, width: 72, height: 72, position: "relative" },
  avatarImg: { width: 72, height: 72, borderRadius: "50%", objectFit: "cover" },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: "50%", background: "rgb(var(--terra-600))", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700 },
  name: { fontSize: 22, fontWeight: 700, color: "rgb(var(--warm-900))", fontFamily: "var(--font-serif)" },
  username: { fontSize: 14, color: "rgb(var(--warm-500))", marginTop: 2 },
  bio: { fontSize: 14, color: "rgb(var(--warm-600))", marginTop: 6, lineHeight: 1.5, maxWidth: 420 },
  statsRow: { display: "flex", gap: 24, background: "white", borderRadius: 14, padding: "16px 20px", marginBottom: 24, border: "1px solid rgb(var(--warm-100))" },
  stat: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  statNum: { fontSize: 24, fontWeight: 700, color: "rgb(var(--warm-900))" },
  statLabel: { fontSize: 12, color: "rgb(var(--warm-500))" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: "rgb(var(--warm-400))", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 },
  menuList: { background: "white", borderRadius: 14, padding: "0 16px", border: "1px solid rgb(var(--warm-100))" },
  installCard: { display: "flex", alignItems: "center", gap: 14, padding: "16px 0" },
  installIcon: { width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "rgb(var(--terra-600))", flexShrink: 0 },
  installInfo: { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  installLabel: { fontSize: 14, fontWeight: 600, color: "rgb(var(--warm-800))" },
  installValue: { fontSize: 12, color: "rgb(var(--warm-400))" },
  installBtn: { background: "rgb(var(--terra-600))", color: "white", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
  installGuide: { marginTop: 12, background: "rgb(var(--warm-50))", border: "1px solid rgb(var(--warm-100))", borderRadius: 14, padding: "14px 16px" },
  installGuideHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  installGuideTitle: { fontSize: 13, fontWeight: 700, color: "rgb(var(--warm-800))", textTransform: "uppercase", letterSpacing: "0.06em" },
  installGuideBadge: { display: "inline-flex", alignItems: "center", gap: 5, color: "rgb(var(--terra-700))", background: "rgb(var(--terra-50))", borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 700 },
  installStepList: { display: "flex", flexDirection: "column", gap: 10 },
  installStep: { display: "flex", alignItems: "flex-start", gap: 10 },
  installStepNum: { width: 22, height: 22, borderRadius: "50%", background: "rgb(var(--terra-600))", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 },
  installStepText: { fontSize: 13, color: "rgb(var(--warm-700))", lineHeight: 1.45, paddingTop: 1 },
  installMessage: { marginTop: 10, fontSize: 13, color: "rgb(var(--warm-600))" },
  logoutBtn: { width: "100%", background: "white", color: "rgb(var(--terra-600))", border: "1.5px solid rgb(var(--terra-200))", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 16 },
  version: { textAlign: "center", fontSize: 12, color: "rgb(var(--warm-300))" },
};
