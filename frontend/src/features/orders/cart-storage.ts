import type { CartLine } from "./types";

export const CART_STORAGE_KEY = "tti.purchase.cart";
export const DEFAULT_CART_TTL_DAYS = 7;

export type StoredCart = {
  expires: number;
  items: CartLine[];
};

export function sanitizeCartLine(item: unknown): CartLine | null {
  if (!item || typeof item !== "object") return null;
  const cast = item as Partial<CartLine>;
  if (
    !Number.isSafeInteger(cast.variant_id) ||
    (cast.variant_id ?? 0) <= 0 ||
    !Number.isSafeInteger(cast.quantity) ||
    (cast.quantity ?? 0) <= 0 ||
    (cast.quantity ?? 0) > 10000 ||
    typeof cast.label !== "string"
  ) {
    return null;
  }
  return {
    variant_id: cast.variant_id as number,
    quantity: cast.quantity as number,
    label: cast.label.slice(0, 200),
    ...(typeof cast.unit_price === "string" &&
    /^\d{1,12}\.\d{2}$/.test(cast.unit_price)
      ? { unit_price: cast.unit_price }
      : {}),
  };
}

export function loadCart(): { items: CartLine[]; expires: number | null } {
  if (typeof window === "undefined") {
    return { items: [], expires: null };
  }
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return { items: [], expires: null };

    const parsed = JSON.parse(raw) as Partial<StoredCart>;
    if (!parsed || typeof parsed !== "object") {
      localStorage.removeItem(CART_STORAGE_KEY);
      return { items: [], expires: null };
    }

    if (
      typeof parsed.expires !== "number" ||
      !Number.isFinite(parsed.expires) ||
      Date.now() >= parsed.expires
    ) {
      localStorage.removeItem(CART_STORAGE_KEY);
      return { items: [], expires: null };
    }

    if (!Array.isArray(parsed.items)) {
      localStorage.removeItem(CART_STORAGE_KEY);
      return { items: [], expires: null };
    }

    const sanitized: CartLine[] = [];
    for (const item of parsed.items) {
      const valid = sanitizeCartLine(item);
      if (valid) sanitized.push(valid);
      if (sanitized.length >= 100) break;
    }

    return { items: sanitized, expires: parsed.expires };
  } catch {
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      /* ignore storage failure */
    }
    return { items: [], expires: null };
  }
}

export function saveCart(
  items: CartLine[],
  ttlDays: number = DEFAULT_CART_TTL_DAYS,
  existingExpires?: number | null,
): void {
  if (typeof window === "undefined") return;

  const validTtl =
    Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : DEFAULT_CART_TTL_DAYS;
  const expires =
    existingExpires && existingExpires > Date.now()
      ? existingExpires
      : Date.now() + validTtl * 24 * 60 * 60 * 1000;

  const sanitized: CartLine[] = [];
  for (const item of items) {
    const valid = sanitizeCartLine(item);
    if (valid) sanitized.push(valid);
    if (sanitized.length >= 100) break;
  }

  const payload: StoredCart = { expires, items: sanitized };
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event("cart-updated"));
  } catch {
    /* ignore storage failure */
  }
}

export function addToCart(
  variantId: number,
  quantity: number,
  label: string,
  ttlDays: number = DEFAULT_CART_TTL_DAYS,
  unitPrice?: string,
): CartLine[] {
  if (!Number.isSafeInteger(variantId) || variantId <= 0) return [];
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return [];

  const { items, expires } = loadCart();
  const existing = items.find((i) => i.variant_id === variantId);

  let updated: CartLine[];
  if (existing) {
    updated = items.map((i) =>
      i.variant_id === variantId
        ? {
            ...i,
            quantity: Math.min(10000, i.quantity + quantity),
            label: label || i.label,
          }
        : i,
    );
  } else {
    updated = [
      ...items,
      {
        variant_id: variantId,
        quantity: Math.min(10000, quantity),
        label,
        unit_price: unitPrice,
      },
    ];
  }

  saveCart(updated, ttlDays, expires);
  return updated;
}

export function updateCartQuantity(
  variantId: number,
  quantity: number,
  ttlDays: number = DEFAULT_CART_TTL_DAYS,
): CartLine[] {
  const { items, expires } = loadCart();
  let updated: CartLine[];
  if (quantity <= 0) {
    updated = items.filter((i) => i.variant_id !== variantId);
  } else {
    updated = items.map((i) =>
      i.variant_id === variantId
        ? { ...i, quantity: Math.min(10000, quantity) }
        : i,
    );
  }
  saveCart(updated, ttlDays, expires);
  return updated;
}

export function removeFromCart(variantId: number): CartLine[] {
  return updateCartQuantity(variantId, 0);
}

export function clearCart(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
    window.dispatchEvent(new Event("cart-updated"));
  } catch {
    /* ignore storage failure */
  }
}
