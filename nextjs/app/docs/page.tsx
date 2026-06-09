import { readFile } from "fs/promises";
import path from "path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { docList } from "@/lib/docs";

type Props = {
  searchParams: Promise<{ doc?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { doc } = await searchParams;
  const slug = doc || docList[0]?.slug || "";
  const entry = docList.find((d) => d.slug === slug);
  return {
    title: entry?.title || "API 문서",
    description: entry?.description || "CL Embed 문서",
  };
}

export default async function DocsPage({ searchParams }: Props) {
  const { doc } = await searchParams;
  const slug = doc || docList[0]?.slug || "USER_GUIDE";
  const entry = docList.find((d) => d.slug === slug);
  const title = entry?.title || "";

  let content: string;
  try {
    const filePath = path.join(process.cwd(), "public", "content", `${slug}.md`);
    content = await readFile(filePath, "utf-8");
  } catch {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <p className="text-sm font-medium text-destructive">
          문서를 불러오지 못했습니다
        </p>
      </div>
    );
  }

  return (
    <article className="prose-custom">
      <div className="mb-6 flex items-center gap-3">
        <BookOpen className="h-5 w-5 text-accent" />
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => (
              <a
                href={href}
                target={href?.startsWith("http") ? "_blank" : undefined}
                rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
              >
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </article>
  );
}
