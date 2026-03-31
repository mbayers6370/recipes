"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, UtensilsCrossed } from "lucide-react";
import { RECIPE_TYPE_OPTIONS, setRecipeTypeTag, type RecipeType } from "@/lib/recipe-taxonomy";

export default function NewRecipePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
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
  const [ingredientsText, setIngredientsText] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [error, setError] = useState("");
  const hasPreviewImage = isValidImageUrl(form.imageUrl);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError("");

    const ingredients = ingredientsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line, i) => ({
        id: String(i),
        name: line,
        order: i,
      }));

    const steps = stepsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((instruction, i) => ({ order: i, instruction }));

    const body = {
      ...form,
      servings: form.servings ? parseInt(form.servings) : undefined,
      prepTime: form.prepTime ? parseInt(form.prepTime) : undefined,
      cookTime: form.cookTime ? parseInt(form.cookTime) : undefined,
      tags: setRecipeTypeTag([], form.recipeType as RecipeType | ""),
      ingredients,
      steps,
    };

    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Failed to save"); setSaving(false); return; }
    router.push(`/recipes/${json.data.id}`);
  };

  return (
    <div style={S.page}>
      <div style={S.header} className="page-header">
        <h1 style={S.title} className="page-header-title">New Recipe</h1>
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
          <input style={S.input} type="text" placeholder="Lemon Garlic Shrimp" value={form.title} onChange={set("title")} autoFocus />
        </Field>

        <Field label="Description">
          <textarea style={{ ...S.input, ...S.textarea }} placeholder="Brief description…" value={form.description} onChange={set("description")} rows={2} />
        </Field>

        <Field label="Recipe image URL">
          <input style={S.input} type="url" placeholder="https://example.com/recipe.jpg" value={form.imageUrl} onChange={set("imageUrl")} />
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
            <select style={S.input} value={form.recipeType} onChange={set("recipeType")}>
              <option value="">Unsorted</option>
              {RECIPE_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prep (min)">
            <input style={S.input} type="number" placeholder="15" value={form.prepTime} onChange={set("prepTime")} min={0} />
          </Field>
          <Field label="Cook (min)">
            <input style={S.input} type="number" placeholder="20" value={form.cookTime} onChange={set("cookTime")} min={0} />
          </Field>
        </div>

        <div style={S.row} className="recipe-form-row">
          <Field label="Serves">
            <input style={S.input} type="number" placeholder="4" value={form.servings} onChange={set("servings")} min={1} />
          </Field>
          <Field label="Difficulty">
            <select style={S.input} value={form.difficulty} onChange={set("difficulty")}>
              <option value="">—</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </Field>
          <Field label="Cuisine">
            <input style={S.input} type="text" placeholder="Italian" value={form.cuisine} onChange={set("cuisine")} />
          </Field>
        </div>

        <Field label="Ingredients (one per line)">
          <textarea
            style={{ ...S.input, ...S.textareaTall }}
            placeholder={"2 cups flour\n1 tsp salt\n3 eggs"}
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            rows={6}
          />
        </Field>

        <Field label="Steps (one per line)">
          <textarea
            style={{ ...S.input, ...S.textareaTall }}
            placeholder={"Preheat oven to 375°F.\nMix dry ingredients in a large bowl.\nAdd eggs and mix until smooth."}
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            rows={8}
          />
        </Field>

        <Field label="Notes">
          <textarea style={{ ...S.input, ...S.textarea }} placeholder="Substitutions, tips, storage…" value={form.notes} onChange={set("notes")} rows={3} />
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

const S: Record<string, React.CSSProperties> = {
  page: { padding: "16px", minHeight: "100dvh", background: "rgb(var(--warm-50))" },
  header: {},
  headerActions: { display: "flex", gap: 8 },
  backBtn: { background: "none", border: "none", fontSize: 14, color: "rgb(var(--terra-600))", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 },
  title: { fontSize: 20, fontWeight: 700, fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)", color: "rgb(var(--warm-900))" },
  saveBtn: { background: "rgb(var(--terra-600))", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  input: { border: "1.5px solid rgb(var(--warm-200))", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "rgb(var(--warm-900))", background: "white", outline: "none", width: "100%", boxSizing: "border-box" as const },
  textarea: { resize: "vertical" as const, lineHeight: 1.6 },
  textareaTall: { resize: "vertical" as const, lineHeight: 1.8, fontFamily: "var(--font-mono)", fontSize: 13 },
  row: { gap: 10 },
  imagePreviewCard: { background: "white", borderRadius: 14, border: "1px solid rgb(var(--warm-200))", overflow: "hidden" },
  imagePreviewWrap: { position: "relative", width: "100%", aspectRatio: "16/9", background: "rgb(var(--warm-100))" },
  imagePreview: { objectFit: "cover" },
  imagePlaceholder: { aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "rgb(var(--warm-500))", background: "linear-gradient(135deg, rgb(var(--warm-100)), rgb(var(--terra-50)))" },
  error: { fontSize: 13, color: "rgb(var(--terra-700))", background: "rgb(var(--terra-50))", border: "1px solid rgb(var(--terra-200))", borderRadius: 8, padding: "10px 12px" },
  saveBtnBottom: { background: "rgb(var(--terra-600))", color: "white", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
};
