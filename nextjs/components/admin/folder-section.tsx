"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderPlus, FolderMinus, ArrowRightLeft } from "lucide-react";
import {
  fetchFolders,
  deleteFolder,
  moveCategoriesToFolder,
  fetchUsers,
} from "@/lib/api";
import { isAdmin } from "@/lib/utils";
import FolderDeleteModal from "./folder-delete-modal";

interface FolderSectionProps {
  token: string | null;
  user: import("@/lib/api").User | null;
  selectedFolder: string | null;
  selectedIds: Set<number>;
  onFolderChange: (folder: string | null) => void;
  onFolderActionComplete: () => void;
}

interface UserData {
  id: number;
  name: string;
  email: string;
}

const DEFAULT_FOLDER_LABEL = "기본폴더";
const ALL_FOLDERS_VALUE = "__all__";

export default function FolderSection({
  token,
  user,
  selectedFolder,
  selectedIds,
  onFolderChange,
  onFolderActionComplete,
}: FolderSectionProps) {
  const [folders, setFolders] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [moveTargetFolder, setMoveTargetFolder] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const isViewerAdmin = user ? isAdmin(user) : false;

  // 회원 목록 로드 (관리자만)
  useEffect(() => {
    if (!token || !isViewerAdmin) return;
    fetchUsers(token)
      .then((res) => setUsers(res.data))
      .catch(() => {});
  }, [token, isViewerAdmin]);

  // 폴더 목록 로드
  const loadFolders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchFolders(token, selectedUserId);
      setFolders(res.data);
    } catch {
      // 무시
    }
  }, [token, selectedUserId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 비동기 폴더 로딩은 표준 패턴
    loadFolders();
  }, [loadFolders]);

  // 폴더 추가
  const handleAddFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name || !token) return;
    if (name === DEFAULT_FOLDER_LABEL) {
      setError(
        `"${DEFAULT_FOLDER_LABEL}"은(는) 사용할 수 없는 이름입니다.`,
      );
      return;
    }
    if (folders.includes(name)) {
      setError("이미 존재하는 폴더명입니다.");
      return;
    }

    // 폴더는 카테고리 이동 시 자동 생성되므로 여기서는 목록에만 추가
    setFolders((prev) => [...prev, name].sort());
    setNewFolderName("");
    setError(null);
  }, [newFolderName, token, folders]);

  // 폴더 삭제
  const handleDeleteFolder = useCallback(
    async (moveToDefault: boolean) => {
      if (!token || !selectedFolder || selectedFolder === ALL_FOLDERS_VALUE)
        return;
      try {
        await deleteFolder(selectedFolder, token, selectedUserId, moveToDefault);
        setDeleteModalOpen(false);
        onFolderChange(null);
        await loadFolders();
        onFolderActionComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : "폴더 삭제 실패");
      }
    },
    [
      token,
      selectedFolder,
      selectedUserId,
      loadFolders,
      onFolderChange,
      onFolderActionComplete,
    ],
  );

  // 선택 폴더 이동
  const handleMoveSelected = useCallback(async () => {
    if (!token || selectedIds.size === 0) return;
    const target =
      moveTargetFolder === DEFAULT_FOLDER_LABEL ? null : moveTargetFolder || null;
    try {
      await moveCategoriesToFolder(Array.from(selectedIds), target, token);
      setMoveTargetFolder("");
      await loadFolders();
      onFolderActionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "폴더 이동 실패");
    }
  }, [token, selectedIds, moveTargetFolder, loadFolders, onFolderActionComplete]);

  // 전체 폴더 이동
  const handleMoveAll = useCallback(async () => {
    if (!token) return;
    const target =
      moveTargetFolder === DEFAULT_FOLDER_LABEL ? null : moveTargetFolder || null;
    try {
      await moveCategoriesToFolder([], target, token);
      setMoveTargetFolder("");
      await loadFolders();
      onFolderActionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "폴더 이동 실패");
    }
  }, [token, moveTargetFolder, loadFolders, onFolderActionComplete]);

  // 회원 변경
  const handleUserChange = useCallback(
    (value: string | null) => {
      if (!value || value === "all") {
        setSelectedUserId(null);
      } else {
        setSelectedUserId(Number(value));
      }
      onFolderChange(null);
    },
    [onFolderChange],
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">폴더</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 관리자: 회원 select */}
          {isViewerAdmin && (
            <div className="space-y-1">
              <Label className="text-xs">회원</Label>
              <Select
                value={selectedUserId ? String(selectedUserId) : "all"}
                onValueChange={handleUserChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 폴더 select */}
          <div className="space-y-1">
            <Label className="text-xs">폴더</Label>
            <Select
              value={selectedFolder ?? ALL_FOLDERS_VALUE}
              onValueChange={(value) =>
                onFolderChange(value === ALL_FOLDERS_VALUE ? null : value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FOLDERS_VALUE}>전체</SelectItem>
                <SelectItem value={DEFAULT_FOLDER_LABEL}>
                  <span className="italic text-muted-foreground">
                    {DEFAULT_FOLDER_LABEL}
                  </span>
                </SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 새 폴더 추가 */}
          <div className="flex gap-2">
            <Input
              placeholder="새 폴더명"
              value={newFolderName}
              onChange={(e) => {
                setNewFolderName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddFolder();
              }}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              onClick={handleAddFolder}
              disabled={!newFolderName.trim()}
              className="h-8 shrink-0"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* 폴더 이동 */}
          <div className="space-y-2">
            <Select value={moveTargetFolder} onValueChange={(v) => setMoveTargetFolder(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="이동할 폴더 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_FOLDER_LABEL}>
                  {DEFAULT_FOLDER_LABEL}
                </SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleMoveSelected}
                disabled={selectedIds.size === 0 || !moveTargetFolder}
                className="flex-1 h-8 text-xs"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                선택이동
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleMoveAll}
                disabled={!moveTargetFolder}
                className="flex-1 h-8 text-xs"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                전체이동
              </Button>
            </div>
          </div>

          {/* 폴더 삭제 */}
          {selectedFolder && selectedFolder !== ALL_FOLDERS_VALUE && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDeleteModalOpen(true)}
              className="w-full h-8 text-xs"
            >
              <FolderMinus className="h-3.5 w-3.5 mr-1" />
              &ldquo;{selectedFolder}&rdquo; 삭제
            </Button>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <FolderDeleteModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        folderName={selectedFolder ?? ""}
        onConfirm={handleDeleteFolder}
      />
    </>
  );
}
