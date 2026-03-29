"use client";

import { useEffect, useState } from "react";
import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Download, Plus } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import type { RecipeSummary, CookingSession, MealPlan } from "@/types";
import { DAY_NAMES } from "@/lib/date-utils";
import { RecipeImage } from "@/components/recipe-image";

const FoodIconPattern = dynamic(
  () => import("@/components/auth/auth-pattern").then((mod) => mod.FoodIconPattern),
  { ssr: false }
);

const HOME_MEAL_TYPE_ORDER = ["breakfast", "brunch", "lunch", "dinner", "side", "snack", "dessert"] as const;
const HOME_MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  brunch: "Brunch",
  lunch: "Lunch",
  dinner: "Dinner",
  side: "Side",
  snack: "Snack",
  dessert: "Dessert",
};

function getTimeContextSnapshot() {
  const now = new Date();
  return {
    greeting: getGreeting(now),
    todayIndex: now.getDay(),
    todayDateLabel: now.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function subscribeToHydration() {
  return () => {};
}

export default function HomePage() {
  const { user } = useAuth();
  const [recentRecipes, setRecentRecipes] = useState<RecipeSummary[]>([]);
  const [activeSession] = useState<CookingSession | null>(null);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeContext, setTimeContext] = useState<ReturnType<typeof getTimeContextSnapshot> | null>(null);
  const [recentRecipeLimit, setRecentRecipeLimit] = useState(2);
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setTimeContext(getTimeContextSnapshot());
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/recipes?limit=6").then((r) => r.json()),
      fetch("/api/meal-plan").then((r) => r.json()),
    ]).then(([recipesRes, planRes]) => {
      setRecentRecipes(recipesRes.data?.recipes || []);
      setMealPlan(planRes.data || null);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const syncRecentRecipeLimit = () => {
      setRecentRecipeLimit(mediaQuery.matches ? 4 : 2);
    };

    syncRecentRecipeLimit();
    mediaQuery.addEventListener("change", syncRecentRecipeLimit);

    return () => {
      mediaQuery.removeEventListener("change", syncRecentRecipeLimit);
    };
  }, []);

  const greeting = mounted ? (timeContext?.greeting ?? "Welcome") : "Welcome";
  const todayIndex = mounted ? timeContext?.todayIndex : null;
  const effectiveRecentRecipeLimit = mounted ? recentRecipeLimit : 2;
  const todayItems = todayIndex === null || todayIndex === undefined
    ? []
    : (mealPlan?.items || [])
      .filter((item) =>
        item.dayOfWeek === todayIndex &&
        (Boolean(item.recipe?.id) || Boolean(item.note?.trim()))
      )
      .sort(
        (a, b) =>
          HOME_MEAL_TYPE_ORDER.indexOf(a.mealType as (typeof HOME_MEAL_TYPE_ORDER)[number]) -
          HOME_MEAL_TYPE_ORDER.indexOf(b.mealType as (typeof HOME_MEAL_TYPE_ORDER)[number])
      );

  return (
    <div style={S.page}>
      {/* Hero */}
      <div style={S.hero}>
        <FoodIconPattern
          iconColor="rgba(247, 241, 232, 0.26)"
          opacity={0.14}
          overlay="linear-gradient(180deg, rgba(255,255,255,0.04), rgba(96, 42, 18, 0.1))"
          columns={7}
          gap="22px 14px"
          rotation={-6}
          scale={1.04}
        />
        <div style={S.heroContent} className="home-hero-copy">
          <h1 style={S.heroTitle}>
            {greeting},{" "}
            <span style={{ color: "rgba(255,255,255,0.85)" }}>
              {user?.displayName || user?.username || "chef"}
            </span>
          </h1>
          <p style={S.heroSub}>What are you cooking today?</p>
        </div>
      </div>

      <div style={S.content}>
        {/* Active cooking session */}
        {activeSession && (
          <Section title="Continue Cooking">
            <div style={S.sessionCard}>
              <div style={{ flex: 1 }}>
                <p style={S.sessionTitle}>{activeSession.recipe?.title}</p>
                <p style={S.sessionSub}>
                  Step {activeSession.currentStep + 1} of{" "}
                  {(activeSession.recipe?.steps as unknown[])?.length ?? "?"} · in progress
                </p>
              </div>
              <Link
                href={`/recipes/${activeSession.recipeId}/cook`}
                style={S.resumeBtn}
              >
                <span>Resume</span>
                <ArrowRight size={14} strokeWidth={2.2} />
              </Link>
            </div>
          </Section>
        )}

        {/* Today's plan */}
        <Section title="" titleClassName="home-plan-title">
          {todayItems.length > 0 ? (
            <div style={S.planCard}>
              <div style={S.planHeader}>
                <div style={S.planHeaderLabel}>
                  <span style={S.planToday}>
                    {todayIndex !== null && todayIndex !== undefined ? DAY_NAMES[todayIndex] : "Today"}
                  </span>
                  <span style={S.planDate}>
                    {timeContext?.todayDateLabel ?? ""}
                  </span>
                </div>
                <span style={S.todayPill}>Today</span>
              </div>
              {todayItems.map((item, index) => (
                <TodayMealRow
                  key={item.id}
                  label={HOME_MEAL_TYPE_LABELS[item.mealType] || item.mealType}
                  item={item}
                  showDivider={index > 0}
                />
              ))}
            </div>
          ) : (
            <div style={S.emptyCard}>
              <p style={S.emptyText}>Nothing planned for today yet.</p>
              <Link href="/plan" style={S.emptyLink}>
                <span>Plan your week</span>
                <ArrowRight size={14} strokeWidth={2.2} />
              </Link>
            </div>
          )}
        </Section>

        <div style={S.actionRowWrap}>
          <div style={S.actionRow}>
            <Link href="/recipes/import" style={S.floatingPrimary}>
              <Download size={16} strokeWidth={2.2} style={{ marginRight: 8 }} />
              <span>Import recipe</span>
            </Link>
            <Link href="/recipes/new" style={S.floatingSecondary}>
              <Plus size={16} strokeWidth={2.2} />
              <span>Add manually</span>
            </Link>
          </div>
        </div>

        {/* Recently saved */}
        <Section
          title="Recently Saved"
          right={<Link href="/recipes" style={S.seeAll}><span>See all</span><ArrowRight size={14} strokeWidth={2.2} /></Link>}
        >
      {loading ? (
            <div style={S.loadingGrid} className="home-recipe-grid">
              {[...Array(effectiveRecentRecipeLimit)].map((_, i) => <SkeletonCard key={i} className="home-recipe-card" />)}
            </div>
          ) : recentRecipes.length > 0 ? (
            <div style={S.recipeGrid} className="home-recipe-grid">
              {recentRecipes.slice(0, effectiveRecentRecipeLimit).map((r) => (
                <RecipeCard key={r.id} recipe={r} className="home-recipe-card" />
              ))}
            </div>
          ) : (
            <div style={S.emptyCard}>
              <p style={S.emptyText}>Your saved recipes will appear here.</p>
              <Link href="/recipes/import" style={S.emptyLink}>
                <Download size={14} strokeWidth={2.2} />
                <span>Import your first recipe</span>
              </Link>
            </div>
          )}
        </Section>
      </div>

    </div>
  );
}

