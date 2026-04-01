"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";
import { RECIPE_TYPE_OPTIONS, setRecipeTypeTag, type RecipeType } from "@/lib/recipe-taxonomy";
import { normalizeExternalUrl } from "@/lib/url";

export function RecipeManualForm() {
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
  const [resolvedImageUrl, setResolvedImageUrl] = useState("");
  const [resolvingImage, setResolvingImage] = useState(false);
  const previewImageUrl = resolvedImageUrl || (isLikelyDirectImageUrl(form.imageUrl) ? form.imageUrl : "");
  const hasPreviewImage = isValidImageUrl(previewImageUrl);

  const set =
    (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((current) => ({ ...current, [key]: e.target.value }));

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

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }

    setSaving(true);
    setError("");

    const ingredients = ingredientsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => ({
        id: String(index),
        name: line,
        order: index,
      }));

    const steps = stepsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((instruction, index) => ({ order: index, instruction }));

    const body = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      imageUrl: normalizeExternalUrl(form.imageUrl),
      difficulty: form.difficulty || undefined,
      cuisine: form.cuisine.trim() || undefined,
      notes: form.notes.trim() || undefined,
      servings: form.servings ? parseInt(form.servings, 10) : undefined,
      prepTime: form.prepTime ? parseInt(form.prepTime, 10) : undefined,
      cookTime: form.cookTime ? parseInt(form.cookTime, 10) : undefined,
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

    if (!res.ok) {
      setError(json.error || "Failed to save");
      setSaving(false);
      return;
    }

    router.push(`/recipes/${json.data.id}`);
  };

  return (
    <div style={S.form}>
      <Field label="Title *">
        <input style={S.input} type="text" placeholder="Lemon Garlic Shrimp" value={form.title} onChange={set("title")} autoFocus />
      </Field>

      <Field label="Description">
        <textarea style={{ ...S.input, ...S.textarea }} placeholder="Brief description…" value={form.description} onChange={set("description")} rows={2} />
      </Field>

      <Field label="Recipe image URL">
        <input
          style={S.input}
          type="text"
          inputMode="url"
          placeholder="https://example.com/recipe.jpg"
          value={form.imageUrl}
          onChange={(e) => {
            setResolvedImageUrl("");
            set("imageUrl")(e);
          }}
          onBlur={() => void handleImageUrlBlur()}
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

      <button type="button" onClick={handleSave} disabled={saving} style={S.saveBtnBottom}>
        {saving ? "Saving…" : "Save Recipe"}
      </button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "rgb(var(--warm-500))", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
      {children}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  form: { display: "flex", flexDirection: "column", gap: 16, textAlign: "left" as const },
  input: { border: "1.5px solid rgb(var(--warm-200))", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "rgb(var(--warm-900))", background: "white", outline: "none", width: "100%", boxSizing: "border-box" as const },
  textarea: { resize: "vertical" as const, lineHeight: 1.6 },
  textareaTall: { resize: "vertical" as const, lineHeight: 1.8, fontFamily: "var(--font-mono)", fontSize: 13 },
  row: { gap: 10 },
  imagePreviewCard: { background: "white", borderRadius: 14, border: "1px solid rgb(var(--warm-200))", overflow: "hidden", maxWidth: 320, width: "100%", alignSelf: "center" },
  imagePreviewWrap: { position: "relative", width: "100%", aspectRatio: "16/9", background: "rgb(var(--warm-100))" },
  imagePreview: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  imagePlaceholder: { aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "rgb(var(--warm-500))", background: "linear-gradient(135deg, rgb(var(--warm-100)), rgb(var(--terra-50)))" },
  helperText: { fontSize: 12, color: "rgb(var(--warm-500))", textAlign: "center" as const },
  error: { fontSize: 13, color: "rgb(var(--terra-700))", background: "rgb(var(--terra-50))", border: "1px solid rgb(var(--terra-200))", borderRadius: 8, padding: "10px 12px" },
  saveBtnBottom: { background: "rgb(var(--terra-600))", color: "white", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
};
