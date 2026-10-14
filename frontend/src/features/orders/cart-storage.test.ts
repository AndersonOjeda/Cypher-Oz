import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addToCart,
  CART_STORAGE_KEY,
  clearCart,
  loadCart,
  removeFromCart,
  saveCart,
  updateCartQuantity,
} from "./cart-storage";

describe("Anonymous Cart Storage (HU-08 / RF-13 / RF-14)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("stores items in localStorage with TTL metadata", () => {
    const lines = [{ variant_id: 10, quantity: 2, label: "Laptop Core i7" }];
    saveCart(lines, 7);

    const raw = localStorage.getItem(CART_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.items).toEqual(lines);
    expect(parsed.expires).toBeGreaterThan(Date.now());

    const loaded = loadCart();
    expect(loaded.items).toHaveLength(1);
    expect(loaded.items[0]).toEqual(lines[0]);
  });

  it("adds items and increments quantity when the same variant is added", () => {
    addToCart(10, 2, "Laptop Gamer");
    let { items } = loadCart();
    expect(items).toEqual([{ variant_id: 10, quantity: 2, label: "Laptop Gamer" }]);

    addToCart(10, 3, "Laptop Gamer");
    items = loadCart().items;
    expect(items).toEqual([{ variant_id: 10, quantity: 5, label: "Laptop Gamer" }]);

    addToCart(20, 1, "Mouse Inalámbrico");
    items = loadCart().items;
    expect(items).toHaveLength(2);
    expect(items[1]).toEqual({ variant_id: 20, quantity: 1, label: "Mouse Inalámbrico" });
  });

  it("updates quantity and removes line when quantity is 0", () => {
    addToCart(1, 4, "Teclado RGB");
    addToCart(2, 1, "Pad Mouse");

    updateCartQuantity(1, 2);
    let { items } = loadCart();
    expect(items.find((i) => i.variant_id === 1)?.quantity).toBe(2);

    removeFromCart(1);
    items = loadCart().items;
    expect(items.find((i) => i.variant_id === 1)).toBeUndefined();
    expect(items).toHaveLength(1);
  });

  it("cleans up expired carts and returns empty list", () => {
    const expiredPayload = {
      expires: Date.now() - 1000,
      items: [{ variant_id: 5, quantity: 1, label: "Cámara Web" }],
    };
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(expiredPayload));

    const { items, expires } = loadCart();
    expect(items).toEqual([]);
    expect(expires).toBeNull();
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });

  it("recovers gracefully from corrupted data in localStorage", () => {
    localStorage.setItem(CART_STORAGE_KEY, "invalid-json-content{");
    const { items } = loadCart();
    expect(items).toEqual([]);
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });

  it("sanitizes invalid cart line structures", () => {
    const invalidPayload = {
      expires: Date.now() + 100000,
      items: [
        { variant_id: -1, quantity: 2, label: "Bad ID" },
        { variant_id: 3, quantity: -5, label: "Bad quantity" },
        { variant_id: 4, quantity: 2, label: "Valid Item" },
      ],
    };
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(invalidPayload));

    const { items } = loadCart();
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ variant_id: 4, quantity: 2, label: "Valid Item" });
  });

  it("dispatches cart-updated event on save and clear", () => {
    const listener = vi.fn();
    window.addEventListener("cart-updated", listener);

    addToCart(7, 1, "Auriculares");
    expect(listener).toHaveBeenCalledTimes(1);

    clearCart();
    expect(listener).toHaveBeenCalledTimes(2);

    window.removeEventListener("cart-updated", listener);
  });
});

