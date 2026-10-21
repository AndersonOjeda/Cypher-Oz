"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  Boxes,
  ChevronDown,
  CreditCard,
  Package,
  Settings,
  ShoppingBag,
  Users,
} from "lucide-react";

const sections = [
  { href: "/admin/catalogo", label: "Administrar catálogo", icon: Package },
  { href: "/admin/inventario", label: "Inventario", icon: Boxes },
  { href: "/admin/pedidos", label: "Gestión de pedidos", icon: ShoppingBag },
  { href: "/admin/pagos", label: "Verificación de pagos", icon: CreditCard },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

export function AdminNavigation({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = sections.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <aside
      className="admin-navigation"
      aria-label="Panel de administración"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <div className="admin-navigation-title">
        <span>TTI</span>
        <strong>Administración</strong>
      </div>
      <button
        ref={trigger}
        type="button"
        className="admin-navigation-toggle"
        aria-expanded={open}
        aria-controls="admin-navigation-links"
        onClick={() => setOpen(!open)}
      >
        <span>
          Menú de administración
          <small>{current?.label ?? "Elige una sección"}</small>
        </span>
        <ChevronDown
          size={20}
          aria-hidden="true"
          className={open ? "is-open" : undefined}
        />
      </button>
      <div
        id="admin-navigation-links"
        className="admin-navigation-links"
        data-open={open}
      >
        <nav aria-label="Secciones de administración">
          {sections.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={current?.href === href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="admin-navigation-personal">
          <span>Tu cuenta</span>
          <Link href="/cuenta" onClick={() => setOpen(false)}>
            Mi cuenta
          </Link>
          <Link href="/pedidos" onClick={() => setOpen(false)}>
            Mis pedidos
          </Link>
          <Link href="/catalogo" onClick={() => setOpen(false)}>
            Ver la tienda ↗
          </Link>
        </div>
      </div>
    </aside>
  );
}

export function AdminAccountMenu() {
  return (
    <section
      className="account-admin-menu"
      aria-labelledby="account-admin-heading"
    >
      <h2 id="account-admin-heading">Administración</h2>
      <p>
        Gestiona la tienda desde un solo panel. Dentro encontrarás un menú para
        cambiar de sección.
      </p>
      <Link className="button primary" href="/admin/catalogo">
        Administrar catálogo
      </Link>
      <details>
        <summary>Más herramientas de administración</summary>
        <nav aria-label="Herramientas administrativas">
          {sections.slice(1).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Icon size={18} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </details>
    </section>
  );
}
