// 서버(SSR)에서는 Docker 내부 네트워크로 직접 호출, 클라이언트에서는 외부 URL 사용
const API_URL =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  cache?: RequestCache;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, cache } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    ...(cache !== undefined ? { cache } : {}),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(error.message || `API Error: ${res.status}`, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

// --- Runner 상태 ---

export type StepName = "translation.zh" | "translation.en" | "embedding.ko" | "embedding.zh" | "embedding.en";

// --- 카테고리 상세 (번역·임베딩 상태) ---

export type EmbeddingStatus = "completed" | "pending" | "failed" | "running";

export interface LanguageDetail {
  translation_text: string | null;
  embedding: {
    status: EmbeddingStatus;
    preview?: number[] | null;
  };
}

export interface CategoryTranslations {
  id: number;
  category_code: string;
  category_name_ko: string;
  embedding_dimensions: number | null;
  languages: {
    ko: LanguageDetail;
    en: LanguageDetail;
    zh: LanguageDetail;
  };
}

export interface CategoryTranslationsResponse {
  data: CategoryTranslations;
}

export function fetchCategoryTranslations(
  categoryId: number,
  token?: string | null,
  noPreview?: boolean
): Promise<CategoryTranslationsResponse> {
  const params = noPreview ? '?no_preview=true' : '';
  return request<CategoryTranslationsResponse>(
    `/categories/${categoryId}/translations${params}`,
    { token }
  );
}

// --- 배치 작업 상태 확인 ---

export interface BatchStatusCategory {
  id: number;
  category_name_ko: string;
  missing_steps: StepName[];
}

export interface BatchStatusData {
  total_selected: number;
  needs_processing: number;
  total_steps: number;
  categories: BatchStatusCategory[];
}

export interface BatchStatusResponse {
  data: BatchStatusData;
}

export async function fetchBatchStatus(
  token: string,
  params: { ids?: number[]; filter?: string; keyword?: string; folder?: string; steps?: StepName[] }
): Promise<BatchStatusResponse> {
  return request<BatchStatusResponse>("/categories/batch-status", {
    method: "POST",
    body: params,
    token,
  });
}

// --- 배치 실행 ---

export interface BatchRunStepResult {
  step: string;
  status: "completed" | "failed" | "skipped";
  result?: string | null;
  error?: string | null;
}

export interface BatchRunCategoryResult {
  id: number;
  category_name_ko: string;
  status: "completed" | "failed";
  steps: BatchRunStepResult[];
}

export interface BatchRunData {
  total_categories: number;
  completed_categories: number;
  failed_categories: number;
  total_steps: number;
  completed_steps: number;
  failed_steps: number;
  categories: BatchRunCategoryResult[];
}

export interface BatchRunResponse {
  data: BatchRunData;
}

export async function batchRun(
  token: string,
  params: { ids?: number[]; filter?: string; keyword?: string; folder?: string; steps?: StepName[] }
): Promise<BatchRunResponse> {
  return request<BatchRunResponse>("/categories/batch-run", {
    method: "POST",
    body: params,
    token,
  });
}

// --- 배치 실행 (SSE 스트리밍) ---

export interface BatchProgress {
  totalCategories: number;
  completedCategories: number;
  failedCategories: number;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  currentCategory: string;
  currentStep: string;
  currentStepIndex: number;
  totalStepsInCategory: number;
}

export interface BatchProgressCallbacks {
  onProgress?: (progress: BatchProgress) => void;
  onComplete?: (result: BatchRunData) => void;
  onError?: (error: string) => void;
}

/**
 * SSE 스트리밍 배치 실행.
 * 서버에서 실시간으로 진행 상황을 수신합니다.
 */
export async function batchRunStream(
  token: string,
  params: { ids?: number[]; filter?: string; keyword?: string; folder?: string; steps?: StepName[] },
  callbacks: BatchProgressCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

  const res = await fetch(`${API_URL}/categories/batch-run-stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params),
    signal,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `배치 실행 실패 (${res.status})`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("응답 스트림을 읽을 수 없습니다");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6);
          try {
            const data = JSON.parse(jsonStr);

            if (eventType === "progress" && callbacks.onProgress) {
              callbacks.onProgress({
                totalCategories: data.total_categories,
                completedCategories: data.completed_categories,
                failedCategories: data.failed_categories,
                totalSteps: data.total_steps ?? 0,
                completedSteps: data.completed_steps,
                failedSteps: data.failed_steps,
                currentCategory: data.category_name || "",
                currentStep: data.step || "",
                currentStepIndex: data.step_index ?? 0,
                totalStepsInCategory: data.total_steps_in_category ?? 0,
              });
            } else if (eventType === "category_complete" && callbacks.onProgress) {
              callbacks.onProgress({
                totalCategories: data.total_categories,
                completedCategories: data.completed_categories,
                failedCategories: data.failed_categories,
                totalSteps: data.total_steps,
                completedSteps: data.completed_steps,
                failedSteps: data.failed_steps,
                currentCategory: data.category_name || "",
                currentStep: "",
                currentStepIndex: 0,
                totalStepsInCategory: 0,
              });
            } else if (eventType === "complete" && callbacks.onComplete) {
              callbacks.onComplete(data as BatchRunData);
            }
          } catch {
            // JSON 파싱 실패 무시
          }
          eventType = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// --- 벌크 업로드/다운로드 ---

export interface BulkUploadRowResult {
  row: number;
  success: boolean;
  message?: string;
  category_code?: string;
  category_name_ko?: string;
}

export interface BulkUploadSummary {
  total: number;
  success: number;
  failed: number;
}

export interface BulkUploadResponse {
  data: {
    results: BulkUploadRowResult[];
    summary: BulkUploadSummary;
  };
}

export async function bulkUpload(
  file: File,
  token?: string | null,
  folder?: string,
): Promise<BulkUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (folder) formData.append("folder", folder);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  const res = await fetch(`${API_URL}/categories/bulk-upload`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `업로드 실패 (${res.status})`);
  }

  return res.json();
}

export async function bulkDownload(
  token?: string | null,
  params?: { filter?: string; search?: string; folder?: string; user_id?: number },
): Promise<Blob> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  const query = new URLSearchParams();
  if (params?.filter) query.set("filter", params.filter);
  if (params?.search) query.set("search", params.search);
  if (params?.folder) query.set("folder", params.folder);
  if (params?.user_id) query.set("user_id", String(params.user_id));

  const res = await fetch(`${API_URL}/categories/bulk-download?${query}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`다운로드 실패 (${res.status})`);
  }

  return res.blob();
}

