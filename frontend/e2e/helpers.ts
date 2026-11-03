import { expect, type APIRequestContext } from "@playwright/test";

export async function verifyRegisteredEmail(
  request: APIRequestContext,
  email: string,
) {
  const linkResponse = await request.get(
    `http://127.0.0.1:8001/__e2e__/verification-token/?email=${encodeURIComponent(email)}`,
  );
  expect(linkResponse.status(), await linkResponse.text()).toBe(200);
  const { token } = await linkResponse.json();
  const csrfToken = (await (await request.get("/api/v1/auth/csrf/")).json())
    .csrfToken;
  const verification = await request.post("/api/v1/auth/verify-email/", {
    headers: { "X-CSRFToken": csrfToken },
    data: { token },
  });
  expect(verification.status(), await verification.text()).toBe(200);
}
