import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ModeToggle } from "@/components/mode-toggle";
import {
  ArrowRight,
  Languages,
  Search,
  Braces,
  Cpu,
} from "lucide-react";

const features = [
  {
    icon: Languages,
    title: "다국어 분석",
    description:
      "한국어, 중국어, 영어 텍스트를 자동으로 인식하고 분석합니다. 입력 언어에 관계없이 일관된 카테고리를 추천합니다.",
  },
  {
    icon: Search,
    title: "벡터 유사도 검색",
    description:
      "pgvector 기반 코사인 유사도 검색으로 의미적으로 가장 적합한 카테고리를 찾아냅니다. 단순 키워드 매칭을 넘어선 이해.",
  },
  {
    icon: Braces,
    title: "임베딩 파이프라인",
    description:
      "Ollama 로컬 모델로 실시간 번역 및 임베딩을 생성합니다. 비동기 큐와 WebSocket으로 처리 현황을 실시간 확인합니다.",
  },
];

const techStack = [
  "Next.js 16",
  "React 19",
  "Tailwind v4",
  "shadcn/ui",
  "Laravel 13",
  "PostgreSQL",
  "pgvector",
  "Redis",
  "Ollama",
  "Reverb",
];

export default function Home() {
  return (
    <>
      {/* 헤더 */}
      <header className="fixed top-0 right-0 left-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-primary" />
            <span className="text-sm font-medium tracking-tight">
              CL Embed
            </span>
          </div>
          <ModeToggle />
        </div>
      </header>

      {/* 메인 */}
      <main className="relative flex flex-1 flex-col items-center justify-center">
        {/* 배경 그리드 */}
        <div className="bg-noise" />
        <div className="bg-grid pointer-events-none absolute inset-0" />

        {/* 그라디언트 오브 */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <div className="h-72 w-72 rounded-full bg-primary/5 blur-3xl sm:h-96 sm:w-96" />
        </div>

        {/* 컨텐츠 */}
        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-5 pt-24 pb-16 sm:pt-28 sm:pb-20">
          {/* 코드 뱃지 */}
          <div className="animate-fade-in-up animation-delay-100 mb-6">
            <Badge
              variant="outline"
              className="gap-1.5 border-primary/20 bg-primary/5 px-3 py-1 font-mono text-[11px] tracking-tight text-primary"
            >
              <span className="text-muted-foreground">$</span>
              npm create cl-embed
              <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" />
            </Badge>
          </div>

          {/* 히어로 */}
          <div className="animate-fade-in-up animation-delay-200 mb-12 flex flex-col items-center text-center sm:mb-16">
            <h1 className="font-heading mb-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              AI 기반{" "}
              <span className="text-primary">다국어 카테고리</span>
              <br />
              추천 시스템
            </h1>
            <p className="mb-8 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              사용자 텍스트를 분석해 네이버 카테고리 체계 기준으로
              가장 적합한 카테고리를 추천합니다.
              <br className="hidden sm:block" />
              한국어·중국어·영어를 지원합니다.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="h-9 gap-1.5 rounded-lg text-sm">
                시작하기
                <ArrowRight className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-9 rounded-lg text-sm"
              >
                기술 문서
              </Button>
            </div>
          </div>

          {/* 기능 카드 */}
          <div className="animate-fade-in-up animation-delay-400 mb-12 grid w-full gap-3 sm:mb-16 sm:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} size="sm" className="group/card">
                  <CardHeader>
                    <div className="mb-1 flex size-8 items-center justify-center rounded-lg border bg-muted/50">
                      <Icon className="size-4 text-primary" />
                    </div>
                    <CardTitle className="text-sm">{feature.title}</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          {/* 기술 스택 */}
          <div className="animate-fade-in-up animation-delay-600 mb-8 w-full sm:mb-12">
            <div className="mb-4 text-center">
              <span className="font-mono text-xs tracking-wider text-muted-foreground/60">
                /tech-stack
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {techStack.map((tech) => (
                <Badge
                  key={tech}
                  variant="secondary"
                  className="px-2.5 py-1 text-[11px] font-normal tracking-tight"
                >
                  {tech}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="border-t border-border/40 bg-background/40">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-5">
          <span className="text-[11px] text-muted-foreground/50">
            &copy; {new Date().getFullYear()} CL Embed
          </span>
          <span className="font-mono text-[11px] text-muted-foreground/30">
            v0.1.0-dev
          </span>
        </div>
      </footer>
    </>
  );
}