// --- 추천 ---

export interface LanguageScore {
  similarity_score: number | null;
  rank: number | null;
  category_embedding: number[] | null;
}

export interface PerLanguageScores {
  ko: LanguageScore;
  en: LanguageScore;
  zh: LanguageScore;
}

export interface Recommendation {
  id: number;
  category_code: string;
  category_name_ko: string;
  category_name_zh: string | null;
  category_name_en: string | null;
  category_name: string;
  translation_status: "completed" | "partial" | "pending";
  similarity_score: number | null;
  query_embedding: number[] | null;
  category_embedding: number[] | null;
  per_language_scores: PerLanguageScores | null;
}

export interface RecommendResponse {
  data: Recommendation[];
  meta: PaginationMeta;
}

export function recommend(
  text: string,
  targetLanguage: string,
  token?: string | null,
  page?: number,
  perPage?: number,
  filter?: string,
  keyword?: string,
  folder?: string,
  userId?: number | null,
): Promise<RecommendResponse> {
  const body: Record<string, string | number> = { text, target_language: targetLanguage };
  if (page) body.page = page;
  if (perPage) body.per_page = perPage;
  if (filter) body.filter = filter;
  if (keyword) body.keyword = keyword;
  if (folder) body.folder = folder;
  if (userId) body.user_id = userId;
  return request<RecommendResponse>("/recommend", {
    method: "POST",
    body,
    token,
  });
}

// --- 카테고리 ---

export interface Category {
  id: number;
  user_id: number;
  category_code: string;
  category_name_ko: string;
  category_name_zh: string | null;
  category_name_en: string | null;
  category_name?: string;
  translation_status: "completed" | "partial" | "pending";
  similarity_score?: number | null;
}

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

