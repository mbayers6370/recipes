"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, ImageUp, Link2, PencilLine } from "lucide-react";
import type { ParsedRecipe } from "@/lib/recipe-parser";

type ImportStep = "input" | "preview" | "saving";
type ImportMode = "url" | "text" | "image";

const IMPORT_MODE_COPY: Record<
  ImportMode,
  { tabLabel: string; title: string; description: string; buttonLabel: string }
> = {
  url: {
    tabLabel: "Website URL",
    title: "Paste a recipe link",
    description:
      "Use a recipe website link from places like NYT Cooking, AllRecipes, or Serious Eats.",
    buttonLabel: "Import Recipe",
  },
  text: {
    tabLabel: "Paste Text",
    title: "Paste recipe text",
    description:
      "Paste a recipe from notes, chat, email, or anywhere else and we’ll try to organize it for you.",
    buttonLabel: "Parse Recipe",
  },
  image: {
    tabLabel: "Photo / Screenshot",
    title: "Upload a recipe photo",
    description:
      "We’ll read the text from your photo or screenshot, then you can fix any mistakes before parsing it.",
    buttonLabel: "Read Text From Image",
  },
};

export default function ImportRecipePage() {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>("input");
  const [mode, setMode] = useState<ImportMode>("url");
  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [fallbackTitle, setFallbackTitle] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageOcrText, setImageOcrText] = useState("");
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  useEffect(() => {
    setError("");
  }, [mode]);

  useEffect(() => {
    if (mode !== "image") return;
    setImageOcrText("");
    setOcrProgress(null);
  }, [imageFile, mode]);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let payload: { mode: "url"; url: string } | { mode: "text"; text: string; title?: string };

      if (mode === "image") {
        if (!imageFile) throw new Error("Please choose an image first.");
        if (!imageOcrText.trim()) {
          const { createWorker } = await import("tesseract.js");
          const worker = await createWorker("eng", 1, {
            logger: (message) => {
              if (message.status === "recognizing text" && typeof message.progress === "number") {
                setOcrProgress(message.progress);
              }
            },
          });

          const result = await worker.recognize(imageFile);
          await worker.terminate();

          const extractedText = result.data.text.trim();
          setOcrProgress(null);

          if (!extractedText) {
            throw new Error("No readable text was found in that image.");
          }

          setImageOcrText(extractedText);
          setLoading(false);
          return;
        }

        payload = {
          mode: "text",
          text: imageOcrText,
          title: fallbackTitle.trim() || undefined,
        };
      } else {
        payload =
          mode === "url"
            ? { mode, url }
            : { mode, text: rawText, title: fallbackTitle.trim() || undefined };
      }

      const res = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setParsed(json.data);
      setStep("preview");
    } catch (err) {
      setError((err as Error).message);
      setOcrProgress(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!parsed) return;
    if (!parsed.title?.trim()) {
      setError("Please add a recipe title before saving.");
      return;
    }
    setLoading(true);
    setStep("saving");
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      router.push(`/recipes/${json.data.id}`);
    } catch (err) {
      setError((err as Error).message);
      setStep("preview");
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.header} className="page-header">
        <h1 style={S.title} className="page-header-title">Import Recipe</h1>
        <div style={S.headerActions} className="page-header-actions">
          <button onClick={() => router.back()} style={S.backBtn}>
            <ArrowLeft size={16} strokeWidth={2.2} />
            <span>Back</span>
          </button>
        </div>
      </div>

      {step === "input" && (
        <div style={S.card}>
          <div style={S.modeTabs}>
            <button
              type="button"
              onClick={() => setMode("url")}
              style={{ ...S.modeTab, ...(mode === "url" ? S.modeTabActive : {}) }}
            >
              <Link2 size={16} strokeWidth={2.2} />
              <span>{IMPORT_MODE_COPY.url.tabLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("text")}
              style={{ ...S.modeTab, ...(mode === "text" ? S.modeTabActive : {}) }}
            >
              <FileText size={16} strokeWidth={2.2} />
              <span>{IMPORT_MODE_COPY.text.tabLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("image")}
              style={{ ...S.modeTab, ...(mode === "image" ? S.modeTabActive : {}) }}
            >
              <ImageUp size={16} strokeWidth={2.2} />
              <span>{IMPORT_MODE_COPY.image.tabLabel}</span>
            </button>
          </div>

          <div style={S.iconWrap}>
            {mode === "url" ? <Link2 size={32} strokeWidth={2.2} /> : <ImageUp size={32} strokeWidth={2.2} />}
          </div>
          <h2 style={S.cardTitle}>{IMPORT_MODE_COPY[mode].title}</h2>
          <p style={S.cardSub}>{IMPORT_MODE_COPY[mode].description}</p>
          <form onSubmit={handleImport} style={S.form}>
            {mode === "url" ? (
              <input
                style={S.input}
                type="url"
                placeholder="https://www.example.com/recipes/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                autoFocus
              />
            ) : mode === "text" ? (
              <>
                <input
                  style={S.input}
                  type="text"
                  placeholder="Optional fallback title"
                  value={fallbackTitle}
                  onChange={(e) => setFallbackTitle(e.target.value)}
                />
                <textarea
                  style={{ ...S.input, ...S.textarea }}
                  placeholder={"Title\n\nIngredients\n- 2 eggs\n- 1 tbsp butter\n\nInstructions\n1. Whisk eggs\n2. Cook in butter"}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  required
                  rows={10}
                  autoFocus
                />
              </>
            ) : (
              <>
                <input
                  style={S.input}
                  type="text"
                  placeholder="Optional fallback title"
                  value={fallbackTitle}
                  onChange={(e) => setFallbackTitle(e.target.value)}
                />
                <label style={S.uploadBox}>
                  <input
                    type="file"
                    accept="image/*"
                    style={S.hiddenInput}
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  />
                  <ImageUp size={22} strokeWidth={2.2} />
                  <span>{imageFile ? imageFile.name : "Choose image"}</span>
                </label>
                {imagePreviewUrl && (
                  <div style={S.uploadPreviewWrap}>
                    <Image
                      src={imagePreviewUrl}
                      alt="Recipe upload preview"
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 100vw, 720px"
                      style={S.uploadPreview}
                    />
                  </div>
                )}
                {ocrProgress !== null && (
                  <p style={S.helperText}>Reading text from image… {Math.round(ocrProgress * 100)}%</p>
                )}
                {imageOcrText && (
                  <>
                    <p style={S.helperText}>
                      Review and fix the extracted text before parsing the recipe.
                    </p>
                    <textarea
                      style={{ ...S.input, ...S.textarea, minHeight: 220 }}
                      placeholder="OCR text will appear here..."
                      value={imageOcrText}
                      onChange={(e) => setImageOcrText(e.target.value)}
                      required
                      rows={12}
                    />
                  </>
                )}
              </>
            )}
            {error && <p style={S.error}>{error}</p>}
            <button type="submit" disabled={loading} style={S.btn}>
              {loading
                ? mode === "image"
                  ? "Scanning image…"
                  : "Importing…"
                : mode === "url"
                ? IMPORT_MODE_COPY.url.buttonLabel
                : mode === "text"
                ? IMPORT_MODE_COPY.text.buttonLabel
                : imageOcrText
                ? "Parse Corrected Text"
                : IMPORT_MODE_COPY.image.buttonLabel}
            </button>
          </form>

          <div style={S.divider}>
            <span style={S.dividerText}>or</span>
          </div>

          <button
            style={S.altBtn}
            onClick={() => router.push("/recipes/new")}
          >
            <PencilLine size={16} strokeWidth={2.2} />
            <span>Enter recipe manually</span>
          </button>
        </div>
      )}

      {step === "preview" && parsed && (
        <div style={S.preview}>
          <div style={S.previewCard}>
            {parsed.imageUrl && (
              <div style={S.previewImgWrap}>
                <Image
                  src={parsed.imageUrl}
                  alt={parsed.title || "Imported recipe preview"}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 720px"
                  style={S.previewImg}
                />
              </div>
            )}
            <div style={S.previewBody}>
              <input
                style={S.previewTitleInput}
                value={parsed.title || ""}
                onChange={(e) => setParsed((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                placeholder="Recipe title"
              />
              {!parsed.title?.trim() && (
                <p style={S.previewTitleHint}>Add a title before saving.</p>
              )}
              {parsed.description && <p style={S.previewDesc}>{parsed.description}</p>}

              <div style={S.previewMeta}>
                {parsed.prepTime && <MetaChip label="Prep" value={`${parsed.prepTime}m`} />}
                {parsed.cookTime && <MetaChip label="Cook" value={`${parsed.cookTime}m`} />}
                {parsed.servings && <MetaChip label="Serves" value={String(parsed.servings)} />}
              </div>

              <div style={S.section}>
                <h3 style={S.sectionTitle}>Ingredients ({parsed.ingredients.length})</h3>
                <ul style={S.list}>
                  {parsed.ingredients.slice(0, 8).map((ing, i) => (
                    <li key={i} style={S.listItem}>
                      {[ing.amount, ing.unit, ing.name].filter(Boolean).join(" ")}
                    </li>
                  ))}
                  {parsed.ingredients.length > 8 && (
                    <li style={{ ...S.listItem, color: "rgb(var(--warm-400))" }}>
                      +{parsed.ingredients.length - 8} more
                    </li>
                  )}
                </ul>
              </div>

              <div style={S.section}>
                <h3 style={S.sectionTitle}>Steps ({parsed.steps.length})</h3>
                <ol style={S.list}>
                  {parsed.steps.slice(0, 3).map((step, i) => (
                    <li key={i} style={S.listItem}>
                      {step.instruction.slice(0, 80)}{step.instruction.length > 80 ? "…" : ""}
                    </li>
                  ))}
                  {parsed.steps.length > 3 && (
                    <li style={{ ...S.listItem, color: "rgb(var(--warm-400))" }}>
                      +{parsed.steps.length - 3} more steps
                    </li>
                  )}
                </ol>
              </div>
            </div>
          </div>

          {error && <p style={S.error}>{error}</p>}

          <div style={S.previewActions}>
            <button onClick={() => setStep("input")} style={S.secondaryBtn}>
              <ArrowLeft size={16} strokeWidth={2.2} />
              <span>Try again</span>
            </button>
            <button onClick={handleSave} disabled={loading} style={S.btn}>
              {loading ? "Saving…" : "Save Recipe"}
            </button>
          </div>
        </div>
      )}

      {step === "saving" && (
        <div style={S.savingState}>
          <div style={S.spinner} />
          <p style={S.savingText}>Saving your recipe…</p>
        </div>
      )}
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "rgb(var(--warm-100))", borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "rgb(var(--warm-500))", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "rgb(var(--warm-800))" }}>{value}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: "16px", minHeight: "100dvh", background: "rgb(var(--warm-50))" },
  header: {},
  headerActions: { display: "flex", gap: 8 },
  backBtn: { background: "none", border: "none", fontSize: 14, color: "rgb(var(--terra-600))", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 },
  title: { fontSize: 22, fontWeight: 700, fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)", color: "rgb(var(--warm-900))" },
  card: { background: "white", borderRadius: 20, padding: "32px 20px", textAlign: "center", border: "1px solid rgb(var(--warm-200))" },
  modeTabs: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, background: "rgb(var(--warm-100))", borderRadius: 12, padding: 4, marginBottom: 20 },
  modeTab: { background: "transparent", border: "none", borderRadius: 10, padding: "10px 12px", color: "rgb(var(--warm-600))", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" },
  modeTabActive: { background: "white", color: "rgb(var(--warm-900))" },
  iconWrap: { color: "rgb(var(--terra-600))", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 20, fontWeight: 700, color: "rgb(var(--warm-900))", marginBottom: 8, fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)" },
  cardSub: { fontSize: 14, color: "rgb(var(--warm-500))", marginBottom: 24, lineHeight: 1.6 },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  input: { width: "100%", border: "1.5px solid rgb(var(--warm-200))", borderRadius: 12, padding: "13px 14px", fontSize: 14, color: "rgb(var(--warm-900))", background: "white", outline: "none", boxSizing: "border-box" },
  textarea: { minHeight: 220, resize: "vertical", lineHeight: 1.6, fontFamily: "inherit" },
  uploadBox: { border: "1.5px dashed rgb(var(--warm-300))", borderRadius: 14, padding: "18px 14px", color: "rgb(var(--warm-700))", background: "rgb(var(--warm-50))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer" },
  hiddenInput: { display: "none" },
  uploadPreviewWrap: { width: "100%", maxHeight: 280, aspectRatio: "16/10", position: "relative", overflow: "hidden", borderRadius: 12, border: "1px solid rgb(var(--warm-200))", background: "white" },
  uploadPreview: { objectFit: "contain" },
  helperText: { fontSize: 12, color: "rgb(var(--warm-500))", textAlign: "left" },
  error: { fontSize: 13, color: "rgb(var(--terra-700))", background: "rgb(var(--terra-50))", border: "1px solid rgb(var(--terra-200))", borderRadius: 8, padding: "8px 12px", textAlign: "left" },
  btn: { background: "rgb(var(--terra-600))", color: "white", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  divider: { display: "flex", alignItems: "center", gap: 12, margin: "20px 0" },
  dividerText: { fontSize: 13, color: "rgb(var(--warm-400))" },
  altBtn: { width: "100%", background: "rgb(var(--warm-50))", border: "1.5px solid rgb(var(--warm-200))", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 500, cursor: "pointer", color: "rgb(var(--warm-700))", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 },
  preview: { display: "flex", flexDirection: "column", gap: 16 },
  previewCard: { background: "white", borderRadius: 16, overflow: "hidden", border: "1px solid rgb(var(--warm-200))" },
  previewImgWrap: { width: "100%", aspectRatio: "16/9", position: "relative" },
  previewImg: { objectFit: "cover" },
  previewBody: { padding: "20px" },
  previewTitleInput: { width: "100%", border: "1.5px solid rgb(var(--warm-200))", borderRadius: 10, padding: "11px 14px", fontSize: 22, fontWeight: 700, color: "rgb(var(--warm-900))", fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)", marginBottom: 8, background: "white", outline: "none" },
  previewTitleHint: { fontSize: 12, color: "rgb(var(--terra-700))", marginBottom: 8 },
  previewDesc: { fontSize: 14, color: "rgb(var(--warm-600))", marginBottom: 16, lineHeight: 1.6 },
  previewMeta: { display: "flex", gap: 10, marginBottom: 20 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: "rgb(var(--warm-700))", marginBottom: 8 },
  list: { paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 },
  listItem: { fontSize: 13, color: "rgb(var(--warm-700))", lineHeight: 1.5 },
  previewActions: { display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 10 },
  secondaryBtn: { background: "white", border: "1.5px solid rgb(var(--warm-200))", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "rgb(var(--warm-700))", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 },
  savingState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, minHeight: "50vh" },
  spinner: { width: 40, height: 40, border: "3px solid rgb(var(--warm-200))", borderTopColor: "rgb(var(--terra-600))", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  savingText: { fontSize: 16, color: "rgb(var(--warm-600))" },
};
