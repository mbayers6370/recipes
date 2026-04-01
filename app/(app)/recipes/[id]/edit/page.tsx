"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ChevronUp, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import type { Recipe } from "@/types";
import { RECIPE_TYPE_OPTIONS, getRecipeType, setRecipeTypeTag, stripRecipeTypeTags, type RecipeType } from "@/lib/recipe-taxonomy";
import { normalizeExternalUrl } from "@/lib/url";
import { normalizeIngredientUnit } from "@/lib/ingredient-units";
import { UnitCombobox } from "@/components/unit-combobox";

type IngredientForm = { id?: string; name: string; amount: string; unit: string };
type StepForm = { id?: string; instruction: string };

export default function EditRecipePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    imageUrl: "",
    recipeType: "",
    servings: "",
    prepTime: "",
    cookTime: "",
    difficulty: "",
    cuisine: "",
    notes: "",
  });
  const [ingredients, setIngredients] = useState<IngredientForm[]>([]);
  const [steps, setSteps] = useState<StepForm[]>([]);
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const [resolvedImageUrl, setResolvedImageUrl] = useState("");
  const [resolvingImage, setResolvingImage] = useState(false);
  const previewImageUrl = resolvedImageUrl || (isLikelyDirectImageUrl(form.imageUrl) ? form.imageUrl : "");
  const hasPreviewImage = isValidImageUrl(previewImageUrl);

  useEffect(() => {
    fetch(`/api/recipes/${id}`)
      .then((res) => res.json())
      .then((json) => {
        const recipe = json.data as Recipe | null;
        if (!recipe) throw new Error("Recipe not found");

        setForm({
          title: recipe.title || "",
          description: recipe.description || "",
          imageUrl: recipe.sourceUrl || recipe.imageUrl || "",
          recipeType: getRecipeType(recipe.tags) || "",
          servings: recipe.servings ? String(recipe.servings) : "",
          prepTime: recipe.prepTime ? String(recipe.prepTime) : "",
          cookTime: recipe.cookTime ? String(recipe.cookTime) : "",
          difficulty: recipe.difficulty || "",
          cuisine: recipe.cuisine || "",
          notes: recipe.notes || "",
        });
        setResolvedImageUrl(recipe.imageUrl || "");
        setExtraTags(stripRecipeTypeTags(recipe.tags));
        setIngredients(
          (recipe.ingredients || []).map((ingredient) => ({
            id: ingredient.id,
            name: ingredient.name || "",
            amount: ingredient.amount || "",
            unit: ingredient.unit || "",
          }))
        );
        setSteps(
          (recipe.steps || []).map((step) => ({
            id: step.id,
            instruction: step.instruction || "",
          }))
        );
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  const setField =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const adjustNumericField = (key: "servings" | "prepTime" | "cookTime", min = 0, delta: 1 | -1) => {
    setForm((prev) => {
      const current = parseInt(prev[key] || "0", 10);
      const next = Math.max(min, (Number.isFinite(current) ? current : 0) + delta);
      return { ...prev, [key]: String(next) };
    });
  };

  const handleImageUrlBlur = async () => {
    const value = normalizeExternalUrl(form.imageUrl);
    if (!value) {
      setResolvedImageUrl("");
      return;
    }

    if (isLikelyDirectImageUrl(value)) {
      setResolvedImageUrl(value);
      return;
    }

    setResolvingImage(true);

    try {
      const res = await fetch("/api/recipes/resolve-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const json = await res.json();

      if (res.ok && json.data?.imageUrl) {
        setResolvedImageUrl(json.data.imageUrl);
      } else {
        setResolvedImageUrl("");
        setError(json.error || "We couldn't resolve an image from that URL.");
      }
    } catch {
      setResolvedImageUrl("");
      setError("We couldn't resolve an image from that URL.");
    } finally {
      setResolvingImage(false);
    }
  };

  const updateIngredient = (index: number, key: keyof IngredientForm, value: string) => {
    setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const updateStep = (index: number, key: keyof StepForm, value: string) => {
    setSteps((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const addIngredient = () => {
      setIngredients((prev) => [...prev, { name: "", amount: "", unit: "" }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const moveIngredient = (index: number, direction: "up" | "down") => {
    setIngredients((prev) => {
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;

      const next = [...prev];
      const [ingredient] = next.splice(index, 1);
      next.splice(nextIndex, 0, ingredient);
      return next;
    });
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { instruction: "" }]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }

    setSaving(true);
    setError("");

    const imageInput = normalizeExternalUrl(form.imageUrl);
    const directImageUrl = imageInput && isLikelyDirectImageUrl(imageInput) ? imageInput : undefined;
    const sourceUrl = imageInput && !isLikelyDirectImageUrl(imageInput) ? imageInput : undefined;
    const imageUrl = directImageUrl || resolvedImageUrl || undefined;

    const body = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      imageUrl,
      sourceUrl,
      servings: form.servings ? parseInt(form.servings, 10) : undefined,
      prepTime: form.prepTime ? parseInt(form.prepTime, 10) : undefined,
      cookTime: form.cookTime ? parseInt(form.cookTime, 10) : undefined,
      difficulty: form.difficulty || undefined,
      cuisine: form.cuisine.trim() || undefined,
      tags: setRecipeTypeTag(extraTags, form.recipeType as RecipeType | ""),
      notes: form.notes.trim() || undefined,
      ingredients: ingredients
        .filter((ingredient) => ingredient.name.trim())
        .map((ingredient) => ({
          ...(ingredient.id ? { id: ingredient.id } : {}),
          name: ingredient.name.trim(),
          amount: ingredient.amount.trim() || undefined,
          unit: normalizeIngredientUnit(ingredient.unit) || undefined,
        })),
      steps: steps
        .filter((step) => step.instruction.trim())
        .map((step, index) => ({
          ...(step.id ? { id: step.id } : {}),
          order: index,
          instruction: step.instruction.trim(),
        })),
    };

    const res = await fetch(`/api/recipes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Failed to save recipe");
      setSaving(false);
      return;
    }

    router.push(`/recipes/${id}`);
  };

  if (loading) return <div style={S.loading}>Loading recipe…</div>;

  return (
    <div style={S.page}>
      <div style={S.header} className="page-header">
        <h1 style={S.title} className="page-header-title">Edit Recipe</h1>
        <div style={S.headerActions} className="page-header-actions">
          <button onClick={() => router.back()} style={S.backBtn}>
            <ArrowLeft size={16} strokeWidth={2.2} />
            <span>Back</span>
          </button>
          <button onClick={handleSave} disabled={saving} style={S.saveBtn}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div style={S.form}>
        <Field label="Title *">
          <input style={S.input} value={form.title} onChange={setField("title")} placeholder="Recipe title" />
        </Field>

        <Field label="Description">
          <textarea style={{ ...S.input, ...S.textarea }} value={form.description} onChange={setField("description")} rows={2} />
        </Field>

        <Field label="Recipe image URL">
          <input
            style={S.input}
            type="text"
            inputMode="url"
            value={form.imageUrl}
            onChange={(e) => {
              setResolvedImageUrl("");
              setField("imageUrl")(e);
            }}
            onBlur={() => void handleImageUrlBlur()}
            placeholder="https://example.com/recipe.jpg"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>

        <div style={S.imagePreviewCard}>
          {hasPreviewImage ? (
            <div style={S.imagePreviewWrap}>
              <img
                src={previewImageUrl}
                alt={form.title || "Recipe preview"}
                style={S.imagePreview}
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div style={S.imagePlaceholder}>
              <UtensilsCrossed size={28} strokeWidth={2} />
              <span>No recipe image yet</span>
            </div>
          )}
        </div>
        {resolvingImage ? <p style={S.helperText}>Resolving recipe image…</p> : null}

        <div style={S.row} className="recipe-form-row">
          <Field label="Folder" style={S.metaField}>
            <SelectControl>
              <select style={{ ...S.input, ...S.metaControl, ...S.metaSelect }} value={form.recipeType} onChange={setField("recipeType")}>
                <option value="">Unsorted</option>
                {RECIPE_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </SelectControl>
          </Field>
          <Field label="Prep (min)" style={S.metaField}>
            <NumberControl
              value={form.prepTime}
              onChange={(value) => setForm((prev) => ({ ...prev, prepTime: value }))}
              onIncrement={() => adjustNumericField("prepTime", 0, 1)}
              onDecrement={() => adjustNumericField("prepTime", 0, -1)}
            />
          </Field>
          <Field label="Cook (min)" style={S.metaField}>
            <NumberControl
              value={form.cookTime}
              onChange={(value) => setForm((prev) => ({ ...prev, cookTime: value }))}
              onIncrement={() => adjustNumericField("cookTime", 0, 1)}
              onDecrement={() => adjustNumericField("cookTime", 0, -1)}
            />
          </Field>
        </div>

        <div style={S.row} className="recipe-form-row">
          <Field label="Serves" style={S.metaField}>
            <NumberControl
              value={form.servings}
              onChange={(value) => setForm((prev) => ({ ...prev, servings: value }))}
              onIncrement={() => adjustNumericField("servings", 1, 1)}
              onDecrement={() => adjustNumericField("servings", 1, -1)}
              min={1}
            />
          </Field>
          <Field label="Difficulty" style={S.metaField}>
            <SelectControl>
              <select style={{ ...S.input, ...S.metaControl, ...S.metaSelect }} value={form.difficulty} onChange={setField("difficulty")}>
                <option value="">—</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </SelectControl>
          </Field>
          <Field label="Cuisine" style={S.metaField}>
            <input style={{ ...S.input, ...S.metaControl }} value={form.cuisine} onChange={setField("cuisine")} />
          </Field>
        </div>

        <SectionHeader title="Ingredients" />
        <div style={S.stack}>
          {ingredients.map((ingredient, index) => (
            <div key={`${ingredient.id || "ingredient"}-${index}`} style={S.card}>
              <div style={S.cardHeader}>
                <strong style={S.cardTitle}>Ingredient {index + 1}</strong>
                <div style={S.cardHeaderActions}>
                  <button
                    type="button"
                    style={{ ...S.iconBtn, ...(index === 0 ? S.iconBtnDisabled : {}) }}
                    onClick={() => moveIngredient(index, "up")}
                    disabled={index === 0}
                    aria-label={`Move ingredient ${index + 1} up`}
                  >
                    <ArrowUp size={14} strokeWidth={2.1} />
                  </button>
                  <button
                    type="button"
                    style={{ ...S.iconBtn, ...(index === ingredients.length - 1 ? S.iconBtnDisabled : {}) }}
                    onClick={() => moveIngredient(index, "down")}
                    disabled={index === ingredients.length - 1}
                    aria-label={`Move ingredient ${index + 1} down`}
                  >
                    <ArrowDown size={14} strokeWidth={2.1} />
                  </button>
                  <button type="button" style={S.iconBtn} onClick={() => removeIngredient(index)} aria-label={`Delete ingredient ${index + 1}`}>
                    <Trash2 size={14} strokeWidth={2.1} />
                  </button>
                </div>
              </div>
              <div style={S.cardGrid}>
                <input style={S.input} placeholder="Amount" value={ingredient.amount} onChange={(e) => updateIngredient(index, "amount", e.target.value)} />
                <UnitCombobox value={ingredient.unit} onChange={(value) => updateIngredient(index, "unit", value)} />
              </div>
              <input style={S.input} placeholder="Ingredient name" value={ingredient.name} onChange={(e) => updateIngredient(index, "name", e.target.value)} />
            </div>
          ))}
        </div>
        <div style={S.sectionFooter}>
          <button type="button" style={S.addInlineBtn} onClick={addIngredient}>
            <Plus size={14} strokeWidth={2.2} />
            <span>Add ingredient</span>
          </button>
        </div>

        <SectionHeader title="Steps" />
        <div style={S.stack}>
          {steps.map((step, index) => (
            <div key={`${step.id || "step"}-${index}`} style={S.card}>
              <div style={S.cardHeader}>
                <strong style={S.cardTitle}>Step {index + 1}</strong>
                <button type="button" style={S.iconBtn} onClick={() => removeStep(index)}>
                  <Trash2 size={14} strokeWidth={2.1} />
                </button>
              </div>
              <textarea
                style={{ ...S.input, ...S.textarea }}
                placeholder="Describe this step"
                value={step.instruction}
                onChange={(e) => updateStep(index, "instruction", e.target.value)}
                rows={3}
              />
            </div>
          ))}
        </div>
        <div style={S.sectionFooter}>
          <button type="button" style={S.addInlineBtn} onClick={addStep}>
            <Plus size={14} strokeWidth={2.2} />
            <span>Add step</span>
          </button>
        </div>

        <Field label="Notes">
          <textarea style={{ ...S.input, ...S.textarea }} value={form.notes} onChange={setField("notes")} rows={3} />
        </Field>

        {error && <p style={S.error}>{error}</p>}

        <button onClick={handleSave} disabled={saving} style={S.saveBtnBottom}>
          {saving ? "Saving…" : "Save Recipe"}
        </button>
      </div>
    </div>
  );
}

function isValidImageUrl(value: string) {
  if (!value.trim()) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isLikelyDirectImageUrl(value: string) {
  try {
    const url = new URL(value);
    return /\.(avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(url.pathname) || /\.(avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(url.toString());
  } catch {
    return false;
  }
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "rgb(var(--warm-500))", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
      {children}
    </div>
  );
}

function SelectControl({ children }: { children: React.ReactNode }) {
  return (
    <div style={S.selectWrap}>
      {children}
      <span style={S.selectIcon}>
        <ChevronDown size={15} strokeWidth={2.2} />
      </span>
    </div>
  );
}

function NumberControl({
  value,
  onChange,
  onIncrement,
  onDecrement,
  min = 0,
}: {
  value: string;
  onChange: (value: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  min?: number;
}) {
  return (
    <div style={S.numberWrap}>
      <input
        style={{ ...S.input, ...S.metaControl, ...S.metaNumber }}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value.replace(/[^\d]/g, "");
          onChange(nextValue);
        }}
        placeholder={String(min)}
      />
      <div style={S.numberActions}>
        <button type="button" style={S.numberBtn} onClick={onIncrement} aria-label="Increase value">
          <ChevronUp size={14} strokeWidth={2.2} />
        </button>
        <button type="button" style={S.numberBtn} onClick={onDecrement} aria-label="Decrease value">
          <ChevronDown size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
}: {
  title: string;
}) {
  return (
    <div style={S.sectionHeader}>
      <h2 style={S.sectionTitle}>{title}</h2>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  loading: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", color: "rgb(var(--warm-500))" },
  page: { padding: "16px", minHeight: "100dvh", background: "rgb(var(--warm-50))", maxWidth: 920, margin: "0 auto" },
  header: {},
  headerActions: { display: "flex", gap: 8 },
  backBtn: { background: "none", border: "none", fontSize: 14, color: "rgb(var(--terra-600))", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 },
  title: { fontSize: 20, fontWeight: 700, fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)", color: "rgb(var(--warm-900))" },
  saveBtn: { background: "rgb(var(--terra-600))", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  saveBtnBottom: { background: "rgb(var(--terra-600))", color: "white", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  row: { gap: 10 },
  input: { border: "1.5px solid rgb(var(--warm-200))", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "rgb(var(--warm-900))", background: "white", outline: "none", width: "100%", boxSizing: "border-box" as const },
  metaField: { minHeight: 74 },
  metaControl: { height: 46 },
  metaNumber: { paddingRight: 42 },
  metaSelect: { appearance: "none" as const, paddingRight: 40 },
  selectWrap: { position: "relative" },
  selectIcon: { position: "absolute", top: "50%", right: 14, transform: "translateY(-50%)", color: "rgb(var(--terra-600))", pointerEvents: "none" as const, display: "flex", alignItems: "center", justifyContent: "center" },
  numberWrap: { position: "relative" },
  numberActions: { position: "absolute", top: 7, right: 8, bottom: 7, display: "flex", flexDirection: "column", gap: 4 },
  numberBtn: { width: 22, flex: 1, border: "none", borderRadius: 7, background: "rgb(var(--terra-50))", color: "rgb(var(--terra-600))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 },
  textarea: { resize: "vertical" as const, lineHeight: 1.6 },
  imagePreviewCard: { background: "white", borderRadius: 14, border: "1px solid rgb(var(--warm-200))", overflow: "hidden" },
  imagePreviewWrap: { position: "relative", width: "100%", aspectRatio: "16/9", background: "rgb(var(--warm-100))" },
  imagePreview: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  imagePlaceholder: { aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "rgb(var(--warm-500))", background: "linear-gradient(135deg, rgb(var(--warm-100)), rgb(var(--terra-50)))" },
  helperText: { fontSize: 12, color: "rgb(var(--warm-500))", textAlign: "center" as const },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: "rgb(var(--warm-900))", fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)" },
  sectionFooter: { display: "flex", justifyContent: "flex-start", marginTop: 4 },
  addInlineBtn: { background: "white", border: "1.5px solid rgb(var(--warm-200))", borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "rgb(var(--warm-700))", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" },
  stack: { display: "flex", flexDirection: "column", gap: 12 },
  card: { background: "white", border: "1px solid rgb(var(--warm-200))", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10 },
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  cardHeaderActions: { display: "flex", alignItems: "center", gap: 4 },
  cardTitle: { fontSize: 13, color: "rgb(var(--warm-700))", fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-brand)" },
  cardGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  iconBtn: { background: "transparent", border: "none", color: "rgb(var(--warm-400))", cursor: "pointer", width: 28, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" },
  iconBtnDisabled: { opacity: 0.35, cursor: "not-allowed" },
  error: { fontSize: 13, color: "rgb(var(--terra-700))", background: "rgb(var(--terra-50))", border: "1px solid rgb(var(--terra-200))", borderRadius: 8, padding: "10px 12px" },
};
