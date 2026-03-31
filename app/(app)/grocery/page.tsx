"use client";

import { useEffect, useState } from "react";
import { Check, ShoppingCart, Trash2 } from "lucide-react";
import type { GroceryList, GroceryItem } from "@/types";
import {
  GROCERY_SECTION_LABELS,
  GROCERY_SECTION_ORDER,
  getGrocerySection,
  type GrocerySectionId,
} from "@/lib/grocery-sections";
import { normalizeGroceryName } from "@/lib/grocery-normalization";
import { isMeaningfulIngredientName } from "@/lib/ingredient-normalization";

function getDisplayName(name?: string | null) {
  return normalizeGroceryName(name) || (name || "").trim();
}

function isRenderableGroceryItem(item: GroceryItem) {
  return isMeaningfulIngredientName(item.name);
}

function sortGroceryItems(items: GroceryItem[]) {
  return [...items].sort((a, b) => {
    if (a.isChecked !== b.isChecked) return a.isChecked ? 1 : -1;
    const aCheckedAt = a.checkedAt ? new Date(a.checkedAt).getTime() : 0;
    const bCheckedAt = b.checkedAt ? new Date(b.checkedAt).getTime() : 0;
    return aCheckedAt - bCheckedAt;
  });
}

type GrocerySortMode = "aisle" | "alpha";

function sortVisibleItems(items: GroceryItem[], sortMode: GrocerySortMode) {
  if (sortMode === "alpha") {
    return [...items].sort((a, b) =>
      getDisplayName(a.name).localeCompare(getDisplayName(b.name), undefined, { sensitivity: "base" })
    );
  }

  return sortGroceryItems(items);
}

function groupItemsBySection(items: GroceryItem[]) {
  const buckets = new Map<GrocerySectionId, GroceryItem[]>();

  for (const sectionId of GROCERY_SECTION_ORDER) {
    buckets.set(sectionId, []);
  }

  for (const item of items) {
    const section = getGrocerySection(item.name, item.category);
    buckets.get(section)?.push(item);
  }

  return GROCERY_SECTION_ORDER.map((sectionId) => ({
    id: sectionId,
    label: GROCERY_SECTION_LABELS[sectionId],
    items: buckets.get(sectionId) || [],
  })).filter((section) => section.items.length > 0);
}

