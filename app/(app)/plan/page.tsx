"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, CirclePlus, Download, Recycle, Trash2, UtensilsCrossed, X } from "lucide-react";
import type { MealPlan, RecipeSummary } from "@/types";
import { DAY_NAMES, startOfWeek, addDays } from "@/lib/date-utils";
import { RecipeImage } from "@/components/recipe-image";

const WEEK_DAYS = DAY_NAMES;
const PRIMARY_MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;
const EXTRA_MEAL_TYPES = ["brunch", "snack", "dessert", "side"] as const;
const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  brunch: "Brunch",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  dessert: "Dessert",
  side: "Side",
};
const FEATURED_MEAL_ORDER: Record<string, number> = {
  breakfast: 0,
  brunch: 1,
  lunch: 2,
  snack: 3,
  side: 4,
  dinner: 5,
  dessert: 6,
};

function getCurrentFeaturedMealType(now: Date) {
  const minutes = now.getHours() * 60 + now.getMinutes();

  if (minutes <= 600) return "breakfast";
  if (minutes <= 840) return "lunch";
  return "dinner";
}

export default function PlanPage() {
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPickerFor, setShowPickerFor] = useState<{ day: number; meal: string } | null>(null);
  const [pickerMealType, setPickerMealType] = useState<string>("lunch");
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedPastDays, setExpandedPastDays] = useState<Set<number>>(new Set());

  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const fetchPlan = async (ws: Date) => {
    setLoading(true);
    const res = await fetch(`/api/meal-plan?week=${ws.toISOString()}`);
    const json = await res.json();
    setPlan(json.data);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadPlan() {
      const res = await fetch(`/api/meal-plan?week=${weekStart.toISOString()}`);
      const json = await res.json();
      if (cancelled) return;
      setPlan(json.data);
      setLoading(false);
    }

    void loadPlan();
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncIsMobile = () => setIsMobile(mediaQuery.matches);

    syncIsMobile();
    mediaQuery.addEventListener("change", syncIsMobile);

    return () => {
      mediaQuery.removeEventListener("change", syncIsMobile);
    };
  }, []);

  useEffect(() => {
    setExpandedPastDays(new Set());
  }, [weekStart]);

  const openPicker = async (day: number, meal: string) => {
    setShowPickerFor({ day, meal });
    setPickerMealType(meal === "extra" ? "side" : meal);
    if (recipes.length === 0) {
      const res = await fetch("/api/recipes?limit=50");
      const json = await res.json();
      setRecipes(json.data?.recipes || []);
    }
  };

  const addMeal = async (recipeId?: string, note?: string) => {
    if (!showPickerFor) return;
    await fetch("/api/meal-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        week: weekStart.toISOString(),
        dayOfWeek: showPickerFor.day,
        mealType: pickerMealType,
        recipeId,
        note,
      }),
    });
    setShowPickerFor(null);
    setPickerMealType("lunch");
    fetchPlan(weekStart);
  };

  const deleteMeal = async (itemId: string) => {
    await fetch(`/api/meal-plan?itemId=${itemId}`, {
      method: "DELETE",
    });
    fetchPlan(weekStart);
  };

  const today = new Date();
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const todayIndex = today.getDay();
  const currentFeaturedMealType = getCurrentFeaturedMealType(today);
  const planItems = plan?.items || [];
  const recipeItems = [...planItems]
    .filter((item) => Boolean(item.recipe?.id))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const isCurrentWeek = weekStart <= startOfToday && startOfToday <= addDays(weekStart, 6);
  const currentAndFutureRecipeItems = isCurrentWeek
    ? recipeItems.filter((item) => item.dayOfWeek >= todayIndex)
    : recipeItems;
  const todayItems = currentAndFutureRecipeItems
    .filter((item) => item.dayOfWeek === todayIndex)
    .sort((a, b) => (FEATURED_MEAL_ORDER[a.mealType] ?? 99) - (FEATURED_MEAL_ORDER[b.mealType] ?? 99));
  const todayFeaturedItem =
    todayItems.find((item) => item.mealType === currentFeaturedMealType) ||
    todayItems.find((item) => (FEATURED_MEAL_ORDER[item.mealType] ?? 99) > (FEATURED_MEAL_ORDER[currentFeaturedMealType] ?? 99)) ||
    todayItems[0] ||
    null;
  const featuredItem =
    (isCurrentWeek ? todayFeaturedItem : null) ||
    currentAndFutureRecipeItems[0] ||
    null;
  const featuredEyebrow = featuredItem?.dayOfWeek === todayIndex && isCurrentWeek ? "Today" : "Coming up";

  return (
    <div style={S.page}>
      <div className="page-banner">
        <h1 className="page-banner-title">Meal Plan</h1>
      </div>

      {/* Plan grid */}
      {loading ? (
        <div style={S.skeleton}>
          {[...Array(7)].map((_, i) => <div key={i} style={S.skeletonRow} />)}
        </div>
      ) : (
        <>
          <div style={S.editorialIntro}>
            {featuredItem ? (
              <div style={S.featuredCard}>
                <div style={S.featuredCopy}>
                  <span style={S.featuredEyebrow}>{featuredEyebrow}</span>
                  <h2 style={S.featuredTitle}>
                    {featuredItem.recipe?.title || featuredItem.note}
                  </h2>
                  <p style={S.featuredMeta}>
                    {WEEK_DAYS[featuredItem.dayOfWeek]} ·{" "}
                    {MEAL_TYPE_LABELS[featuredItem.mealType] || featuredItem.mealType}
                  </p>
                </div>
                {featuredItem.recipe?.id ? (
                  <Link href={`/recipes/${featuredItem.recipe.id}`} style={S.featuredLink}>
                    View recipe
                  </Link>
                ) : null}
              </div>
            ) : (
              <div style={S.featuredCard}>
                <div style={S.featuredCopy}>
                  <span style={S.featuredEyebrow}>Coming up</span>
                  <h2 style={S.featuredTitle}>Add a recipe</h2>
                  <p style={S.featuredMeta}>No upcoming recipes are scheduled right now.</p>
                </div>
                <Link href="/recipes" style={S.featuredLink}>
                  Browse recipes
                </Link>
              </div>
            )}
            <div style={S.weekNavWrap}>
              <div style={S.weekNav} className="page-header-actions">
                <button style={S.weekBtn} onClick={() => setWeekStart(addDays(weekStart, -7))}>
                  <ArrowLeft size={18} strokeWidth={2.2} />
                </button>
                <span style={S.weekLabel}>{weekLabel}</span>
                <button style={S.weekBtn} onClick={() => setWeekStart(addDays(weekStart, 7))}>
                  <ArrowRight size={18} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          </div>

          <div style={S.planGrid}>
            {WEEK_DAYS.map((day, i) => {
            const dayDate = addDays(weekStart, i);
            const dayStart = new Date(dayDate);
            dayStart.setHours(0, 0, 0, 0);
            const isPastDay = dayStart.getTime() < startOfToday.getTime();
            const isToday = i === todayIndex && weekStart <= today && today <= addDays(weekStart, 6);
            const isCollapsed = isMobile && isPastDay && !expandedPastDays.has(i);
            const dayItems = (plan?.items || []).filter(
              (it) => it.dayOfWeek === i && Boolean(it.recipe?.id || it.note?.trim())
            );
            const extraTypes = EXTRA_MEAL_TYPES.filter((type) =>
              dayItems.some((item) => item.mealType === type)
            );
            const toggleCollapsedDay = () => {
              setExpandedPastDays((current) => {
                const next = new Set(current);
                if (next.has(i)) next.delete(i);
                else next.add(i);
                return next;
              });
            };

              return (
                <div key={day} style={{ ...S.dayRow, ...(isToday ? S.dayRowToday : {}), ...(isPastDay ? S.dayRowPast : {}) }}>
                {isMobile && isPastDay ? (
                  <button type="button" style={S.dayHeaderButton} onClick={toggleCollapsedDay}>
                    <div style={S.dayLabel}>
                      <span style={{ ...S.dayName, ...(isToday ? S.dayNameToday : {}) }}>{day}</span>
                      <span style={{ ...S.dayDate, ...(isToday ? S.dayDateToday : {}) }}>{dayDate.getDate()}</span>
                    </div>
                    <div style={S.dayHeaderMeta}>
                      <span style={S.pastPill}>Past</span>
                      {isCollapsed ? <ChevronDown size={16} strokeWidth={2.2} /> : <ChevronUp size={16} strokeWidth={2.2} />}
                    </div>
                  </button>
                ) : (
                  <div style={S.dayHeader}>
                    <div style={S.dayLabel}>
                      <span style={{ ...S.dayName, ...(isToday ? S.dayNameToday : {}) }}>{day}</span>
                      <span style={{ ...S.dayDate, ...(isToday ? S.dayDateToday : {}) }}>{dayDate.getDate()}</span>
                    </div>
                    {isToday && <span style={S.todayPill}>Today</span>}
                  </div>
                )}
                {!isCollapsed && <div style={S.mealSlots}>
                  {PRIMARY_MEAL_TYPES.map((mealType) => (
                    <MealSlot
                      key={mealType}
                      label={MEAL_TYPE_LABELS[mealType]}
                      items={dayItems.filter((item) => item.mealType === mealType)}
                      isLocked={isPastDay}
                      onDelete={deleteMeal}
                      onAdd={() => openPicker(i, mealType)}
                      tone={isToday ? "today" : "default"}
                    />
                  ))}

                  {extraTypes.length > 0 && (
                    <div style={{ ...S.extraSection, ...(isToday ? S.extraSectionToday : {}) }}>
                      <p style={{ ...S.extraHeading, ...(isToday ? S.extraHeadingToday : {}) }}>Extras</p>
                      <div style={S.extraStack}>
                        {extraTypes.map((mealType) => (
                          <MealSlot
                            key={mealType}
                            label={MEAL_TYPE_LABELS[mealType]}
                            items={dayItems.filter((item) => item.mealType === mealType)}
                            isLocked={isPastDay}
                            onDelete={deleteMeal}
                            onAdd={() => openPicker(i, mealType)}
                            compact
                            tone={isToday ? "today" : "default"}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {!isPastDay && (
                    <button style={{ ...S.addExtraBtn, ...(isToday ? S.addExtraBtnToday : {}) }} onClick={() => openPicker(i, "extra")}>
                      <CirclePlus size={14} strokeWidth={2.2} />
                      <span>Add extra</span>
                    </button>
                  )}
                </div>}
              </div>
              );
            })}
          </div>
        </>
      )}

      {/* Recipe picker modal */}
      {showPickerFor && (
        <div style={S.modalBackdrop} onClick={() => setShowPickerFor(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitle}>
                {WEEK_DAYS[showPickerFor.day]} · {MEAL_TYPE_LABELS[pickerMealType] || pickerMealType}
              </h2>
              <button style={S.modalClose} onClick={() => setShowPickerFor(null)}>
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>

            {showPickerFor.meal === "extra" && (
              <div style={S.extraTypePicker}>
                {EXTRA_MEAL_TYPES.map((mealType) => (
                  <button
                    key={mealType}
                    style={{
                      ...S.extraTypeChip,
                      ...(pickerMealType === mealType ? S.extraTypeChipActive : {}),
                    }}
                    onClick={() => setPickerMealType(mealType)}
                  >
                    {MEAL_TYPE_LABELS[mealType]}
                  </button>
                ))}
              </div>
            )}

            <div style={S.modalOptions}>
              <button style={S.noteOption} onClick={() => addMeal(undefined, "Out")}>
                <UtensilsCrossed size={16} strokeWidth={2} />
                <span>Eating out</span>
              </button>
              <button style={S.noteOption} onClick={() => addMeal(undefined, "Leftovers")}>
                <Recycle size={16} strokeWidth={2} />
                <span>Leftovers</span>
              </button>
            </div>

            <p style={S.modalSub}>Or pick a recipe:</p>
            <div style={S.recipeList}>
              {recipes.length === 0 ? (
                <p style={{ color: "rgb(var(--warm-400))", fontSize: 14, textAlign: "center", padding: 20 }}>
                  No recipes saved yet.{" "}
                  <Link href="/recipes/import" style={{ color: "rgb(var(--terra-600))", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Download size={14} strokeWidth={2.2} />
                    <span>Import one</span>
                  </Link>
                </p>
              ) : (
                recipes.map((r) => (
                  <button key={r.id} style={S.recipeOption} onClick={() => addMeal(r.id)}>
                    <div style={S.recipeOptImgWrap}>
                      <RecipeImage
                        imageUrl={r.imageUrl}
                        title={r.title}
                        tags={r.tags}
                        sizes="44px"
                        iconSize={18}
                        imageStyle={S.recipeOptImg}
                      />
                    </div>
                    <div>
                      <p style={S.recipeOptTitle}>{r.title}</p>
                      {r.totalTime && <p style={S.recipeOptMeta}>{r.totalTime} min</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MealSlot({ label, items, isLocked, onAdd, onDelete, compact = false, tone = "default" }: {
  label: string;
  items: MealPlan["items"];
  isLocked: boolean;
  onAdd: () => void;
  onDelete: (itemId: string) => void;
  compact?: boolean;
  tone?: "default" | "today";
}) {
  const hasItems = items.length > 0;
  const isTodayTone = tone === "today";

  return (
    <div style={{ ...SS.slot, ...(compact ? SS.slotCompact : {}) }}>
      <span style={{ ...SS.slotLabel, ...(isTodayTone ? SS.slotLabelToday : {}) }}>{label}</span>
      {hasItems ? (
        <div style={{ ...SS.slotFilled, ...(isTodayTone ? SS.slotFilledToday : {}) }}>
          <div style={SS.slotContent}>
            {items.map((item) => (
              <div key={item.id} style={SS.slotItem}>
                {item.recipe ? (
                  <Link href={`/recipes/${item.recipe.id}`} style={{ ...SS.slotLink, ...(isTodayTone ? SS.slotLinkToday : {}) }}>
                    {item.recipe.title}
                  </Link>
                ) : (
                  <span style={{ ...SS.slotNote, ...(isTodayTone ? SS.slotNoteToday : {}) }}>{item.note || "–"}</span>
                )}
                {!isLocked && (
                  <button
                    type="button"
                    aria-label={`Delete ${label.toLowerCase()} meal`}
                    style={{ ...SS.deleteBtn, ...(isTodayTone ? SS.deleteBtnToday : {}) }}
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2 size={14} strokeWidth={2.1} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!isLocked && (
            <button style={{ ...SS.addBtn, ...(isTodayTone ? SS.addBtnToday : {}) }} onClick={onAdd}>
              <CirclePlus size={16} strokeWidth={2.2} />
              <span>Add</span>
            </button>
          )}
        </div>
      ) : isLocked ? (
        <span style={{ ...SS.lockedText, ...(isTodayTone ? SS.lockedTextToday : {}) }}>Past day</span>
      ) : (
        <button style={{ ...SS.addBtn, ...(isTodayTone ? SS.addBtnToday : {}) }} onClick={onAdd}>
          <CirclePlus size={16} strokeWidth={2.2} />
          <span>Add</span>
        </button>
      )}
    </div>
  );
}

const SS: Record<string, React.CSSProperties> = {
  slot: { display: "grid", gridTemplateColumns: "72px 1fr", gap: 10, alignItems: "start" },
  slotCompact: { gridTemplateColumns: "72px 1fr" },
  slotLabel: { fontSize: 11, color: "rgb(var(--warm-500))", fontWeight: 600, paddingTop: 10 },
  slotLabelToday: { color: "rgba(255,255,255,0.72)" },
  slotFilled: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
    minWidth: 0,
    background: "rgb(var(--warm-50))",
    border: "1px solid rgb(var(--warm-100))",
    borderRadius: "var(--radius-card-inner)",
    padding: "8px 10px",
  },
  slotFilledToday: {
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(2px)",
  },
  slotContent: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 },
  slotItem: { display: "flex", alignItems: "center", gap: 8, minHeight: 24 },
  slotLink: { fontSize: 13, color: "rgb(var(--warm-800))", textDecoration: "none", fontWeight: 500, lineHeight: 1.4 },
  slotLinkToday: { color: "rgba(255,255,255,0.96)" },
  slotNote: { fontSize: 13, color: "rgb(var(--warm-500))", fontStyle: "italic" },
  slotNoteToday: { color: "rgba(255,255,255,0.84)" },
  lockedText: {
    fontSize: 12,
    color: "rgb(var(--warm-400))",
    fontStyle: "italic",
    background: "rgb(var(--warm-50))",
    border: "1px solid rgb(var(--warm-100))",
    borderRadius: "var(--radius-card-inner)",
    padding: "9px 10px",
  },
  lockedTextToday: {
    color: "rgba(255,255,255,0.74)",
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  addBtn: {
    background: "rgb(var(--warm-50))",
    border: "1px dashed rgb(var(--warm-300))",
    borderRadius: "var(--radius-card-inner)",
    minHeight: 36,
    color: "rgb(var(--terra-600))",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "0 12px",
    fontSize: 12,
    fontWeight: 600,
    width: "100%",
  },
  addBtnToday: {
    background: "rgba(255,255,255,0.14)",
    border: "1px dashed rgba(255,255,255,0.34)",
    color: "rgb(var(--warm-50))",
  },
  deleteBtn: { background: "transparent", border: "none", color: "rgb(var(--warm-400))", cursor: "pointer", width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 },
  deleteBtnToday: { color: "rgba(255,255,255,0.7)" },
};

const S: Record<string, React.CSSProperties> = {
  page: { padding: "16px", minHeight: "100dvh", background: "rgb(var(--warm-50))", width: "100%", maxWidth: 960, margin: "0 auto" },
  header: { marginBottom: 20 },
  title: {
    fontSize: 26,
    fontWeight: 700,
    fontFamily: "var(--font-serif)",
    letterSpacing: "var(--tracking-display)",
    color: "rgb(var(--warm-900))",
    marginBottom: 12,
    whiteSpace: "nowrap",
  },
  weekNav: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, width: "100%" },
  weekNavWrap: {
    display: "flex",
    justifyContent: "center",
  },
  weekBtn: { background: "none", border: "none", cursor: "pointer", color: "rgb(var(--warm-600))", padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "center" },
  weekLabel: { fontSize: 13, fontWeight: 600, color: "rgb(var(--warm-700))" },
  editorialIntro: { display: "grid", gap: 12, marginBottom: 16 },
  featuredCard: {
    background: "linear-gradient(135deg, rgba(181,88,47,0.96) 0%, rgba(146,67,38,0.98) 100%)",
    borderRadius: "var(--radius-card)",
    padding: "18px 18px 20px",
    color: "white",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 14,
  },
  featuredCopy: { display: "flex", flexDirection: "column", gap: 8 },
  featuredEyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.78)" },
  featuredTitle: { fontSize: 22, lineHeight: 1.15, fontWeight: 700, maxWidth: 420 },
  featuredMeta: { fontSize: 13, color: "rgba(255,255,255,0.82)" },
  featuredLink: {
    borderRadius: "var(--radius-pill)",
    background: "rgba(255,255,255,0.14)",
    color: "white",
    padding: "10px 14px",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
    border: "1px solid rgba(255,255,255,0.16)",
  },
  featuredTag: {
    borderRadius: "var(--radius-pill)",
    background: "rgba(255,255,255,0.14)",
    color: "white",
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
    border: "1px solid rgba(255,255,255,0.16)",
  },
  planGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 },
  dayRow: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: "14px",
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgb(var(--warm-200))",
    borderRadius: "var(--radius-card)",
    boxShadow: "0 12px 30px rgba(71, 55, 46, 0.04)",
  },
  dayRowToday: {
    background: "linear-gradient(180deg, rgb(var(--terra-700)) 0%, rgb(var(--terra-600)) 100%)",
    border: "1px solid rgba(112, 48, 26, 0.22)",
    boxShadow: "0 16px 34px rgba(112, 48, 26, 0.18)",
  },
  dayRowPast: {
    opacity: 0.82,
    background: "rgb(var(--terra-50))",
    border: "1px solid rgb(var(--terra-200))",
    filter: "saturate(0.88)",
  },
  dayHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  dayHeaderButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    textAlign: "left" as const,
    color: "inherit",
  },
  dayHeaderMeta: { display: "inline-flex", alignItems: "center", gap: 8, color: "rgb(var(--warm-500))" },
  dayLabel: { display: "flex", alignItems: "center", gap: 10 },
  dayName: { fontSize: 11, fontWeight: 700, color: "rgb(var(--warm-500))", textTransform: "uppercase" as const, letterSpacing: "0.06em" },
  dayNameToday: { color: "rgba(255,255,255,0.72)" },
  dayDate: { fontSize: 18, fontWeight: 700, color: "rgb(var(--warm-900))" },
  dayDateToday: { color: "rgb(var(--warm-50))" },
  todayPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 9px",
    borderRadius: "var(--radius-pill)",
    background: "rgba(255,255,255,0.14)",
    color: "rgb(var(--warm-50))",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  pastPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 9px",
    borderRadius: "var(--radius-pill)",
    background: "rgb(var(--terra-50))",
    color: "rgb(var(--terra-700))",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  mealSlots: { display: "flex", flexDirection: "column", gap: 10 },
  extraSection: { paddingTop: 2, marginTop: 2, borderTop: "1px solid rgb(var(--warm-100))" },
  extraSectionToday: { borderTop: "1px solid rgba(255,255,255,0.14)" },
  extraHeading: { fontSize: 10, fontWeight: 700, color: "rgb(var(--warm-400))", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, paddingTop: 10 },
  extraHeadingToday: { color: "rgba(255,255,255,0.64)" },
  extraStack: { display: "flex", flexDirection: "column", gap: 6 },
  addExtraBtn: {
    marginTop: 4,
    alignSelf: "flex-start",
    background: "rgb(var(--warm-50))",
    border: "1px dashed rgb(var(--warm-300))",
    borderRadius: "var(--radius-pill)",
    color: "rgb(var(--terra-600))",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
  },
  addExtraBtnToday: {
    background: "rgba(255,255,255,0.14)",
    border: "1px dashed rgba(255,255,255,0.34)",
    color: "rgb(var(--warm-50))",
  },
  skeleton: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 },
  skeletonRow: { height: 188, background: "rgb(var(--warm-100))", borderRadius: "var(--radius-card)" },
  // Modal
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "flex-end" },
  modal: { background: "white", borderRadius: "var(--radius-modal) var(--radius-modal) 0 0", padding: "24px 20px", width: "100%", maxHeight: "80dvh", overflowY: "auto" as const },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: 700, color: "rgb(var(--warm-900))", textTransform: "capitalize" as const },
  modalClose: { background: "none", border: "none", cursor: "pointer", color: "rgb(var(--warm-400))", display: "flex", alignItems: "center", justifyContent: "center" },
  extraTypePicker: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 16 },
  extraTypeChip: {
    border: "1px solid rgb(var(--warm-200))",
    borderRadius: "var(--radius-pill)",
    background: "white",
    color: "rgb(var(--warm-600))",
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
  },
  extraTypeChipActive: {
    background: "rgb(var(--terra-50))",
    border: "1px solid rgb(var(--terra-300))",
    color: "rgb(var(--terra-700))",
  },
  modalOptions: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 16 },
  noteOption: { background: "rgb(var(--warm-50))", border: "1.5px solid rgb(var(--warm-200))", borderRadius: "var(--radius-control)", padding: "12px 8px", fontSize: 13, fontWeight: 500, cursor: "pointer", color: "rgb(var(--warm-700))", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 },
  modalSub: { fontSize: 12, color: "rgb(var(--warm-400))", marginBottom: 10 },
  recipeList: { display: "flex", flexDirection: "column", gap: 8 },
  recipeOption: { display: "flex", alignItems: "center", gap: 12, background: "rgb(var(--warm-50))", border: "1px solid rgb(var(--warm-100))", borderRadius: "var(--radius-control)", padding: "10px 12px", cursor: "pointer", textAlign: "left" as const },
  recipeOptImgWrap: { width: 44, height: 44, position: "relative", overflow: "hidden", borderRadius: "var(--radius-control)", flexShrink: 0, background: "rgb(var(--warm-100))" },
  recipeOptImg: { objectFit: "cover" as const, objectPosition: "center center" as const },
  recipeOptTitle: { fontSize: 14, fontWeight: 600, color: "rgb(var(--warm-800))" },
  recipeOptMeta: { fontSize: 12, color: "rgb(var(--warm-400))" },
};
