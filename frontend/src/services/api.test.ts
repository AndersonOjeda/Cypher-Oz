import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
const response = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("unsafe request gets CSRF and includes cookies", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response(200, { csrfToken: "masked-csrf" }))
    .mockResolvedValueOnce(response(201, { id: 1 }));
  vi.stubGlobal("fetch", fetch);
  const { api } = await import("./api");
  expect(await api("/auth/register/", { method: "POST", body: "{}" })).toEqual({
    id: 1,
  });
  expect(fetch.mock.calls[1][1].headers.get("X-CSRFToken")).toBe("masked-csrf");
  expect(fetch.mock.calls[1][1].credentials).toBe("include");
});

test("expired access refreshes then retries protected request", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response(401, {}))
    .mockResolvedValueOnce(response(200, { csrfToken: "csrf" }))
    .mockResolvedValueOnce(response(200, { message: "renewed" }))
    .mockResolvedValueOnce(response(200, { id: 1 }));
  vi.stubGlobal("fetch", fetch);
  const { api } = await import("./api");
  expect(await api("/users/me/")).toEqual({ id: 1 });
  expect(fetch.mock.calls.map((call) => call[0])).toEqual([
    "/api/v1/users/me/",
    "/api/v1/auth/csrf/",
    "/api/v1/auth/refresh/",
    "/api/v1/users/me/",
  ]);
});

test("invalid refresh terminates without retry loop", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response(401, {}))
    .mockResolvedValueOnce(response(200, { csrfToken: "csrf" }))
    .mockResolvedValueOnce(
      response(401, { code: "unauthorized", message: "Sin sesión" }),
    );
  vi.stubGlobal("fetch", fetch);
  const { api } = await import("./api");
  await expect(api("/users/me/")).rejects.toMatchObject({ status: 401 });
  expect(fetch).toHaveBeenCalledTimes(3);
});

test("HTML upstream failure is shown as a readable error", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(new Response("<h1>Bad gateway</h1>", { status: 502 })),
  );
  const { api } = await import("./api");
  await expect(api("/users/me/")).rejects.toThrow(
    "El servicio no está disponible",
  );
});
