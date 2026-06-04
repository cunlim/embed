"use client";

import { useState, useCallback, useEffect } from "react";
import {
  getApiKeys,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  type ApiKeyItem,
} from "@/lib/api";

interface UseApiKeysReturn {
  apiKeys: ApiKeyItem[];
  isLoading: boolean;
  error: string | null;
  loadApiKeys: () => Promise<void>;
  addApiKey: (name: string) => Promise<ApiKeyItem>;
  toggleStatus: (id: number, currentStatus: string) => Promise<void>;
  removeApiKey: (id: number) => Promise<void>;
  renameApiKey: (id: number, name: string) => Promise<void>;
}

export function useApiKeys(token?: string | null): UseApiKeysReturn {
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(null);

  const loadApiKeys = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await getApiKeys(token);
      setApiKeys(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "API key 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const addApiKey = useCallback(
    async (name: string) => {
      if (!token) throw new Error("인증이 필요합니다.");
      const response = await createApiKey(token, name);
      setApiKeys((prev) => [response.data, ...prev]);
      return response.data;
    },
    [token],
  );

  const toggleStatus = useCallback(
    async (id: number, currentStatus: string) => {
      if (!token) throw new Error("인증이 필요합니다.");
      const newStatus = currentStatus === "active" ? "paused" : "active";
      const response = await updateApiKey(token, id, { status: newStatus });
      setApiKeys((prev) => prev.map((k) => (k.id === id ? response.data : k)));
    },
    [token],
  );

  const removeApiKey = useCallback(
    async (id: number) => {
      if (!token) throw new Error("인증이 필요합니다.");
      await deleteApiKey(token, id);
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    },
    [token],
  );

  const renameApiKey = useCallback(
    async (id: number, name: string) => {
      if (!token) throw new Error("인증이 필요합니다.");
      const response = await updateApiKey(token, id, { name });
      setApiKeys((prev) => prev.map((k) => (k.id === id ? response.data : k)));
    },
    [token],
  );

  useEffect(() => {
    async function init() {
      await loadApiKeys();
    }
    init();
  }, [loadApiKeys]);

  return {
    apiKeys,
    isLoading,
    error,
    loadApiKeys,
    addApiKey,
    toggleStatus,
    removeApiKey,
    renameApiKey,
  };
}
