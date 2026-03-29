"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, Mail, Smartphone, UserRound } from "lucide-react";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [recipeCount, setRecipeCount] = useState<number | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const loadProfileStats = async () => {
      const res = await fetch("/api/recipes?limit=1", {
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

  if (!user) return null;

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
          <MenuItem icon={Smartphone} label="Install on phone" value="Add to Home Screen from browser" />
        </div>
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
  logoutBtn: { width: "100%", background: "white", color: "rgb(var(--terra-600))", border: "1.5px solid rgb(var(--terra-200))", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 16 },
  version: { textAlign: "center", fontSize: 12, color: "rgb(var(--warm-300))" },
};