export interface CategoryListResponse {
  data: Category[];
  meta: PaginationMeta;
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
}

export function getCategories(
  token?: string | null,
  page?: number,
  perPage?: number,
  filter?: string,
  search?: string,
  folder?: string,
  userId?: number | null,
  steps?: StepName[],
  searchLang?: string,
): Promise<CategoryListResponse> {
  const params = new URLSearchParams();
  if (page && page > 1) params.set("page", String(page));
  params.set("per_page", String(perPage ?? 20));
  if (filter) params.set("filter", filter);
  if (search) params.set("search", search);
  if (searchLang) params.set("search_lang", searchLang);
  if (folder) params.set("folder", folder);
  if (userId) params.set("user_id", String(userId));
  if (steps && steps.length > 0) {
    steps.forEach((step) => params.append("steps[]", step));
  }
  const qs = params.toString();
  return request<CategoryListResponse>(`/categories?${qs}`, { token });
}

/** cat1~catN 동적 파라미터. max_depth 설정에 따라 확장 가능. */
export type CategoryLevelsParams = Record<string, string>;

export interface CategoryLevelOption {
  label: string;
  categoryId: number;
  categoryCode: string;
}

export interface CategoryLevelsResponse {
  options: string[] | CategoryLevelOption[];
  maxDepth: number;
  isLeaf: boolean;
  leafCategoryId: number | null;
  categoryCount: number | null;
}

export function fetchCategoryLevels(
  params?: CategoryLevelsParams,
  token?: string | null,
  userId?: number | null,
): Promise<{ data: CategoryLevelsResponse }> {
  const searchParams = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) searchParams.set(key, value);
    }
  }
  if (userId) searchParams.set("user_id", String(userId));
  const qs = searchParams.toString();
  return request<{ data: CategoryLevelsResponse }>(
    `/categories/levels${qs ? "?" + qs : ""}`,
    { cache: "no-store", token }
  );
}


export function deleteCategory(
  id: number,
  token?: string | null
): Promise<void> {
  return request<void>(`/categories/${id}`, {
    method: "DELETE",
    token,
  });
}

export function createCategory(
  categoryNameKo: string,
  token?: string | null,
  categoryCode?: string,
  categoryNameEn?: string,
  categoryNameZh?: string,
  folder?: string,
  userId?: number,
): Promise<{ data: Category }> {
  const body: Record<string, string> = { category_name_ko: categoryNameKo };
  if (categoryCode) {
    body.category_code = categoryCode;
  }
  if (categoryNameEn) {
    body.category_name_en = categoryNameEn;
  }
  if (categoryNameZh) {
    body.category_name_zh = categoryNameZh;
  }
  // "기본폴더"는 폴더 미지정을 의미하므로 NULL로 저장
  if (folder && folder !== "기본폴더") body.folder = folder;
  // admin이 특정 회원의 폴더를 선택한 경우 해당 회원의 user_id 전송
  if (userId) {
    body.user_id = String(userId);
  }
  return request<{ data: Category }>("/categories", {
    method: "POST",
    body,
    token,
  });
}


// --- 개별 단계 실행 ---

export interface RunStepResponse {
  step: string;
  status: "completed" | "failed";
  result?: string;
  error?: string;
  translations?: CategoryTranslations;
}

export async function runStep(
  categoryId: number,
  step: string,
  token?: string | null
): Promise<RunStepResponse> {
  try {
    return await request<RunStepResponse>(`/categories/${categoryId}/run-step`, {
      method: "POST",
      body: { step },
      token,
    });
  } catch (err) {
    // 422 유효성 검증 실패는 재시도 불가 — failed 상태로 반환
    if (err instanceof ApiError && err.status === 422) {
      return { step, status: "failed", error: err.message };
    }
    throw err;
  }
}

// --- 카테고리 텍스트 업데이트 ---

export interface UpdateTextResponse {
  data: {
    updated: boolean;
    id: number;
    translations: CategoryTranslations;
    listRow: {
      id: number;
      category_code: string;
      category_name_ko: string;
      category_name_zh: string | null;
      category_name_en: string | null;
      translation_status: string;
    };
  };
}

