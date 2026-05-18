import { test, expect } from "@playwright/test";

test.describe("Admin 모달 - run-step HTTP API", () => {
  test("전체 실행 버튼이 표시되고 클릭 가능하다", async ({ page }) => {
    const token = process.env.E2E_TOKEN || "";
    await page.goto(`/login?token=${token}`);
    await page.goto("/admin");

    await page.waitForSelector("text=카테고리 관리");

    // 첫 번째 카테고리 클릭
    const firstCategory = page.locator("text=CAT_").first();
    await firstCategory.click();

    // 모달 열림 확인
    await expect(page.locator("text=카테고리 상세")).toBeVisible();

    // 전체 실행 버튼 확인
    const runAllButton = page.locator("button:has-text('전체 실행')");
    await expect(runAllButton).toBeVisible();
  });
});
