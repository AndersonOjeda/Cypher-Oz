"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Package, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api, ApiError, type Address, type User } from "@/services/api";
import { errorText, Pager, useResource } from "@/features/catalog/shared";
import type { Page } from "@/features/catalog/types";
import {
  cop,
  type CartLine,
  type CheckoutBody,
  type Order,
  type Quote,
} from "./types";

type Variant = {
  id: number;
  product_name: string;
  name: string;
  sku: string;
  price: string;
  stock: number;
  image_url: string | null;
};
type Attempt = {
  userId: number;
  key: string;
  body: CheckoutBody & { quote_token: string };
};
const CART = "tti.purchase.cart";
const ATTEMPT = "tti.purchase.attempt";

export function Purchase() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const variants = useResource<Page<Variant> & { cart_ttl_days: number }>(
    `/purchase/variants/?page=${page}&search=${encodeURIComponent(search)}`,
    revision,
  );
  const [cart, setCart] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState("");
  const [mode, setMode] = useState("URBAN");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const submitting = useRef(false);
  const authRevision = useRef(0);
  const cartExpiry = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try {
        const saved = JSON.parse(localStorage.getItem(CART) ?? "null");
        if (saved && Date.now() < saved.expires && Array.isArray(saved.items)) {
          cartExpiry.current = saved.expires;
          setCart(
            saved.items
              .filter(
                (item: CartLine) =>
                  Number.isSafeInteger(item.variant_id) &&
                  item.variant_id > 0 &&
                  Number.isSafeInteger(item.quantity) &&
                  item.quantity > 0 &&
                  item.quantity <= 10000 &&
                  typeof item.label === "string",
              )
              .slice(0, 100),
          );
        }
      } catch {
        /* A damaged cart must not prevent a new purchase. */
      }
      setReady(true);
    });
    async function loadIdentity() {
      const generation = ++authRevision.current;
      try {
        const current = await api<User>("/users/me/");
        if (!active || generation !== authRevision.current) return;
        setUser(current);
        const saved = current.addresses ?? [];
        setAddresses(saved);
        setAddressId((id) =>
          saved.some((a) => String(a.id) === id)
            ? id
            : String(saved.find((a) => a.is_default)?.id ?? saved[0]?.id ?? ""),
        );
        setQuote(null);
        setAttempt(null);
        try {
          const pending = JSON.parse(
            sessionStorage.getItem(ATTEMPT) ?? "null",
          ) as Attempt | null;
          if (
            pending?.userId === current.id &&
            typeof pending.key === "string" &&
            pending.body?.quote_token
          )
            setAttempt(pending);
        } catch {
          /* Storage is optional; memory still preserves a retry. */
        }
      } catch (err) {
        if (!active || generation !== authRevision.current) return;
        if (!(err instanceof ApiError && err.status === 401))
          setError(errorText(err));
        setUser(null);
        setAddresses([]);
      }
    }
    void loadIdentity();
    window.addEventListener("focus", loadIdentity);
    return () => {
      active = false;
      window.removeEventListener("focus", loadIdentity);
    };
  }, []);

  function updateCart(next: CartLine[]) {
    setCart(next);
    setQuote(null);
    setError("");
    try {
      cartExpiry.current ??=
        Date.now() + 86400000 * (variants.data?.cart_ttl_days ?? 0);
      localStorage.setItem(
        CART,
        JSON.stringify({ items: next, expires: cartExpiry.current }),
      );
    } catch {
      setError(
        "La compra está disponible en esta pestaña, pero no pudo guardarse en el navegador.",
      );
    }
  }

  function body(): CheckoutBody {
    return {
      items: cart.map(({ variant_id, quantity }) => ({ variant_id, quantity })),
      address_id: mode === "PICKUP" ? null : Number(addressId) || null,
      delivery_mode: mode,
    };
  }

  async function review() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setQuote(null);
    try {
      setQuote(
        await api<Quote>("/checkout/preview/", {
          method: "POST",
          body: JSON.stringify(body()),
        }),
      );
    } catch (err) {
      setError(errorText(err));
      if (err instanceof ApiError && err.status === 401) setUser(null);
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }

  async function confirm() {
    if (submitting.current || !user || (!attempt && !quote?.can_confirm))
      return;
    const current = attempt ?? {
      userId: user.id,
      key: crypto.randomUUID(),
      body: { ...body(), quote_token: quote!.quote_token },
    };
    if (current.userId !== user.id) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setAttempt(current);
    try {
      sessionStorage.setItem(ATTEMPT, JSON.stringify(current));
    } catch {
      /* Keep the stable key in memory. */
    }
    try {
      const order = await api<Order>("/orders/", {
        method: "POST",
        headers: { "Idempotency-Key": current.key },
        body: JSON.stringify(current.body),
      });
      try {
        sessionStorage.removeItem(ATTEMPT);
        localStorage.removeItem(CART);
      } catch {
        /* Order is already committed. */
      }
      router.push(`/pedidos/${order.number}`);
    } catch (err) {
      setError(errorText(err));
      if (err instanceof ApiError && [400, 404, 409].includes(err.status)) {
        setAttempt(null);
        setQuote(null);
        try {
          sessionStorage.removeItem(ATTEMPT);
        } catch {
          /* No pending order was created. */
        }
      }
      if (err instanceof ApiError && err.status === 401) setUser(null);
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }

  return (
    <section className="purchase-shell">
      <div className="purchase-heading">
        <h1>Comprar en TTI</h1>
        <Link href="/pedidos">Mis pedidos</Link>
        <Link href="/cuenta">Mi cuenta</Link>
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <div className="purchase-layout">
        <section aria-labelledby="products-title">
          <h2 id="products-title">Productos</h2>
          <label className="field">
            Buscar productos
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          {variants.loading && <p role="status">Cargando productos...</p>}
          {variants.error && (
            <p role="alert">
              {variants.error}{" "}
              <button
                title="Reintentar productos"
                aria-label="Reintentar productos"
                onClick={() => setRevision((n) => n + 1)}
              >
                <RefreshCw size={18} />
              </button>
            </p>
          )}
          <div className="purchase-products">
            {variants.data?.results.map((variant) => (
              <article key={variant.id} className="purchase-product">
                {variant.image_url ? (
                  <Image
                    unoptimized
                    src={variant.image_url}
                    alt={variant.product_name}
                    width={240}
                    height={180}
                  />
                ) : (
                  <div className="purchase-no-image">
                    <Package size={36} aria-hidden="true" />
                    <span>Sin imagen</span>
                  </div>
                )}
                <h3>{variant.product_name}</h3>
                <p>
                  {variant.name} · {variant.sku}
                </p>
                <strong>{cop(variant.price)}</strong>
                <p>
                  {variant.stock > 0
                    ? `${variant.stock} disponibles`
                    : "Agotado"}
                </p>
                <button
                  className="button primary"
                  disabled={
                    !ready ||
                    busy ||
                    !!attempt ||
                    variant.stock === 0 ||
                    cart.length >= 100
                  }
                  onClick={() => {
                    const line = cart.find(
                      (item) => item.variant_id === variant.id,
                    );
                    if (
                      line &&
                      line.quantity >= Math.min(variant.stock, 10000)
                    ) {
                      setError("No hay más unidades disponibles.");
                      return;
                    }
                    updateCart(
                      line
                        ? cart.map((item) =>
                            item === line
                              ? { ...item, quantity: item.quantity + 1 }
                              : item,
                          )
                        : [
                            ...cart,
                            {
                              variant_id: variant.id,
                              quantity: 1,
                              label: `${variant.product_name} · ${variant.sku}`,
                            },
                          ],
                    );
                  }}
                >
                  <Plus size={18} aria-hidden="true" /> Agregar
                </button>
              </article>
            ))}
          </div>
          {variants.data?.count === 0 && <p>No hay productos disponibles.</p>}
          {variants.data && (
            <Pager page={page} data={variants.data} onChange={setPage} />
          )}
        </section>
        <section aria-labelledby="checkout-title" className="purchase-checkout">
          <h2 id="checkout-title">Tu compra</h2>
          {!ready ? (
            <p role="status">Cargando compra...</p>
          ) : cart.length === 0 ? (
            <p>No hay productos en tu compra.</p>
          ) : (
            <>
              <ul className="purchase-lines">
                {cart.map((line) => (
                  <li key={line.variant_id}>
                    <span>{line.label}</span>
                    <label>
                      Cantidad
                      <input
                        type="number"
                        aria-label={`Cantidad ${line.label}`}
                        min={1}
                        max={10000}
                        value={line.quantity}
                        disabled={busy || !!attempt}
                        onChange={(e) => {
                          const quantity = e.target.valueAsNumber;
                          if (
                            Number.isSafeInteger(quantity) &&
                            quantity > 0 &&
                            quantity <= 10000
                          )
                            updateCart(
                              cart.map((item) =>
                                item === line ? { ...item, quantity } : item,
                              ),
                            );
                        }}
                      />
                    </label>
                    <button
                      className="purchase-icon"
                      title={`Quitar ${line.label}`}
                      aria-label={`Quitar ${line.label}`}
                      disabled={busy || !!attempt}
                      onClick={() =>
                        updateCart(cart.filter((item) => item !== line))
                      }
                    >
                      <Trash2 size={18} />
                    </button>
                  </li>
                ))}
              </ul>
              {!user ? (
                <div className="purchase-actions">
                  <Link className="button primary" href="/login?next=/comprar">
                    Iniciar sesión para continuar
                  </Link>
                  <Link href="/registro?next=/comprar">Crear cuenta</Link>
                </div>
              ) : (
                <>
                  <fieldset disabled={busy || !!attempt}>
                    <legend>Entrega</legend>
                    <label>
                      Modalidad
                      <select
                        value={mode}
                        onChange={(e) => {
                          setMode(e.target.value);
                          setQuote(null);
                        }}
                      >
                        <option value="URBAN">Domicilio urbano en Pasto</option>
                        <option value="PICKUP">Recogida en tienda</option>
                        <option value="SPECIAL">
                          Zona especial / fuera del área urbana
                        </option>
                      </select>
                    </label>
                    {mode !== "PICKUP" && (
                      <label>
                        Dirección
                        <select
                          value={addressId}
                          onChange={(e) => {
                            setAddressId(e.target.value);
                            setQuote(null);
                          }}
                        >
                          <option value="">Selecciona una dirección</option>
                          {addresses.map((address) => (
                            <option value={address.id} key={address.id}>
                              {address.label}: {address.address_line},{" "}
                              {address.city}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <Link href="/cuenta">Gestionar direcciones</Link>
                  </fieldset>
                  {!attempt && (
                    <button
                      className="button primary"
                      disabled={busy || (mode !== "PICKUP" && !addressId)}
                      onClick={review}
                    >
                      {busy ? "Consultando..." : "Revisar total"}
                    </button>
                  )}
                </>
              )}
            </>
          )}
          {quote && (
            <section
              aria-label="Revisión de compra"
              className="purchase-review"
            >
              <h3>Revisión de compra</h3>
              {quote.items.map((line) => (
                <p key={line.variant_id}>
                  {line.product_name} × {line.quantity}:{" "}
                  <strong>{cop(line.total)}</strong>
                </p>
              ))}
              {!!quote.address.address_line && (
                <p>
                  {quote.address.recipient_name}
                  <br />
                  {quote.address.address_line}, {quote.address.city}
                </p>
              )}
              <dl>
                <dt>Subtotal</dt>
                <dd>{cop(quote.subtotal)}</dd>
                <dt>Descuentos</dt>
                <dd>{cop(quote.discount)}</dd>
                <dt>Envío</dt>
                <dd>{cop(quote.shipping)}</dd>
                <dt>Total COP</dt>
                <dd>
                  <strong>{cop(quote.total)}</strong>
                </dd>
              </dl>
              {quote.message && <p role="alert">{quote.message}</p>}
              {!attempt && (
                <button
                  className="button primary"
                  disabled={busy || !quote.can_confirm}
                  onClick={confirm}
                >
                  Confirmar pedido
                </button>
              )}
            </section>
          )}
          {attempt && user && (
            <div className="purchase-actions">
              <p role="status">Confirmación pendiente de respuesta.</p>
              <button
                className="button primary"
                disabled={busy}
                onClick={confirm}
              >
                {busy ? "Confirmando..." : "Recuperar confirmación"}
              </button>
              <Link href="/pedidos">Consultar mis pedidos</Link>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
