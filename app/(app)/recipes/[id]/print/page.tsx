"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Recipe } from "@/types";

export default function PrintRecipePage() {
  const params = useParams();
  const id = params.id as string;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/recipes/${id}`)
      .then((res) => res.json())
      .then((json) => setRecipe(json.data))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && recipe) {
      const timer = window.setTimeout(() => window.print(), 150);
      return () => window.clearTimeout(timer);
    }
  }, [loading, recipe]);

  if (loading) return <div style={S.loading}>Preparing recipe…</div>;
  if (!recipe) return <div style={S.loading}>Recipe not found.</div>;

  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];

  return (
    <main style={S.page}>
      <article style={S.sheet}>
        <header style={S.header}>
          <p style={S.wordmark}>abovo</p>
          <h1 style={S.title}>{recipe.title}</h1>
          {recipe.description && <p style={S.description}>{recipe.description}</p>}
          <div style={S.meta}>
            {recipe.servings ? <span>Serves {recipe.servings}</span> : null}
            {recipe.prepTime ? <span>Prep {recipe.prepTime} min</span> : null}
            {recipe.cookTime ? <span>Cook {recipe.cookTime} min</span> : null}
            {recipe.totalTime ? <span>Total {recipe.totalTime} min</span> : null}
            {recipe.cuisine ? <span>{recipe.cuisine}</span> : null}
          </div>
        </header>

        {ingredients.length > 0 && (
          <section style={S.section}>
            <h2 style={S.sectionTitle}>Ingredients</h2>
              <ul style={S.ingredientList}>
                {ingredients.map((ingredient, index) => (
                <li key={`${ingredient.id || "ingredient"}-${index}`} style={S.ingredientItem}>
                  {[ingredient.amount, ingredient.unit, ingredient.name].filter(Boolean).join(" ")}
                  {ingredient.notes ? ` (${ingredient.notes})` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}

        {steps.length > 0 && (
          <section style={S.section}>
            <h2 style={S.sectionTitle}>Steps</h2>
              <ol style={S.stepList}>
                {steps.map((step, index) => (
                <li key={`${step.id || "step"}-${index}`} style={S.stepItem}>
                  <span>{step.instruction}</span>
                  {step.timerSeconds ? (
                    <span style={S.timerNote}>Timer: {formatTimer(step.timerSeconds)}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        )}

        {recipe.notes && (
          <section style={S.section}>
            <h2 style={S.sectionTitle}>Notes</h2>
            <p style={S.notes}>{recipe.notes}</p>
          </section>
        )}

        {recipe.sourceUrl && (
          <footer style={S.footer}>
            Source: {recipe.sourceUrl}
          </footer>
        )}
      </article>
    </main>
  );
}

function formatTimer(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

const S: Record<string, React.CSSProperties> = {
  loading: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgb(var(--warm-50))",
    color: "rgb(var(--warm-700))",
  },
  page: {
    minHeight: "100dvh",
    padding: "24px",
    background: "rgb(var(--warm-50))",
  },
  sheet: {
    maxWidth: 760,
    margin: "0 auto",
    background: "white",
    border: "1px solid rgb(var(--warm-200))",
    padding: "40px 36px",
  },
  header: { marginBottom: 28 },
  wordmark: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: "rgb(var(--terra-600))",
    marginBottom: 10,
  },
  title: {
    fontSize: 34,
    lineHeight: 1.08,
    fontWeight: 700,
    color: "rgb(var(--warm-900))",
    fontFamily: "var(--font-serif)",
    marginBottom: 10,
  },
  description: { fontSize: 16, color: "rgb(var(--warm-700))", lineHeight: 1.6, marginBottom: 12 },
  meta: { display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12, color: "rgb(var(--warm-500))" },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "rgb(var(--terra-600))",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 12,
  },
  ingredientList: { paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 },
  ingredientItem: { fontSize: 15, color: "rgb(var(--warm-800))", lineHeight: 1.6 },
  stepList: { paddingLeft: 18, display: "flex", flexDirection: "column", gap: 14 },
  stepItem: { fontSize: 15, color: "rgb(var(--warm-800))", lineHeight: 1.7 },
  timerNote: { display: "block", marginTop: 4, fontSize: 12, color: "rgb(var(--warm-500))" },
  notes: { fontSize: 15, color: "rgb(var(--warm-800))", lineHeight: 1.7 },
  footer: { fontSize: 12, color: "rgb(var(--warm-500))", borderTop: "1px solid rgb(var(--warm-100))", paddingTop: 16 },
};
