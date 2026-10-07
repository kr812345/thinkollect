import { useAuthStore } from '../store/authStore'

export function apiUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'
}

export function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export function getSessionToken(): string | null {
  return useAuthStore.getState().session?.token ?? null
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getSessionToken()
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) {
    Object.assign(headers, authHeaders(token))
  }
  const res = await fetch(`${apiUrl()}${path}`, { ...init, headers })
  if (res.status === 401 && token && getSessionToken() === token) {
    useAuthStore.getState().logout()
  }
  return res
}
