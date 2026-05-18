const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://embed.cunlim.dev/api";

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;

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

export interface Recommendation {
  category_code: string;
  category_name: string;
  similarity_score: number;
}

export interface RecommendResponse {
  data: Recommendation[];
}

export function recommend(
  text: string,
  targetLanguage: string,
  token?: string | null
): Promise<RecommendResponse> {
  return request<RecommendResponse>("/recommend", {
    method: "POST",
    body: { text, target_language: targetLanguage },
    token,
  });
}

// --- 카테고리 ---

export interface Category {
  id: number;
  category_code: string;
  category_name_ko: string;
  category_name_zh: string | null;
  category_name_en: string | null;
  translation_status: "completed" | "partial" | "pending";
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
): Promise<CategoryListResponse> {
  const params = new URLSearchParams();
  if (page && page > 1) params.set("page", String(page));
  params.set("per_page", "20");
  const qs = params.toString();
  return request<CategoryListResponse>(`/categories?${qs}`, { token });
}

export function getAllCategories(token?: string | null): Promise<CategoryListResponse> {
  const params = new URLSearchParams();
  params.set("per_page", "10000");
  params.set("page", "1");
  return request<CategoryListResponse>(`/categories?${params.toString()}`, { token });
}

export function createCategory(
  categoryNameKo: string,
  token?: string | null
): Promise<{ data: Category }> {
  return request<{ data: Category }>("/categories", {
    method: "POST",
    body: { category_name_ko: categoryNameKo },
    token,
  });
}

// --- 개별 카테고리 번역·임베딩 ---

export interface TranslateEmbedResponse {
  message: string;
  category_id: number;
}

export function translateEmbedCategory(
  categoryId: number,
  token?: string | null,
  steps?: string[]
): Promise<TranslateEmbedResponse> {
  return request<TranslateEmbedResponse>(`/categories/${categoryId}/translate-embed`, {
    method: "POST",
    body: steps ? { steps } : undefined,
    token,
  });
}

export function cancelTranslateEmbed(
  categoryId: number,
  token?: string | null,
): Promise<TranslateEmbedResponse> {
  return request<TranslateEmbedResponse>(`/categories/${categoryId}/translate-embed/cancel`, {
    method: "POST",
    token,
  });
}

// --- 개별 단계 실행 ---

export interface RunStepResponse {
  step: string;
  status: "completed" | "failed";
  result?: string;
  error?: string;
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

// --- 인증 ---

export interface User {
  id: number;
  name: string;
  email: string;
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
