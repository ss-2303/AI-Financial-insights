/**
 * services/api.ts
 * ===============
 * Typed Axios client with JWT interceptor.
 *
 * Concept — what is an Axios interceptor?
 *   Interceptors run on every request or response automatically.
 *   The request interceptor here adds the JWT header to every call:
 *     Authorization: Bearer eyJ...
 *   Without it you'd have to add the header manually in every component.
 *
 * Concept — why a single axios instance?
 *   All API calls share the same baseURL and interceptors.
 *   If the backend URL changes, you update it in one place.
 */

import axios, { AxiosError } from "axios"
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  TransactionsResponse,
  AnalysisResponse,
  ApiError,
} from "../types/api"

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001"

// ── Axios instance ────────────────────────────────────────────────────────────
const client = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
})

// ── Request interceptor — attach JWT to every request ────────────────────────
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor — handle 401 globally ───────────────────────────────
client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear storage and redirect to login
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)

// ── Auth endpoints ────────────────────────────────────────────────────────────

export const register = (data: RegisterRequest) =>
  client.post<AuthResponse>("/auth/register", data).then((r) => r.data)

export const login = (data: LoginRequest) =>
  client.post<AuthResponse>("/auth/login", data).then((r) => r.data)

export const getMe = () =>
  client.get<AuthResponse["user"]>("/auth/me").then((r) => r.data)

// ── Transaction endpoints ─────────────────────────────────────────────────────

export const getTransactions = (page = 1, limit = 20, category?: string) => {
  const params: Record<string, string | number> = { page, limit }
  if (category) params.category = category
  return client
    .get<TransactionsResponse>("/transactions", { params })
    .then((r) => r.data)
}

export const analyzeTransactions = (limit = 20) =>
  client
    .post<AnalysisResponse>("/transactions/analyze", { limit })
    .then((r) => r.data)

export const uploadTransactions = (transactions: unknown[]) =>
  client
    .post("/transactions/upload", { transactions })
    .then((r) => r.data)

export default client