import { test, expect } from "@playwright/test";
import { setupAuth } from "./helpers/auth";

test.describe("Embed 페이지 - 작업 실행", () => {
  test("전체 처리 버튼이 표시된다", async ({ page }) => {
    await setupAuth(page);
    await page.goto("/embed");

    // 작업 실행 섹션 확인
    await expect(page.locator("text=작업 실행")).toBeVisible();

    // 전체 처리 버튼 확인
    const batchButton = page.getByRole("button", { name: "전체 처리" });
    await expect(batchButton).toBeVisible();
  });
});