function Section({
  title,
  right,
  children,
  titleClassName,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  titleClassName?: string;
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      {(title || right) && (
        <div style={S.sectionHeader}>
          {title ? <h2 style={S.sectionTitle} className={titleClassName}>{title}</h2> : <div />}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function TodayMealRow({
  label,
  item,
  showDivider = false,
}: {
  label: string;
  item?: MealPlan["items"][0];
  showDivider?: boolean;
}) {
  return (
    <div style={{ ...S.planRow, ...(showDivider ? S.planRowDivider : {}) }}>
      <span style={S.planDay}>{label}</span>
      <div style={S.planRowCard}>
        <div style={S.planMealWrap}>
          <span style={S.planMeal}>
            {item?.recipe?.title || item?.note || (
              <span style={{ color: "rgb(var(--warm-400))", fontStyle: "italic" }}>
                Not planned
              </span>
            )}
          </span>
        </div>
        {item?.recipe && (
          <Link href={`/recipes/${item.recipe.id}`} style={S.cookBtn}>
            View
          </Link>
        )}
      </div>
    </div>
  );
}

function RecipeCard({ recipe, className }: { recipe: RecipeSummary; className?: string }) {
  const meta = [
    recipe.totalTime ? `${recipe.totalTime} min` : null,
    recipe.cuisine || null,
    recipe.difficulty ? recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1) : null,
  ].filter(Boolean);

  return (
    <Link href={`/recipes/${recipe.id}`} style={S.recipeCard} className={className}>
      <div style={S.recipeThumb}>
        <RecipeImage
          imageUrl={recipe.imageUrl}
          title={recipe.title}
          tags={recipe.tags}
          sizes="(max-width: 768px) 50vw, 240px"
          iconSize={28}
          imageStyle={S.recipeImg}
        />
      </div>
      <div style={S.recipeInfo}>
        <p style={S.recipeTitle}>{recipe.title}</p>
        {meta.length > 0 && (
          <div style={S.recipeMeta}>
            {meta.map((item, index) => (
              <span key={`${recipe.id}-${item}-${index}`}>
                {index > 0 && <span style={S.dot}>· </span>}
                {item}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div style={{ ...S.recipeCard, background: "rgb(var(--warm-100))", pointerEvents: "none" }} className={className}>
      <div style={{ ...S.recipeThumb, background: "rgb(var(--warm-200))", borderRadius: 12 }} />
      <div style={{ padding: "10px 0", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ height: 14, background: "rgb(var(--warm-200))", borderRadius: 6, width: "80%" }} />
        <div style={{ height: 12, background: "rgb(var(--warm-200))", borderRadius: 6, width: "40%" }} />
      </div>
    </div>
  );
}

function getGreeting(now: Date) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const S: Record<string, React.CSSProperties> = {
  page: { background: "rgb(var(--warm-50))", minHeight: "100dvh" },

  // Hero
  hero: {
    background: "linear-gradient(135deg, rgb(196,90,44) 0%, rgb(163,70,36) 60%, rgb(133,58,33) 100%)",
    padding: "32px 20px 36px",
    position: "relative",
    overflow: "hidden",
  },
  heroContent: { position: "relative", zIndex: 1, width: "100%", maxWidth: 960, margin: "0 auto" },
  heroTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "white",
    fontFamily: "var(--font-serif)",
    marginBottom: 6,
    lineHeight: 1.2,
  },
  heroSub: { fontSize: 15, color: "rgba(255,255,255,0.75)", marginBottom: 8 },
  heroNote: { fontSize: 13, color: "rgba(255,255,255,0.68)" },

  actionRowWrap: { marginBottom: 28 },
  actionRow: { width: "100%", maxWidth: 960, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  content: { padding: "24px 16px 96px", width: "100%", maxWidth: 960, margin: "0 auto" },

  // Active session
  sessionCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "white",
    borderRadius: 14,
    padding: "16px",
    border: "1px solid rgb(var(--warm-200))",
  },
  sessionTitle: { fontWeight: 600, fontSize: 15, color: "rgb(var(--warm-900))" },
  sessionSub: { fontSize: 12, color: "rgb(var(--warm-500))", marginTop: 2 },
  resumeBtn: {
    background: "rgb(var(--terra-600))",
    color: "white",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
    whiteSpace: "nowrap" as const,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },

  // Plan
  planCard: {
    background: "linear-gradient(180deg, rgba(243, 232, 224, 0.9) 0%, rgba(255,255,255,0.98) 100%)",
    borderRadius: 18,
    border: "1px solid rgb(var(--terra-200))",
    overflow: "hidden",
    padding: 14,
  },
  planHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    marginBottom: 12,
    borderBottom: "1px solid rgb(var(--warm-100))",
  },
  planHeaderLabel: { display: "flex", alignItems: "center", gap: 10 },
  planToday: { fontSize: 11, fontWeight: 700, color: "rgb(var(--terra-700))", textTransform: "uppercase", letterSpacing: "0.06em" },
  planDate: { fontSize: 12, color: "rgb(var(--warm-500))", fontWeight: 600 },
  todayPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 9px",
    borderRadius: 999,
    background: "rgba(181, 88, 47, 0.12)",
    color: "rgb(var(--terra-700))",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  planRow: {
    display: "grid",
    gridTemplateColumns: "72px 1fr",
    gap: 10,
    alignItems: "start",
    padding: "0 0 10px",
  },
  planRowDivider: { borderTop: "1px solid rgb(var(--warm-100))", paddingTop: 10 },
  planDay: { fontSize: 11, fontWeight: 600, color: "rgb(var(--warm-500))", paddingTop: 10 },
  planRowCard: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgb(var(--warm-50))",
    border: "1px solid rgb(var(--warm-100))",
    borderRadius: 12,
    padding: "8px 10px",
    minWidth: 0,
  },
  planMealWrap: { flex: 1, minWidth: 0 },
  planMeal: { fontSize: 13, color: "rgb(var(--warm-800))", fontWeight: 500, lineHeight: 1.4 },
  cookBtn: {
    fontSize: 12,
    color: "rgb(var(--terra-600))",
    textDecoration: "none",
    fontWeight: 600,
    background: "transparent",
    padding: "0 2px",
    borderRadius: 6,
    flexShrink: 0,
  },

  // Section
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: "rgb(var(--warm-900))", fontFamily: "var(--font-serif)" },
  seeAll: { fontSize: 13, color: "rgb(var(--terra-600))", textDecoration: "none", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 },

  // Recipe grid
  recipeGrid: { display: "grid", gap: 12 },
  loadingGrid: { display: "grid", gap: 12 },
  recipeCard: {
    background: "white",
    borderRadius: 14,
    overflow: "hidden",
    textDecoration: "none",
    border: "1px solid rgb(var(--warm-100))",
    transition: "transform 0.15s",
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  recipeThumb: { aspectRatio: "4/3", overflow: "hidden", background: "rgb(var(--warm-100))", position: "relative" },
  recipeImg: { width: "100%", height: "100%", objectFit: "cover" },
  recipeInfo: { padding: "12px 12px 14px", display: "flex", flexDirection: "column", minHeight: 76, flex: 1 },
  recipeTitle: { fontSize: 13, fontWeight: 600, color: "rgb(var(--warm-900))", lineHeight: 1.35, marginBottom: 10, flex: 1 },
  recipeMeta: { fontSize: 11, color: "rgb(var(--warm-500))", display: "flex", gap: 4, flexWrap: "wrap" as const, alignItems: "center", marginTop: "auto" },
  dot: { color: "rgb(var(--warm-300))" },

  // Empty
  emptyCard: {
    background: "white",
    borderRadius: 14,
    padding: "28px 20px",
    textAlign: "center",
    border: "1.5px dashed rgb(var(--warm-200))",
  },
  emptyText: { fontSize: 14, color: "rgb(var(--warm-500))", marginBottom: 10 },
  emptyLink: { fontSize: 14, color: "rgb(var(--terra-600))", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 },
  floatingPrimary: {
    background: "rgb(var(--terra-600))",
    color: "white",
    borderRadius: 14,
    padding: "14px 16px",
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingSecondary: {
    background: "white",
    color: "rgb(var(--warm-800))",
    borderRadius: 14,
    padding: "14px 16px",
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: "1px solid rgb(var(--warm-200))",
  },
};
