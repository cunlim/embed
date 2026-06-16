import { test, expect } from "@playwright/test";
import { setupAuth } from "./helpers/auth";

test.describe("대량 카테고리 업로드", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await page.goto("/embed");
  });

  test("추가 Card에 단일/대량 토글이 표시된다", async ({ page }) => {
    await expect(page.getByRole("button", { name: "단일" })).toBeVisible();
    await expect(page.getByRole("button", { name: "대량" })).toBeVisible();
  });

  test("대량 모드에서 샘플 다운로드 링크가 표시된다", async ({ page }) => {
    await page.getByRole("button", { name: "대량" }).click();

    const downloadLink = page.getByText("샘플 다운로드");
    await expect(downloadLink).toBeVisible();
    await expect(downloadLink).toHaveAttribute(
      "href",
      "/samples/카테고리대량등록_v1.xlsx"
    );
  });

  test("대량 모드에서 xlsx 파일 업로드 후 결과 통계가 표시된다", async ({
    page,
  }) => {
    // 인증 확인
    const token = process.env.E2E_TOKEN || "";
    if (!token) {
      test.skip();
      return;
    }

    await page.getByRole("button", { name: "대량" }).click();

    // 파일 업로드
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(
      "public/samples/카테고리대량등록_v1.xlsx"
    );

    // 업로드 버튼 클릭
    await page.getByRole("button", { name: "업로드" }).click();

    // 결과 통계 표시 대기 (최대 60초)
    await expect(page.getByText(/성공 \d+건/)).toBeVisible({
      timeout: 60000,
    });
    await expect(page.getByText(/실패 \d+건/)).toBeVisible();
  });
});
