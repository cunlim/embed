import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UsageHistoryItem } from "@/lib/api";

interface UsageHistoryProps {
  history: UsageHistoryItem[];
}

/** 서버/클라이언트 동일 출력을 위한 포맷터 (locale 독립적) */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function UsageHistory({ history }: UsageHistoryProps) {

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
        {history.length === 0 ? (
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
                      {formatDate(item.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.source === 'embed' ? (
                        <Badge variant="secondary" className="bg-blue-500/15 text-blue-700 dark:text-blue-400">
                          {item.source_label ?? 'Embed 유사도 검색'}
                        </Badge>
                      ) : item.source === 'deleted' ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          {item.source_label ?? '(삭제됨)'}
                        </Badge>
                      ) : (
                        item.api_key?.name ?? "-"
                      )}
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
