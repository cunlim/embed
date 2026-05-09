const techStack = [
  { name: "pgvector", delay: "animate-stagger-1" },
  { name: "Ollama", delay: "animate-stagger-2" },
  { name: "Laravel", delay: "animate-stagger-3" },
  { name: "Next.js", delay: "animate-stagger-4" },
  { name: "Redis", delay: "animate-stagger-5" },
  { name: "Docker", delay: "animate-stagger-6" },
];

export function TechBadges() {
  return (
    <div className="flex flex-wrap justify-center gap-2 px-6 py-8">
      {techStack.map((tech) => (
        <span
          key={tech.name}
          className={`${tech.delay} border border-border bg-card-bg px-3 py-1.5 rounded-full font-mono text-xs text-primary hover:border-primary/50 transition-colors cursor-default`}
        >
          {tech.name}
        </span>
      ))}
    </div>
  );
}