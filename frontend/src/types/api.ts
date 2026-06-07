/**
 * types/api.ts
 * ============
 * TypeScript interfaces that mirror the Node backend responses.
 *
 * Concept — why define types here?
 *   Every API response has a known shape. Defining it once here means:
 *   - Your editor autocompletes response fields
 *   - TypeScript catches mismatches at build time
 *   - If backend changes a field name, every affected line turns red
 *
 *   Without types: response.user.Email  (typo — fails silently at runtime)
 *   With types:    response.user.Email  (red underline immediately)
 */

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  id:        string
  email:     string
  name:      string
  createdAt?: string
}

export interface AuthResponse {
  message: string
  token:   string
  user:    User
}

export interface LoginRequest {
  email:    string
  password: string
}

export interface RegisterRequest {
  email:    string
  password: string
  name:     string
}

// ── Transactions ──────────────────────────────────────────────────────────────

export type Category =
  | "groceries"
  | "dining"
  | "transport"
  | "utilities"
  | "shopping"
  | "entertainment"
  | "healthcare"
  | "subscription"
  | "other"

export interface Transaction {
  _id:          string
  merchant:     string
  description:  string
  amount:       number
  date:         string
  category:     Category
  mlConfidence: number
  mlMethod:     string
  isAnomaly:    boolean
  anomalyScore: number
}

export interface Pagination {
  page:  number
  limit: number
  total: number
  pages: number
}

export interface TransactionsResponse {
  transactions: Transaction[]
  pagination:   Pagination
}

// ── Analysis ──────────────────────────────────────────────────────────────────

export interface Metrics {
  total_spending:        number
  transaction_count:     number
  average_transaction:   number
  largest_transaction:   number
  largest_merchant:      string
  categories_count:      number
  ml_accuracy:           number
  classification_method: string
}

export interface AnomalyAlert {
  transaction_id: string
  merchant:       string
  anomaly_type:   string
  severity:       "low" | "medium" | "high"
  description:    string
  amount:         number
}

export interface Insights {
  summary:         string
  recommendations: string[]
  confidence_note: string
}

export interface AnalysisResponse {
  status:        string
  timestamp:     string
  transactions:  Transaction[]
  metrics:       Metrics
  anomalies:     AnomalyAlert[]
  insights:      Insights
  processing_ms: number
}

// ── Error ─────────────────────────────────────────────────────────────────────

export interface ApiError {
  error:   string
  message: string
}