"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Check,
  Pause,
  Play,
  Trash2,
  Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiKeyItem } from "@/lib/api";

interface ApiKeyCardProps {
  apiKey: ApiKeyItem;
  onToggleStatus: (id: number, currentStatus: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onRename: (id: number, name: string) => Promise<void>;
}

export function ApiKeyCard({
  apiKey,
  onToggleStatus,
  onDelete,
  onRename,
}: ApiKeyCardProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(apiKey.name);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const truncatedKey = apiKey.key.slice(0, 10) + "...";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(apiKey.key);
    setCopied(true);
    toast.success("API key가 클립보드에 복사되었습니다.");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      await onToggleStatus(apiKey.id, apiKey.status);
      toast.success(
        apiKey.status === "active"
          ? "API key가 일시정지되었습니다."
          : "API key가 활성화되었습니다."
      );
    } catch {
      toast.error("상태 변경에 실패했습니다.");
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("이 API key를 삭제하시겠습니까?")) return;
    setIsDeleting(true);
    try {
      await onDelete(apiKey.id);
      toast.success("API key가 삭제되었습니다.");
    } catch {
      toast.error("삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRename = async () => {
    if (!editName.trim()) return;
    try {
      await onRename(apiKey.id, editName.trim());
      setIsEditing(false);
      toast.success("이름이 변경되었습니다.");
    } catch {
      toast.error("이름 변경에 실패했습니다.");
    }
  };

  const lastUsed = apiKey.last_used_at
    ? new Date(apiKey.last_used_at).toLocaleDateString("ko-KR")
    : "사용 이력 없음";

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 w-48"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") {
                    setIsEditing(false);
                    setEditName(apiKey.name);
                  }
                }}
              />
              <Button size="sm" variant="ghost" onClick={handleRename}>
                확인
              </Button>
            </div>
          ) : (
            <span className="font-medium">{apiKey.name}</span>
          )}
          <Badge variant={apiKey.status === "active" ? "default" : "secondary"}>
            {apiKey.status === "active" ? "활성" : "일시정지"}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            {truncatedKey}
          </code>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          <span className="text-xs">최근 사용: {lastUsed}</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              setEditName(apiKey.name);
              setIsEditing(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleToggle}
          disabled={isToggling}
        >
          {apiKey.status === "active" ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
