"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  const selectedUserIdRef = useRef(selectedUserId);
  // eslint-disable-next-line react-hooks/refs
  selectedUserIdRef.current = selectedUserId;
  const [renameTarget, setRenameTarget] = useState<string>("");

  // "기능시연" 클릭 시 폴더 section 초기화
  useEffect(() => {
    const handleReset = () => {
      setSelectedUserId(null);
      onFolderChange(null);
      setNewFolderName("");
      setRenameTarget("");
      setMoveTargetFolder("");
      setError(null);
    };
    window.addEventListener("resetEmbedPage", handleReset);
    return () => window.removeEventListener("resetEmbedPage", handleReset);
  }, [onFolderChange]);

  const isViewerAdmin = user ? isAdmin(user) : false;

  // 폴더 목록 로드
  const loadFolders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchFolders(token, selectedUserIdRef.current);
      setFolders(res.data);
      setFolderGroups(res.grouped ?? []);
    } catch {
      // 무시
    }
  }, [token]);

  // 초기 마운트 시 폴더 그룹 로드 (optgroup 표시용)
  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

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
    if (!token || !renameTarget || !newFolderName.trim()) return;
    if (renameTarget === DEFAULT_FOLDER_LABEL) {
      setError("기본폴더는 이름을 변경할 수 없습니다.");
      return;
    }
    if (RESERVED_NAMES.includes(newFolderName.trim())) {
      setError(`"${newFolderName.trim()}"은(는) 사용할 수 없는 이름입니다.`);
      return;
    }
    try {
      await renameFolder(renameTarget, newFolderName.trim(), token, selectedUserId);
      setRenameTarget("");
      setNewFolderName("");
      setError(null);
      await loadFolders();
      if (selectedFolder === renameTarget) {
        onFolderChange(newFolderName.trim());
      }
      onFolderActionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "폴더명 수정 실패");
    }
  }, [token, renameTarget, newFolderName, selectedUserId, loadFolders, selectedFolder, onFolderChange, onFolderActionComplete]);

  // 폴더 삭제
  const handleDeleteFolder = useCallback(
    async (moveToDefault: boolean) => {
      if (!token || !selectedFolder || selectedFolder === ALL_FOLDERS_VALUE)
        return;
      try {
        await deleteFolder(selectedFolder, token, selectedUserId, moveToDefault);
        setDeleteModalOpen(false);
        // onFolderChange(null)에서 이미 카테고리를 올바른 folder=undefined로 재로드하므로
        // onFolderActionComplete 호출은 불필요하며 stale selectedFolder를 사용할 위험이 있음
        onFolderChange(null);
        await loadFolders();
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
      const newUserId = !value || value === "all" ? null : Number(value);
      selectedUserIdRef.current = newUserId;
      setSelectedUserId(newUserId);
      onFolderChange(null);
      // 폴더 목록 재로드 (ref로 최신 userId 사용)
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
                  <SelectValue
                    render={(value) => {
                      if (!value || value === "all") return <span className="italic text-muted-foreground truncate">전체</span>;
                      const u = users.find(u => String(u.id) === value);
                      if (u) return <span className="truncate">{u.name} ({u.email})</span>;
                      return <span className="truncate">{String(value)}</span>;
                    }}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="italic text-muted-foreground truncate">전체</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)} className="truncate">
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
              onValueChange={(value) => {
                // composite value 파싱: "all:user_id" 또는 "기본폴더:user_id"
                if (value && value.includes(":")) {
                  const [prefix, userIdStr] = value.split(":");
                  const uid = Number(userIdStr);
                  selectedUserIdRef.current = uid;
                  setSelectedUserId(uid);
                  if (prefix === "all") {
                    onFolderChange(null);
                  } else {
                    onFolderChange("기본폴더");
                  }
                  return;
                }
                onFolderChange(value === ALL_FOLDERS_VALUE ? null : value);
              }}
            >
              <SelectTrigger className="w-full">
              <SelectValue
                  render={(value) => {
                    const v = String(value ?? "");
                    if (!v || v === ALL_FOLDERS_VALUE) return <span className="italic text-muted-foreground truncate">전체</span>;
                    if (v === DEFAULT_FOLDER_LABEL) return <span className="italic text-muted-foreground truncate">{DEFAULT_FOLDER_LABEL}</span>;
                    // composite value: 접두사 제거 후 표시
                    if (v.includes(":")) {
                      const [prefix] = v.split(":");
                      if (prefix === "all") return <span className="italic text-muted-foreground truncate">전체</span>;
                      return <span className="truncate">{DEFAULT_FOLDER_LABEL}</span>;
                    }
                    return <span className="truncate">{v}</span>;
                  }}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FOLDERS_VALUE} className="italic text-muted-foreground truncate">전체</SelectItem>
                <SelectItem value={DEFAULT_FOLDER_LABEL} className="italic text-muted-foreground truncate">{DEFAULT_FOLDER_LABEL}</SelectItem>
                {isViewerAdmin && !selectedUserId && folderGroups.length > 0
                  ? folderGroups.map((group, idx) => (
                      <SelectGroup key={group.user_id} className={idx > 0 ? "mt-1 pt-1 border-t border-border" : ""}>
                        <SelectLabel>{group.user_name}</SelectLabel>
                        <SelectItem value={`all:${group.user_id}`} className="italic text-muted-foreground truncate">전체</SelectItem>
                        <SelectItem value={`${DEFAULT_FOLDER_LABEL}:${group.user_id}`} className="italic text-muted-foreground truncate">{DEFAULT_FOLDER_LABEL}</SelectItem>
                        {group.folders.map((f) => (
                          <SelectItem key={f} value={f} className="truncate">
                            {f}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))
                  : folders.map((f) => (
                      <SelectItem key={f} value={f} className="truncate">
                        {f}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>

          {/* 폴더 추가 + 수정 */}
          <div className="flex gap-2">
            <Input
              placeholder="새 폴더명"
              value={newFolderName}
              onChange={(e) => {
                setNewFolderName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (renameTarget) {
                    handleRenameFolder();
                  } else {
                    handleAddFolder();
                  }
                }
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
            {selectedFolder &&
              selectedFolder !== ALL_FOLDERS_VALUE &&
              selectedFolder !== DEFAULT_FOLDER_LABEL && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRenameTarget(selectedFolder);
                    setNewFolderName(selectedFolder); // 기존 폴더명 pre-fill
                  }}
                  className="h-8 shrink-0"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
            )}
          </div>

          {/* 폴더 이동 */}
          <div className="space-y-2">
            <Select value={moveTargetFolder} onValueChange={(v) => setMoveTargetFolder(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="이동할 폴더 선택" />
              </SelectTrigger>
              <SelectContent>
                {isViewerAdmin && !selectedUserId ? (
                  // 관리자 + 회원 "전체" → optgroup 표시
                  <>
                    <SelectItem value={DEFAULT_FOLDER_LABEL}>
                      {DEFAULT_FOLDER_LABEL}
                    </SelectItem>
                    {folderGroups.map((group) => (
                      <SelectGroup key={group.user_id}>
                        <SelectLabel>{group.user_name}</SelectLabel>
                        <SelectItem value={DEFAULT_FOLDER_LABEL}>
                          {DEFAULT_FOLDER_LABEL}
                        </SelectItem>
                        {group.folders.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </>
                ) : (
                  // 특정 회원 or 일반 회원 → flat list
                  <>
                    <SelectItem value={DEFAULT_FOLDER_LABEL}>
                      {DEFAULT_FOLDER_LABEL}
                    </SelectItem>
                    {folders.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </>
                )}
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
          {selectedFolder && selectedFolder !== ALL_FOLDERS_VALUE && selectedFolder !== DEFAULT_FOLDER_LABEL && (
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
