import { Suspense } from "react";
import { fetchCategoryLevels } from "@/lib/api";
import { EmbedPageInner } from "./embed-page-inner";

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;

  const cat1 = typeof sp.cat1 === "string" ? sp.cat1 : null;
  const cat2 = typeof sp.cat2 === "string" ? sp.cat2 : null;
  const cat3 = typeof sp.cat3 === "string" ? sp.cat3 : null;

  // 대 옵션 항상 prefetch
  let 대Options: string[] = [];
  let 중Options: string[] = [];
  let 소Options: string[] = [];
  let 세Options: { 세: string; categoryId: number; categoryCode: string }[] = [];

  try {
    const 대Res = await fetchCategoryLevels();
    대Options = 대Res.data.대 ?? [];

    if (cat1) {
      const 중Res = await fetchCategoryLevels({ 대: cat1 });
      중Options = 중Res.data.중 ?? [];
    }
    if (cat1 && cat2) {
      const 소Res = await fetchCategoryLevels({ 대: cat1, 중: cat2 });
      소Options = 소Res.data.소 ?? [];
    }
    if (cat1 && cat2 && cat3) {
      const 세Res = await fetchCategoryLevels({ 대: cat1, 중: cat2, 소: cat3 });
      세Options = 세Res.data.세 ?? [];
    }
  } catch {
    // prefetch 실패 시 클라이언트에서 빈 배열로 시작
  }

  return (
    <Suspense>
      <EmbedPageInner
        server대Options={대Options}
        server중Options={중Options}
        server소Options={소Options}
        server세Options={세Options}
      />
    </Suspense>
  );
}