export default function GroceryPage() {
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [activeList, setActiveList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [sortMode, setSortMode] = useState<GrocerySortMode>("aisle");

  const fetchLists = async () => {
    const res = await fetch("/api/grocery");
    const json = await res.json();
    const data: GroceryList[] = json.data || [];
    setLists(data);
    setActiveList((current) => {
      if (!data.length) return null;
      if (current) {
        const matching = data.find((list) => list.id === current.id);
        if (matching) return matching;
      }
      return data[0];
    });
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadLists() {
      const res = await fetch("/api/grocery");
      const json = await res.json();
      const data: GroceryList[] = json.data || [];
      if (cancelled) return;
      setLists(data);
      setActiveList(data[0] || null);
      setLoading(false);
    }

    void loadLists();
    return () => {
      cancelled = true;
    };
  }, []);

  const createList = async () => {
    const name = prompt("List name:", "This Week");
    if (!name) return;
    const res = await fetch("/api/grocery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_list", name }),
    });
    const json = await res.json();
    await fetchLists();
    setActiveList(json.data);
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList || !newItem.trim()) return;
    setAddingItem(true);
    await fetch("/api/grocery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId: activeList.id, name: newItem.trim() }),
    });
    setNewItem("");
    setAddingItem(false);
    fetchLists();
  };

  const toggleItem = async (item: GroceryItem) => {
    await fetch(`/api/grocery/${activeList?.id}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isChecked: !item.isChecked }),
    });
    // Optimistic update
    if (activeList) {
      const nextItems = sortGroceryItems(
        activeList.items.map((it) =>
          it.id === item.id
            ? {
                ...it,
                isChecked: !it.isChecked,
                checkedAt: !it.isChecked ? new Date().toISOString() : null,
              }
            : it
        )
      );

      setActiveList({
        ...activeList,
        items: nextItems,
      });
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!activeList) return;

    await fetch(`/api/grocery/${activeList.id}/items/${itemId}`, {
      method: "DELETE",
    });

    const nextItems = activeList.items.filter((item) => item.id !== itemId);
    setActiveList({ ...activeList, items: nextItems });
    setLists((prev) =>
      prev.map((list) =>
        list.id === activeList.id ? { ...list, items: nextItems } : list
      )
    );
  };

  const deleteList = async () => {
    if (!activeList) return;
    const confirmed = confirm(`Delete "${activeList.name}"?`);
    if (!confirmed) return;

    await fetch(`/api/grocery?listId=${activeList.id}`, {
      method: "DELETE",
    });

    const nextLists = lists.filter((list) => list.id !== activeList.id);
    setLists(nextLists);
    setActiveList(nextLists[0] || null);
  };

  const unchecked = sortVisibleItems(
    activeList?.items.filter((i) => !i.isChecked && isRenderableGroceryItem(i)) || [],
    sortMode
  );
  const checked = sortVisibleItems(
    activeList?.items.filter((i) => i.isChecked && isRenderableGroceryItem(i)) || [],
    sortMode
  );

  return (
    <div style={S.page}>
      <div style={S.header} className="page-header">
        <h1 style={S.title} className="page-header-title">Grocery</h1>
        <div className="page-header-actions">
          <button onClick={createList} style={S.newListBtn}>+ New List</button>
          {activeList && (
            <button onClick={deleteList} style={S.deleteListBtn}>Delete List</button>
          )}
        </div>
      </div>

      {/* List tabs */}
      {lists.length > 0 && (
        <div style={S.listTabs}>
          {lists.map((list) => (
            <button
              key={list.id}
              style={{ ...S.listTab, ...(activeList?.id === list.id ? S.listTabActive : {}) }}
              onClick={() => setActiveList(list)}
            >
              <span>{list.name}</span>
              <span style={S.listCount}>{list._count?.items ?? list.items.length}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : !activeList ? (
        <EmptyState onCreate={createList} />
      ) : (
        <>
          {/* Add item */}
          <form onSubmit={addItem} style={S.addForm}>
            <input
              style={S.addInput}
              type="text"
              placeholder="Add an item…"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
            />
            <button type="submit" disabled={addingItem || !newItem.trim()} style={S.addBtn}>
              Add
            </button>
          </form>

          <div style={S.sortRow}>
            <span style={S.sortLabel}>Sort</span>
            <div style={S.sortToggle}>
              <button
                type="button"
                style={{ ...S.sortBtn, ...(sortMode === "aisle" ? S.sortBtnActive : {}) }}
                onClick={() => setSortMode("aisle")}
              >
                By aisle
              </button>
              <button
                type="button"
                style={{ ...S.sortBtn, ...(sortMode === "alpha" ? S.sortBtnActive : {}) }}
                onClick={() => setSortMode("alpha")}
              >
                A-Z
              </button>
            </div>
          </div>

          {/* Items */}
          {unchecked.length === 0 && checked.length === 0 ? (
            <div style={S.emptyList}>
              <p style={{ fontSize: 14, color: "rgb(var(--warm-400))" }}>
                List is empty. Add items above!
              </p>
            </div>
          ) : (
            <div style={S.itemsWrap}>
              {unchecked.length > 0 && (
                <div style={S.itemGroup}>
                  {sortMode === "aisle"
                    ? groupItemsBySection(unchecked).map((section) => (
                        <div key={section.id}>
                          <p style={S.sectionHeader}>{section.label}</p>
                          {section.items.map((item) => (
                            <GroceryItemRow
                              key={item.id}
                              item={item}
                              onToggle={() => toggleItem(item)}
                              onDelete={() => deleteItem(item.id)}
                            />
                          ))}
                        </div>
                      ))
                    : unchecked.map((item) => (
                        <GroceryItemRow
                          key={item.id}
                          item={item}
                          onToggle={() => toggleItem(item)}
                          onDelete={() => deleteItem(item.id)}
                        />
                      ))}
                </div>
              )}

              {checked.length > 0 && (
                <>
                  <p style={S.checkedHeader}>Checked ({checked.length})</p>
                  <div style={{ ...S.itemGroup, opacity: 0.55 }}>
                    {sortMode === "aisle"
                      ? groupItemsBySection(checked).map((section) => (
                          <div key={section.id}>
                            <p style={S.sectionHeader}>{section.label}</p>
                            {section.items.map((item) => (
                              <GroceryItemRow
                                key={item.id}
                                item={item}
                                onToggle={() => toggleItem(item)}
                                onDelete={() => deleteItem(item.id)}
                              />
                            ))}
                          </div>
                        ))
                      : checked.map((item) => (
                          <GroceryItemRow
                            key={item.id}
                            item={item}
                            onToggle={() => toggleItem(item)}
                            onDelete={() => deleteItem(item.id)}
                          />
                        ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GroceryItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: GroceryItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const displayName = getDisplayName(item.name);

  return (
    <div style={{ ...IS.row, ...(item.isChecked ? IS.rowChecked : {}) }}>
      <button
        type="button"
        aria-label={`Toggle ${displayName}`}
        style={{ ...IS.check, ...(item.isChecked ? IS.checkDone : {}) }}
        onClick={onToggle}
      >
        {item.isChecked && <Check size={12} strokeWidth={3} />}
      </button>
      <div style={IS.info}>
        <span style={{ ...IS.name, ...(item.isChecked ? IS.nameChecked : {}) }}>
          {displayName}
        </span>
        {(item.amount || item.unit) && (
          <span style={IS.amount}>
            {[item.amount, item.unit].filter(Boolean).join(" ")}
          </span>
        )}
      </div>
      {item.category && <span style={IS.cat}>{item.category}</span>}
      <button type="button" aria-label={`Delete ${displayName}`} style={IS.deleteBtn} onClick={onDelete}>
        <Trash2 size={14} strokeWidth={2.1} />
      </button>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16, color: "rgb(var(--terra-600))" }}>
        <ShoppingCart size={44} strokeWidth={2} />
      </div>
      <p style={{ fontSize: 17, fontWeight: 600, color: "rgb(var(--warm-800))", marginBottom: 8 }}>
        No grocery lists yet
      </p>
      <p style={{ fontSize: 14, color: "rgb(var(--warm-500))", marginBottom: 20 }}>
        Create a list and add items, or add ingredients from any recipe.
      </p>
      <button onClick={onCreate} style={{ background: "rgb(var(--terra-600))", color: "white", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
        Create List
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "20px 0" }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{ height: 52, background: "rgb(var(--warm-100))", borderRadius: 10 }} />
      ))}
    </div>
  );
}

const IS: Record<string, React.CSSProperties> = {
  row: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", width: "100%", background: "none", textAlign: "left", borderBottom: "1px solid rgb(var(--warm-100))" },
  rowChecked: {},
  check: { width: 22, height: 22, borderRadius: "50%", border: "2px solid rgb(var(--warm-300))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, color: "white", background: "white", cursor: "pointer", padding: 0 },
  checkDone: { background: "rgb(var(--terra-500))", border: "2px solid rgb(var(--terra-500))" },
  info: { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  name: { fontSize: 15, color: "rgb(var(--warm-800))", fontWeight: 500 },
  nameChecked: { textDecoration: "line-through", color: "rgb(var(--warm-400))" },
  amount: { fontSize: 12, color: "rgb(var(--warm-400))" },
  cat: { fontSize: 11, color: "rgb(var(--warm-400))", background: "rgb(var(--warm-100))", borderRadius: 20, padding: "2px 8px" },
  deleteBtn: { background: "transparent", border: "none", color: "rgb(var(--warm-400))", cursor: "pointer", width: 28, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 },
};

const S: Record<string, React.CSSProperties> = {
  page: {
    padding: "16px",
    minHeight: "100dvh",
    background: "rgb(var(--warm-50))",
    width: "100%",
    maxWidth: 960,
    margin: "0 auto",
  },
  header: {},
  title: { fontSize: 26, fontWeight: 700, fontFamily: "var(--font-serif)", color: "rgb(var(--warm-900))" },
  newListBtn: { background: "rgb(var(--terra-600))", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  deleteListBtn: { background: "rgb(var(--warm-50))", color: "rgb(var(--terra-700))", border: "1px solid rgb(var(--terra-200))", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  listTabs: { display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 2 },
  listTab: { border: "1px solid rgb(var(--warm-200))", borderRadius: 14, padding: "10px 12px", fontSize: 13, fontWeight: 600, background: "white", cursor: "pointer", color: "rgb(var(--warm-700))", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 8 },
  listTabActive: { background: "linear-gradient(180deg, rgba(243, 232, 224, 0.9) 0%, rgba(255,255,255,0.98) 100%)", borderColor: "rgb(var(--terra-200))", color: "rgb(var(--warm-900))" },
  listCount: { fontSize: 11, fontWeight: 700, padding: "3px 7px", borderRadius: 999, background: "rgba(53,49,46,0.08)", color: "inherit" },
  addForm: { display: "flex", gap: 8, marginBottom: 16, background: "white", border: "1px solid rgb(var(--warm-200))", borderRadius: 16, padding: 10 },
  addInput: { flex: 1, border: "1.5px solid rgb(var(--warm-200))", borderRadius: 10, padding: "11px 14px", fontSize: 14, background: "white", outline: "none", color: "rgb(var(--warm-900))" },
  addBtn: { background: "rgb(var(--terra-600))", color: "white", border: "none", borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  sortRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  sortLabel: { fontSize: 11, fontWeight: 700, color: "rgb(var(--warm-500))", textTransform: "uppercase", letterSpacing: "0.06em" },
  sortToggle: { display: "inline-flex", alignItems: "center", gap: 6, background: "white", border: "1px solid rgb(var(--warm-200))", borderRadius: 999, padding: 4 },
  sortBtn: { border: "none", background: "transparent", color: "rgb(var(--warm-500))", borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  sortBtnActive: { background: "rgb(var(--terra-50))", color: "rgb(var(--terra-700))" },
  itemsWrap: { background: "white", borderRadius: 18, border: "1px solid rgb(var(--warm-200))", overflow: "hidden" },
  itemGroup: {},
  sectionHeader: { fontSize: 11, fontWeight: 700, color: "rgb(var(--terra-700))", textTransform: "uppercase", padding: "14px 14px 6px", letterSpacing: "0.06em", background: "rgba(243, 232, 224, 0.38)" },
  checkedHeader: { fontSize: 11, fontWeight: 700, color: "rgb(var(--warm-400))", textTransform: "uppercase", padding: "10px 14px 6px", letterSpacing: "0.05em" },
  emptyList: { textAlign: "center", padding: "40px 20px", background: "white", borderRadius: 18, border: "1px solid rgb(var(--warm-200))" },
};
