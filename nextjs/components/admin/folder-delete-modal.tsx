"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { checkFolderHasCategories } from "@/lib/api";

interface FolderDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  token?: string | null;
  userId?: number | null;
  onConfirm: (moveToDefault: boolean) => void;
}

export default function FolderDeleteModal({
  open,
  onOpenChange,
  folderName,
  token,
  userId,
  onConfirm,
}: FolderDeleteModalProps) {
  const [moveToDefault, setMoveToDefault] = useState(true);
  const [hasCategories, setHasCategories] = useState<boolean | null>(null);
  const [categoryCount, setCategoryCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [duplicateCodes, setDuplicateCodes] = useState<string[]>([]);
  const prevOpenRef = useRef(open);

  // 모달이 열릴 때마다 카테고리 존재 여부 조회
  useEffect(() => {
    if (open && !prevOpenRef.current && token && folderName) {
      setHasCategories(null);
      setCategoryCount(0);
      setDuplicateCount(0);
      setDuplicateCodes([]);
      checkFolderHasCategories(folderName, token, userId)
        .then((res) => {
          setHasCategories(res.data.has_categories);
          setCategoryCount(res.data.count);
          setDuplicateCount(res.data.duplicate_count ?? 0);
          setDuplicateCodes(res.data.duplicate_codes ?? []);
        })
        .catch(() => {
          setHasCategories(true);
        });
    }
    prevOpenRef.current = open;
  }, [open, folderName, token, userId]);

  // 중복이 있을 때 "기본폴더로 이동"이 선택되어 있으면 "카테고리도 함께 삭제"로 전환
  useEffect(() => {
    if (duplicateCount > 0 && moveToDefault) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMoveToDefault(false);
    }
  }, [duplicateCount, moveToDefault]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>폴더 삭제</DialogTitle>
          <DialogDescription>
            &ldquo;{folderName}&rdquo; 폴더를 삭제하시겠습니까?
          </DialogDescription>
        </DialogHeader>

        {hasCategories === null ? (
          <p className="text-sm text-muted-foreground">확인 중...</p>
        ) : hasCategories ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              이 폴더에는 {categoryCount}개의 카테고리가 있습니다.
            </p>
            {duplicateCount > 0 && (
              <div className="text-sm text-destructive">
                <p>
                  기본폴더에 이미 {duplicateCount}개의 동일한 카테고리가 존재하여 기본폴더로 이동할 수 없습니다.
                </p>
                <p className="truncate max-w-full mt-1" title={duplicateCodes.join(", ")}>
                  ({duplicateCodes.slice(0, 3).join(", ")}{duplicateCodes.length > 3 ? ", ..." : ""})
                </p>
              </div>
            )}
            <button
              type="button"
              disabled={duplicateCount > 0}
              onClick={() => setMoveToDefault(true)}
              className={`flex items-center gap-2 w-full p-2 rounded-md border text-sm transition-colors ${
                duplicateCount > 0
                  ? "opacity-50 cursor-not-allowed"
                  : moveToDefault
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
        ) : (
          <p className="text-sm text-muted-foreground">
            이 폴더는 비어 있습니다. 폴더만 삭제됩니다.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(hasCategories ? moveToDefault : true)}
          >
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
