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

interface FolderDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  onConfirm: (moveToDefault: boolean) => void;
}

export default function FolderDeleteModal({
  open,
  onOpenChange,
  folderName,
  onConfirm,
}: FolderDeleteModalProps) {
  const [moveToDefault, setMoveToDefault] = useState(true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>폴더 삭제</DialogTitle>
          <DialogDescription>
            &ldquo;{folderName}&rdquo; 폴더를 삭제하시겠습니까?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setMoveToDefault(true)}
            className={`flex items-center gap-2 w-full p-2 rounded-md border text-sm transition-colors ${
              moveToDefault
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted"
            }`}
          >
            <span
              className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center ${
                moveToDefault ? "border-primary" : "border-muted-foreground"
              }`}
            >
              {moveToDefault && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </span>
            기본폴더로 이동
          </button>
          <button
            type="button"
            onClick={() => setMoveToDefault(false)}
            className={`flex items-center gap-2 w-full p-2 rounded-md border text-sm transition-colors ${
              !moveToDefault
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted"
            }`}
          >
            <span
              className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center ${
                !moveToDefault ? "border-primary" : "border-muted-foreground"
              }`}
            >
              {!moveToDefault && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </span>
            카테고리도 함께 삭제
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(moveToDefault)}>
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