export function updateCategoryText(
  categoryId: number,
  field: "category_name_ko" | "category_name_en" | "category_name_zh" | "category_code",
  value: string | null,
  token?: string | null
): Promise<UpdateTextResponse> {
  return request<UpdateTextResponse>(`/categories/${categoryId}/update-text`, {
    method: "PUT",
    body: { field, value },
    token,
  });
}

// --- 인증 ---

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

interface AuthApiResponse {
  data: {
    user: User;
    token: string;
    token_type: string;
  };
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await request<AuthApiResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  return { user: res.data.user, token: res.data.token };
}

export async function register(
  name: string,
  email: string,
  password: string,
  passwordConfirmation: string
): Promise<AuthResponse> {
  const res = await request<AuthApiResponse>("/auth/register", {
    method: "POST",
    body: {
      name,
      email,
      password,
      password_confirmation: passwordConfirmation,
    },
  });
  return { user: res.data.user, token: res.data.token };
}

export function logout(token?: string | null): Promise<void> {
  return request<void>("/auth/logout", { method: "POST", token });
}

export async function getUser(token?: string | null): Promise<User> {
  const res = await request<{ data: User }>("/auth/user", { token });
  return res.data;
}

// --- 관리자 설정 ---

export interface SettingsByGroup {
  [group: string]: Record<string, number | string>;
}

export interface SettingsResponse {
  data: SettingsByGroup;
}

export function fetchSettings(token?: string | null): Promise<SettingsResponse> {
  return request<SettingsResponse>("/admin/settings", {
    method: "GET",
    token,
  });
}

export interface UpdateSettingResponse {
  data: {
    group: string;
    key: string;
    value: number | string;
  };
}

export function updateSetting(
  group: string,
  key: string,
  value: string | number,
  token?: string | null,
): Promise<UpdateSettingResponse> {
  return request<UpdateSettingResponse>("/admin/settings", {
    method: "PUT",
    body: { group, key, value },
    token,
  });
}

// --- 폴더 ---

export interface FolderGroup {
  user_id: number;
  user_name: string;
  user_email: string;
  folders: string[];
}

export function fetchFolders(
  token?: string | null,
  userId?: number | null,
): Promise<{ data: string[]; grouped?: FolderGroup[] }> {
  const params = new URLSearchParams();
  if (userId) params.set("user_id", String(userId));
  const qs = params.toString();
  return request<{ data: string[]; grouped?: FolderGroup[] }>(`/folders${qs ? "?" + qs : ""}`, { token });
}

export function deleteFolder(
  folderName: string,
  token?: string | null,
  userId?: number | null,
  moveToDefault: boolean = true,
): Promise<{ message: string }> {
  const params = new URLSearchParams();
  if (userId) params.set("user_id", String(userId));
  params.set("move_to_default", moveToDefault ? "1" : "0");
  const qs = params.toString();
  return request<{ message: string }>(`/folders/${encodeURIComponent(folderName)}?${qs}`, {
    method: "DELETE",
    token,
  });
}

export function moveCategoriesToFolder(
  categoryIds: number[],
  targetFolder: string | null,
  token?: string | null,
  targetUserId?: number | null,
): Promise<{ message: string; moved: number; failed: number }> {
  const body: Record<string, unknown> = { category_ids: categoryIds, target_folder: targetFolder };
  if (targetUserId != null) body.target_user_id = targetUserId;
  return request<{ message: string; moved: number; failed: number }>("/categories/move-folder", {
    method: "POST",
    body,
    token,
  });
}

export function createFolder(
  folderName: string,
  token?: string | null,
  userId?: number | null,
): Promise<{ message: string }> {
  const body: Record<string, unknown> = { folder_name: folderName };
  if (userId) body.user_id = userId;
  return request<{ message: string }>("/folders", {
    method: "POST",
    body,
    token,
  });
}

export function renameFolder(
  oldName: string,
  newName: string,
  token?: string | null,
  userId?: number | null,
): Promise<{ message: string }> {
  const body: Record<string, unknown> = { new_name: newName };
  if (userId) body.user_id = userId;
  return request<{ message: string }>(`/folders/${encodeURIComponent(oldName)}`, {
    method: "PUT",
    body,
    token,
  });
}

