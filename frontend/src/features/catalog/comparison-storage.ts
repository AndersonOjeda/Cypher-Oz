"use client";

export interface ComparisonItem {
  id: number;
  name: string;
  slug: string;
  category_id: number;
  category_name?: string;
  image_url?: string | null;
}

const STORAGE_KEY = "tti.comparison.items";

export function getComparisonItems(): ComparisonItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is ComparisonItem => !!item && Number.isSafeInteger(item.id) && item.id > 0 && typeof item.name === "string" && typeof item.slug === "string" && Number.isSafeInteger(item.category_id)).slice(0, 4) : [];
  } catch {
    return [];
  }
}

export function saveComparisonItems(items: ComparisonItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const json = JSON.stringify(items);
    sessionStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(STORAGE_KEY, json);
    window.dispatchEvent(new Event("comparison-updated"));
  } catch {
    // Ignore storage quota errors
  }
}

export function addToComparison(
  item: ComparisonItem
): { success: boolean; error?: string } {
  const current = getComparisonItems();
  if (current.some((x) => x.id === item.id)) {
    return { success: true };
  }
  if (current.length >= 4) {
    return {
      success: false,
      error: "Solo puedes comparar hasta 4 productos a la vez.",
    };
  }
  if (current.length > 0 && current[0].category_id !== item.category_id) {
    return {
      success: false,
      error: `Solo puedes comparar productos de la misma categoría (${current[0].category_name || "categoría actual"}).`,
    };
  }
  const next = [...current, item];
  saveComparisonItems(next);
  return { success: true };
}

export function removeFromComparison(id: number): void {
  const current = getComparisonItems();
  const next = current.filter((x) => x.id !== id);
  saveComparisonItems(next);
}

export function clearComparison(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("comparison-updated"));
  } catch {
    // Ignore
  }
}

export function isInComparison(id: number): boolean {
  const current = getComparisonItems();
  return current.some((x) => x.id === id);
}

