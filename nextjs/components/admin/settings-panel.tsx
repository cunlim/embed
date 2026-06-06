"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fetchSettings, updateSetting, type SettingsByGroup } from "@/lib/api";

interface Props {
  token: string | null;
}

const GROUP_LABELS: Record<string, string> = {
  api: "API",
  embed: "임베딩",
  translate: "번역",
  pagination: "페이지네이션",
  recommend: "추천",
  auth: "인증",
  category: "카테고리",
  validation: "검증",
  cache: "캐시",
  frontend: "프론트엔드",
};

const FIELD_LABELS: Record<string, Record<string, string>> = {
  api: {
    free_quota: "무료 호출 회수",
    rate_limit_per_minute: "분당 호출 제한",
  },
  embed: {
    host: "API 서버 주소",
    api_key: "API 키",
    model: "임베딩 모델명",
    timeout: "HTTP 타임아웃(초)",
    rate_limit_max_attempts: "Rate Limit 최대 시도",
    rate_limit_decay_seconds: "Rate Limit 시간 창(초)",
  },
  translate: {
    host: "API 서버 주소",
    api_key: "API 키",
    model: "번역 모델명",
    timeout: "HTTP 타임아웃(초)",
    max_attempts: "번역 재시도 횟수",
  },
  pagination: {
    default_per_page: "기본 페이지 크기",
    max_per_page_guest: "비로그인 최대 페이지 크기",
  },
  recommend: {
    default_limit: "기본 추천 결과 수",
    max_per_page: "최대 페이지 크기",
  },
  auth: {
    token_expiry_days: "토큰 만료일",
    session_lifetime: "세션 수명(분)",
  },
  category: {
    code_prefix: "코드 Prefix",
    code_random_length: "코드 랜덤 길이",
    code_max_attempts: "코드 생성 최대 시도",
  },
  validation: {
    text_max_length: "텍스트 최대 길이",
    name_max_length: "이름 최대 길이",
  },
  cache: {
    settings_ttl: "설정 캐시 TTL(초)",
  },
  frontend: {
    step_delay_ms: "단계 실행 간 지연(ms)",
  },
};

export function SettingsPanel({ token }: Props) {
  const [settings, setSettings] = useState<SettingsByGroup>({});
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchSettings(token).then((res) => {
      setSettings(res.data);
      const init: Record<string, string> = {};
      for (const [group, items] of Object.entries(res.data)) {
        for (const [key, val] of Object.entries(items)) {
          init[`${group}.${key}`] = String(val);
        }
      }
      setEditing(init);
    }).catch(() => {
      setMsg({ type: "error", text: "설정을 불러오지 못했습니다." });
    });
  }, [token]);

  const handleSave = useCallback(async (group: string, key: string) => {
    const fieldKey = `${group}.${key}`;
    setSaving((prev) => ({ ...prev, [fieldKey]: true }));
    setMsg(null);
    try {
      const res = await updateSetting(group, key, editing[fieldKey], token);
      setSettings((prev) => ({
        ...prev,
        [group]: { ...prev[group], [key]: res.data.value },
      }));
      setMsg({ type: "success", text: "저장되었습니다." });
    } catch {
      setMsg({ type: "error", text: `${group}.${key} 저장 실패` });
    } finally {
      setSaving((prev) => ({ ...prev, [fieldKey]: false }));
    }
  }, [editing, token]);

  if (Object.keys(settings).length === 0) {
    return <p className="text-muted-foreground text-sm">불러오는 중...</p>;
  }

  return (
    <div className="space-y-6">
      {msg && (
        <p className={msg.type === "success" ? "text-green-600 text-sm" : "text-red-600 text-sm"}>
          {msg.text}
        </p>
      )}
      {Object.entries(GROUP_LABELS).map(([group, label]) => {
        const items = settings[group];
        if (!items) return null;
        return (
          <Card key={group} className="p-4">
            <h3 className="font-semibold text-sm mb-3">{label}</h3>
            <div className="space-y-3">
              {Object.keys(items).map((key) => {
                const fieldKey = `${group}.${key}`;
                const isInteger = typeof items[key] === "number";
                const isApiKey = key === "api_key";
                return (
                  <div key={key} className="flex items-center gap-3">
                    <Label className="w-48 shrink-0 text-xs text-muted-foreground">
                      {FIELD_LABELS[group]?.[key] ?? key}
                    </Label>
                    <Input
                      type={isApiKey ? "password" : isInteger ? "number" : "text"}
                      value={editing[fieldKey] ?? ""}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                      }
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saving[fieldKey]}
                      onClick={() => handleSave(group, key)}
                    >
                      {saving[fieldKey] ? "저장 중" : "저장"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
