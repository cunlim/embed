"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiKeys } from "@/hooks/useApiKeys";
import type { ApiKeyItem } from "@/lib/api";
import { ApiKeyCard } from "./api-key-card";
import { ApiKeyCreateDialog } from "./api-key-create-dialog";

interface ApiKeySectionProps {
  readonly token: string | null;
  readonly initialApiKeys?: ApiKeyItem[];
}

export function ApiKeySection({ token, initialApiKeys }: ApiKeySectionProps) {
  const {
    apiKeys,
    isLoading,
    addApiKey,
    toggleStatus,
    removeApiKey,
    renameApiKey,
  } = useApiKeys(token, initialApiKeys);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCreate = async (name: string) => {
    try {
      const { plainKey } = await addApiKey(name);
      toast.success("API key가 생성되었습니다.", {
        description: (
          <div className="mt-1">
            <p className="mb-1">아래 키를 복사해두세요. 이후에는 확인할 수 없습니다.</p>
            <code className="block w-full rounded bg-muted px-2 py-1 text-xs break-all">{plainKey}</code>
          </div>
        ),
        duration: 30000,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "API key 생성에 실패했습니다.");
      throw new Error("API key 생성 실패");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Key className="h-5 w-5" />
          API Key 관리
        </CardTitle>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />새 API key
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Key className="mb-2 h-8 w-8" />
            <p>등록된 API key가 없습니다.</p>
            <p className="text-sm">
              위의 버튼을 클릭하여 새 API key를 생성하세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((key) => (
              <ApiKeyCard
                key={key.id}
                apiKey={key}
                onToggleStatus={toggleStatus}
                onDelete={removeApiKey}
                onRename={renameApiKey}
              />
            ))}
          </div>
        )}
      </CardContent>

      <ApiKeyCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreate}
      />
    </Card>
  );
}
