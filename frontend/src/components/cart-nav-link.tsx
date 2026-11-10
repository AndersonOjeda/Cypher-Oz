"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { loadCart } from "@/features/orders/cart-storage";

function countCartItems() {
  return loadCart().items.reduce((total, item) => total + item.quantity, 0);
}

export function CartNavLink({ className }: { className?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(countCartItems());
    sync();
    window.addEventListener("cart-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cart-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <Link
      href="/comprar"
      className={className ?? "inline-flex items-center gap-1.5"}
      aria-label={`Carrito de compras, ${count} ${count === 1 ? "producto" : "productos"}`}
    >
      <ShoppingCart size={16} aria-hidden="true" />
      <span>Carrito</span>
      {count > 0 && (
        <span
          className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full bg-blue-600 text-white"
          data-testid="cart-badge"
        >
          {count}
        </span>
      )}
    </Link>
  );
}
