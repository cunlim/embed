const stats = [
  { value: "100ms", label: "캐시 응답", icon: "⚡" },
  { value: "3개", label: "다국어 지원", icon: "🌐" },
  { value: "cosine", label: "유사도 검색", icon: "🔍" },
];

export function StatsCards() {
  return (
    <div className="flex flex-wrap justify-center gap-4 px-6 py-8">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card-bg border border-border rounded-xl px-5 py-4 text-center min-w-[120px]"
        >
          <div className="text-2xl font-bold gradient-text">{stat.value}</div>
          <div className="text-xs text-muted mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}