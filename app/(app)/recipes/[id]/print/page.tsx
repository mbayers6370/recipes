import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AutoPrint } from "./auto-print";

export default async function PrintRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const recipe = await prisma.recipe.findFirst({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      sourceUrl: true,
      prepTime: true,
      cookTime: true,
      totalTime: true,
      servings: true,
      difficulty: true,
      cuisine: true,
      ingredients: true,
      steps: true,
      notes: true,
    },
  });

  if (!recipe) {
    notFound();
  }

  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  const [firstStep, ...remainingSteps] = steps;

  return (
    <main style={S.page}>
      <AutoPrint />
      <article style={S.sheet}>
        <header style={S.header}>
          <div style={S.logoWrap}>
            <Image
              src="/abovo_terracotta.png"
              alt="abovo"
              width={92}
              height={24}
              priority
              style={S.logo}
            />
          </div>
          <div style={S.logoRule} />
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
              {ingredients.map((ingredient, index) => {
                const item = ingredient as {
                  id?: string;
                  amount?: string;
                  unit?: string;
                  name?: string;
                  notes?: string;
                };

                return (
                  <li key={`${item.id || "ingredient"}-${index}`} style={S.ingredientItem}>
                    {[item.amount, item.unit, item.name].filter(Boolean).join(" ")}
                    {item.notes ? ` (${item.notes})` : ""}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {steps.length > 0 && (
          <section style={S.section}>
            <div style={S.sectionIntroGroup}>
              <h2 style={S.sectionTitle}>Steps</h2>
              {firstStep ? (
                <ol style={S.stepList}>
                  {(() => {
                    const item = firstStep as {
                      id?: string;
                      instruction?: string;
                      timerSeconds?: number;
                    };

                    return (
                      <li key={`${item.id || "step"}-0`} style={S.stepItem}>
                        <span>{item.instruction}</span>
                        {item.timerSeconds ? (
                          <span style={S.timerNote}>Timer: {formatTimer(item.timerSeconds)}</span>
                        ) : null}
                      </li>
                    );
                  })()}
                </ol>
              ) : null}
            </div>
            {remainingSteps.length > 0 ? (
              <ol style={S.remainingStepList} start={2}>
                {remainingSteps.map((step, index) => {
                  const item = step as {
                    id?: string;
                    instruction?: string;
                    timerSeconds?: number;
                  };

                  return (
                    <li key={`${item.id || "step"}-${index + 1}`} style={S.stepItem}>
                      <span>{item.instruction}</span>
                      {item.timerSeconds ? (
                        <span style={S.timerNote}>Timer: {formatTimer(item.timerSeconds)}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </section>
        )}

        {recipe.notes && (
          <section style={S.section}>
            <h2 style={S.sectionTitle}>Notes</h2>
            <p style={S.notes}>{recipe.notes}</p>
          </section>
        )}

        {recipe.sourceUrl && <footer style={S.footer}>Source: {recipe.sourceUrl}</footer>}
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
  page: {
    minHeight: "100dvh",
    padding: 0,
    background: "white",
  },
  sheet: {
    width: "100%",
    maxWidth: "none",
    margin: "0 auto",
    background: "white",
    padding: "24px 0 32px",
  },
  header: {
    maxWidth: 760,
    margin: "0 auto 24px",
    padding: "0 28px",
    breakAfter: "avoid-page",
    pageBreakAfter: "avoid",
    textAlign: "center",
  },
  logoWrap: { marginBottom: 14, display: "flex", justifyContent: "center" },
  logo: { width: "92px", height: "auto" },
  logoRule: {
    width: "100%",
    height: 1,
    background: "rgb(var(--terra-600))",
    marginBottom: 18,
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
  description: { fontSize: 16, color: "rgb(var(--warm-700))", lineHeight: 1.6, marginBottom: 12 },
  meta: { display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12, color: "rgb(var(--warm-500))" },
  section: { maxWidth: 760, margin: "0 auto 28px", padding: "0 28px" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "rgb(var(--terra-600))",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 12,
    breakAfter: "avoid-page",
    pageBreakAfter: "avoid",
  },
  sectionIntroGroup: {
    breakInside: "avoid-page",
    pageBreakInside: "avoid",
    marginBottom: 14,
  },
  ingredientList: { paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 },
  ingredientItem: { fontSize: 15, color: "rgb(var(--warm-800))", lineHeight: 1.6 },
  stepList: {
    paddingLeft: 18,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  remainingStepList: { paddingLeft: 18, display: "flex", flexDirection: "column", gap: 14 },
  stepItem: {
    fontSize: 15,
    color: "rgb(var(--warm-800))",
    lineHeight: 1.7,
    breakInside: "avoid-page",
    pageBreakInside: "avoid",
  },
  timerNote: { display: "block", marginTop: 4, fontSize: 12, color: "rgb(var(--warm-500))" },
  notes: { fontSize: 15, color: "rgb(var(--warm-800))", lineHeight: 1.7 },
  footer: {
    maxWidth: 760,
    margin: "0 auto",
    padding: "16px 28px 0",
    fontSize: 12,
    color: "rgb(var(--warm-500))",
    borderTop: "1px solid rgb(var(--warm-100))",
  },
};
