"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, type User } from "@/services/api";

const noopSubscribe = () => () => {};

export function AuthNavLink() {
  const pathname = usePathname();
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;

    function checkAuth() {
      api<User>("/users/me/")
        .then((data) => {
          if (active) setUser(data);
        })
        .catch(() => {
          if (active) setUser(null);
        });
    }

    checkAuth();

    window.addEventListener("auth-changed", checkAuth);
    return () => {
      active = false;
      window.removeEventListener("auth-changed", checkAuth);
    };
  }, [pathname]);

  // Keep default SSR links during initial render to prevent hydration mismatch
  if (!mounted) {
    return (
      <>
        <Link href="/cuenta">Mi cuenta</Link>
        <Link className="header-login" href="/login">
          Iniciar sesión <span aria-hidden="true">↗</span>
        </Link>
      </>
    );
  }

  if (user) {
    return (
      <>
        {user.role === "ADMIN" && (
          <Link href="/admin/catalogo" className="header-admin-link">
            Administración
          </Link>
        )}
        <Link href="/cuenta" className="header-account-link">
          Mi cuenta
        </Link>
      </>
    );
  }

  return (
    <Link className="header-login" href="/login">
      Iniciar sesión <span aria-hidden="true">↗</span>
    </Link>
  );
}
