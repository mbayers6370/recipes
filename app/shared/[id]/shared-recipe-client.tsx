"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Save, Share2 } from "lucide-react";
import { BottomNav, DesktopNav } from "@/components/layout/nav";
import { RecipeImage } from "@/components/recipe-image";
import { useAuth } from "@/context/auth-context";
import type { Recipe } from "@/types";

type SharedRecipe = Omit<Recipe, "userId" | "householdId" | "isFavorite" | "isPublic"> & {
  user?: {
    id: string;
    username: string;
    displayName?: string | null;
  };
};

function sanitizeSharedRecipe(recipe: SharedRecipe) {
  return {
    title: recipe.title,
    description: recipe.description || undefined,
    imageUrl: recipe.imageUrl || undefined,
    sourceUrl: recipe.sourceUrl || undefined,
    prepTime: recipe.prepTime || undefined,
    cookTime: recipe.cookTime || undefined,
    totalTime: recipe.totalTime || undefined,
    servings: recipe.servings || undefined,
    difficulty: recipe.difficulty || undefined,
    cuisine: recipe.cuisine || undefined,
    tags: recipe.tags || [],
    ingredients: (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map((ingredient) => ({
      amount: ingredient.amount,
      unit: ingredient.unit,
      name: ingredient.name,
      notes: ingredient.notes,
    })),
    steps: (Array.isArray(recipe.steps) ? recipe.steps : []).map((step, index) => ({
      order: index,
      instruction: step.instruction,
      timerSeconds: step.timerSeconds,
      ingredientIds: step.ingredientIds,
    })),
    notes: recipe.notes || undefined,
  };
}

export function SharedRecipeClient({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();

  const [recipe, setRecipe] = useState<SharedRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    fetch(`/api/shared-recipes/${id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        setRecipe(json?.data || null);
        setLoading(false);
      })
      .catch(() => {
        setRecipe(null);
        setLoading(false);
      });
  }, [id]);

  const ownerLabel = useMemo(() => {
    if (!recipe?.user) return "abovo";
    return recipe.user.displayName || recipe.user.username;
  }, [recipe?.user]);

  const handleSave = async () => {
    if (!recipe) return;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/shared/${id}`)}`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(sanitizeSharedRecipe(recipe)),
      });
      const json = await res.json();
      if (res.ok && json.data?.id) {
        router.push(`/recipes/${json.data.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!recipe) return;
    setSharing(true);
    try {
      const url = window.location.href;
      if (navigator.share) {
        await navigator.share({
          title: recipe.title,
          text: `Shared from abovo by ${ownerLabel}`,
          url,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        alert("Link copied.");
      }
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return <div style={S.state}>Loading recipe…</div>;
  }

  if (!recipe) {
    return <div style={S.state}>Recipe not found.</div>;
  }

  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];

  return (
    <div style={S.appShell}>
      <DesktopNav />
      <main style={S.main}>
        <div style={S.page}>
          <div style={S.shell}>
            <div style={S.topRow}>
              <span style={S.badge}>Shared from abovo</span>
            </div>

            <div style={S.hero}>
              <RecipeImage
                imageUrl={recipe.imageUrl}
                title={recipe.title}
                tags={recipe.tags}
                sizes="(min-width: 960px) 360px, 100vw"
                showLabel
                iconSize={42}
                imageStyle={S.heroImage}
              />
            </div>

            <div style={S.card}>
              <p style={S.kicker}>Shared by {ownerLabel}</p>
              <h1 style={S.title}>{recipe.title}</h1>
              {recipe.description && <p style={S.description}>{recipe.description}</p>}

              <div style={S.meta}>
                {recipe.totalTime ? <span>{recipe.totalTime} min</span> : null}
                {recipe.servings ? <span>Serves {recipe.servings}</span> : null}
                {recipe.cuisine ? <span>{recipe.cuisine}</span> : null}
              </div>

              <div style={S.actionRow}>
                <button type="button" onClick={() => void handleSave()} style={S.primaryBtn} disabled={saving}>
                  <Save size={16} strokeWidth={2.2} />
                  <span>{saving ? "Saving…" : user ? "Save to my recipes" : "Log in to save"}</span>
                </button>
                <button type="button" onClick={() => void handleShare()} style={S.secondaryBtn} disabled={sharing}>
                  <Share2 size={16} strokeWidth={2.2} />
                  <span>{sharing ? "Sharing…" : "Share link"}</span>
                </button>
                <Link href="/recipes/import" style={S.ghostLink}>
                  <Download size={16} strokeWidth={2.2} />
                  <span>Import another</span>
                </Link>
              </div>

              <div style={S.contentGrid}>
                <section style={S.panel}>
                  <h2 style={S.panelTitle}>Ingredients</h2>
                  <ul style={S.list}>
                    {ingredients.map((ingredient, index) => (
                      <li key={`${ingredient.id || "ingredient"}-${index}`} style={S.listItem}>
                        {[ingredient.amount, ingredient.unit, ingredient.name, ingredient.notes].filter(Boolean).join(" ")}
                      </li>
                    ))}
                  </ul>
                </section>

                <section style={S.panel}>
                  <h2 style={S.panelTitle}>Steps</h2>
                  <ol style={S.stepList}>
                    {steps.map((step, index) => (
                      <li key={`${step.id || "step"}-${index}`} style={S.stepItem}>
                        {step.instruction}
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              {recipe.notes && (
                <section style={S.notesPanel}>
                  <h2 style={S.panelTitle}>Notes</h2>
                  <p style={S.notesText}>{recipe.notes}</p>
                </section>
              )}
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  appShell: {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    background: "rgb(var(--warm-50))",
  },
  main: {
    flex: 1,
    paddingBottom: "72px",
  },
  page: {
    minHeight: "100%",
    background: "rgb(var(--warm-50))",
    padding: "28px 16px 48px",
  },
  shell: {
    maxWidth: 960,
    margin: "0 auto",
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    marginBottom: 18,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    background: "rgb(var(--terra-50))",
    color: "rgb(var(--terra-700))",
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 700,
  },
  hero: {
    overflow: "hidden",
    borderRadius: 20,
    minHeight: 240,
    position: "relative",
    background: "rgb(var(--warm-100))",
    marginBottom: 18,
  },
  heroImage: { objectFit: "cover", objectPosition: "center center" },
  card: {
    background: "white",
    borderRadius: 20,
    border: "1px solid rgb(var(--warm-100))",
    padding: "24px 22px",
  },
  kicker: {
    fontSize: 12,
    fontWeight: 700,
    color: "rgb(var(--terra-600))",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    lineHeight: 1.08,
    fontWeight: 700,
    color: "rgb(var(--warm-900))",
    fontFamily: "var(--font-serif)",
    letterSpacing: "var(--tracking-display)",
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    color: "rgb(var(--warm-700))",
    lineHeight: 1.6,
    marginBottom: 14,
  },
  meta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    fontSize: 12,
    color: "rgb(var(--warm-500))",
    marginBottom: 20,
  },
  actionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    border: "none",
    background: "rgb(var(--terra-600))",
    color: "white",
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    border: "1px solid rgb(var(--warm-200))",
    background: "white",
    color: "rgb(var(--warm-700))",
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  ghostLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    border: "1px solid rgb(var(--warm-200))",
    background: "rgb(var(--warm-50))",
    color: "rgb(var(--warm-700))",
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "none",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
  },
  panel: {
    border: "1px solid rgb(var(--warm-100))",
    borderRadius: 16,
    padding: "18px 16px",
    background: "rgb(var(--warm-50))",
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "rgb(var(--terra-600))",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 12,
  },
  list: {
    paddingLeft: 18,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  listItem: {
    fontSize: 14,
    color: "rgb(var(--warm-800))",
    lineHeight: 1.55,
  },
  stepList: {
    paddingLeft: 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  stepItem: {
    fontSize: 14,
    color: "rgb(var(--warm-800))",
    lineHeight: 1.6,
  },
  notesPanel: {
    marginTop: 16,
    border: "1px solid rgb(var(--warm-100))",
    borderRadius: 16,
    padding: "18px 16px",
    background: "rgb(var(--warm-50))",
  },
  notesText: {
    fontSize: 14,
    color: "rgb(var(--warm-800))",
    lineHeight: 1.6,
  },
  state: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgb(var(--warm-50))",
    color: "rgb(var(--warm-700))",
    padding: 24,
  },
};
