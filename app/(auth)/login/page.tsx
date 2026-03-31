"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { AuthPattern } from "@/components/auth/auth-pattern";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(identifier, password);
      window.location.assign(redirect);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return <LoginShell form={
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.field}>
        <label style={styles.label}>Email or username</label>
        <input
          style={styles.input}
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="you@example.com"
          autoComplete="username"
          required
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Password</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <button type="submit" disabled={loading} style={styles.btn}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  } />;
}

function LoginShell({ form }: { form?: React.ReactNode }) {
  return (
    <div style={styles.page}>
      <AuthPattern />
      <div aria-hidden="true" style={styles.cardGlow} />
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <Image
            src="/abovo_cream.png"
            alt="abovo"
            width={144}
            height={34}
            priority
            style={styles.logoImage}
          />
        </div>

        <h1 style={styles.heading}>Welcome Back</h1>
        <p style={styles.sub}>Sign in to your kitchen</p>

        {form}

        <p style={styles.footer}>
          No account?{" "}
          <Link href="/signup" style={styles.link}>
            Create one free
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    position: "relative",
    overflow: "hidden",
    background:
      "radial-gradient(circle at center, rgba(247, 241, 232, 0.18) 0%, rgba(247, 241, 232, 0.1) 16%, rgba(247, 241, 232, 0) 40%), linear-gradient(180deg, rgb(var(--terra-500)) 0%, rgb(150 69 34) 100%)",
  },
  cardGlow: {
    position: "absolute",
    zIndex: 0,
    width: "min(88vw, 560px)",
    height: "min(88vw, 560px)",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(247, 241, 232, 0.34) 0%, rgba(247, 241, 232, 0.18) 24%, rgba(247, 241, 232, 0.08) 42%, rgba(247, 241, 232, 0) 68%)",
    filter: "blur(12px)",
    transform: "translateZ(0)",
  },
  card: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: 400,
    background: "rgba(171, 80, 41, 0.9)",
    borderRadius: 20,
    padding: "40px 32px",
    border: "1px solid rgba(247, 241, 232, 0.24)",
    backdropFilter: "blur(10px)",
  },
  logoWrap: {
    marginBottom: 28,
    display: "flex",
    justifyContent: "center",
  },
  logoImage: {
    width: "144px",
    height: "auto",
  },
  heading: {
    fontSize: 26,
    fontWeight: 700,
    color: "rgb(236 225 211)",
    marginBottom: 6,
    fontFamily: "var(--font-serif)",
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    color: "rgba(232, 219, 204, 0.9)",
    marginBottom: 28,
    textAlign: "center",
  },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: "rgba(247, 241, 232, 0.88)" },
  input: {
    border: "1.5px solid rgba(247, 241, 232, 0.7)",
    borderRadius: 10,
    padding: "11px 14px",
    fontSize: 15,
    color: "rgb(var(--warm-900))",
    background: "white",
    outline: "none",
    transition: "border-color 0.15s",
    width: "100%",
  },
  error: {
    fontSize: 13,
    color: "rgb(var(--warm-50))",
    background: "rgba(96, 42, 18, 0.34)",
    border: "1px solid rgba(247, 241, 232, 0.2)",
    borderRadius: 8,
    padding: "8px 12px",
  },
  btn: {
    background: "rgb(var(--warm-50))",
    color: "rgb(var(--terra-600))",
    border: "none",
    borderRadius: 10,
    padding: "13px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
    transition: "background 0.15s",
  },
  footer: { textAlign: "center", marginTop: 20, fontSize: 14, color: "rgba(247, 241, 232, 0.78)" },
  link: { color: "rgb(var(--warm-50))", fontWeight: 700, textDecoration: "none" },
};
