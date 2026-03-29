"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChefHat, Download, Heart, Search } from "lucide-react";
import type { RecipeSummary } from "@/types";
import { RECIPE_TYPE_OPTIONS, formatRecipeType, getRecipeType, isImportedRecipe } from "@/lib/recipe-taxonomy";
import { RecipeImage } from "@/components/recipe-image";

const SORT_OPTIONS = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "created_desc", label: "Recently created" },
  { value: "title_asc", label: "A-Z" },
  { value: "cook_time_asc", label: "Cook time" },
  { value: "type_asc", label: "Type" },
] as const;

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [recipeType, setRecipeType] = useState("");
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]["value"]>("updated_desc");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({
        q: search,
        page: String(page),
        limit: "20",
        ...(favorites ? { favorites: "true" } : {}),
        ...(recipeType ? { type: recipeType } : {}),
        ...(sort ? { sort } : {}),
      });
      const res = await fetch(`/api/recipes?${params}`);
      const json = await res.json();
      if (cancelled) return;
      setRecipes(json.data?.recipes || []);
      setTotal(json.data?.total || 0);
      setLoading(false);
    }, search ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [favorites, page, recipeType, search, sort]);

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header} className="page-header">
        <h1 style={S.title} className="page-header-title">Recipes</h1>
        <div style={S.headerActions} className="page-header-actions">
          <Link href="/recipes/import" style={S.importBtn}>
            <Download size={14} strokeWidth={2.2} />
            <span>Import</span>
          </Link>
          <Link href="/recipes/new" style={S.newBtn}>+ New</Link>
        </div>
      </div>

      {/* Search */}
      <div style={S.searchBar}>
        <div style={S.searchIcon}>
          <Search size={16} strokeWidth={2.5} />
        </div>
        <input
          style={S.searchInput}
          type="search"
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Filters */}
      <div style={S.filters}>
        <button
          style={{ ...S.filterChip, ...(favorites ? S.filterChipActive : {}) }}
          onClick={() => { setFavorites(!favorites); setPage(1); }}
        >
          <Heart size={14} strokeWidth={2.2} fill={favorites ? "currentColor" : "none"} />
          <span>Favorites</span>
        </button>
      </div>

      <div style={S.folderRow} className="recipes-folder-grid">
        <button
          style={{ ...S.folderChip, ...(!recipeType ? S.folderChipActive : {}) }}
          className="recipes-folder-chip"
          onClick={() => { setRecipeType(""); setPage(1); }}
        >
          All recipes
        </button>
        {RECIPE_TYPE_OPTIONS.map((type) => (
          <button
            key={type}
            style={{ ...S.folderChip, ...(recipeType === type ? S.folderChipActive : {}) }}
            className="recipes-folder-chip"
            onClick={() => { setRecipeType(type); setPage(1); }}
          >
            {formatRecipeType(type)}
          </button>
        ))}
      </div>

      <div style={S.sortRow}>
        <label style={S.sortLabel} htmlFor="recipes-sort">Sort</label>
        <select
          id="recipes-sort"
          style={S.sortSelect}
          value={sort}
          onChange={(e) => { setSort(e.target.value as (typeof SORT_OPTIONS)[number]["value"]); setPage(1); }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      {loading ? (
        <div style={S.grid} className="recipes-grid">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : recipes.length > 0 ? (
        <>
          <p style={S.count}>{total} recipe{total !== 1 ? "s" : ""}</p>
          <div style={S.grid} className="recipes-grid">
            {recipes.map((r) => <RecipeCard key={r.id} recipe={r} />)}
          </div>
        </>
      ) : (
        <div style={S.empty}>
          <div style={S.emptyIcon}><ChefHat size={42} strokeWidth={2} /></div>
          <p style={S.emptyTitle}>
            {search ? `No results for "${search}"` : "No recipes yet"}
          </p>
          <p style={S.emptySub}>
            {search ? "Try a different search" : "Import a recipe to get started"}
          </p>
          {!search && (
            <Link href="/recipes/import" style={S.emptyBtn}>
              <Download size={14} strokeWidth={2.2} />
              <span>Import Recipe</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const mins = recipe.totalTime || (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  const recipeType = getRecipeType(recipe.tags);
  const meta = [
    mins > 0 ? `${mins} min` : null,
    isImportedRecipe(recipe.tags) ? "Imported" : null,
    recipeType ? formatRecipeType(recipeType) : null,
    recipe.cuisine || null,
  ].filter(Boolean);

  return (
    <Link href={`/recipes/${recipe.id}`} style={S.card}>
      <div style={S.cardThumb}>
        <RecipeImage
          imageUrl={recipe.imageUrl}
          title={recipe.title}
          tags={recipe.tags}
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 280px"
          iconSize={28}
          imageStyle={S.cardImg}
        />
        {recipe.isFavorite && <div style={S.favBadge}><Heart size={13} strokeWidth={2.2} fill="currentColor" /></div>}
      </div>
      <div style={S.cardBody}>
        <p style={S.cardTitle}>{recipe.title}</p>
        {meta.length > 0 && (
          <div style={S.cardMeta}>
            {meta.map((item, index) => (
              <span key={`${recipe.id}-${item}-${index}`}>
                {index > 0 && <span style={S.dot}>· </span>}
                {item}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div style={{ ...S.card, pointerEvents: "none" }}>
      <div style={{ ...S.cardThumb, background: "rgb(var(--warm-200))" }} />
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ height: 14, background: "rgb(var(--warm-200))", borderRadius: 6, width: "85%" }} />
        <div style={{ height: 12, background: "rgb(var(--warm-100))", borderRadius: 6, width: "50%" }} />
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: "16px", minHeight: "100dvh", background: "rgb(var(--warm-50))" },
  header: {},
  title: { fontSize: 26, fontWeight: 700, fontFamily: "var(--font-serif)", color: "rgb(var(--warm-900))" },
  headerActions: { display: "flex", gap: 8 },
  importBtn: {
    background: "rgb(var(--terra-600))", color: "white", borderRadius: 8,
    padding: "8px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none",
    display: "inline-flex", alignItems: "center", gap: 8,
  },
  newBtn: {
    background: "white", color: "rgb(var(--warm-700))",
    border: "1.5px solid rgb(var(--warm-200))", borderRadius: 8,
    padding: "8px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none",
  },
  searchBar: { position: "relative", marginBottom: 12 },
  searchIcon: { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgb(var(--warm-400))" },
  searchInput: {
    width: "100%", paddingLeft: 38, paddingRight: 14, paddingTop: 11, paddingBottom: 11,
    border: "1.5px solid rgb(var(--warm-200))", borderRadius: 12, fontSize: 14,
    background: "white", outline: "none", color: "rgb(var(--warm-900))", boxSizing: "border-box",
  },
  filters: { display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" as const },
  filterChip: {
    borderWidth: "1.5px", borderStyle: "solid", borderColor: "rgb(var(--warm-200))", borderRadius: 20, padding: "6px 14px",
    fontSize: 13, fontWeight: 500, background: "white", cursor: "pointer",
    color: "rgb(var(--warm-600))", whiteSpace: "nowrap" as const, display: "inline-flex",
    alignItems: "center", gap: 6,
  },
  filterChipActive: {
    background: "rgb(var(--terra-50))", borderColor: "rgb(var(--terra-300))",
    color: "rgb(var(--terra-700))",
  },
  folderRow: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 14 },
  folderChip: {
    borderWidth: "1px", borderStyle: "solid", borderColor: "rgb(var(--warm-200))",
    borderRadius: 999, padding: "8px 10px", fontSize: 12, fontWeight: 600,
    background: "white", color: "rgb(var(--warm-600))", whiteSpace: "normal" as const,
    cursor: "pointer", textAlign: "center" as const, minHeight: 40,
  },
  folderChipActive: {
    background: "rgb(var(--terra-50))", borderColor: "rgb(var(--terra-300))", color: "rgb(var(--terra-700))",
  },
  sortRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  sortLabel: { fontSize: 12, fontWeight: 700, color: "rgb(var(--warm-500))", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  sortSelect: {
    borderWidth: "1.5px", borderStyle: "solid", borderColor: "rgb(var(--warm-200))",
    borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "rgb(var(--warm-800))",
    background: "white", outline: "none", minWidth: 180,
  },
  count: { fontSize: 12, color: "rgb(var(--warm-500))", marginBottom: 12 },
  grid: { display: "grid", gap: 12 },
  card: {
    background: "white", borderRadius: 14, overflow: "hidden",
    textDecoration: "none", border: "1px solid rgb(var(--warm-100))",
    display: "flex", flexDirection: "column", height: "100%",
  },
  cardThumb: { aspectRatio: "4/3", overflow: "hidden", background: "rgb(var(--warm-100))", position: "relative" },
  cardImg: { width: "100%", height: "100%", objectFit: "cover" },
  favBadge: { position: "absolute", top: 8, right: 8, background: "rgba(255,255,255,0.9)", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "rgb(var(--terra-600))" },
  cardBody: { padding: "12px 12px 14px", display: "flex", flexDirection: "column", minHeight: 78, flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: 600, color: "rgb(var(--warm-900))", lineHeight: 1.35, marginBottom: 10, flex: 1 },
  cardMeta: { fontSize: 11, color: "rgb(var(--warm-500))", display: "flex", gap: 4, flexWrap: "wrap" as const, alignItems: "center", marginTop: "auto" },
  dot: { color: "rgb(var(--warm-300))" },
  empty: { textAlign: "center", padding: "60px 20px" },
  emptyIcon: { marginBottom: 16, color: "rgb(var(--terra-600))", display: "flex", alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 17, fontWeight: 600, color: "rgb(var(--warm-800))", marginBottom: 8 },
  emptySub: { fontSize: 14, color: "rgb(var(--warm-500))", marginBottom: 20 },
  emptyBtn: { background: "rgb(var(--terra-600))", color: "white", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 },
};
