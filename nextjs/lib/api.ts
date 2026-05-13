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

// --- 추천 ---

export interface Recommendation {
  category_code: string;
  category_name: string;
  similarity_score: number;
}

export interface RecommendResponse {
  recommendations: Recommendation[];
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
  embedding_ko: number[] | null;
  embedding_zh: number[] | null;
  embedding_en: number[] | null;
}

export interface CategoryListResponse {
  data: Category[];
}

export function getCategories(token?: string | null): Promise<CategoryListResponse> {
  return request<CategoryListResponse>("/categories", { token });
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

// --- 배치 번역 ---

export interface BatchTranslateResponse {
  batch_id: string;
}

export function batchTranslate(
  targetLanguage: string,
  token?: string | null
): Promise<BatchTranslateResponse> {
  return request<BatchTranslateResponse>("/categories/batch-translate", {
    method: "POST",
    body: { target_language: targetLanguage },
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

export function getUser(token?: string | null): Promise<User> {
  return request<User>("/auth/user", { token });
}
