import { CheckCircle2, AlertTriangle, Minus } from "lucide-react";

interface Props {
  status: "completed" | "partial" | "pending";
}

export default function StatusBadge({ status }: Props) {
  if (status === "completed") {
    return (
      <div className="flex items-center gap-1.5 text-green-500">
        <CheckCircle2 className="h-4 w-4" />
        <span className="text-xs">처리완료</span>
      </div>
    );
  }

  if (status === "partial") {
    return (
      <div className="flex items-center gap-1.5 text-yellow-500">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-xs">일부처리</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Minus className="h-4 w-4" />
      <span className="text-xs">처리안됨</span>
    </div>
  );
}
