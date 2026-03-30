"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Check, ChefHat, Download, Heart, Share2, ShoppingCart, Timer as TimerIcon, Users } from "lucide-react";
import type { Household, Recipe } from "@/types";
import { scaleAmountText } from "@/lib/measurements";
import { RECIPE_TYPE_OPTIONS, formatRecipeType, getRecipeType, isImportedRecipe, setRecipeTypeTag, stripRecipeTypeTags, type RecipeType } from "@/lib/recipe-taxonomy";
import { RecipeImage } from "@/components/recipe-image";
import { useAuth } from "@/context/auth-context";

export default function RecipeDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ingredients" | "steps">("ingredients");
  const [servingScale, setServingScale] = useState(1);
  const [addedToGrocery, setAddedToGrocery] = useState(false);
  const [movingFolder, setMovingFolder] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sharingWithKitchen, setSharingWithKitchen] = useState(false);
  const [household, setHousehold] = useState<Household | null>(null);

  useEffect(() => {
    fetch(`/api/recipes/${id}`)
      .then((r) => r.json())
      .then((json) => { setRecipe(json.data); setLoading(false); });
  }, [id]);

  useEffect(() => {
    fetch("/api/household", { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : null)
      .then((json) => {
        if (json?.data) {
          setHousehold(json.data);
        }
      })
      .catch(() => {
        setHousehold(null);
      });
  }, []);

  const toggleFavorite = async () => {
    if (!recipe) return;
    const res = await fetch(`/api/recipes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: !recipe.isFavorite }),
    });
    const json = await res.json();
    setRecipe(json.data);
  };

  const addToGrocery = async () => {
    await fetch("/api/grocery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_from_recipe", recipeId: id, servingScale }),
    });
    setAddedToGrocery(true);
    setTimeout(() => setAddedToGrocery(false), 2500);
  };

  const moveToFolder = async (nextType: string) => {
    if (!recipe) return;
    setMovingFolder(true);
    const nextTags = setRecipeTypeTag(stripRecipeTypeTags(recipe.tags), nextType as RecipeType | "");

    const res = await fetch(`/api/recipes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tags: nextTags,
      }),
    });
    if (res.ok) {
      setRecipe((current) => (current ? { ...current, tags: nextTags } : current));
    }
    setMovingFolder(false);
  };

  const deleteRecipe = async () => {
    if (!confirm("Delete this recipe?")) return;
    await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    router.push("/recipes");
  };

  const exportRecipe = async () => {
    setExporting(true);
    try {
      window.open(`/recipes/${id}/print`, "_blank", "noopener,noreferrer");
    } finally {
      setExporting(false);
    }
  };

  const shareRecipe = async () => {
    if (!recipe) return;
    setSharing(true);
    try {
      const res = await fetch(`/api/recipes/${id}/export`);
      if (!res.ok) throw new Error("Failed to prepare recipe share");

      const markdown = await res.text();
      const url = window.location.href;

      if (navigator.share) {
        await navigator.share({
          title: recipe.title,
          text: markdown,
          url,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${markdown}\n\n${url}`.trim());
        alert("Recipe copied so you can paste it into Messages, Notes, or email.");
        return;
      }

      await exportRecipe();
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("[share recipe]", error);
      }
    } finally {
      setSharing(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!recipe) return <div style={{ padding: 24, textAlign: "center" }}>Recipe not found.</div>;

  const ingredients = Array.isArray(recipe.ingredients)
    ? (recipe.ingredients as Array<{ id?: string; amount?: string; unit?: string; name: string; notes?: string }>)
    : [];
  const steps = Array.isArray(recipe.steps)
    ? (recipe.steps as Array<{ id?: string; order: number; instruction: string; timerSeconds?: number }>)
    : [];
  const mins = recipe.totalTime || (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  const recipeType = getRecipeType(recipe.tags);
  const imported = isImportedRecipe(recipe.tags);
  const isOwner = recipe.userId === user?.id;
  const canShareWithKitchen = Boolean(isOwner && household);
  const ownerLabel = recipe.user?.displayName || recipe.user?.username || "Shared kitchen";

  const toggleKitchenShare = async () => {
    if (!recipe || !household || !isOwner) return;
    setSharingWithKitchen(true);
    try {
      const res = await fetch(`/api/recipes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: recipe.householdId ? null : household.id,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setRecipe(json.data);
      }
    } finally {
      setSharingWithKitchen(false);
    }
  };

  return (
    <div style={S.page} className="recipe-detail-shell">
      <div style={S.heroWrap} className="recipe-detail-hero">
        <RecipeImage
          imageUrl={recipe.imageUrl}
          title={recipe.title}
          tags={recipe.tags}
          sizes="100vw"
          iconSize={40}
          showLabel
          imageStyle={S.heroImg}
        />
          <div style={S.heroOverlay} />
          <button onClick={() => router.back()} style={S.backBtn}>
            <ArrowLeft size={18} strokeWidth={2.2} />
          </button>
          {isOwner && (
            <button onClick={toggleFavorite} style={S.favBtn}>
              <Heart size={18} strokeWidth={2.2} fill={recipe.isFavorite ? "currentColor" : "none"} />
            </button>
          )}
      </div>

      <div style={S.content} className="recipe-detail-content">
        {/* Title & meta */}
        <div style={S.titleWrap}>
          <h1 style={S.title}>{recipe.title}</h1>
          {imported && <span style={S.importedBadge}>Imported</span>}
          {!isOwner && (
            <p style={S.sharedBy}>Shared by {ownerLabel}</p>
          )}
          {recipe.description && <p style={S.desc}>{recipe.description}</p>}
        </div>

        {/* Quick stats */}
        <div style={S.stats}>
          {recipe.prepTime && <Stat label="Prep" value={`${recipe.prepTime}m`} />}
          {recipe.cookTime && <Stat label="Cook" value={`${recipe.cookTime}m`} />}
          {mins > 0 && <Stat label="Total" value={`${mins}m`} />}
          {recipe.servings && <Stat label="Serves" value={String(recipe.servings)} />}
          {recipe.difficulty && <Stat label="Level" value={recipe.difficulty} />}
        </div>

        <div style={S.controlsRow}>
          {/* Servings scale */}
          <div style={S.scaleRow}>
            <span style={S.scaleLabel}>Servings</span>
            <div style={S.scaleControls}>
              <button
                style={S.scaleBtn}
                onClick={() => setServingScale(Math.max(0.5, servingScale - 0.5))}
              >−</button>
              <span style={S.scaleValue}>
                {recipe.servings
                  ? Math.round(recipe.servings * servingScale * 10) / 10
                  : `×${servingScale}`}
              </span>
              <button
                style={S.scaleBtn}
                onClick={() => setServingScale(servingScale + 0.5)}
              >+</button>
            </div>
          </div>

          <div style={S.folderRow}>
            <span style={S.folderLabel}>Folder</span>
            <select
              style={S.folderSelect}
              value={recipeType || ""}
              onChange={(e) => { void moveToFolder(e.target.value); }}
              disabled={movingFolder || !isOwner}
            >
              <option value="">Unsorted</option>
              {RECIPE_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {formatRecipeType(type)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {canShareWithKitchen && (
          <button onClick={() => void toggleKitchenShare()} style={S.householdShareBtn} disabled={sharingWithKitchen}>
            <Users size={16} strokeWidth={2.2} />
            <span>
              {sharingWithKitchen
                ? "Updating kitchen share…"
                : recipe.householdId
                  ? `Shared with ${household?.name || "your kitchen"}`
                  : `Share with ${household?.name || "your kitchen"}`}
            </span>
          </button>
        )}

        <div style={S.recipeSectionCard}>
          {/* Tabs */}
          <div style={S.tabs}>
            <button
              style={{ ...S.tab, ...(tab === "ingredients" ? S.tabActive : {}) }}
              onClick={() => setTab("ingredients")}
            >
              Ingredients ({ingredients.length})
            </button>
            <button
              style={{ ...S.tab, ...(tab === "steps" ? S.tabActive : {}) }}
              onClick={() => setTab("steps")}
            >
              Steps ({steps.length})
            </button>
          </div>

          {tab === "ingredients" && (
            <ul style={S.ingredientList} className="recipe-copy">
              {ingredients.map((ing, i) => {
                const amount = scaleAmountText(ing.amount, servingScale);
                return (
                  <li
                    key={ing.id || i}
                    style={{
                      ...S.ingredientItem,
                      ...(i === ingredients.length - 1 ? S.ingredientItemLast : {}),
                    }}
                  >
                    <span style={S.ingredientAmount}>
                      {[amount, ing.unit].filter(Boolean).join(" ")}
                    </span>
                    <span style={S.ingredientName}>{ing.name}</span>
                    {ing.notes && <span style={S.ingredientNotes}>{ing.notes}</span>}
                  </li>
                );
              })}
            </ul>
          )}

          {tab === "steps" && (
            <ol style={S.stepList} className="recipe-copy">
              {steps.map((step, i) => (
                <li
                  key={step.id || i}
                  style={{
                    ...S.stepItem,
                    ...(i === steps.length - 1 ? S.stepItemLast : {}),
                  }}
                >
                  <div style={S.stepNum}>{i + 1}</div>
                  <div style={S.stepBody}>
                    <p style={S.stepText}>{step.instruction}</p>
                    {step.timerSeconds && (
                      <div style={S.stepTimer}>
                        <TimerIcon size={12} strokeWidth={2.2} />
                        <span>{Math.floor(step.timerSeconds / 60)}:{String(step.timerSeconds % 60).padStart(2, "0")}</span>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Notes */}
        {recipe.notes && (
          <div style={S.notesBox} className="recipe-copy">
            <h3 style={S.notesTitle}>Notes</h3>
            <p style={S.notesText}>{recipe.notes}</p>
          </div>
        )}

        {/* Source */}
        {recipe.sourceUrl && (
          <p style={S.source}>
            Source:{" "}
            <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" style={S.sourceLink}>
              {new URL(recipe.sourceUrl).hostname}
            </a>
          </p>
        )}

        {/* Actions */}
        <div style={S.actions}>
          <Link href={`/recipes/${id}/cook`} style={S.cookBtn}>
            <ChefHat size={16} strokeWidth={2.2} />
            <span>Start Cooking</span>
          </Link>
          <button onClick={addToGrocery} style={S.groceryBtn}>
            {addedToGrocery ? (
              <>
                <Check size={16} strokeWidth={2.6} />
                <span>Added!</span>
              </>
            ) : (
              <>
                <ShoppingCart size={16} strokeWidth={2.2} />
                <span>Add to Grocery</span>
              </>
            )}
          </button>
        </div>

        <div style={S.secondaryActions}>
          <button onClick={() => void shareRecipe()} style={S.secondaryBtn} disabled={sharing}>
            <Share2 size={15} strokeWidth={2.1} />
            <span>{sharing ? "Sharing…" : "Share"}</span>
          </button>
          <button onClick={() => void exportRecipe()} style={S.secondaryBtn} disabled={exporting}>
            <Download size={15} strokeWidth={2.1} />
            <span>{exporting ? "Exporting…" : "Export"}</span>
          </button>
          {isOwner && <Link href={`/recipes/${id}/edit`} style={S.editBtn}>Edit</Link>}
          {isOwner && <button onClick={deleteRecipe} style={S.deleteBtn}>Delete</button>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "rgb(var(--warm-500))", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "rgb(var(--warm-800))", textTransform: "capitalize" }}>{value}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
      <div style={{ height: 240, background: "rgb(var(--warm-200))", borderRadius: 16 }} />
      <div style={{ height: 28, background: "rgb(var(--warm-200))", borderRadius: 8, width: "70%" }} />
      <div style={{ height: 16, background: "rgb(var(--warm-100))", borderRadius: 8, width: "90%" }} />
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { background: "rgb(var(--warm-50))", minHeight: "100dvh" },
  heroWrap: { position: "relative", aspectRatio: "4/3", maxHeight: 320, overflow: "hidden" },
  heroImg: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center center" },
  heroOverlay: { position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%)" },
  backBtn: { position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: 36, height: 36, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  favBtn: { position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: 36, height: 36, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgb(var(--terra-600))" },
  content: { padding: "20px 16px 32px" },
  titleWrap: { marginBottom: 16 },
  title: { fontSize: 26, fontWeight: 700, color: "rgb(var(--warm-900))", fontFamily: "var(--font-serif)", lineHeight: 1.2, marginBottom: 8 },
  importedBadge: {
    display: "inline-flex",
    alignItems: "center",
    marginBottom: 8,
    padding: "4px 10px",
    borderRadius: 999,
    background: "rgb(var(--terra-50))",
    border: "1px solid rgb(var(--terra-200))",
    color: "rgb(var(--terra-700))",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  desc: { fontSize: 14, color: "rgb(var(--warm-600))", lineHeight: 1.6 },
  sharedBy: { fontSize: 13, color: "rgb(var(--terra-700))", marginBottom: 8, fontWeight: 600 },
  stats: { display: "flex", gap: 16, background: "white", borderRadius: 14, padding: "14px 16px", marginBottom: 14, border: "1px solid rgb(var(--warm-100))", justifyContent: "space-around" },
  controlsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16, alignItems: "stretch" },
  scaleRow: { display: "flex", flexDirection: "column", gap: 8, minWidth: 0, alignItems: "center", justifyContent: "space-between", height: "100%" },
  scaleLabel: { fontSize: 12, color: "rgb(var(--warm-500))", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" },
  scaleControls: { display: "flex", alignItems: "center", gap: 8 },
  scaleBtn: { background: "rgb(var(--warm-100))", border: "none", borderRadius: "50%", width: 28, height: 28, fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgb(var(--warm-800))" },
  scaleValue: { fontSize: 14, fontWeight: 700, color: "rgb(var(--warm-900))", minWidth: 28, textAlign: "center" },
  folderRow: { display: "flex", flexDirection: "column", gap: 8, minWidth: 0, justifyContent: "space-between", height: "100%" },
  folderLabel: { fontSize: 12, color: "rgb(var(--warm-500))", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center" },
  folderSelect: {
    borderWidth: "1.5px", borderStyle: "solid", borderColor: "rgb(var(--warm-200))",
    borderRadius: 10, padding: "8px 10px", fontSize: 12, color: "rgb(var(--warm-800))",
    background: "white", outline: "none", width: "100%",
  },
  householdShareBtn: {
    width: "100%",
    marginBottom: 16,
    background: "rgb(var(--terra-600))",
    color: "white",
    border: "none",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  recipeSectionCard: {
    background: "white",
    border: "1px solid rgb(var(--warm-100))",
    borderRadius: 16,
    padding: "14px 14px 4px",
    marginBottom: 20,
  },
  tabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 0,
    background: "rgb(var(--warm-200))",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    border: "1px solid rgb(var(--warm-200))",
  },
  tab: {
    background: "transparent",
    border: "none",
    borderRadius: 8,
    padding: "10px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    color: "rgb(var(--warm-600))",
    transition: "all 0.15s",
  },
  tabActive: { background: "white", color: "rgb(var(--warm-900))", fontWeight: 700 },
  ingredientList: { listStyle: "none", display: "flex", flexDirection: "column", gap: 0 },
  ingredientItem: { display: "flex", alignItems: "baseline", gap: 8, padding: "10px 0", borderBottom: "1px solid rgb(var(--warm-100))" },
  ingredientItemLast: { borderBottom: "none" },
  ingredientAmount: { fontSize: 13, fontWeight: 600, color: "rgb(var(--terra-700))", minWidth: 56, flexShrink: 0 },
  ingredientName: { fontSize: 14, color: "rgb(var(--warm-800))", flex: 1 },
  ingredientNotes: { fontSize: 12, color: "rgb(var(--warm-400))", fontStyle: "italic" },
  stepList: { paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 0 },
  stepItem: { display: "flex", gap: 14, padding: "14px 0", borderBottom: "1px solid rgb(var(--warm-100))" },
  stepItemLast: { borderBottom: "none" },
  stepNum: { width: 28, height: 28, borderRadius: "50%", background: "rgb(var(--terra-600))", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 },
  stepBody: { flex: 1 },
  stepText: { fontSize: 15, color: "rgb(var(--warm-800))", lineHeight: 1.7 },
  stepTimer: { marginTop: 6, fontSize: 12, color: "rgb(var(--warm-500))", background: "rgb(var(--warm-100))", padding: "3px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 6 },
  notesBox: { marginTop: 20, background: "rgb(var(--terra-50))", borderRadius: 12, padding: "14px 16px", border: "1px solid rgb(var(--terra-200))" },
  notesTitle: { fontSize: 12, fontWeight: 700, color: "rgb(var(--terra-700))", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" },
  notesText: { fontSize: 14, color: "rgb(var(--warm-700))", lineHeight: 1.6 },
  source: { marginTop: 12, fontSize: 12, color: "rgb(var(--warm-400))" },
  sourceLink: { color: "rgb(var(--terra-600))", textDecoration: "none" },
  actions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 24 },
  cookBtn: { background: "rgb(var(--terra-600))", color: "white", borderRadius: 12, padding: "14px", fontSize: 14, fontWeight: 700, textDecoration: "none", textAlign: "center", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 },
  groceryBtn: { background: "white", color: "rgb(var(--warm-700))", border: "1.5px solid rgb(var(--warm-200))", borderRadius: 12, padding: "14px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryActions: { display: "flex", gap: 12, marginTop: 12, justifyContent: "center", flexWrap: "wrap" },
  secondaryBtn: { background: "white", color: "rgb(var(--warm-700))", border: "1.5px solid rgb(var(--warm-200))", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 },
  editBtn: { fontSize: 13, color: "rgb(var(--warm-500))", textDecoration: "none", padding: "10px 14px", border: "1.5px solid rgb(var(--warm-200))", borderRadius: 10, background: "white" },
  deleteBtn: { background: "white", border: "1.5px solid rgb(var(--terra-200))", borderRadius: 10, fontSize: 13, color: "rgb(var(--terra-600))", cursor: "pointer", padding: "10px 14px" },
};
