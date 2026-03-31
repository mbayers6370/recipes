"use client";

import { useEffect, useState } from "react";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Download, Plus, Users } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import type { RecipeSummary, CookingSession, Household, MealPlan } from "@/types";
import { DAY_NAMES } from "@/lib/date-utils";
import { startOfWeek } from "@/lib/date-utils";
import { RecipeImage } from "@/components/recipe-image";

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
  const [household, setHousehold] = useState<Household | null>(null);
  const [sharedRecipes, setSharedRecipes] = useState<RecipeSummary[]>([]);
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
    const clientWeek = startOfWeek(new Date()).toISOString();

    Promise.all([
      fetch("/api/recipes?limit=6").then((r) => r.json()),
      fetch(`/api/meal-plan?week=${clientWeek}`).then((r) => r.json()),
      fetch("/api/household", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/recipes?sharedOnly=true&limit=3", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([recipesRes, planRes, householdRes, sharedRecipesRes]) => {
        setRecentRecipes(recipesRes.data?.recipes || []);
        setMealPlan(planRes.data || null);
        setHousehold(householdRes?.data || null);
        setSharedRecipes(sharedRecipesRes?.data?.recipes || []);
      })
      .finally(() => setLoading(false));
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
        <div style={S.heroContent} className="home-hero-copy">
          <h1 style={S.heroTitle}>
            <span style={{ color: "rgb(var(--terra-200))" }}>
              {greeting},
            </span>{" "}
            <span style={{ color: "rgb(var(--warm-50))" }}>
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
        <Section>
          {todayItems.length > 0 ? (
            <div style={S.planCard}>
              <div style={S.cardSectionHeader} className="home-plan-header">
                <h2 style={S.sectionTitle} className="home-plan-title">Today</h2>
                <Link href="/plan" style={S.seeAll} className="home-plan-link">
                  <span>Planner</span>
                  <ArrowRight size={14} strokeWidth={2.2} />
                </Link>
              </div>
              <div style={S.planHeader}>
                <div style={S.planHeaderLabel}>
                  <span style={S.planToday}>
                    {todayIndex !== null && todayIndex !== undefined ? DAY_NAMES[todayIndex] : "Today"}
                  </span>
                  <span style={S.planDate}>
                    {timeContext?.todayDateLabel ?? ""}
                  </span>
                </div>
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
              <div style={S.cardSectionHeader} className="home-plan-header">
                <h2 style={S.sectionTitle} className="home-plan-title">Today</h2>
                <Link href="/plan" style={S.seeAll} className="home-plan-link">
                  <span>Planner</span>
                  <ArrowRight size={14} strokeWidth={2.2} />
                </Link>
              </div>
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
        <Section>
          <div style={S.savedPanel}>
            <div style={S.cardSectionHeaderTerracottaBand}>
              <h2 style={S.sectionTitleOnTerracotta}>Recently Saved</h2>
              <Link href="/recipes" style={S.seeAllOnTerracotta}><span>See all</span><ArrowRight size={14} strokeWidth={2.2} /></Link>
            </div>
      {loading ? (
            <div style={S.loadingGrid} className="home-recipe-grid">
              {[...Array(effectiveRecentRecipeLimit)].map((_, i) => <SkeletonCard key={i} className="home-recipe-card" />)}
            </div>
          ) : recentRecipes.length > 0 ? (
            <div style={S.recipeGrid} className="home-recipe-grid">
              {recentRecipes.slice(0, effectiveRecentRecipeLimit).map((r, index) => (
                <RecipeCard
                  key={r.id}
                  recipe={r}
                  className="home-recipe-card"
                  prioritizeImage={index === 0}
                />
              ))}
            </div>
          ) : (
            <div style={S.savedEmptyState}>
              <p style={S.emptyText}>Your saved recipes will appear here.</p>
              <Link href="/recipes/import" style={S.emptyLink}>
                <Download size={14} strokeWidth={2.2} />
                <span>Import your first recipe</span>
              </Link>
            </div>
          )}
          </div>
        </Section>

        <Section bottomMargin={0}>
          <div style={S.kitchenPanel}>
            <div style={S.cardSectionHeaderTerracottaBand}>
              <h2 style={S.sectionTitleOnTerracotta}>Shared Kitchen</h2>
              <Link href="/kitchen" style={S.seeAllOnTerracotta}><span>{household ? "Open kitchen" : "Set up kitchen"}</span><ArrowRight size={14} strokeWidth={2.2} /></Link>
            </div>
            {household ? (
              <>
                <div style={S.kitchenHeader}>
                  <div>
                    <p style={S.kitchenName}>{household.name}</p>
                    <p style={S.kitchenHelper}>
                      {household.memberCount} of {household.memberLimit} seats filled
                    </p>
                  </div>
                </div>

                <div style={S.kitchenMemberList}>
                  {household.members.slice(0, 3).map((member) => (
                    <div key={member.id} style={S.kitchenMemberRow}>
                      <div style={S.kitchenMemberInfo}>
                        <span style={S.kitchenMemberName}>
                          {member.displayName || member.username}
                        </span>
                        <span style={S.kitchenMemberMeta}>{member.email}</span>
                      </div>
                      {member.role === "owner" && (
                        <span style={S.kitchenMemberBadge}>
                          <span>Owner</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <p style={S.kitchenSub}>
                  {sharedRecipes.length > 0
                    ? `${sharedRecipes.length} shared recipe${sharedRecipes.length === 1 ? "" : "s"} ready to browse.`
                    : "No shared recipes yet. Open a recipe and tap Share to add one here."}
                </p>

                {sharedRecipes.length > 0 && (
                  <div style={S.kitchenRecipeRow}>
                    {sharedRecipes.map((recipe) => (
                      <Link key={recipe.id} href={`/recipes/${recipe.id}`} style={S.kitchenRecipeChip}>
                        <div style={S.kitchenRecipeThumb}>
                          <RecipeImage
                            imageUrl={recipe.imageUrl}
                            title={recipe.title}
                            tags={recipe.tags}
                            sizes="72px"
                            iconSize={16}
                            imageStyle={S.kitchenRecipeImage}
                          />
                        </div>
                        <span style={S.kitchenRecipeLabel}>{recipe.title}</span>
                      </Link>
                    ))}
                  </div>
                )}

              </>
            ) : (
              <div style={S.kitchenEmptyState}>
                <div style={S.kitchenEmptyIcon}>
                  <Users size={22} strokeWidth={2} />
                </div>
                <h3 style={S.kitchenTitle}>Start a shared kitchen</h3>
                <p style={S.kitchenSub}>
                  Create one shared spot for family recipes, then connect up to 4 more people.
                </p>
                <Link href="/kitchen" style={S.kitchenCreateLink}>
                  <span>Create kitchen</span>
                  <ArrowRight size={14} strokeWidth={2.2} />
                </Link>
              </div>
            )}
          </div>
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
  bottomMargin = 32,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  titleClassName?: string;
  bottomMargin?: number;
}) {
  return (
    <section style={{ marginBottom: bottomMargin }}>
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

function RecipeCard({
  recipe,
  className,
  prioritizeImage = false,
}: {
  recipe: RecipeSummary;
  className?: string;
  prioritizeImage?: boolean;
}) {
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
          priority={prioritizeImage}
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
  page: { background: "rgb(var(--warm-50))" },

  // Hero
  hero: {
    background: "rgb(var(--terra-600))",
    padding: "34px 20px 36px",
    position: "relative",
    overflow: "hidden",
    borderBottom: "1px solid rgba(97, 45, 24, 0.2)",
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: 960,
    margin: "0 auto",
    padding: "0 16px",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "rgb(var(--warm-50))",
    fontFamily: "var(--font-serif)",
    letterSpacing: "var(--tracking-display)",
    marginBottom: 6,
    lineHeight: 1.2,
  },
  heroSub: {
    fontSize: 15,
    color: "rgba(247, 241, 232, 0.76)",
    marginBottom: 0,
  },

  actionRowWrap: { marginBottom: 28 },
  actionRow: { width: "100%", maxWidth: 960, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  content: { padding: "24px 16px 24px", width: "100%", maxWidth: 960, margin: "0 auto" },

  // Active session
  sessionCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "white",
    borderRadius: "var(--radius-card-inner)",
    padding: "16px",
    border: "1px solid rgb(var(--warm-200))",
  },
  sessionTitle: { fontWeight: 600, fontSize: 15, color: "rgb(var(--warm-900))" },
  sessionSub: { fontSize: 12, color: "rgb(var(--warm-500))", marginTop: 2 },
  resumeBtn: {
    background: "rgb(var(--terra-600))",
    color: "white",
    borderRadius: "var(--radius-control)",
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
    background: "white",
    borderRadius: "var(--radius-card)",
    border: "2px dashed rgba(181, 88, 47, 0.42)",
    overflow: "hidden",
    padding: 14,
    boxShadow: "0 12px 26px rgba(112, 48, 26, 0.08)",
  },
  cardSectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottom: "1px solid rgba(181, 88, 47, 0.22)",
  },
  cardSectionHeaderTerracotta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 12,
    marginBottom: 14,
    borderBottom: "1px solid rgba(255,255,255,0.18)",
  },
  cardSectionHeaderTerracottaBand: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    margin: "-16px -16px 14px",
    padding: "14px 16px 13px",
    background: "linear-gradient(180deg, rgb(var(--terra-700)) 0%, rgb(var(--terra-600)) 100%)",
    borderBottom: "1px solid rgba(112, 48, 26, 0.24)",
    borderTopLeftRadius: "var(--radius-card-inner)",
    borderTopRightRadius: "var(--radius-card-inner)",
  },
  planHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    marginBottom: 12,
  },
  planHeaderLabel: { display: "flex", alignItems: "center", gap: 10 },
  planToday: { fontSize: 11, fontWeight: 700, color: "rgb(var(--terra-700))", textTransform: "uppercase", letterSpacing: "0.06em" },
  planDate: { fontSize: 12, color: "rgb(var(--warm-500))", fontWeight: 600 },
  planRow: {
    display: "grid",
    gridTemplateColumns: "72px 1fr",
    gap: 10,
    alignItems: "start",
    padding: "0 0 10px",
  },
  planRowDivider: { borderTop: "1px solid rgba(181, 88, 47, 0.16)", paddingTop: 10 },
  planDay: { fontSize: 11, fontWeight: 600, color: "rgb(var(--warm-500))", paddingTop: 10 },
  planRowCard: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgb(var(--warm-50))",
    border: "1px solid rgba(181, 88, 47, 0.12)",
    borderRadius: "var(--radius-card-inner)",
    padding: "8px 10px",
    minWidth: 0,
  },
  planMealWrap: { flex: 1, minWidth: 0 },
  planMeal: { fontSize: 13, color: "rgb(var(--warm-800))", fontWeight: 500, lineHeight: 1.4 },
  cookBtn: {
    fontSize: 12,
    color: "rgb(var(--terra-700))",
    textDecoration: "none",
    fontWeight: 700,
    background: "rgb(var(--terra-50))",
    padding: "4px 8px",
    borderRadius: 999,
    flexShrink: 0,
    border: "1px solid rgba(181, 88, 47, 0.16)",
  },

  // Section
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: "rgb(var(--warm-900))", fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)" },
  seeAll: { fontSize: 13, color: "rgb(var(--terra-600))", textDecoration: "none", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 },
  sectionTitleOnTerracotta: { fontSize: 18, fontWeight: 700, color: "rgb(var(--warm-50))", fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)" },
  seeAllOnTerracotta: { fontSize: 13, color: "rgba(255,255,255,0.92)", textDecoration: "none", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 },
  kitchenPanel: {
    background: "white",
    border: "1px solid rgb(var(--warm-100))",
    borderRadius: "var(--radius-card-inner)",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
  },
  kitchenHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    padding: "0 0 12px",
    borderBottom: "1px solid rgb(var(--warm-100))",
  },
  kitchenName: {
    fontSize: 16,
    fontWeight: 700,
    color: "rgb(var(--warm-900))",
    fontFamily: "var(--font-serif)",
    letterSpacing: "var(--tracking-brand)",
  },
  kitchenHelper: {
    fontSize: 12,
    color: "rgb(var(--warm-500))",
    marginTop: 4,
  },
  kitchenMemberList: { display: "flex", flexDirection: "column" },
  kitchenMemberRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 0",
    borderBottom: "1px solid rgb(var(--warm-100))",
  },
  kitchenMemberInfo: { display: "flex", flexDirection: "column", gap: 2 },
  kitchenMemberName: { fontSize: 14, fontWeight: 600, color: "rgb(var(--warm-800))" },
  kitchenMemberMeta: { fontSize: 12, color: "rgb(var(--warm-400))" },
  kitchenMemberBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    color: "rgb(var(--terra-700))",
    fontWeight: 700,
    flexShrink: 0,
  },
  kitchenTitle: { fontSize: 16, fontWeight: 700, color: "rgb(var(--warm-900))" },
  kitchenSub: { fontSize: 13, lineHeight: 1.6, color: "rgb(var(--warm-500))", padding: "16px 0 0" },
  kitchenRecipeRow: { display: "grid", gap: 10, padding: "14px 0 16px", borderTop: "1px solid rgb(var(--warm-100))", marginTop: 14 },
  kitchenRecipeChip: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0",
    textDecoration: "none",
    color: "inherit",
  },
  kitchenRecipeThumb: {
    width: 40,
    height: 40,
    position: "relative",
    borderRadius: "var(--radius-control)",
    overflow: "hidden",
    background: "rgb(var(--warm-100))",
    flexShrink: 0,
  },
  kitchenRecipeImage: { objectFit: "cover" },
  kitchenRecipeLabel: { fontSize: 13, lineHeight: 1.4, color: "rgb(var(--warm-800))", fontWeight: 600 },
  kitchenFooterLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    width: "fit-content",
    margin: "16px 0",
    color: "rgb(var(--terra-600))",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 600,
  },
  kitchenEmptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 10,
    padding: "24px 0",
  },
  kitchenEmptyIcon: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "rgb(var(--terra-50))",
    color: "rgb(var(--terra-600))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  kitchenCreateLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    width: "fit-content",
    padding: "12px 14px",
    borderRadius: "var(--radius-control)",
    background: "rgb(var(--terra-600))",
    color: "white",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 600,
  },

  // Recipe grid
  recipeGrid: { display: "grid", gap: 12 },
  loadingGrid: { display: "grid", gap: 12 },
  savedPanel: {
    background: "rgb(var(--warm-50))",
    borderRadius: "var(--radius-card-inner)",
    border: "1px solid rgb(var(--warm-200))",
    padding: "16px",
  },
  recipeCard: {
    background: "white",
    borderRadius: "var(--radius-card-inner)",
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
  recipeTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "rgb(var(--warm-900))",
    fontFamily: "var(--font-serif)",
    letterSpacing: "var(--tracking-brand)",
    lineHeight: 1.35,
    marginBottom: 10,
    flex: 1,
  },
  recipeMeta: { fontSize: 11, color: "rgb(var(--warm-500))", display: "flex", gap: 4, flexWrap: "wrap" as const, alignItems: "center", marginTop: "auto" },
  dot: { color: "rgb(var(--warm-300))" },

  // Empty
  emptyCard: {
    background: "rgb(var(--warm-50))",
    borderRadius: "var(--radius-card-inner)",
    padding: "16px 20px 28px",
    textAlign: "center",
    border: "2px dashed rgba(181, 88, 47, 0.42)",
    boxShadow: "0 12px 26px rgba(112, 48, 26, 0.08)",
  },
  savedEmptyState: {
    padding: "12px 4px 4px",
    textAlign: "center",
  },
  emptyText: { fontSize: 14, color: "rgb(var(--warm-500))", marginBottom: 10 },
  emptyLink: { fontSize: 14, color: "rgb(var(--terra-600))", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 },
  floatingPrimary: {
    background: "rgb(var(--terra-600))",
    color: "white",
    borderRadius: "var(--radius-card-inner)",
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
    borderRadius: "var(--radius-card-inner)",
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
