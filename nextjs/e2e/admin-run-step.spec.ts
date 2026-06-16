import { test, expect } from "@playwright/test";
import { setupAuth } from "./helpers/auth";

test.describe("Embed 카테고리 - 작업 실행", () => {
  test("전체 처리 버튼이 표시된다", async ({ page }) => {
    await setupAuth(page);
    await page.goto("/embed");

    // 카테고리 목록 로드 대기
    await page.waitForSelector("text=카테고리 목록");

    // 작업 실행 섹션의 전체 처리 버튼 확인 (사이드바에 항상 표시)
    const runAllButton = page.getByRole("button", { name: "전체 처리" });
    await expect(runAllButton).toBeVisible();
  });
});
