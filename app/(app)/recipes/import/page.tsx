"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Link2, PencilLine } from "lucide-react";
import type { ParsedRecipe } from "@/lib/recipe-parser";
import { RecipeManualForm } from "@/components/recipe-manual-form";
import { RecipeImage } from "@/components/recipe-image";

type ImportStep = "input" | "preview" | "saving";
type ImportMode = "url" | "document" | "manual";

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
  document: {
    tabLabel: "PDF / DOCX",
    title: "Upload a recipe document",
    description:
      "Upload a PDF or DOCX file and we’ll extract the recipe text before organizing it for you.",
    buttonLabel: "Import Document",
  },
  manual: {
    tabLabel: "Start From Scratch",
    title: "Create a recipe manually",
    description:
      "Jump straight into the recipe editor and add everything yourself.",
    buttonLabel: "Start From Scratch",
  },
};

export default function ImportRecipePage() {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>("input");
  const [mode, setMode] = useState<ImportMode>("url");
  const [url, setUrl] = useState("");
  const [fallbackTitle, setFallbackTitle] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = useState("");
  const [resolvingImage, setResolvingImage] = useState(false);

  useEffect(() => {
    if (!parsed?.sourceUrl) {
      setResolvedImageUrl("");
      setResolvingImage(false);
      return;
    }

    const sourceUrl = parsed.sourceUrl;
    const currentImageUrl = parsed.imageUrl;
    let cancelled = false;

    async function loadImage() {
      if (isLikelyDirectImageUrl(sourceUrl)) {
        setResolvedImageUrl(sourceUrl);
        return;
      }

      setResolvingImage(true);

      try {
        const res = await fetch("/api/recipes/resolve-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: sourceUrl }),
        });
        const json = await res.json();

        if (cancelled) return;

        if (res.ok && json.data?.imageUrl) {
          setResolvedImageUrl(json.data.imageUrl);
          setParsed((current) => (current ? { ...current, imageUrl: json.data.imageUrl } : current));
        } else {
          setResolvedImageUrl(currentImageUrl && isLikelyDirectImageUrl(currentImageUrl) ? currentImageUrl : "");
        }
      } catch {
        if (!cancelled) {
          setResolvedImageUrl(currentImageUrl && isLikelyDirectImageUrl(currentImageUrl) ? currentImageUrl : "");
        }
      } finally {
        if (!cancelled) {
          setResolvingImage(false);
        }
      }
    }

    void loadImage();

    return () => {
      cancelled = true;
    };
  }, [parsed?.sourceUrl, parsed?.imageUrl]);

  const clearError = () => setError("");

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "manual") return;

      const res =
        mode === "url"
          ? await fetch("/api/recipes/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode, url }),
            })
          : await (() => {
              if (!documentFile) {
                throw new Error("Please choose a PDF or DOCX file first.");
              }

              const formData = new FormData();
              formData.set("mode", "document");
              formData.set("file", documentFile);

              if (fallbackTitle.trim()) {
                formData.set("title", fallbackTitle.trim());
              }

              return fetch("/api/recipes/import", {
                method: "POST",
                body: formData,
              });
            })();

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setResolvedImageUrl("");
      setParsed(json.data);
      setStep("preview");
    } catch (err) {
      setError((err as Error).message);
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
      const imageUrl = resolvedImageUrl || (parsed.imageUrl && isLikelyDirectImageUrl(parsed.imageUrl) ? parsed.imageUrl : undefined);
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed,
          imageUrl,
        }),
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
        <h1 style={S.title} className="page-header-title">Add a New Recipe</h1>
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
              onClick={() => {
                setMode("url");
                clearError();
              }}
              style={{ ...S.modeTab, ...(mode === "url" ? S.modeTabActive : {}) }}
            >
              <Link2 size={16} strokeWidth={2.2} />
              <span>{IMPORT_MODE_COPY.url.tabLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("document");
                clearError();
              }}
              style={{ ...S.modeTab, ...(mode === "document" ? S.modeTabActive : {}) }}
            >
              <FileText size={16} strokeWidth={2.2} />
              <span>{IMPORT_MODE_COPY.document.tabLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("manual");
                clearError();
              }}
              style={{ ...S.modeTab, ...(mode === "manual" ? S.modeTabActive : {}) }}
            >
              <PencilLine size={16} strokeWidth={2.2} />
              <span>{IMPORT_MODE_COPY.manual.tabLabel}</span>
            </button>
          </div>

          <div style={S.iconWrap}>
            {mode === "url" ? (
              <Link2 size={32} strokeWidth={2.2} />
            ) : mode === "document" ? (
              <FileText size={32} strokeWidth={2.2} />
            ) : (
              <PencilLine size={32} strokeWidth={2.2} />
            )}
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
            ) : mode === "document" ? (
              <>
                <input
                  style={S.input}
                  type="text"
                  placeholder="Optional fallback title"
                  value={fallbackTitle}
                  onChange={(e) => setFallbackTitle(e.target.value)}
                />
                <label style={S.filePicker}>
                  <input
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    style={S.hiddenInput}
                    onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                    required
                  />
                  <span style={S.filePickerLabel}>
                    {documentFile ? documentFile.name : "Choose PDF or DOCX"}
                  </span>
                </label>
                <p style={S.helperText}>
                  Best results come from exported recipes, typed documents, and clean scans saved as PDF.
                </p>
              </>
            ) : (
              <RecipeManualForm />
            )}
            {error && <p style={S.error}>{error}</p>}
            {mode !== "manual" ? (
              <button type="submit" disabled={loading} style={S.btn}>
                {loading
                  ? "Importing…"
                  : mode === "url"
                  ? IMPORT_MODE_COPY.url.buttonLabel
                  : IMPORT_MODE_COPY.document.buttonLabel}
              </button>
            ) : null}
          </form>
        </div>
      )}

      {step === "preview" && parsed && (
        <div style={S.preview}>
          <div style={S.previewCard}>
            {(resolvedImageUrl || parsed.imageUrl) && (
              <div style={S.previewImgShell}>
                <div style={S.previewImgWrap}>
                  <RecipeImage
                    imageUrl={resolvedImageUrl || parsed.imageUrl}
                    title={parsed.title || "Imported recipe preview"}
                    sizes="(max-width: 768px) 100vw, 720px"
                    imageStyle={S.previewImg}
                    priority
                  />
                </div>
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
              {resolvingImage ? <p style={S.previewTitleHint}>Resolving recipe image…</p> : null}

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

function isLikelyDirectImageUrl(value?: string | null) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return /\.(avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(url.pathname) || /\.(avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(url.toString());
  } catch {
    return false;
  }
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
  page: { padding: "16px", minHeight: "100dvh", background: "rgb(var(--warm-50))", width: "100%", maxWidth: 960, margin: "0 auto" },
  header: {},
  headerActions: { display: "flex", gap: 8 },
  backBtn: { background: "none", border: "none", fontSize: 14, color: "rgb(var(--terra-600))", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 },
  title: { fontSize: 22, fontWeight: 700, fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)", color: "rgb(var(--warm-900))" },
  card: { background: "white", borderRadius: 20, padding: "32px 20px", textAlign: "center", border: "1px solid rgb(var(--warm-200))" },
  modeTabs: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, background: "rgb(var(--warm-100))", borderRadius: 12, padding: 4, marginBottom: 20 },
  modeTab: { background: "transparent", border: "none", borderRadius: 10, padding: "10px 12px", color: "rgb(var(--warm-600))", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" },
  modeTabActive: { background: "white", color: "rgb(var(--warm-900))" },
  iconWrap: { color: "rgb(var(--terra-600))", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 20, fontWeight: 700, color: "rgb(var(--warm-900))", marginBottom: 8, fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)" },
  cardSub: { fontSize: 14, color: "rgb(var(--warm-500))", marginBottom: 24, lineHeight: 1.6 },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  input: { width: "100%", border: "1.5px solid rgb(var(--warm-200))", borderRadius: 12, padding: "13px 14px", fontSize: 14, color: "rgb(var(--warm-900))", background: "white", outline: "none", boxSizing: "border-box" },
  textarea: { minHeight: 220, resize: "vertical", lineHeight: 1.6, fontFamily: "inherit" },
  filePicker: { width: "100%" },
  hiddenInput: { display: "none" },
  filePickerLabel: { display: "block", width: "100%", border: "1.5px dashed rgb(var(--warm-300))", borderRadius: 12, padding: "16px 14px", fontSize: 14, color: "rgb(var(--warm-700))", background: "rgb(var(--warm-50))", textAlign: "center", cursor: "pointer", boxSizing: "border-box" },
  helperText: { fontSize: 12, color: "rgb(var(--warm-500))", textAlign: "left" },
  error: { fontSize: 13, color: "rgb(var(--terra-700))", background: "rgb(var(--terra-50))", border: "1px solid rgb(var(--terra-200))", borderRadius: 8, padding: "8px 12px", textAlign: "left" },
  btn: { background: "rgb(var(--terra-600))", color: "white", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  preview: { display: "flex", flexDirection: "column", gap: 16 },
  previewCard: { background: "white", borderRadius: 16, overflow: "hidden", border: "1px solid rgb(var(--warm-200))" },
  previewImgShell: { display: "flex", justifyContent: "center", padding: "20px 20px 0" },
  previewImgWrap: { width: "min(30%, 240px)", minWidth: 180, aspectRatio: "1 / 1", position: "relative", borderRadius: 16, overflow: "hidden" },
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
