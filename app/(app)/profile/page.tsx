"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";
import type { Household } from "@/types";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, Mail, Smartphone, UserRound, Users, UserPlus, Crown, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const [recipeCount, setRecipeCount] = useState<number | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [householdLoading, setHouseholdLoading] = useState(true);
  const [householdSaving, setHouseholdSaving] = useState(false);
  const [householdError, setHouseholdError] = useState("");
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
    if (!userId) return;

    let cancelled = false;

    const loadHousehold = async () => {
      const res = await fetch("/api/household", {
        credentials: "same-origin",
      });
      if (!res.ok || cancelled) {
        if (!cancelled) setHouseholdLoading(false);
        return;
      }

      const json = await res.json();
      if (!cancelled) {
        setHousehold(json.data);
        setHouseholdName(json.data?.name || `${user?.displayName || user?.username || "My"} Kitchen`);
        setHouseholdLoading(false);
      }
    };

    void loadHousehold();
    return () => {
      cancelled = true;
    };
  }, [userId, user?.displayName, user?.username]);

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

  const runHouseholdAction = async (body: Record<string, unknown>) => {
    setHouseholdSaving(true);
    setHouseholdError("");

    try {
      const res = await fetch("/api/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        setHouseholdError(json.error || "Could not update your shared kitchen.");
        return;
      }

      setHousehold(json.data ?? null);
      setInviteEmail("");
      await refreshUser();
    } finally {
      setHouseholdSaving(false);
    }
  };

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

    setInstallMessage(
      isIos
        ? "In Safari, tap Share and then Add to Home Screen."
        : "Open your browser menu and choose Install app or Add to Home Screen."
    );
  };

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
              <span style={S.installLabel}>Install abovo</span>
              <span style={S.installValue}>
                {isStandalone
                  ? "Already installed on this device"
                  : installPromptEvent
                    ? "Install as an app from this browser"
                    : "Save it to your home screen"}
              </span>
            </div>
            <button onClick={() => void handleInstall()} style={S.installBtn}>
              {isStandalone ? "Installed" : "Install"}
            </button>
          </div>
        </div>
        {installMessage && <p style={S.installMessage}>{installMessage}</p>}
      </div>

      <div style={S.section}>
        <h2 style={S.sectionTitle}>Shared Kitchen</h2>
        {householdLoading ? (
          <div style={S.menuList}>
            <div style={S.householdEmpty}>Loading your kitchen…</div>
          </div>
        ) : household ? (
          <div style={S.menuList}>
            <div style={S.householdHeader}>
              <div>
                <p style={S.householdName}>{household.name}</p>
                <p style={S.householdSub}>
                  {household.memberCount} of {household.memberLimit} seats filled
                </p>
              </div>
              <div style={S.householdBadge}>
                <Users size={15} strokeWidth={2.2} />
                <span>{household.role === "owner" ? "Owner" : "Member"}</span>
              </div>
            </div>

            <div style={S.householdMemberList}>
              {household.members.map((member) => (
                <div key={member.id} style={S.householdMemberRow}>
                  <div style={S.householdMemberInfo}>
                    <span style={S.householdMemberName}>
                      {member.displayName || member.username}
                    </span>
                    <span style={S.householdMemberMeta}>{member.email}</span>
                  </div>
                  <div style={S.householdMemberActions}>
                    {member.role === "owner" && (
                      <span style={S.memberRole}>
                        <Crown size={13} strokeWidth={2.2} />
                        <span>Owner</span>
                      </span>
                    )}
                    {household.role === "owner" && member.id !== user.id && (
                      <button
                        style={S.memberRemoveBtn}
                        onClick={() => void runHouseholdAction({ action: "remove_member", userId: member.id })}
                        disabled={householdSaving}
                      >
                        <X size={14} strokeWidth={2.2} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {household.role === "owner" && household.remainingSlots > 0 && (
              <div style={S.householdInviteForm}>
                <div style={S.householdInviteLabel}>
                  <UserPlus size={15} strokeWidth={2.2} />
                  <span>Add someone by email</span>
                </div>
                <div style={S.householdInviteControls}>
                  <input
                    style={S.householdInput}
                    type="email"
                    placeholder="friend@example.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                  />
                  <button
                    style={S.householdPrimaryBtn}
                    disabled={householdSaving || !inviteEmail.trim()}
                    onClick={() => void runHouseholdAction({ action: "add_member", email: inviteEmail })}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            <button
              style={S.householdSecondaryBtn}
              onClick={() => void runHouseholdAction({ action: "leave" })}
              disabled={householdSaving}
            >
              {household.role === "owner" ? "Delete kitchen" : "Leave kitchen"}
            </button>
          </div>
        ) : (
          <div style={S.menuList}>
            <div style={S.householdEmpty}>
              <Users size={22} strokeWidth={2} />
              <p style={S.householdEmptyTitle}>Start a shared kitchen</p>
              <p style={S.householdEmptySub}>
                Link up with up to 4 more people so recipes can be shared in one place.
              </p>
              <div style={S.householdInviteControls}>
                <input
                  style={S.householdInput}
                  type="text"
                  placeholder={`${user.displayName || user.username}'s Kitchen`}
                  value={householdName}
                  onChange={(event) => setHouseholdName(event.target.value)}
                />
                <button
                  style={S.householdPrimaryBtn}
                  disabled={householdSaving}
                  onClick={() => void runHouseholdAction({ action: "create", name: householdName })}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
        {householdError && <p style={S.householdError}>{householdError}</p>}
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
  installMessage: { marginTop: 10, fontSize: 13, color: "rgb(var(--warm-600))" },
  householdHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "16px 0 12px", borderBottom: "1px solid rgb(var(--warm-100))" },
  householdName: { fontSize: 16, fontWeight: 700, color: "rgb(var(--warm-900))" },
  householdSub: { fontSize: 12, color: "rgb(var(--warm-500))", marginTop: 4 },
  householdBadge: { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, background: "rgb(var(--terra-50))", color: "rgb(var(--terra-700))", padding: "6px 10px", fontSize: 12, fontWeight: 700 },
  householdMemberList: { display: "flex", flexDirection: "column" },
  householdMemberRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 0", borderBottom: "1px solid rgb(var(--warm-100))" },
  householdMemberInfo: { display: "flex", flexDirection: "column", gap: 2 },
  householdMemberName: { fontSize: 14, fontWeight: 600, color: "rgb(var(--warm-800))" },
  householdMemberMeta: { fontSize: 12, color: "rgb(var(--warm-400))" },
  householdMemberActions: { display: "flex", alignItems: "center", gap: 8 },
  memberRole: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgb(var(--terra-700))", fontWeight: 700 },
  memberRemoveBtn: { width: 28, height: 28, borderRadius: 999, border: "1px solid rgb(var(--warm-200))", background: "white", color: "rgb(var(--warm-500))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  householdInviteForm: { padding: "16px 0", borderBottom: "1px solid rgb(var(--warm-100))", display: "flex", flexDirection: "column", gap: 10 },
  householdInviteLabel: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "rgb(var(--warm-700))" },
  householdInviteControls: { display: "flex", flexDirection: "column", gap: 10 },
  householdInput: { width: "100%", border: "1.5px solid rgb(var(--warm-200))", borderRadius: 10, padding: "11px 14px", fontSize: 14, background: "white", color: "rgb(var(--warm-900))", outline: "none" },
  householdPrimaryBtn: { background: "rgb(var(--terra-600))", color: "white", border: "none", borderRadius: 10, padding: "11px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", minWidth: 104 },
  householdSecondaryBtn: { width: "100%", margin: "16px 0", background: "white", color: "rgb(var(--warm-700))", border: "1px solid rgb(var(--warm-200))", borderRadius: 10, padding: "11px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  householdEmpty: { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, padding: "24px 0", color: "rgb(var(--terra-600))" },
  householdEmptyTitle: { fontSize: 16, fontWeight: 700, color: "rgb(var(--warm-900))" },
  householdEmptySub: { fontSize: 13, color: "rgb(var(--warm-500))", maxWidth: 320 },
  householdError: { marginTop: 10, fontSize: 13, color: "rgb(var(--terra-700))" },
  logoutBtn: { width: "100%", background: "white", color: "rgb(var(--terra-600))", border: "1.5px solid rgb(var(--terra-200))", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 16 },
  version: { textAlign: "center", fontSize: 12, color: "rgb(var(--warm-300))" },
};
