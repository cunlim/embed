import { test, expect } from "@playwright/test";

test.describe("Embed 페이지 - 일괄 번역", () => {
  test("전체 번역 실행 버튼이 표시된다", async ({ page }) => {
    const token = process.env.E2E_TOKEN || "";
    await page.goto(`/login?token=${token}`);
    await page.goto("/embed");

    // 일괄 번역 섹션 확인
    await expect(page.locator("text=일괄 번역")).toBeVisible();

    // 전체 번역 실행 버튼 확인
    const batchButton = page.locator("button:has-text('전체 번역 실행')");
    await expect(batchButton).toBeVisible();
  });
});