export function checkFolderHasCategories(
  folderName: string,
  token?: string | null,
  userId?: number | null,
): Promise<{ data: { has_categories: boolean; count: number; duplicate_count: number; duplicate_codes: string[] } }> {
  const params = new URLSearchParams();
  if (userId) params.set("user_id", String(userId));
  const qs = params.toString();
  return request<{ data: { has_categories: boolean; count: number; duplicate_count: number; duplicate_codes: string[] } }>(
    `/folders/${encodeURIComponent(folderName)}/has-categories${qs ? "?" + qs : ""}`,
    { token },
  );
}

export function fetchUsers(token?: string | null): Promise<{ data: { id: number; name: string; email: string }[] }> {
  return request<{ data: { id: number; name: string; email: string }[] }>("/admin/users", { token });
}

// === 마이페이지 API ===

export interface ApiKeyItem {
  id: number;
  name: string;
  key?: string;
  key_preview: string | null;
  status: "active" | "paused";
  last_used_at: string | null;
  created_at: string;
}

export interface UsageStats {
  total_calls: number;
  today_calls: number;
  active_keys: number;
  quota_remaining: number;
  quota_limit: number;
}

export interface UsageHistoryItem {
  id: number;
  api_key_id: number | null;
  source: 'api_key' | 'embed' | 'deleted';
  source_label: string | null;
  endpoint: string;
  response_status: number;
  processing_time_ms: number;
  created_at: string;
  api_key?: {
    id: number;
    name: string;
    key_preview?: string;
  };
}

export interface ChartDataPoint {
  date: string;
  total: number;
}

export function getApiKeys(token: string, server?: boolean): Promise<{ data: ApiKeyItem[] }> {
  return request("/mypage/api-keys", { token, ...(server ? { cache: "no-store" } : {}) });
}

export function createApiKey(token: string, name: string): Promise<{ data: ApiKeyItem; plain_key: string }> {
  return request("/mypage/api-keys", { method: "POST", body: { name }, token });
}

export function updateApiKey(
  token: string,
  id: number,
  data: { name?: string; status?: string },
): Promise<{ data: ApiKeyItem }> {
  return request(`/mypage/api-keys/${id}`, { method: "PATCH", body: data, token });
}

export function deleteApiKey(token: string, id: number): Promise<void> {
  return request(`/mypage/api-keys/${id}`, { method: "DELETE", token });
}

export function getUsageStats(token: string, server?: boolean): Promise<{ data: UsageStats }> {
  return request("/mypage/usage", { token, ...(server ? { cache: "no-store" } : {}) });
}

export function getUsageHistory(
  token: string,
  limit?: number,
  server?: boolean,
): Promise<{ data: UsageHistoryItem[] }> {
  const query = limit ? `?limit=${limit}` : "";
  return request(`/mypage/usage/history${query}`, { token, ...(server ? { cache: "no-store" } : {}) });
}

export function getUsageChart(
  token: string,
  days?: number,
  server?: boolean,
): Promise<{ data: ChartDataPoint[] }> {
  const query = days ? `?days=${days}` : "";
  return request(`/mypage/usage/chart${query}`, { token, ...(server ? { cache: "no-store" } : {}) });
}

// === 관리자 회원 관리 API ===

export interface AdminUserListItem {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export function fetchAdminUsers(token: string): Promise<{ data: AdminUserListItem[] }> {
  return request("/admin/users", { token });
}

export interface AdminUserDetail {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
  api_quota_remaining: number;
  api_quota_limit: number;
  total_calls: number;
  today_calls: number;
  active_keys: number;
  calls_by_key: {
    api_key_id: number | null;
    total: number;
    api_key?: { id: number; name: string; key: string };
  }[];
}

export function getAdminUserDetail(
  token: string,
  userId: number,
): Promise<{ data: AdminUserDetail }> {
  return request(`/admin/users/${userId}`, { token });
}

export function adjustUserQuota(
  token: string,
  userId: number,
  type: "absolute" | "increment",
  value: number,
): Promise<{ data: AdminUserDetail }> {
  return request(`/admin/users/${userId}/quota`, {
    method: "PATCH",
    body: { type, value },
    token,
  });
}
