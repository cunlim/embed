"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface QuotaAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRemaining: number;
  onSubmit: (type: "absolute" | "increment", value: number) => void;
  loading?: boolean;
}

export function QuotaAdjustDialog({
  open,
  onOpenChange,
  currentRemaining,
  onSubmit,
  loading,
}: QuotaAdjustDialogProps) {
  const [mode, setMode] = useState<"absolute" | "increment">("absolute");
  const [value, setValue] = useState<string>("");

  const handleSubmit = () => {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    onSubmit(mode, num);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>남은 쿼타 조절</DialogTitle>
          <DialogDescription>
            현재 남은 쿼타: <span className="font-semibold">{currentRemaining}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* 라디오 그룹 */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="quota-mode"
                value="absolute"
                checked={mode === "absolute"}
                onChange={() => setMode("absolute")}
                className="accent-foreground"
              />
              절대값 설정
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="quota-mode"
                value="increment"
                checked={mode === "increment"}
                onChange={() => setMode("increment")}
                className="accent-foreground"
              />
              증감 (+/-)
            </label>
          </div>

          {/* 값 입력 */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quota-value">
              {mode === "absolute" ? "설정할 값" : "증감값"}
            </Label>
            <Input
              id="quota-value"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === "absolute" ? "예: 1000" : "예: 100 또는 -50"}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || value === ""}
          >
            {loading ? "처리 중..." : "적용"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
