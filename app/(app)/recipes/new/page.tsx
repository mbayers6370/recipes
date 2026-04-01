"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RecipeManualForm } from "@/components/recipe-manual-form";

export default function NewRecipePage() {
  const router = useRouter();

  return (
    <div style={S.page}>
      <div style={S.header} className="page-header">
        <h1 style={S.title} className="page-header-title">New Recipe</h1>
        <div style={S.headerActions} className="page-header-actions">
          <button onClick={() => router.back()} style={S.backBtn}>
            <ArrowLeft size={16} strokeWidth={2.2} />
            <span>Back</span>
          </button>
        </div>
      </div>
      <RecipeManualForm />
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: "16px", minHeight: "100dvh", background: "rgb(var(--warm-50))" },
  header: {},
  headerActions: { display: "flex", gap: 8 },
  backBtn: { background: "none", border: "none", fontSize: 14, color: "rgb(var(--terra-600))", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 },
  title: { fontSize: 20, fontWeight: 700, fontFamily: "var(--font-serif)", letterSpacing: "var(--tracking-display)", color: "rgb(var(--warm-900))" },
};
