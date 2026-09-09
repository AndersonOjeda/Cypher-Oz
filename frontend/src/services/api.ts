export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

let csrfToken: string | undefined;
let refreshing: Promise<void> | undefined;

async function csrf() {
  const response = await fetch("/api/v1/auth/csrf/", {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("No pudimos conectar. Inténtalo de nuevo.");
  csrfToken = (await response.json()).csrfToken;
  return csrfToken!;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD"].includes(method))
    headers.set("X-CSRFToken", csrfToken ?? (await csrf()));
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.",
    );
  }
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    refreshing ??= api("/auth/refresh/", { method: "POST" }, false)
      .then(() => undefined)
      .finally(() => {
        refreshing = undefined;
      });
    await refreshing;
    return api(path, options, false);
  }
  if (response.status === 204) {
    csrfToken = undefined;
    return undefined as T;
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "El servicio no está disponible. Inténtalo de nuevo más tarde.",
    );
  }
  if (!response.ok) {
    if (response.status === 403) csrfToken = undefined;
    throw new ApiError(
      response.status,
      data.code,
      data.message ?? "No pudimos completar la solicitud.",
      data.details,
    );
  }
  if (data.csrfToken) csrfToken = data.csrfToken;
  return data as T;
}

export type User = {
  id: number;
  name: string;
  email: string;
  role: "CLIENT" | "ADMIN";
};
