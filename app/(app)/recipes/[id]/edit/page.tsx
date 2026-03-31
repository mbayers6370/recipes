"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import type { Recipe } from "@/types";
import { RECIPE_TYPE_OPTIONS, getRecipeType, setRecipeTypeTag, stripRecipeTypeTags, type RecipeType } from "@/lib/recipe-taxonomy";

type IngredientForm = { id?: string; name: string; amount: string; unit: string; notes: string };
type StepForm = { id?: string; instruction: string; timerSeconds: string };

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
  const hasPreviewImage = isValidImageUrl(form.imageUrl);

  useEffect(() => {
    fetch(`/api/recipes/${id}`)
      .then((res) => res.json())
      .then((json) => {
        const recipe = json.data as Recipe | null;
        if (!recipe) throw new Error("Recipe not found");

        setForm({
          title: recipe.title || "",
          description: recipe.description || "",
          imageUrl: recipe.imageUrl || "",
          recipeType: getRecipeType(recipe.tags) || "",
          servings: recipe.servings ? String(recipe.servings) : "",
          prepTime: recipe.prepTime ? String(recipe.prepTime) : "",
          cookTime: recipe.cookTime ? String(recipe.cookTime) : "",
          difficulty: recipe.difficulty || "",
          cuisine: recipe.cuisine || "",
          notes: recipe.notes || "",
        });
        setExtraTags(stripRecipeTypeTags(recipe.tags));
        setIngredients(
          (recipe.ingredients || []).map((ingredient) => ({
            id: ingredient.id,
            name: ingredient.name || "",
            amount: ingredient.amount || "",
            unit: ingredient.unit || "",
            notes: ingredient.notes || "",
          }))
        );
        setSteps(
          (recipe.steps || []).map((step) => ({
            id: step.id,
            instruction: step.instruction || "",
            timerSeconds: step.timerSeconds ? String(step.timerSeconds) : "",
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

  const updateIngredient = (index: number, key: keyof IngredientForm, value: string) => {
    setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const updateStep = (index: number, key: keyof StepForm, value: string) => {
    setSteps((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { name: "", amount: "", unit: "", notes: "" }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { instruction: "", timerSeconds: "" }]);
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

    const body = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
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
          unit: ingredient.unit.trim() || undefined,
          notes: ingredient.notes.trim() || undefined,
        })),
      steps: steps
        .filter((step) => step.instruction.trim())
        .map((step, index) => ({
          ...(step.id ? { id: step.id } : {}),
          order: index,
          instruction: step.instruction.trim(),
          timerSeconds: step.timerSeconds ? parseInt(step.timerSeconds, 10) : undefined,
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
          <input style={S.input} type="url" value={form.imageUrl} onChange={setField("imageUrl")} placeholder="https://example.com/recipe.jpg" />
        </Field>

        <div style={S.imagePreviewCard}>
          {hasPreviewImage ? (
            <div style={S.imagePreviewWrap}>
              <Image
                src={form.imageUrl}
                alt={form.title || "Recipe preview"}
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 720px"
                style={S.imagePreview}
              />
            </div>
          ) : (
            <div style={S.imagePlaceholder}>
              <UtensilsCrossed size={28} strokeWidth={2} />
              <span>No recipe image yet</span>
            </div>
          )}
        </div>

        <div style={S.row} className="recipe-form-row">
          <Field label="Folder">
            <select style={S.input} value={form.recipeType} onChange={setField("recipeType")}>
              <option value="">Unsorted</option>
              {RECIPE_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prep (min)">
            <input style={S.input} type="number" value={form.prepTime} onChange={setField("prepTime")} min={0} />
          </Field>
          <Field label="Cook (min)">
            <input style={S.input} type="number" value={form.cookTime} onChange={setField("cookTime")} min={0} />
          </Field>
        </div>

        <div style={S.row} className="recipe-form-row">
          <Field label="Serves">
            <input style={S.input} type="number" value={form.servings} onChange={setField("servings")} min={1} />
          </Field>
          <Field label="Difficulty">
            <select style={S.input} value={form.difficulty} onChange={setField("difficulty")}>
              <option value="">—</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </Field>
          <Field label="Cuisine">
            <input style={S.input} value={form.cuisine} onChange={setField("cuisine")} />
          </Field>
        </div>

        <SectionHeader title="Ingredients" />
        <div style={S.stack}>
          {ingredients.map((ingredient, index) => (
            <div key={`${ingredient.id || "ingredient"}-${index}`} style={S.card}>
              <div style={S.cardHeader}>
                <strong style={S.cardTitle}>Ingredient {index + 1}</strong>
                <button type="button" style={S.iconBtn} onClick={() => removeIngredient(index)}>
                  <Trash2 size={14} strokeWidth={2.1} />
                </button>
              </div>
              <div style={S.cardGrid}>
                <input style={S.input} placeholder="Amount" value={ingredient.amount} onChange={(e) => updateIngredient(index, "amount", e.target.value)} />
                <input style={S.input} placeholder="Unit" value={ingredient.unit} onChange={(e) => updateIngredient(index, "unit", e.target.value)} />
              </div>
              <input style={S.input} placeholder="Ingredient name" value={ingredient.name} onChange={(e) => updateIngredient(index, "name", e.target.value)} />
              <input style={S.input} placeholder="Notes" value={ingredient.notes} onChange={(e) => updateIngredient(index, "notes", e.target.value)} />
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
              <input
                style={S.input}
                type="number"
                min={0}
                placeholder="Timer seconds (optional)"
                value={step.timerSeconds}
                onChange={(e) => updateStep(index, "timerSeconds", e.target.value)}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "rgb(var(--warm-500))", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
      {children}
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
  textarea: { resize: "vertical" as const, lineHeight: 1.6 },
  imagePreviewCard: { background: "white", borderRadius: 14, border: "1px solid rgb(var(--warm-200))", overflow: "hidden" },
  imagePreviewWrap: { position: "relative", width: "100%", aspectRatio: "16/9", background: "rgb(var(--warm-100))" },
  imagePreview: { objectFit: "cover" },
  imagePlaceholder: { aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "rgb(var(--warm-500))", background: "linear-gradient(135deg, rgb(var(--warm-100)), rgb(var(--terra-50)))" },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: "rgb(var(--warm-900))", fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)" },
  sectionFooter: { display: "flex", justifyContent: "flex-start", marginTop: 4 },
  addInlineBtn: { background: "white", border: "1.5px solid rgb(var(--warm-200))", borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "rgb(var(--warm-700))", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" },
  stack: { display: "flex", flexDirection: "column", gap: 12 },
  card: { background: "white", border: "1px solid rgb(var(--warm-200))", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10 },
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 13, color: "rgb(var(--warm-700))", fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-brand)" },
  cardGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  iconBtn: { background: "transparent", border: "none", color: "rgb(var(--warm-400))", cursor: "pointer", width: 28, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" },
  error: { fontSize: 13, color: "rgb(var(--terra-700))", background: "rgb(var(--terra-50))", border: "1px solid rgb(var(--terra-200))", borderRadius: 8, padding: "10px 12px" },
};
