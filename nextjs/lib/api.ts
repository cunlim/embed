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

  const isFormData = body instanceof FormData;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
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

// --- 카테고리 (통합: 기존 /api/recommend 포함) ---

export interface LanguageScore {
  similarity_score: number | null;
  rank: number | null;
}

export interface PerLanguageScores {
  ko: LanguageScore;
  en: LanguageScore;
  zh: LanguageScore;
}

export interface Category {
  id: number;
  user_id: number;
  category_code: string;
  category_name_ko: string;
  category_name_zh: string | null;
  category_name_en: string | null;
  category_name?: string;
  translation_status: "completed" | "partial" | "pending";
  // 유사도 필드 (text 검색 시에만 존재)
  similarity_score?: number | null;
  per_language_scores?: PerLanguageScores | null;
}

/** @deprecated Category로 통합됨 */
export type Recommendation = Category;

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
  query_embedding?: number[] | null;
}

/** @deprecated CategoryListResponse로 통합됨 */
export type RecommendResponse = CategoryListResponse;

export function getCategories(
  token?: string | null,
  pageNumber?: number,
  pageSize?: number,
  ownerScope?: string,
  likeQuery?: string,
  folder?: string,
  userId?: number | null,
  steps?: StepName[],
  hierarchyLang?: string,
  similarityQuery?: string,
  translationLang?: string,
): Promise<CategoryListResponse> {
  const params = new URLSearchParams();
  if (pageNumber && pageNumber > 1) params.set("page_number", String(pageNumber));
  params.set("page_size", String(pageSize ?? 20));
  if (ownerScope) params.set("owner_scope", ownerScope);
  if (likeQuery) params.set("like_query", likeQuery);
  if (hierarchyLang) params.set("hierarchy_lang", hierarchyLang);
  if (folder) params.set("folder", folder);
  if (userId) params.set("user_id", String(userId));
  if (steps && steps.length > 0) {
    steps.forEach((step) => params.append("steps[]", step));
  }
  // 유사도 검색 파라미터
  if (similarityQuery) params.set("similarity_query", similarityQuery);
  if (translationLang) params.set("translation_lang", translationLang);

  const qs = params.toString();
  return request<CategoryListResponse>(`/categories?${qs}`, { token });
}

/** @deprecated getCategories() 사용 */
export function recommend(
  similarityQuery: string,
  translationLang: string,
  token?: string | null,
  pageNumber?: number,
  pageSize?: number,
  ownerScope?: string,
  likeQuery?: string,
  folder?: string,
  userId?: number | null,
): Promise<CategoryListResponse> {
  return getCategories(token, pageNumber, pageSize, ownerScope, likeQuery, folder,
    userId, undefined, undefined, similarityQuery, translationLang);
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
