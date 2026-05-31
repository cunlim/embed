"use client";

import { useState, useCallback } from "react";
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
import { FolderPlus, FolderMinus, ArrowRightLeft, Pencil } from "lucide-react";
import {
  fetchFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  moveCategoriesToFolder,
  type FolderGroup,
} from "@/lib/api";
import { isAdmin } from "@/lib/utils";
import FolderDeleteModal from "./folder-delete-modal";

interface FolderSectionProps {
  token: string | null;
  user: import("@/lib/api").User | null;
  selectedFolder: string | null;
  selectedIds: Set<number>;
  serverFolders?: string[];
  serverUsers?: { id: number; name: string; email: string }[];
  onFolderChange: (folder: string | null) => void;
  onFolderActionComplete: () => void;
}

const DEFAULT_FOLDER_LABEL = "기본폴더";
const ALL_FOLDERS_VALUE = "all";
const RESERVED_NAMES = ["기본폴더", "전체"];

export default function FolderSection({
  token,
  user,
  selectedFolder,
  selectedIds,
  serverFolders = [],
  serverUsers = [],
  onFolderChange,
  onFolderActionComplete,
}: FolderSectionProps) {
  const [folders, setFolders] = useState<string[]>(serverFolders);
  const [folderGroups, setFolderGroups] = useState<FolderGroup[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [moveTargetFolder, setMoveTargetFolder] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [users] = useState<{ id: number; name: string; email: string }[]>(serverUsers);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [renameTarget, setRenameTarget] = useState<string>("");
  const [renameName, setRenameName] = useState<string>("");

  const isViewerAdmin = user ? isAdmin(user) : false;

  // 폴더 목록 로드
  const loadFolders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchFolders(token, selectedUserId);
      setFolders(res.data);
      setFolderGroups(res.grouped ?? []);
    } catch {
      // 무시
    }
  }, [token, selectedUserId]);

  // 폴더 추가
  const handleAddFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name || !token) return;
    if (RESERVED_NAMES.includes(name)) {
      setError(`"${name}"은(는) 사용할 수 없는 이름입니다.`);
      return;
    }
    if (folders.includes(name)) {
      setError("이미 존재하는 폴더명입니다.");
      return;
    }

    try {
      await createFolder(name, token, selectedUserId);
      setNewFolderName("");
      setError(null);
      await loadFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "폴더 생성 실패");
    }
  }, [newFolderName, token, folders, selectedUserId, loadFolders]);

  // 폴더명 수정
  const handleRenameFolder = useCallback(async () => {
    if (!token || !renameTarget || !renameName.trim()) return;
    if (renameTarget === DEFAULT_FOLDER_LABEL) {
      setError("기본폴더는 이름을 변경할 수 없습니다.");
      return;
    }
    if (RESERVED_NAMES.includes(renameName.trim())) {
      setError(`"${renameName.trim()}"은(는) 사용할 수 없는 이름입니다.`);
      return;
    }
    try {
      await renameFolder(renameTarget, renameName.trim(), token, selectedUserId);
      setRenameTarget("");
      setRenameName("");
      setError(null);
      await loadFolders();
      if (selectedFolder === renameTarget) {
        onFolderChange(renameName.trim());
      }
      onFolderActionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "폴더명 수정 실패");
    }
  }, [token, renameTarget, renameName, selectedUserId, loadFolders, selectedFolder, onFolderChange, onFolderActionComplete]);

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
      // 폴더 목록 재로드
      loadFolders();
    },
    [onFolderChange, loadFolders],
  );

  // 일반 회원일 때는 label 없이 select만 표시
  const showLabels = isViewerAdmin;

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
              {showLabels && <Label className="text-xs">회원</Label>}
              <Select
                value={selectedUserId ? String(selectedUserId) : "all"}
                onValueChange={handleUserChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="italic text-muted-foreground">전체</span>
                  </SelectItem>
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
            {showLabels && <Label className="text-xs">폴더</Label>}
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
                <SelectItem value={ALL_FOLDERS_VALUE}>
                  <span className="italic text-muted-foreground">전체</span>
                </SelectItem>
                <SelectItem value={DEFAULT_FOLDER_LABEL}>
                  <span className="italic text-muted-foreground">
                    {DEFAULT_FOLDER_LABEL}
                  </span>
                </SelectItem>
                {isViewerAdmin && !selectedUserId && folderGroups.length > 0
                  ? folderGroups.map((group) => (
                      <optgroup key={group.user_id} label={group.user_name}>
                        <SelectItem value="all">
                          <span className="italic text-muted-foreground">전체</span>
                        </SelectItem>
                        <SelectItem value={DEFAULT_FOLDER_LABEL}>
                          <span className="italic text-muted-foreground">
                            {DEFAULT_FOLDER_LABEL}
                          </span>
                        </SelectItem>
                        {group.folders.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </optgroup>
                    ))
                  : folders.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>

          {/* 새 폴더 추가 + 폴더명 수정 */}
          <div className="flex flex-col gap-2">
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

            {/* 폴더명 수정 */}
            {selectedFolder &&
              selectedFolder !== ALL_FOLDERS_VALUE &&
              selectedFolder !== DEFAULT_FOLDER_LABEL && (
                <div className="flex gap-2">
                  <Input
                    placeholder="새 폴더명"
                    value={renameName}
                    onChange={(e) => {
                      setRenameName(e.target.value);
                      setRenameTarget(selectedFolder);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameFolder();
                    }}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRenameFolder}
                    disabled={!renameName.trim() || renameTarget !== selectedFolder}
                    className="h-8 shrink-0"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
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
                onClick={handleMoveSelected}
                disabled={selectedIds.size === 0 || !moveTargetFolder}
                className="flex-1 h-8 text-xs"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                선택이동
              </Button>
              <Button
                size="sm"
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
        token={token}
        userId={selectedUserId}
        onConfirm={handleDeleteFolder}
      />
    </>
  );
}
