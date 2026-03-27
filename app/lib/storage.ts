import type { MonitorItem } from '@/app/types/stock'

const STORAGE_KEY = 'stock-monitor-config'

const DEFAULT_CONFIG: MonitorItem[] = [
  { id: '1', code: '002575', name: '群兴玩具', isHolding: true, holding: { shares: 1000, avgCost: 8.50 }, anchorCode: '600666', anchorName: '奥瑞德', boardCode: 'sh883441', boardName: '电子元件' },
  { id: '2', code: '600666', name: '奥瑞德',   isHolding: false, anchorCode: '', anchorName: '', boardCode: 'sh883441', boardName: '电子元件' },
]

export function loadConfig(): MonitorItem[] {
  if (typeof window === 'undefined') return DEFAULT_CONFIG
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIG
    return JSON.parse(raw) as MonitorItem[]
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveConfig(items: MonitorItem[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore
  }
}
