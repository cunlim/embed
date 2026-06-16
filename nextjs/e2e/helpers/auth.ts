import { Page } from "@playwright/test";

/**
 * E2E 토큰으로 쿠키 인증을 설정합니다.
 * baseURL에서 도메인을 동적으로 추출하여 localhost/원격 URL 모두 대응합니다.
 */
export async function setupAuth(page: Page) {
  const token = process.env.E2E_TOKEN || "";
  const baseURL =
    process.env.E2E_BASE_URL || "http://localhost:3000";
  const domain = new URL(baseURL).hostname;

  await page.context().addCookies([
    {
      name: "auth_token",
      value: token,
      path: "/",
      domain,
      sameSite: "Lax",
    },
  ]);
}
