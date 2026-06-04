"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { getAdminUserDetail, adjustUserQuota, type AdminUserDetail } from "@/lib/api";
import { QuotaAdjustDialog } from "./quota-adjust-dialog";

interface UserDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string | null;
  userId: number | null;
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: "최고관리자",
  admin: "관리자",
  user: "일반회원",
};

export function UserDetailModal({
  open,
  onOpenChange,
  token,
  userId,
}: UserDetailModalProps) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    async function fetchDetail() {
      if (!open || !token || !userId) {
        setDetail(null);
        return;
      }
      setLoading(true);
      getAdminUserDetail(token, userId)
        .then((res) => setDetail(res.data))
        .catch(() => toast.error("회원 정보를 불러오지 못했습니다"))
        .finally(() => setLoading(false));
    }
    fetchDetail();
  }, [open, token, userId]);

  const handleQuotaSubmit = async (type: "absolute" | "increment", value: number) => {
    if (!token || !userId) return;
    setAdjusting(true);
    try {
      const res = await adjustUserQuota(token, userId, type, value);
      setDetail(res.data);
      setQuotaOpen(false);
      toast.success("쿼타가 조절되었습니다");
    } catch {
      toast.error("쿼타 조절에 실패했습니다");
    } finally {
      setAdjusting(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("ko-KR");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>회원 상세 정보</DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              불러오는 중...
            </div>
          )}

          {!loading && detail && (
            <div className="flex flex-col gap-5">
              {/* 기본 정보 */}
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">이름</span>
                  <span className="font-medium">{detail.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">이메일</span>
                  <span className="font-medium">{detail.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">역할</span>
                  <Badge variant="outline">
                    {ROLE_LABELS[detail.role] || detail.role}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">가입일</span>
                  <span className="font-medium">{formatDate(detail.created_at)}</span>
                </div>
              </div>

              {/* API 사용 현황 */}
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold">API 사용 현황</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuotaOpen(true)}
                  >
                    쿼타 조절
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">전체 호출</span>
                    <p className="font-semibold">{detail.total_calls.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">오늘 호출</span>
                    <p className="font-semibold">{detail.today_calls.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">남은 쿼타</span>
                    <p className="font-semibold">
                      {detail.api_quota_remaining.toLocaleString()} / {detail.api_quota_limit.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">활성 키</span>
                    <p className="font-semibold">{detail.active_keys}</p>
                  </div>
                </div>
              </div>

              {/* 키별 사용량 테이블 */}
              {detail.calls_by_key.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">키별 사용량</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>키 이름</TableHead>
                        <TableHead className="text-right">호출 수</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.calls_by_key.map((k) => (
                        <TableRow key={k.api_key_id}>
                          <TableCell className="font-medium">
                            {k.api_key?.name || `키 #${k.api_key_id}`}
                          </TableCell>
                          <TableCell className="text-right">
                            {k.total.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <QuotaAdjustDialog
        open={quotaOpen}
        onOpenChange={setQuotaOpen}
        currentRemaining={detail?.api_quota_remaining ?? 0}
        onSubmit={handleQuotaSubmit}
        loading={adjusting}
      />
    </>
  );
}
