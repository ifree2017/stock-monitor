const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 204) return {} as T

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`)
  }
  return data as T
}

// Auth
export interface LoginRequest { email: string; password: string }
export interface RegisterRequest { username: string; email: string; password: string }
export interface AuthResponse { token: string; user: User }
export interface User { id: string; username: string; email: string; created_at: string }

export const authApi = {
  register: (data: RegisterRequest) =>
    request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: LoginRequest) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request<User>('/api/auth/me'),
}

// Holdings
export interface Holding {
  id: string; user_id: string; stock_code: string; stock_name: string
  shares: number; avg_cost: number; created_at: string; updated_at: string
}
export interface HoldingCreate { stock_code: string; stock_name: string; shares: number; avg_cost: number }
export interface HoldingUpdate { shares?: number; avg_cost?: number }

export const holdingsApi = {
  list: () => request<Holding[]>('/api/holdings'),
  create: (data: HoldingCreate) =>
    request<Holding>('/api/holdings', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: HoldingUpdate) =>
    request<Holding>(`/api/holdings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/api/holdings/${id}`, { method: 'DELETE' }),
}

// Monitor Items
export interface MonitorItem {
  id: string; user_id: string; stock_code: string; stock_name: string
  anchor_code: string; anchor_name: string; board_code: string; board_name: string
  sort_order: number; created_at: string; updated_at: string
}
export interface MonitorItemCreate {
  stock_code: string; stock_name: string
  anchor_code?: string; anchor_name?: string; board_code?: string; board_name?: string; sort_order?: number
}
export interface MonitorItemUpdate {
  anchor_code?: string; anchor_name?: string; board_code?: string; board_name?: string; sort_order?: number
}

export const monitorApi = {
  list: () => request<MonitorItem[]>('/api/monitor-items'),
  create: (data: MonitorItemCreate) =>
    request<MonitorItem>('/api/monitor-items', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: MonitorItemUpdate) =>
    request<MonitorItem>(`/api/monitor-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/api/monitor-items/${id}`, { method: 'DELETE' }),
}

// Model Config
export interface ModelConfig {
  id: string; user_id: string; model_name: string; api_key?: string
  base_url: string; rate_limit_per_day: number; enabled: boolean; created_at: string
}
export interface ModelConfigCreate {
  model_name: string; api_key: string; base_url?: string; rate_limit_per_day?: number; enabled?: boolean
}

export const modelConfigApi = {
  get: () => request<ModelConfig | null>('/api/model-config'),
  upsert: (data: ModelConfigCreate) =>
    request<ModelConfig>('/api/model-config', { method: 'POST', body: JSON.stringify(data) }),
  delete: () => request<void>('/api/model-config', { method: 'DELETE' }),
}

// Analyze
export interface AnalyzeRequest { stock_code: string; model_config_id?: string }
export interface AnalyzeResponse {
  signal: string; advice: string; momentum: string; resonance: string
  pnl_amount?: number; pnl_rate?: number
}

export const analyzeApi = {
  analyze: (data: AnalyzeRequest) =>
    request<AnalyzeResponse>('/api/analyze', { method: 'POST', body: JSON.stringify(data) }),
}

// Boards (public)
export interface BoardInfo { code: string; name: string }
export interface BoardMember { code: string; name: string; price: number; zs: number }
export interface BoardLeader { rank: number; code: string; name: string; price: number; zs: number }

export const boardsApi = {
  list: () => request<BoardInfo[]>('/api/boards'),
  members: (code: string) => request<BoardMember[]>(`/api/boards/${code}/members`),
  leaders: (code: string) => request<BoardLeader[]>(`/api/boards/${code}/leaders`),
}

// Quotes (public)
export interface StockQuote {
  code: string; name: string; price: number; prev_close: number; open: number
  volume: number; amount: number; bid1_price: number; bid1_volume: number
  ask1_price: number; ask1_volume: number; high: number; low: number
  amplitude: number; zs: number; date: string; time: string
  bid_prices: number[]; bid_volumes: number[]; ask_prices: number[]; ask_volumes: number[]
  is_up: boolean; is_limit_up: boolean; is_limit_down: boolean
}

export interface MinuteBar { time: string; price: number; volume: number; avg_price: number }
export interface IntradayData {
  code: string; name: string; prev_close: number; today_open: number; bars: MinuteBar[]
}

export const quotesApi = {
  get: (code: string) => request<StockQuote>(`/api/quotes/${code}`),
  intraday: (code: string) => request<IntradayData>(`/api/intraday/${code}`),
}
