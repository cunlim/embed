const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://embed.cunlim.dev/api";

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
    throw new Error(error.message || `API Error: ${res.status}`);
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
    preview: number[] | null;
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
  token?: string | null
): Promise<CategoryTranslationsResponse> {
  return request<CategoryTranslationsResponse>(
    `/categories/${categoryId}/translations`,
    { token }
  );
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
): Promise<RecommendResponse> {
  const body: Record<string, string | number> = { text, target_language: targetLanguage };
  if (page) body.page = page;
  if (perPage) body.per_page = perPage;
  if (filter) body.filter = filter;
  if (keyword) body.keyword = keyword;
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
): Promise<CategoryListResponse> {
  const params = new URLSearchParams();
  if (page && page > 1) params.set("page", String(page));
  params.set("per_page", String(perPage ?? 20));
  if (filter) params.set("filter", filter);
  if (search) params.set("search", search);
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
  token?: string | null
): Promise<{ data: CategoryLevelsResponse }> {
  const searchParams = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) searchParams.set(key, value);
    }
  }
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

export function runStep(
  categoryId: number,
  step: string,
  token?: string | null
): Promise<RunStepResponse> {
  return request<RunStepResponse>(`/categories/${categoryId}/run-step`, {
    method: "POST",
    body: { step },
    token,
  });
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
