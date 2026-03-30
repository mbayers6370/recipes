"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CirclePlus, Download, Recycle, Trash2, UtensilsCrossed, X } from "lucide-react";
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

export default function PlanPage() {
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPickerFor, setShowPickerFor] = useState<{ day: number; meal: string } | null>(null);
  const [pickerMealType, setPickerMealType] = useState<string>("lunch");
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);

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

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header} className="page-header">
        <h1 style={S.title} className="page-header-title">Meal Plan</h1>
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

      {/* Plan grid */}
      {loading ? (
        <div style={S.skeleton}>
          {[...Array(7)].map((_, i) => <div key={i} style={S.skeletonRow} />)}
        </div>
      ) : (
        <div style={S.planGrid}>
          {WEEK_DAYS.map((day, i) => {
            const dayDate = addDays(weekStart, i);
            const isPastDay = dayDate < startOfToday;
            const isToday = i === todayIndex && weekStart <= today && today <= addDays(weekStart, 6);
            const dayItems = (plan?.items || []).filter(
              (it) => it.dayOfWeek === i && Boolean(it.recipe?.id || it.note?.trim())
            );
            const extraTypes = EXTRA_MEAL_TYPES.filter((type) =>
              dayItems.some((item) => item.mealType === type)
            );

            return (
              <div key={day} style={{ ...S.dayRow, ...(isToday ? S.dayRowToday : {}), ...(isPastDay ? S.dayRowPast : {}) }}>
                <div style={S.dayHeader}>
                  <div style={S.dayLabel}>
                    <span style={{ ...S.dayName, ...(isToday ? S.dayNameToday : {}) }}>{day}</span>
                    <span style={S.dayDate}>{dayDate.getDate()}</span>
                  </div>
                  {isToday && <span style={S.todayPill}>Today</span>}
                </div>
                <div style={S.mealSlots}>
                  {PRIMARY_MEAL_TYPES.map((mealType) => (
                    <MealSlot
                      key={mealType}
                      label={MEAL_TYPE_LABELS[mealType]}
                      items={dayItems.filter((item) => item.mealType === mealType)}
                      isLocked={isPastDay}
                      onDelete={deleteMeal}
                      onAdd={() => openPicker(i, mealType)}
                    />
                  ))}

                  {extraTypes.length > 0 && (
                    <div style={S.extraSection}>
                      <p style={S.extraHeading}>Extras</p>
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
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {!isPastDay && (
                    <button style={S.addExtraBtn} onClick={() => openPicker(i, "extra")}>
                      <CirclePlus size={14} strokeWidth={2.2} />
                      <span>Add extra</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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

function MealSlot({ label, items, isLocked, onAdd, onDelete, compact = false }: {
  label: string;
  items: MealPlan["items"];
  isLocked: boolean;
  onAdd: () => void;
  onDelete: (itemId: string) => void;
  compact?: boolean;
}) {
  const hasItems = items.length > 0;

  return (
    <div style={{ ...SS.slot, ...(compact ? SS.slotCompact : {}) }}>
      <span style={SS.slotLabel}>{label}</span>
      {hasItems ? (
        <div style={SS.slotFilled}>
          <div style={SS.slotContent}>
            {items.map((item) => (
              <div key={item.id} style={SS.slotItem}>
                {item.recipe ? (
                  <Link href={`/recipes/${item.recipe.id}`} style={SS.slotLink}>
                    {item.recipe.title}
                  </Link>
                ) : (
                  <span style={SS.slotNote}>{item.note || "–"}</span>
                )}
                {!isLocked && (
                  <button
                    type="button"
                    aria-label={`Delete ${label.toLowerCase()} meal`}
                    style={SS.deleteBtn}
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2 size={14} strokeWidth={2.1} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!isLocked && (
            <button style={SS.addBtn} onClick={onAdd}>
              <CirclePlus size={16} strokeWidth={2.2} />
              <span>Add</span>
            </button>
          )}
        </div>
      ) : isLocked ? (
        <span style={SS.lockedText}>Past day</span>
      ) : (
        <button style={SS.addBtn} onClick={onAdd}>
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
  slotFilled: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
    minWidth: 0,
    background: "rgb(var(--warm-50))",
    border: "1px solid rgb(var(--warm-100))",
    borderRadius: 12,
    padding: "8px 10px",
  },
  slotContent: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 },
  slotItem: { display: "flex", alignItems: "center", gap: 8, minHeight: 24 },
  slotLink: { fontSize: 13, color: "rgb(var(--warm-800))", textDecoration: "none", fontWeight: 500, lineHeight: 1.4 },
  slotNote: { fontSize: 13, color: "rgb(var(--warm-500))", fontStyle: "italic" },
  lockedText: {
    fontSize: 12,
    color: "rgb(var(--warm-400))",
    fontStyle: "italic",
    background: "rgb(var(--warm-50))",
    border: "1px solid rgb(var(--warm-100))",
    borderRadius: 12,
    padding: "9px 10px",
  },
  addBtn: {
    background: "rgb(var(--warm-50))",
    border: "1px dashed rgb(var(--warm-300))",
    borderRadius: 12,
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
  deleteBtn: { background: "transparent", border: "none", color: "rgb(var(--warm-400))", cursor: "pointer", width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 },
};

const S: Record<string, React.CSSProperties> = {
  page: { padding: "16px", minHeight: "100dvh", background: "rgb(var(--warm-50))", width: "100%", maxWidth: 860, margin: "0 auto" },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 700, fontFamily: "var(--font-serif)", color: "rgb(var(--warm-900))", marginBottom: 12 },
  weekNav: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, width: "100%" },
  weekBtn: { background: "none", border: "none", cursor: "pointer", color: "rgb(var(--warm-600))", padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "center" },
  weekLabel: { fontSize: 13, fontWeight: 600, color: "rgb(var(--warm-700))" },
  planGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 },
  dayRow: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: "14px",
    background: "white",
    border: "1px solid rgb(var(--warm-200))",
    borderRadius: 18,
  },
  dayRowToday: {
    background: "linear-gradient(180deg, rgba(243, 232, 224, 0.9) 0%, rgba(255,255,255,0.98) 100%)",
    border: "1px solid rgb(var(--terra-200))",
  },
  dayRowPast: { opacity: 0.92 },
  dayHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  dayLabel: { display: "flex", alignItems: "center", gap: 10 },
  dayName: { fontSize: 11, fontWeight: 700, color: "rgb(var(--warm-500))", textTransform: "uppercase" as const, letterSpacing: "0.06em" },
  dayNameToday: { color: "rgb(var(--terra-600))" },
  dayDate: { fontSize: 18, fontWeight: 700, color: "rgb(var(--warm-900))" },
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
  mealSlots: { display: "flex", flexDirection: "column", gap: 10 },
  extraSection: { paddingTop: 2, marginTop: 2, borderTop: "1px solid rgb(var(--warm-100))" },
  extraHeading: { fontSize: 10, fontWeight: 700, color: "rgb(var(--warm-400))", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, paddingTop: 10 },
  extraStack: { display: "flex", flexDirection: "column", gap: 6 },
  addExtraBtn: {
    marginTop: 4,
    alignSelf: "flex-start",
    background: "rgb(var(--warm-50))",
    border: "1px dashed rgb(var(--warm-300))",
    borderRadius: 999,
    color: "rgb(var(--terra-600))",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
  },
  skeleton: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 },
  skeletonRow: { height: 188, background: "rgb(var(--warm-100))", borderRadius: 18 },
  // Modal
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "flex-end" },
  modal: { background: "white", borderRadius: "20px 20px 0 0", padding: "24px 20px", width: "100%", maxHeight: "80dvh", overflowY: "auto" as const },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: 700, color: "rgb(var(--warm-900))", textTransform: "capitalize" as const },
  modalClose: { background: "none", border: "none", cursor: "pointer", color: "rgb(var(--warm-400))", display: "flex", alignItems: "center", justifyContent: "center" },
  extraTypePicker: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 16 },
  extraTypeChip: {
    border: "1px solid rgb(var(--warm-200))",
    borderRadius: 999,
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
  noteOption: { background: "rgb(var(--warm-50))", border: "1.5px solid rgb(var(--warm-200))", borderRadius: 10, padding: "12px 8px", fontSize: 13, fontWeight: 500, cursor: "pointer", color: "rgb(var(--warm-700))", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 },
  modalSub: { fontSize: 12, color: "rgb(var(--warm-400))", marginBottom: 10 },
  recipeList: { display: "flex", flexDirection: "column", gap: 8 },
  recipeOption: { display: "flex", alignItems: "center", gap: 12, background: "rgb(var(--warm-50))", border: "1px solid rgb(var(--warm-100))", borderRadius: 10, padding: "10px 12px", cursor: "pointer", textAlign: "left" as const },
  recipeOptImgWrap: { width: 44, height: 44, position: "relative", overflow: "hidden", borderRadius: 8, flexShrink: 0, background: "rgb(var(--warm-100))" },
  recipeOptImg: { objectFit: "cover" as const },
  recipeOptTitle: { fontSize: 14, fontWeight: 600, color: "rgb(var(--warm-800))" },
  recipeOptMeta: { fontSize: 12, color: "rgb(var(--warm-400))" },
};
