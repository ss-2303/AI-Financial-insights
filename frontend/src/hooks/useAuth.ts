/**
 * hooks/useAuth.ts
 * ================
 * Auth state management — login, logout, persist JWT.
 *
 * Concept — why a custom hook?
 *   Any component that needs auth state (user, token, isLoggedIn)
 *   just calls useAuth(). The logic lives in one place.
 *   If you change how auth works, you change this file only.
 *
 * Concept — why localStorage for the token?
 *   localStorage persists across page refreshes.
 *   If you stored the token only in React state, refreshing
 *   the page would log the user out.
 *   Trade-off: localStorage is accessible to JS (XSS risk).
 *   For a portfolio project this is fine. Production apps
 *   use httpOnly cookies instead.
 */

import { useState, useCallback } from "react"
import type { User, LoginRequest, RegisterRequest } from "../types/api"
import { login as apiLogin, register as apiRegister } from "../services/api"

interface AuthState {
  user:       User | null
  token:      string | null
  isLoggedIn: boolean
}

// Load initial state from localStorage (persists across refreshes)
const loadInitialState = (): AuthState => {
  try {
    const token = localStorage.getItem("token")
    const user  = localStorage.getItem("user")
    if (token && user) {
      return { token, user: JSON.parse(user), isLoggedIn: true }
    }
  } catch {
    // Corrupt localStorage — clear it
    localStorage.removeItem("token")
    localStorage.removeItem("user")
  }
  return { token: null, user: null, isLoggedIn: false }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(loadInitialState)
  const [loading, setLoading] = useState(false)
  const [error,   setError  ] = useState<string | null>(null)

  const login = useCallback(async (credentials: LoginRequest) => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiLogin(credentials)

      // Persist to localStorage so refresh keeps user logged in
      localStorage.setItem("token", response.token)
      localStorage.setItem("user",  JSON.stringify(response.user))

      setState({
        token:      response.token,
        user:       response.user,
        isLoggedIn: true,
      })
      return response
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message ?? "Login failed"
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (data: RegisterRequest) => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiRegister(data)

      localStorage.setItem("token", response.token)
      localStorage.setItem("user",  JSON.stringify(response.user))

      setState({
        token:      response.token,
        user:       response.user,
        isLoggedIn: true,
      })
      return response
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message ?? "Registration failed"
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setState({ token: null, user: null, isLoggedIn: false })
    window.location.href = "/login"   // redirect to login on logout
  }, [])

  return {
    user:       state.user,
    token:      state.token,
    isLoggedIn: state.isLoggedIn,
    loading,
    error,
    login,
    register,
    logout,
  }
}