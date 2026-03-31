"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CirclePlus,
  UtensilsCrossed,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { RecipeImage } from "@/components/recipe-image";
import { DAY_NAMES, addDays, startOfWeek } from "@/lib/date-utils";
import type {
  Household,
  HouseholdIdea,
  HouseholdPlan,
  RecipeSummary,
} from "@/types";

const KITCHEN_MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;
const KITCHEN_MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};
const IDEA_VOTES = [
  { value: "cook", label: "Cook this week" },
  { value: "maybe", label: "Maybe" },
  { value: "skip", label: "Skip" },
] as const;

export default function KitchenPage() {
  const { user } = useAuth();
  const today = new Date();
  const currentWeekStart = startOfWeek(today);
  const currentDayIndex = today.getDay();
  const [household, setHousehold] = useState<Household | null>(null);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [ideas, setIdeas] = useState<HouseholdIdea[]>([]);
  const [plan, setPlan] = useState<HouseholdPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [weekStart, setWeekStart] = useState<Date>(currentWeekStart);
  const [selectedDay, setSelectedDay] = useState<number>(Math.min(6, Math.max(0, currentDayIndex)));
  const [pickerState, setPickerState] = useState<{ dayOfWeek: number; mealType: string } | null>(null);
  const [ideaPickerOpen, setIdeaPickerOpen] = useState(false);

  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const loadKitchen = useCallback(async () => {
    const [householdRes, recipesRes, ideasRes, planRes] = await Promise.all([
      fetch("/api/household", { credentials: "same-origin" }).then((response) =>
        response.ok ? response.json() : null
      ),
      fetch("/api/recipes?sharedOnly=true", { credentials: "same-origin" }).then((response) =>
        response.ok ? response.json() : null
      ),
      fetch("/api/kitchen-ideas", { credentials: "same-origin" }).then((response) =>
        response.ok ? response.json() : null
      ),
      fetch(`/api/kitchen-plan?week=${weekStart.toISOString()}`, { credentials: "same-origin" }).then((response) =>
        response.ok ? response.json() : null
      ),
    ]);

    setHousehold(householdRes?.data ?? null);
    setRecipes(recipesRes?.data?.recipes ?? []);
    setIdeas(ideasRes?.data ?? []);
    setPlan(planRes?.data ?? null);
    setHouseholdName(
      householdRes?.data?.name || `${user?.displayName || user?.username || "My"} Kitchen`
    );
  }, [user?.displayName, user?.username, weekStart]);

  useEffect(() => {
    void loadKitchen().finally(() => setLoading(false));
  }, [loadKitchen]);

  const runKitchenAction = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Could not update your kitchen.");
        return;
      }

      setInviteEmail("");
      await loadKitchen();
    } finally {
      setSaving(false);
    }
  };

  const addKitchenPlanItem = async (recipeId?: string, note?: string) => {
    if (!pickerState) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/kitchen-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          week: weekStart.toISOString(),
          dayOfWeek: pickerState.dayOfWeek,
          mealType: pickerState.mealType,
          recipeId,
          note,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not update the shared plan.");
        return;
      }
      setPickerState(null);
      await loadKitchen();
    } finally {
      setSaving(false);
    }
  };

  const deleteKitchenPlanItem = async (itemId: string) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/kitchen-plan?itemId=${itemId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not remove that meal.");
        return;
      }
      await loadKitchen();
    } finally {
      setSaving(false);
    }
  };

  const addIdea = async (recipeId: string) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/kitchen-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ recipeId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not add that meal idea.");
        return;
      }
      setIdeaPickerOpen(false);
      await loadKitchen();
    } finally {
      setSaving(false);
    }
  };

  const castIdeaVote = async (ideaId: string, vote: "cook" | "maybe" | "skip") => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/kitchen-ideas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ideaId, vote }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not save that vote.");
        return;
      }
      setIdeas((current) =>
        current.map((idea) => (idea.id === ideaId ? json.data : idea))
      );
    } finally {
      setSaving(false);
    }
  };

  const removeIdea = async (ideaId: string) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/kitchen-ideas?ideaId=${ideaId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not remove that idea.");
        return;
      }
      setIdeas((current) => current.filter((idea) => idea.id !== ideaId));
    } finally {
      setSaving(false);
    }
  };

  const sharedRecipesForIdeaPicker = useMemo(
    () => recipes.filter((recipe) => !ideas.some((idea) => idea.recipeId === recipe.id)),
    [recipes, ideas]
  );
  const visibleSharedRecipes = useMemo(() => recipes.slice(0, 4), [recipes]);
  const selectedDate = addDays(weekStart, selectedDay);
  const selectedDayItems = useMemo(
    () => (plan?.items || []).filter((item) => item.dayOfWeek === selectedDay),
    [plan?.items, selectedDay]
  );
  const isCurrentWeek =
    weekStart.getFullYear() === currentWeekStart.getFullYear() &&
    weekStart.getMonth() === currentWeekStart.getMonth() &&
    weekStart.getDate() === currentWeekStart.getDate();
  const isAtCurrentMobileDay = isCurrentWeek && selectedDay <= currentDayIndex;

  const moveSelectedDay = (direction: -1 | 1) => {
    if (direction < 0 && isAtCurrentMobileDay) {
      return;
    }
    setSelectedDay((current) => {
      const next = current + direction;
      if (next < 0) {
        setWeekStart((week) => addDays(week, -7));
        return 6;
      }
      if (next > 6) {
        setWeekStart((week) => addDays(week, 7));
        return 0;
      }
      return next;
    });
  };

  if (loading) {
    return <div style={S.state}>Loading kitchen…</div>;
  }

  if (!household) {
    return (
      <div style={S.page}>
        <div style={S.emptyWrap}>
          <div style={S.emptyIcon}>
            <Users size={22} strokeWidth={2} />
          </div>
          <h1 style={S.emptyTitle}>Start a shared kitchen</h1>
          <p style={S.emptyText}>
            Create one shared spot for family recipes, then connect up to 4 more people.
          </p>
          <div style={S.formStack}>
            <input
              style={S.input}
              type="text"
              placeholder={`${user?.displayName || user?.username || "My"} Kitchen`}
              value={householdName}
              onChange={(event) => setHouseholdName(event.target.value)}
            />
            <button
              type="button"
              style={S.primaryBtn}
              onClick={() => void runKitchenAction({ action: "create", name: householdName })}
              disabled={saving}
            >
              {saving ? "Creating…" : "Create kitchen"}
            </button>
          </div>
          {error && <p style={S.error}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <div className="page-banner">
          <h1 className="page-banner-title">Kitchen</h1>
        </div>

        <div style={S.header}>
          <div>
            <p style={S.kicker}>Current kitchen</p>
            <h1 style={S.title}>{household.name}</h1>
            <p style={S.sub}>
              {household.memberCount} {household.memberCount === 1 ? "person" : "people"} connected.
            </p>
          </div>
        </div>

        <section style={S.sectionCard} className="kitchen-section kitchen-section-ideas">
          <div style={S.sectionHeader} className="kitchen-ideas-header">
            <div>
              <h2 style={S.sectionTitle}>Meal Ideas</h2>
              <p style={S.sectionSub}>What are we feeling this week?</p>
            </div>
            <button
              type="button"
              style={S.primaryGhostBtn}
              onClick={() => setIdeaPickerOpen(true)}
              disabled={sharedRecipesForIdeaPicker.length === 0}
            >
              <UtensilsCrossed size={15} strokeWidth={2.2} />
              <span>Suggest idea</span>
              <ArrowRight size={14} strokeWidth={2.2} />
            </button>
          </div>

          {ideas.length > 0 ? (
            <div style={S.ideaStack}>
              {ideas.map((idea) => {
                const myVote = idea.votes.find((vote) => vote.userId === user?.id)?.vote;
                const counts = {
                  cook: idea.votes.filter((vote) => vote.vote === "cook").length,
                  maybe: idea.votes.filter((vote) => vote.vote === "maybe").length,
                  skip: idea.votes.filter((vote) => vote.vote === "skip").length,
                };

                return (
                  <div key={idea.id} style={S.ideaCard}>
                    <div style={S.ideaMedia}>
                      <RecipeImage
                        imageUrl={idea.recipe.imageUrl}
                        title={idea.recipe.title}
                        tags={idea.recipe.tags}
                        sizes="88px"
                        iconSize={22}
                        imageStyle={S.ideaImage}
                      />
                    </div>
                    <div style={S.ideaBody}>
                      <div style={S.ideaHeader}>
                        <div>
                          <p style={S.ideaTitle}>{idea.recipe.title}</p>
                          <p style={S.ideaMeta}>
                            Suggested by {idea.proposedByUser?.displayName || idea.proposedByUser?.username || "Kitchen member"}
                          </p>
                        </div>
                        {(idea.proposedByUserId === user?.id || household.role === "owner") && (
                          <button
                            type="button"
                            style={S.iconBtn}
                            onClick={() => void removeIdea(idea.id)}
                          >
                            <X size={14} strokeWidth={2.2} />
                          </button>
                        )}
                      </div>
                      <div style={S.voteRow}>
                        {IDEA_VOTES.map((vote) => (
                          <button
                            key={vote.value}
                            type="button"
                            style={{
                              ...S.voteBtn,
                              ...(myVote === vote.value ? S.voteBtnActive : {}),
                            }}
                            onClick={() => void castIdeaVote(idea.id, vote.value)}
                          >
                            <span>{vote.label}</span>
                            <span style={S.voteCount}>
                              {counts[vote.value]}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={S.emptyRecipes}>
              <p style={S.emptyText}>No meal ideas yet.</p>
              <p style={S.emptyHint}>Suggest one from your shared recipes to start the weekly conversation.</p>
            </div>
          )}
        </section>

        <section style={{ marginBottom: 28 }} className="kitchen-section kitchen-section-shared">
          <div style={S.sectionHeader}>
            <h2 style={S.sectionTitle}>Shared Recipes</h2>
            <Link href="/recipes" style={S.inlineLink}>
              <span>All recipes</span>
              <ArrowRight size={14} strokeWidth={2.2} />
            </Link>
          </div>

          {recipes.length > 0 ? (
            <div style={S.recipeGrid} className="kitchen-shared-grid">
              {visibleSharedRecipes.map((recipe) => (
                <Link key={recipe.id} href={`/recipes/${recipe.id}`} style={S.recipeCard}>
                  <div style={S.recipeThumb}>
                    <RecipeImage
                      imageUrl={recipe.imageUrl}
                      title={recipe.title}
                      tags={recipe.tags}
                      sizes="(min-width: 768px) 220px, 50vw"
                      iconSize={26}
                      imageStyle={S.recipeImage}
                    />
                  </div>
                  <div style={S.recipeBody}>
                    <p style={S.recipeTitle}>{recipe.title}</p>
                    <p style={S.recipeOwner}>
                      Shared by {recipe.user?.displayName || recipe.user?.username || "Kitchen member"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={S.emptyRecipes}>
              <p style={S.emptyText}>No shared recipes yet.</p>
              <p style={S.emptyHint}>Open a recipe and tap Share to send it into the kitchen.</p>
            </div>
          )}
        </section>

        <section style={S.sectionCard} className="kitchen-section kitchen-section-planner">
          <div style={S.sectionHeader}>
            <h2 style={S.sectionTitle}>Planner</h2>
            <div style={S.weekNav} className="kitchen-planner-mobile-nav">
              {isAtCurrentMobileDay ? (
                <div style={S.weekBtnSpacer} aria-hidden="true" />
              ) : (
                <button type="button" style={S.weekBtn} onClick={() => moveSelectedDay(-1)}>
                  <ArrowLeft size={16} strokeWidth={2.2} />
                </button>
              )}
              <div style={S.dayFocus}>
                <span style={S.weekLabel}>{DAY_NAMES[selectedDay]}</span>
                <span style={S.dayFocusDate}>
                  {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
              <button type="button" style={S.weekBtn} onClick={() => moveSelectedDay(1)}>
                <ArrowRight size={16} strokeWidth={2.2} />
              </button>
            </div>
            <div style={S.weekNav} className="kitchen-planner-desktop-nav">
              <button type="button" style={S.weekBtn} onClick={() => setWeekStart(addDays(weekStart, -7))}>
                <ArrowLeft size={16} strokeWidth={2.2} />
              </button>
              <span style={S.weekLabel}>{weekLabel}</span>
              <button type="button" style={S.weekBtn} onClick={() => setWeekStart(addDays(weekStart, 7))}>
                <ArrowRight size={16} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <div style={S.planMobileWrap} className="kitchen-plan-mobile">
            <div style={S.planDayCard}>
              <div style={S.planDayBody}>
                {KITCHEN_MEAL_TYPES.map((mealType) => {
                  const mealItems = selectedDayItems.filter((item) => item.mealType === mealType);
                  return (
                    <div key={mealType} style={S.planSlot}>
                      <div style={S.planSlotTop}>
                        <span style={S.planSlotLabel}>{KITCHEN_MEAL_LABELS[mealType]}</span>
                        <button
                          type="button"
                          style={S.addMiniBtn}
                          onClick={() => setPickerState({ dayOfWeek: selectedDay, mealType })}
                        >
                          <CirclePlus size={13} strokeWidth={2.2} />
                          <span>Add</span>
                        </button>
                      </div>
                      {mealItems.length > 0 ? (
                        <div style={S.planItemStack}>
                          {mealItems.map((item) => (
                            <div key={item.id} style={S.planItem}>
                              <div style={S.planItemInfo}>
                                <span style={S.planItemTitle}>
                                  {item.recipe?.title || item.note || "Planned"}
                                </span>
                                {item.createdByUser && (
                                  <span style={S.planItemMeta}>
                                    Added by {item.createdByUser.displayName || item.createdByUser.username}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                style={S.iconBtn}
                                onClick={() => void deleteKitchenPlanItem(item.id)}
                              >
                                <X size={14} strokeWidth={2.2} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={S.planEmpty}>Nothing here yet.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={S.planGrid} className="kitchen-plan-grid kitchen-plan-desktop">
            {DAY_NAMES.map((dayName, dayOfWeek) => {
              const dayDate = addDays(weekStart, dayOfWeek);
              const dayItems = (plan?.items || []).filter((item) => item.dayOfWeek === dayOfWeek);

              return (
                <div key={dayName} style={S.planDayCard}>
                  <div style={S.planDayHeader}>
                    <span style={S.planDayName}>{dayName}</span>
                    <span style={S.planDayDate}>{dayDate.getDate()}</span>
                  </div>
                  <div style={S.planDayBody}>
                    {KITCHEN_MEAL_TYPES.map((mealType) => {
                      const mealItems = dayItems.filter((item) => item.mealType === mealType);
                      return (
                        <div key={mealType} style={S.planSlot}>
                          <div style={S.planSlotTop}>
                            <span style={S.planSlotLabel}>{KITCHEN_MEAL_LABELS[mealType]}</span>
                            <button
                              type="button"
                              style={S.addMiniBtn}
                              onClick={() => setPickerState({ dayOfWeek, mealType })}
                            >
                              <CirclePlus size={13} strokeWidth={2.2} />
                              <span>Add</span>
                            </button>
                          </div>
                          {mealItems.length > 0 ? (
                            <div style={S.planItemStack}>
                              {mealItems.map((item) => (
                                <div key={item.id} style={S.planItem}>
                                  <div style={S.planItemInfo}>
                                    <span style={S.planItemTitle}>
                                      {item.recipe?.title || item.note || "Planned"}
                                    </span>
                                    {item.createdByUser && (
                                      <span style={S.planItemMeta}>
                                        Added by {item.createdByUser.displayName || item.createdByUser.username}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    style={S.iconBtn}
                                    onClick={() => void deleteKitchenPlanItem(item.id)}
                                  >
                                    <X size={14} strokeWidth={2.2} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p style={S.planEmpty}>Nothing here yet.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section style={{ ...S.card, marginBottom: 0 }} className="kitchen-section kitchen-section-manage">
          <div style={S.cardHeader}>
            <div>
              <p style={S.cardTitle}>{household.name}</p>
              <p style={S.cardSub}>
                {household.memberCount} of {household.memberLimit} seats filled
              </p>
            </div>
          </div>

          <div style={S.memberList}>
            {household.members.map((member) => (
              <div key={member.id} style={S.memberRow}>
                <div style={S.memberInfo}>
                  <span style={S.memberName}>{member.displayName || member.username}</span>
                  <span style={S.memberMeta}>{member.email}</span>
                </div>
                <div style={S.memberActions}>
                  {member.role === "owner" && (
                    <span style={S.ownerBadge}>
                      <span>Owner</span>
                    </span>
                  )}
                  {household.role === "owner" && member.id !== user?.id && (
                    <button
                      type="button"
                      style={S.iconBtn}
                      onClick={() => void runKitchenAction({ action: "remove_member", userId: member.id })}
                      disabled={saving}
                    >
                      <X size={14} strokeWidth={2.2} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {household.role === "owner" && household.remainingSlots > 0 && (
            <div style={S.inviteBlock}>
              <div style={S.inviteLabel}>
                <UserPlus size={15} strokeWidth={2.2} />
                <span>Add someone by email</span>
              </div>
              <div style={S.formStack}>
                <input
                  style={S.input}
                  type="email"
                  placeholder="friend@example.com"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                />
                <button
                  type="button"
                  style={S.primaryBtn}
                  onClick={() => void runKitchenAction({ action: "add_member", email: inviteEmail })}
                  disabled={saving || !inviteEmail.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            style={S.secondaryBtn}
            onClick={() => void runKitchenAction({ action: "leave" })}
            disabled={saving}
          >
            {household.role === "owner" ? "Delete kitchen" : "Leave kitchen"}
          </button>
          {error && <p style={S.error}>{error}</p>}
        </section>
      </div>

      {pickerState && (
        <div style={S.modalBackdrop} onClick={() => setPickerState(null)}>
          <div style={S.modal} onClick={(event) => event.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <p style={S.modalKicker}>Shared Plan</p>
                <h3 style={S.modalTitle}>
                  {DAY_NAMES[pickerState.dayOfWeek]} · {KITCHEN_MEAL_LABELS[pickerState.mealType]}
                </h3>
              </div>
              <button type="button" style={S.iconBtn} onClick={() => setPickerState(null)}>
                <X size={16} strokeWidth={2.2} />
              </button>
            </div>
            <div style={S.modalList}>
              <button type="button" style={S.noteBtn} onClick={() => void addKitchenPlanItem(undefined, "Takeout night")}>
                Takeout night
              </button>
              <button type="button" style={S.noteBtn} onClick={() => void addKitchenPlanItem(undefined, "Leftovers")}>
                Leftovers
              </button>
              {recipes.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  style={S.modalRecipeBtn}
                  onClick={() => void addKitchenPlanItem(recipe.id)}
                >
                  <div style={S.modalRecipeThumb}>
                    <RecipeImage
                      imageUrl={recipe.imageUrl}
                      title={recipe.title}
                      tags={recipe.tags}
                      sizes="48px"
                      iconSize={18}
                      imageStyle={S.modalRecipeImage}
                    />
                  </div>
                  <div style={S.modalRecipeInfo}>
                    <span style={S.modalRecipeTitle}>{recipe.title}</span>
                    {recipe.totalTime ? <span style={S.modalRecipeMeta}>{recipe.totalTime} min</span> : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {ideaPickerOpen && (
        <div style={S.modalBackdrop} onClick={() => setIdeaPickerOpen(false)}>
          <div style={S.modal} onClick={(event) => event.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <p style={S.modalKicker}>Meal Ideas</p>
                <h3 style={S.modalTitle}>Suggest from shared recipes</h3>
              </div>
              <button type="button" style={S.iconBtn} onClick={() => setIdeaPickerOpen(false)}>
                <X size={16} strokeWidth={2.2} />
              </button>
            </div>
            <div style={S.modalList}>
              {sharedRecipesForIdeaPicker.length > 0 ? (
                sharedRecipesForIdeaPicker.map((recipe) => (
                  <button
                    key={recipe.id}
                    type="button"
                    style={S.modalRecipeBtn}
                    onClick={() => void addIdea(recipe.id)}
                  >
                    <div style={S.modalRecipeThumb}>
                      <RecipeImage
                        imageUrl={recipe.imageUrl}
                        title={recipe.title}
                        tags={recipe.tags}
                        sizes="48px"
                        iconSize={18}
                        imageStyle={S.modalRecipeImage}
                      />
                    </div>
                    <div style={S.modalRecipeInfo}>
                      <span style={S.modalRecipeTitle}>{recipe.title}</span>
                      {recipe.user ? (
                        <span style={S.modalRecipeMeta}>
                          Shared by {recipe.user.displayName || recipe.user.username}
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))
              ) : (
                <p style={S.emptyHint}>All shared recipes are already in the ideas queue.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { background: "rgb(var(--warm-50))", padding: "24px 16px 16px" },
  shell: { maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column" },
  header: { marginBottom: 22 },
  kicker: { fontSize: 12, fontWeight: 700, color: "rgb(var(--terra-600))", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 },
  title: { fontSize: 34, lineHeight: 1.08, color: "rgb(var(--warm-900))", fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)", marginBottom: 8 },
  sub: { fontSize: 15, color: "rgb(var(--warm-600))", lineHeight: 1.6 },
  card: { background: "white", borderRadius: "var(--radius-card-inner)", padding: "0 16px 16px", border: "1px solid rgb(var(--warm-100))", marginBottom: 28 },
  cardHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "16px 0 12px", borderBottom: "1px solid rgb(var(--warm-100))" },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "rgb(var(--warm-900))",
    fontFamily: "var(--font-serif)",
    letterSpacing: "var(--tracking-brand)",
  },
  cardSub: { fontSize: 12, color: "rgb(var(--warm-500))", marginTop: 4 },
  memberList: { display: "flex", flexDirection: "column" },
  memberRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "14px 0", borderBottom: "1px solid rgb(var(--warm-100))" },
  memberInfo: { display: "flex", flexDirection: "column", gap: 2 },
  memberName: { fontSize: 14, fontWeight: 600, color: "rgb(var(--warm-800))" },
  memberMeta: { fontSize: 12, color: "rgb(var(--warm-400))" },
  memberActions: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  ownerBadge: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgb(var(--terra-700))", fontWeight: 700 },
  iconBtn: { width: 28, height: 28, borderRadius: 999, border: "1px solid rgb(var(--warm-200))", background: "white", color: "rgb(var(--warm-500))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 },
  inviteBlock: { paddingTop: 16, marginTop: 4, display: "flex", flexDirection: "column", gap: 10 },
  inviteLabel: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "rgb(var(--warm-700))" },
  formStack: { display: "flex", flexDirection: "column", gap: 10 },
  input: { width: "100%", border: "1.5px solid rgb(var(--warm-200))", borderRadius: "var(--radius-input)", padding: "11px 14px", fontSize: 14, background: "white", color: "rgb(var(--warm-900))", outline: "none" },
  primaryBtn: { background: "rgb(var(--terra-600))", color: "white", border: "none", borderRadius: "var(--radius-control)", padding: "11px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  primaryGhostBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "transparent",
    color: "rgb(var(--terra-600))",
    border: "none",
    padding: "0",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
  },
  secondaryBtn: { width: "100%", marginTop: 16, background: "white", color: "rgb(var(--warm-700))", border: "1px solid rgb(var(--warm-200))", borderRadius: "var(--radius-control)", padding: "11px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  error: { marginTop: 10, fontSize: 13, color: "rgb(var(--terra-700))" },
  sectionCard: { background: "white", border: "1px solid rgb(var(--warm-100))", borderRadius: "var(--radius-card)", padding: "18px 16px", marginBottom: 28 },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" as const },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: "rgb(var(--warm-900))", fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)" },
  sectionSub: { fontSize: 13, color: "rgb(var(--warm-500))", marginTop: 4 },
  inlineLink: { display: "inline-flex", alignItems: "center", gap: 6, color: "rgb(var(--terra-600))", textDecoration: "none", fontSize: 14, fontWeight: 600 },
  weekNav: { display: "inline-flex", alignItems: "center", gap: 8 },
  weekBtn: { width: 32, height: 32, borderRadius: "var(--radius-pill)", border: "1px solid rgb(var(--warm-200))", background: "white", color: "rgb(var(--warm-700))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  weekBtnSpacer: { width: 32, height: 32, flexShrink: 0 },
  weekLabel: { fontSize: 13, fontWeight: 700, color: "rgb(var(--warm-700))", minWidth: 120, textAlign: "center" },
  dayFocus: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, minWidth: 0, textAlign: "center", flex: 1 },
  dayFocusDate: { fontSize: 18, lineHeight: 1.15, fontWeight: 700, color: "rgb(var(--warm-900))", fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)" },
  dayFocusRange: { fontSize: 11, lineHeight: 1.35, color: "rgb(var(--warm-500))" },
  planMobileWrap: { display: "grid", gap: 12, width: "100%" },
  planGrid: { display: "grid", gap: 12 },
  planDayCard: { width: "100%", background: "rgb(var(--warm-50))", border: "1px solid rgb(var(--warm-100))", borderRadius: "var(--radius-card-inner)", padding: "12px 12px 10px" },
  planDayHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  planDayName: { fontSize: 12, fontWeight: 700, color: "rgb(var(--terra-700))", textTransform: "uppercase", letterSpacing: "0.06em" },
  planDayDate: { fontSize: 12, color: "rgb(var(--warm-500))", fontWeight: 600 },
  planDayBody: { display: "flex", flexDirection: "column", gap: 10 },
  planSlot: { background: "white", border: "1px solid rgb(var(--warm-100))", borderRadius: "var(--radius-control)", padding: "10px 10px 8px" },
  planSlotTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  planSlotLabel: { fontSize: 12, fontWeight: 700, color: "rgb(var(--warm-600))" },
  addMiniBtn: { display: "inline-flex", alignItems: "center", gap: 5, borderRadius: "var(--radius-pill)", border: "1px solid rgb(var(--warm-200))", background: "white", color: "rgb(var(--terra-600))", fontSize: 12, fontWeight: 700, padding: "5px 9px", cursor: "pointer" },
  planItemStack: { display: "flex", flexDirection: "column", gap: 8 },
  planItem: { display: "flex", alignItems: "flex-start", gap: 8, justifyContent: "space-between" },
  planItemInfo: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 },
  planItemTitle: { fontSize: 13, color: "rgb(var(--warm-800))", fontWeight: 600, lineHeight: 1.4 },
  planItemMeta: { fontSize: 12, color: "rgb(var(--warm-500))" },
  planEmpty: { fontSize: 12, color: "rgb(var(--warm-400))", fontStyle: "italic", padding: "4px 0 2px" },
  ideaStack: { display: "flex", flexDirection: "column", gap: 12 },
  ideaCard: { display: "flex", gap: 14, padding: "12px", border: "1px solid rgb(var(--warm-100))", borderRadius: "var(--radius-card-inner)", background: "rgb(var(--warm-50))", alignItems: "stretch" },
  ideaMedia: { width: 88, minWidth: 88, borderRadius: "var(--radius-control)", overflow: "hidden", background: "rgb(var(--warm-100))", position: "relative" },
  ideaImage: { objectFit: "cover" },
  ideaBody: { flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 },
  ideaHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  ideaTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "rgb(var(--warm-900))",
    fontFamily: "var(--font-serif)",
    letterSpacing: "var(--tracking-brand)",
    lineHeight: 1.4,
  },
  ideaMeta: { fontSize: 12, color: "rgb(var(--warm-500))", marginTop: 3 },
  voteRow: { display: "flex", flexWrap: "wrap" as const, gap: 8 },
  voteBtn: { display: "inline-flex", alignItems: "center", gap: 8, borderRadius: "var(--radius-pill)", border: "1px solid rgb(var(--warm-200))", background: "white", color: "rgb(var(--warm-700))", padding: "8px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  voteBtnActive: { background: "rgb(var(--terra-50))", border: "1px solid rgb(var(--terra-200))", color: "rgb(var(--terra-700))" },
  voteCount: { fontSize: 11, color: "rgb(var(--warm-500))" },
  recipeGrid: { display: "grid", gap: 14, alignItems: "start" },
  recipeCard: { display: "flex", flexDirection: "column", textDecoration: "none", background: "white", border: "1px solid rgb(var(--warm-100))", borderRadius: "var(--radius-card-inner)", overflow: "hidden" },
  recipeThumb: { aspectRatio: "16 / 10", position: "relative", background: "rgb(var(--warm-100))" },
  recipeImage: { objectFit: "cover" },
  recipeBody: { padding: "10px 12px 12px", display: "flex", flexDirection: "column", minHeight: 56, gap: 6 },
  recipeTitle: {
    fontSize: 14,
    lineHeight: 1.35,
    fontWeight: 700,
    color: "rgb(var(--warm-900))",
    fontFamily: "var(--font-serif)",
    letterSpacing: "var(--tracking-brand)",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  recipeOwner: { fontSize: 12, color: "rgb(var(--warm-500))", marginTop: "auto", textAlign: "left" },
  emptyWrap: { maxWidth: 520, margin: "72px auto 0", padding: "32px 24px", background: "white", border: "1px solid rgb(var(--warm-100))", borderRadius: "var(--radius-modal)", textAlign: "center" },
  emptyIcon: { width: 44, height: 44, borderRadius: "50%", background: "rgb(var(--terra-50))", color: "rgb(var(--terra-600))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" },
  emptyTitle: { fontSize: 24, fontWeight: 700, color: "rgb(var(--warm-900))", fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)", marginBottom: 8 },
  emptyText: { fontSize: 14, color: "rgb(var(--warm-600))", lineHeight: 1.6 },
  emptyHint: { fontSize: 13, color: "rgb(var(--warm-500))", marginTop: 6 },
  emptyRecipes: { background: "white", border: "1px solid rgb(var(--warm-100))", borderRadius: "var(--radius-card)", padding: "24px 20px", textAlign: "center" },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(22, 18, 15, 0.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 120 },
  modal: { width: "100%", maxWidth: 520, background: "rgb(var(--warm-50))", borderRadius: "var(--radius-modal)", border: "1px solid rgb(var(--warm-100))", padding: 16, maxHeight: "80vh", overflowY: "auto" as const },
  modalHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 },
  modalKicker: { fontSize: 11, fontWeight: 700, color: "rgb(var(--terra-600))", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 },
  modalTitle: { fontSize: 20, fontWeight: 700, color: "rgb(var(--warm-900))", fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)" },
  modalList: { display: "flex", flexDirection: "column", gap: 10 },
  noteBtn: { width: "100%", textAlign: "left", background: "white", border: "1px solid rgb(var(--warm-100))", borderRadius: "var(--radius-control)", padding: "12px 14px", fontSize: 14, fontWeight: 600, color: "rgb(var(--warm-800))", cursor: "pointer" },
  modalRecipeBtn: { width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: "white", border: "1px solid rgb(var(--warm-100))", borderRadius: "var(--radius-control)", padding: "10px", cursor: "pointer" },
  modalRecipeThumb: { width: 48, height: 48, minWidth: 48, borderRadius: "var(--radius-control)", overflow: "hidden", position: "relative", background: "rgb(var(--warm-100))" },
  modalRecipeImage: { objectFit: "cover" },
  modalRecipeInfo: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 },
  modalRecipeTitle: { fontSize: 14, fontWeight: 700, color: "rgb(var(--warm-900))", lineHeight: 1.35 },
  modalRecipeMeta: { fontSize: 12, color: "rgb(var(--warm-500))" },
  state: { minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", color: "rgb(var(--warm-600))", background: "rgb(var(--warm-50))", padding: 24 },
};
