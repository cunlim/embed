import { CheckCircle2, Clock, Minus } from "lucide-react";

interface Props {
  status: "completed" | "partial" | "pending";
}

export default function StatusBadge({ status }: Props) {
  if (status === "completed") {
    return (
      <div className="flex items-center text-green-500">
        <CheckCircle2 className="h-4 w-4" />
      </div>
    );
  }

  if (status === "partial") {
    return (
      <div className="flex items-center text-blue-500">
        <Clock className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div className="flex items-center text-muted-foreground">
      <Minus className="h-4 w-4" />
    </div>
  );
}
