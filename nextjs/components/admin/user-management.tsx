"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fetchAdminUsers, type AdminUserListItem } from "@/lib/api";
import { UserDetailModal } from "./user-detail-modal";

interface Props {
  token: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: "최고관리자",
  admin: "관리자",
  user: "일반회원",
};

export function UserManagement({ token }: Props) {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      if (!token) return;
      setLoading(true);
      fetchAdminUsers(token)
        .then((res) => setUsers(res.data))
        .catch(() => toast.error("회원 목록을 불러오지 못했습니다"))
        .finally(() => setLoading(false));
    }
    fetchUsers();
  }, [token]);

  const handleManage = (userId: number) => {
    setSelectedUserId(userId);
    setDetailOpen(true);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("ko-KR");

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">회원 관리</h2>
        <p className="text-sm text-muted-foreground">
          전체 회원 목록을 관리합니다.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          불러오는 중...
        </div>
      )}

      {!loading && users.length === 0 && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          등록된 회원이 없습니다.
        </div>
      )}

      {!loading && users.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>역할</TableHead>
              <TableHead>가입일</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {ROLE_LABELS[u.role] || u.role}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(u.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleManage(u.id)}
                  >
                    관리
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <UserDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        token={token}
        userId={selectedUserId}
      />
    </Card>
  );
}
