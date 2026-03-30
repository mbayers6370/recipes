"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { AuthPattern } from "@/components/auth/auth-pattern";

export default function SignupPage() {
  const { signup } = useAuth();

  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    displayName: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email.includes("@")) e.email = "Valid email required";
    if (form.username.length < 3) e.username = "At least 3 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) e.username = "Letters, numbers, underscores only";
    if (form.password.length < 8) e.password = "At least 8 characters";
    if (!/[A-Z]/.test(form.password)) e.password = "Needs an uppercase letter";
    if (!/[0-9]/.test(form.password)) e.password = "Needs a number";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      await signup(form);
      window.location.assign("/");
    } catch (err) {
      setErrors({ _: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <AuthPattern />
      <div style={styles.card}>
        <div className="auth-wordmark" style={styles.logoText}>abovo</div>

        <h1 style={styles.heading}>Create your account</h1>
        <p style={styles.sub}>Save, plan, and cook with less friction.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <Field label="Display name (optional)" error={errors.displayName}>
            <input style={styles.input} type="text" placeholder="Chef Matt" value={form.displayName} onChange={set("displayName")} autoComplete="name" />
          </Field>
          <Field label="Email" error={errors.email}>
            <input style={styles.input} type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} autoComplete="email" required />
          </Field>
          <Field label="Username" error={errors.username}>
            <input style={styles.input} type="text" placeholder="chefmatt" value={form.username} onChange={set("username")} autoComplete="username" required />
          </Field>
          <Field label="Password" error={errors.password}>
            <input style={styles.input} type="password" placeholder="Min 8 chars, 1 uppercase, 1 number" value={form.password} onChange={set("password")} autoComplete="new-password" required />
          </Field>

          {errors._ && <p style={styles.error}>{errors._}</p>}

          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={styles.footer}>
          Already have one?{" "}
          <Link href="/login" style={styles.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: "rgba(247, 241, 232, 0.88)" }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: 12, color: "rgb(var(--warm-50))" }}>{error}</span>}
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
      "linear-gradient(180deg, rgb(var(--terra-500)) 0%, rgb(150 69 34) 100%)",
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
  logoText: { marginBottom: 28, textAlign: "center" },
  heading: { fontSize: 26, fontWeight: 700, color: "rgb(var(--warm-50))", marginBottom: 6, fontFamily: "var(--font-serif)", textAlign: "center" },
  sub: { fontSize: 14, color: "rgba(247, 241, 232, 0.78)", marginBottom: 28, textAlign: "center" },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  input: { border: "1.5px solid rgba(247, 241, 232, 0.7)", borderRadius: 10, padding: "11px 14px", fontSize: 15, color: "rgb(var(--warm-900))", background: "white", outline: "none", width: "100%" },
  error: { fontSize: 13, color: "rgb(var(--warm-50))", background: "rgba(96, 42, 18, 0.34)", border: "1px solid rgba(247, 241, 232, 0.2)", borderRadius: 8, padding: "8px 12px" },
  btn: { background: "rgb(var(--warm-50))", color: "rgb(var(--terra-600))", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 4 },
  footer: { textAlign: "center", marginTop: 20, fontSize: 14, color: "rgba(247, 241, 232, 0.78)" },
  link: { color: "rgb(var(--warm-50))", fontWeight: 700, textDecoration: "none" },
};
