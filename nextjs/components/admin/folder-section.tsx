"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderPlus, FolderMinus, ArrowRightLeft, Pencil, Check, X } from "lucide-react";
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
  initialUserId?: number | null;
  selectedIds: Set<number>;
  serverFolders?: string[];
  serverFolderGroups?: import("@/lib/api").FolderGroup[];
  serverUsers?: { id: number; name: string; email: string }[];
  onFolderChange: (folder: string | null, userId?: number | null) => void;
  onFolderActionComplete: () => void;
}

const DEFAULT_FOLDER_LABEL = "기본폴더";
const ALL_FOLDERS_VALUE = "all";
const RESERVED_NAMES = ["기본폴더", "전체"];

export default function FolderSection({
  token,
  user,
  selectedFolder,
  initialUserId,
  selectedIds,
  serverFolders = [],
  serverFolderGroups = [],
  serverUsers = [],
  onFolderChange,
  onFolderActionComplete,
}: FolderSectionProps) {
  const [folders, setFolders] = useState<string[]>(serverFolders);
  const [folderGroups, setFolderGroups] = useState<FolderGroup[]>(serverFolderGroups);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [moveTargetFolder, setMoveTargetFolder] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(initialUserId ?? null);
  const selectedUserIdRef = useRef(selectedUserId);
  // eslint-disable-next-line react-hooks/refs
  selectedUserIdRef.current = selectedUserId;
  const [renameTarget, setRenameTarget] = useState<string>("");

  // "기능시연" 클릭 시 폴더 section 초기화
  useEffect(() => {
    const handleReset = () => {
      setSelectedUserId(null);
      onFolderChange(null, null);
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
      const res = await fetchFolders(token);
      setFolders(res.data);
      setFolderGroups(res.grouped ?? []);
    } catch {
      // 무시
    }
  }, [token]);

  // 초기 마운트 시 폴더 그룹 로드 (optgroup 표시용)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const currentUserFolders = selectedUserId
      ? (folderGroups.find(g => g.user_id === selectedUserId)?.folders ?? [])
      : (user ? (folderGroups.find(g => g.user_id === user.id)?.folders ?? []) : folders);
    if (currentUserFolders.includes(name)) {
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
  }, [newFolderName, token, folders, folderGroups, selectedUserId, user, loadFolders]);

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
    if (!window.confirm(`선택한 ${selectedIds.size}개 카테고리를 이동하시겠습니까?`)) return;
    let resolvedFolder = moveTargetFolder;
    if (resolvedFolder && resolvedFolder.includes(":")) {
      const [name] = resolvedFolder.split(":");
      resolvedFolder = name;
    }
    const target =
      resolvedFolder === DEFAULT_FOLDER_LABEL ? null : resolvedFolder || null;
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
    if (!window.confirm("현재 범위의 모든 카테고리를 이동하시겠습니까?")) return;
    let resolvedFolder = moveTargetFolder;
    if (resolvedFolder && resolvedFolder.includes(":")) {
      const [name] = resolvedFolder.split(":");
      resolvedFolder = name;
    }
    const target =
      resolvedFolder === DEFAULT_FOLDER_LABEL ? null : resolvedFolder || null;
    try {
      await moveCategoriesToFolder([], target, token);
      setMoveTargetFolder("");
      await loadFolders();
      onFolderActionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "폴더 이동 실패");
    }
  }, [token, moveTargetFolder, loadFolders, onFolderActionComplete]);

  // 현재 선택된 폴더는 이동 대상에서 제외
  const disabledMoveTarget =
    selectedFolder && selectedFolder !== ALL_FOLDERS_VALUE
      ? isViewerAdmin && selectedUserId !== null
        ? `${selectedFolder}:${selectedUserId}`
        : selectedFolder
      : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">폴더</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 폴더 select */}
          <div className="space-y-1">
            <Select
              value={
                selectedUserId !== null
                  ? (selectedFolder ?? "all") + ":" + selectedUserId
                  : (selectedFolder ?? ALL_FOLDERS_VALUE)
              }
              onValueChange={(value) => {
                if (value && value.includes(":")) {
                  const [prefix, userIdStr] = value.split(":");
                  const uid = Number(userIdStr);
                  selectedUserIdRef.current = uid;
                  setSelectedUserId(uid);
                  if (prefix === "all") {
                    onFolderChange(null, uid);
                  } else if (prefix === DEFAULT_FOLDER_LABEL) {
                    onFolderChange(DEFAULT_FOLDER_LABEL, uid);
                  } else {
                    onFolderChange(prefix, uid);
                  }
                  return;
                }
                if (value === ALL_FOLDERS_VALUE) {
                  selectedUserIdRef.current = null;
                  setSelectedUserId(null);
                  onFolderChange(null, null);
                  return;
                }
                if (value === DEFAULT_FOLDER_LABEL) {
                  selectedUserIdRef.current = null;
                  setSelectedUserId(null);
                  onFolderChange(DEFAULT_FOLDER_LABEL, null);
                  return;
                }
                onFolderChange(value, selectedUserId);
              }}
            >
              <SelectTrigger className="w-full">
              <SelectValue
                  render={(value) => {
                    const v = String(value ?? "");
                    if (!v || v === ALL_FOLDERS_VALUE) return <span className="italic truncate">전체</span>;
                    if (v === DEFAULT_FOLDER_LABEL) return <span className="italic truncate">{DEFAULT_FOLDER_LABEL}</span>;
                    if (v.includes(":")) {
                      const [prefix, uidStr] = v.split(":");
                      const uid = Number(uidStr);
                      const group = folderGroups.find(g => g.user_id === uid);
                      const userName = group?.user_name ?? serverUsers?.find(u => u.id === uid)?.name ?? `#${uid}`;
                      const folderDisplay = prefix === "all" ? "전체" : prefix;
                      if (isViewerAdmin) {
                        const isSpecial = prefix === "all" || prefix === DEFAULT_FOLDER_LABEL;
                        return <span className={`truncate${isSpecial ? " italic" : ""}`}>{userName} / {folderDisplay}</span>;
                      }
                      if (prefix === "all") return <span className="italic truncate">전체</span>;
                      if (prefix === DEFAULT_FOLDER_LABEL) return <span className="italic truncate">{DEFAULT_FOLDER_LABEL}</span>;
                      return <span className="truncate">{folderDisplay}</span>;
                    }
                    if (isViewerAdmin && selectedUserId) {
                      const group = folderGroups.find(g => g.user_id === selectedUserId);
                      const userName = group?.user_name ?? "";
                      return <span className="truncate">{userName} / {v}</span>;
                    }
                    return <span className="truncate">{v}</span>;
                  }}
                />
              </SelectTrigger>
              <SelectContent>
                {isViewerAdmin ? (
                  <>
                    <SelectGroup>
                      <SelectLabel>전체회원</SelectLabel>
                      <SelectItem value={ALL_FOLDERS_VALUE} className="italic truncate">전체</SelectItem>
                      <SelectItem value={DEFAULT_FOLDER_LABEL} className="italic truncate">{DEFAULT_FOLDER_LABEL}</SelectItem>
                    </SelectGroup>
                    {folderGroups.length > 0 ? (
                      folderGroups.map((group, idx) => (
                        <SelectGroup key={group.user_id} className={idx > 0 ? "mt-1 pt-1 border-t border-border" : ""}>
                          <SelectLabel>{group.user_name} ({group.user_email})</SelectLabel>
                          <SelectItem value={`all:${group.user_id}`} className="italic truncate">전체</SelectItem>
                          <SelectItem value={`${DEFAULT_FOLDER_LABEL}:${group.user_id}`} className="italic truncate">{DEFAULT_FOLDER_LABEL}</SelectItem>
                          {group.folders.filter(f => f !== DEFAULT_FOLDER_LABEL).map((f) => (
                            <SelectItem key={f} value={`${f}:${group.user_id}`} className="truncate">
                              {f}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))
                    ) : (
                      // Fallback: folderGroups not loaded yet — show folders flat
                      folders.filter(f => f !== DEFAULT_FOLDER_LABEL).map((f) => (
                        <SelectItem key={f} value={f} className="truncate">
                          {f}
                        </SelectItem>
                      ))
                    )}
                  </>
                ) : (
                  // 일반 회원: flat list
                  <>
                    <SelectItem value={ALL_FOLDERS_VALUE} className="italic truncate">전체</SelectItem>
                    <SelectItem value={DEFAULT_FOLDER_LABEL} className="italic truncate">{DEFAULT_FOLDER_LABEL}</SelectItem>
                    {folders.filter(f => f !== DEFAULT_FOLDER_LABEL).map((f) => (
                      <SelectItem key={f} value={f} className="truncate">
                        {f}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 폴더 추가 + 수정 */}
          <div className="flex gap-2">
            <Input
              placeholder={renameTarget ? "폴더명 수정..." : "새 폴더명"}
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
            {renameTarget ? (
              <>
                <Button
                  size="sm"
                  onClick={handleRenameFolder}
                  disabled={!newFolderName.trim()}
                  className="h-8 shrink-0"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRenameTarget("");
                    setNewFolderName("");
                    setError(null);
                  }}
                  className="h-8 shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
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
                      onClick={() => {
                        setRenameTarget(selectedFolder);
                        setNewFolderName(selectedFolder);
                      }}
                      className="h-8 shrink-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                )}
              </>
            )}
          </div>

          {/* 폴더 이동 */}
          <div className="space-y-2">
            <div className="flex gap-1">
              <div className="flex-1">
            <Select value={moveTargetFolder} onValueChange={(v) => setMoveTargetFolder(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue
                  render={(value) => {
                    const v = String(value ?? "");
                    if (!v) return <span className="italic truncate">이동할 폴더 선택</span>;
                    if (v === DEFAULT_FOLDER_LABEL) return <span className="italic truncate">{DEFAULT_FOLDER_LABEL}</span>;
                    if (v.includes(":")) {
                      const [prefix, uidStr] = v.split(":");
                      const uid = Number(uidStr);
                      const group = folderGroups.find(g => g.user_id === uid);
                      const userName = group?.user_name ?? serverUsers?.find(u => u.id === uid)?.name ?? `#${uid}`;
                      if (isViewerAdmin) {
                        const isSpecial = prefix === DEFAULT_FOLDER_LABEL;
                        return <span className={`truncate${isSpecial ? " italic" : ""}`}>{userName} / {prefix}</span>;
                      }
                      return <span className="truncate">{prefix}</span>;
                    }
                    if (isViewerAdmin && selectedUserId) {
                      const group = folderGroups.find(g => g.user_id === selectedUserId);
                      const userName = group?.user_name ?? "";
                      return <span className="truncate">{userName} / {v}</span>;
                    }
                    return <span className="truncate">{v}</span>;
                  }}
                />
              </SelectTrigger>
              <SelectContent>
                {isViewerAdmin ? (
                  folderGroups.length > 0 ? (
                    folderGroups.map((group, idx) => (
                      <SelectGroup key={group.user_id} className={idx > 0 ? "mt-1 pt-1 border-t border-border" : ""}>
                        <SelectLabel>{group.user_name} ({group.user_email})</SelectLabel>
                        <SelectItem value={`${DEFAULT_FOLDER_LABEL}:${group.user_id}`} className="italic" disabled={disabledMoveTarget === `${DEFAULT_FOLDER_LABEL}:${group.user_id}`}>
                          {DEFAULT_FOLDER_LABEL}
                        </SelectItem>
                        {group.folders.filter(f => f !== DEFAULT_FOLDER_LABEL).map((f) => (
                          <SelectItem key={f} value={`${f}:${group.user_id}`} disabled={disabledMoveTarget === `${f}:${group.user_id}`}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))
                  ) : (
                    <>
                      <SelectItem value={DEFAULT_FOLDER_LABEL} className="italic" disabled={disabledMoveTarget === DEFAULT_FOLDER_LABEL}>{DEFAULT_FOLDER_LABEL}</SelectItem>
                      {folders.filter(f => f !== DEFAULT_FOLDER_LABEL).map((f) => (
                        <SelectItem key={f} value={f} disabled={disabledMoveTarget === f}>{f}</SelectItem>
                      ))}
                    </>
                  )
                ) : (
                  <>
                    <SelectItem value={DEFAULT_FOLDER_LABEL} className="italic" disabled={disabledMoveTarget === DEFAULT_FOLDER_LABEL}>{DEFAULT_FOLDER_LABEL}</SelectItem>
                    {folders.filter(f => f !== DEFAULT_FOLDER_LABEL).map((f) => (
                      <SelectItem key={f} value={f} disabled={disabledMoveTarget === f}>{f}</SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
              </div>
              {moveTargetFolder && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMoveTargetFolder("")}
                  className="h-9 w-9 shrink-0 p-0"
                  title="초기화"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
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
              <FolderMinus className="h-3.5 w-3.5 mr-1 shrink-0" />
              <span className="truncate">&ldquo;{selectedFolder.length > 10 ? selectedFolder.slice(0, 10) + "..." : selectedFolder}&rdquo; 삭제</span>
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
