/**
 * hooks/useFinancialData.ts
 * =========================
 * Demo behaviour:
 *   Calls the Python ML service directly for analysis data.
 *   This means ALL users see the same ML-classified transactions
 *   and insights — the data is not per-user.
 *
 *   Flow:
 *     POST http://localhost:8000/api/v1/analyze
 *       → Python reads processed_transactions.csv
 *       → ML model classifies each row
 *       → anomaly detection runs
 *       → Claude generates insights
 *       → returns same data to every user
 *
 *   Why: this is a portfolio demo. Per-user data would require each
 *   user to upload their own CSV. Showing the full ML pipeline with
 *   consistent data makes the demo more compelling.
 */

import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import type { Transaction, Metrics, AnomalyAlert, Insights } from "../types/api"

const ML_URL = import.meta.env.VITE_ML_URL ?? "http://localhost:8000"

interface FinancialData {
  transactions: Transaction[]
  metrics:      Metrics | null
  anomalies:    AnomalyAlert[]
  insights:     Insights | null
  loading:      boolean
  error:        string | null
  refetch:      () => void
}

export function useFinancialData(limit = 20): FinancialData {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [metrics,      setMetrics]      = useState<Metrics | null>(null)
  const [anomalies,    setAnomalies]    = useState<AnomalyAlert[]>([])
  const [insights,     setInsights]     = useState<Insights | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Call Python ML service directly — same data for all users
      const { data } = await axios.post(`${ML_URL}/api/v1/analyze`, {
        limit,
        include_insights:  true,
        include_anomalies: true,
      })

      setTransactions(data.transactions ?? [])
      setMetrics(data.metrics      ?? null)
      setAnomalies(data.anomalies  ?? [])
      setInsights(data.insights    ?? null)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail
        ?? "Could not reach ML service. Is Python backend running on port 8000?"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => { fetchData() }, [fetchData])

  return { transactions, metrics, anomalies, insights, loading, error, refetch: fetchData }
}