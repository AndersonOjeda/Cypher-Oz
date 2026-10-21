"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api, type User } from "@/services/api";
import { AdminNavigation } from "./admin-navigation";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api<User>("/users/me/", { signal: controller.signal })
      .then((user) => {
        if (!controller.signal.aborted) setIsAdmin(user.role === "ADMIN");
      })
      .catch(() => {
        /* Each page handles its own access and retry messages. */
      });
    return () => controller.abort();
  }, []);

  return (
    <div className={isAdmin ? "admin-layout" : undefined}>
      {isAdmin && <AdminNavigation key={pathname} pathname={pathname} />}
      <div className={isAdmin ? "admin-layout-content" : undefined}>
        {children}
      </div>
    </div>
  );
}
