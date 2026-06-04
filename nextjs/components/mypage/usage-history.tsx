"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUsageStats } from "@/hooks/useUsageStats";

interface UsageHistoryProps {
  token: string | null;
}

export function UsageHistory({ token }: UsageHistoryProps) {
  const { history, isLoading } = useUsageStats(token);

  const getStatusBadge = (status: number) => {
    if (status >= 200 && status < 300) {
      return (
        <Badge variant="default" className="bg-green-500/15 text-green-700 dark:text-green-400">
          {status}
        </Badge>
      );
    }
    if (status >= 400) {
      return (
        <Badge variant="destructive">{status}</Badge>
      );
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">최근 호출 이력</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            호출 이력이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>날짜</TableHead>
                  <TableHead>API key</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">처리시간</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">
                      {new Date(item.created_at).toLocaleString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.api_key?.name ?? "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(item.response_status)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {item.processing_time_ms}ms
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
