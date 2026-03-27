import type { StockQuote, IntradayData, MinuteBar, BoardMember } from '@/app/types/stock'

const TENCENT_API = 'https://qt.gtimg.cn/q='

// 腾讯接口字段索引（~ 分隔）
// [1] 名称(GBK) [2] 代码 [3] 当前价 [4] 昨收 [5] 今开
// [6] 成交量(手)  [7] 外盘  [8] 内盘
// [9-18] 买一至买五(价格/量)  [19-28] 卖一至卖五(价格/量)
// [29] 保留  [30] 时间戳  [31] 涨跌额  [32] 涨跌幅%  [33] 最高  [34] 最低
// [43] 成交额(元)

function parseTencentRecord(raw: string): StockQuote | null {
  const parts = raw.split('~')
  if (parts.length < 30) return null

  const price     = parseFloat(parts[3])  || 0
  const prevClose = parseFloat(parts[4]) || 0
  const openVal   = parseFloat(parts[5])  || 0
  const volume    = parseInt(parts[6])    || 0
  const amount    = parseFloat(parts[43]) || 0
  const wz        = parseFloat(parts[31]) || 0
  const zs        = parseFloat(parts[32]) || 0
  const high      = parseFloat(parts[33]) || 0
  const low       = parseFloat(parts[34]) || 0
  const timeRaw   = parts[30] || ''

  const amplitude = prevClose > 0
    ? parseFloat(((high - low) / prevClose * 100).toFixed(2))
    : 0

  const time = timeRaw.length >= 14
    ? `${timeRaw.slice(8, 10)}:${timeRaw.slice(10, 12)}:${timeRaw.slice(12, 14)}`
    : timeRaw

  const date = timeRaw.length >= 8
    ? `${timeRaw.slice(0, 4)}-${timeRaw.slice(4, 6)}-${timeRaw.slice(6, 8)}`
    : ''

  return {
    code: parts[2] || '',
    name: parts[1] || '',
    price, prevClose, open: openVal, volume, amount,
    bid1Price:  parseFloat(parts[9])  || 0,
    bid1Volume: parseInt(parts[10])   || 0,
    ask1Price:  parseFloat(parts[19])  || 0,
    ask1Volume: parseInt(parts[20])   || 0,
    high, low, amplitude, wz, zs, date, time,
    bidPrices:  [9, 11, 13, 15, 17].map(i => parseFloat(parts[i]) || 0),
    bidVolumes: [10, 12, 14, 16, 18].map(i => parseInt(parts[i]) || 0),
    askPrices:  [19, 21, 23, 25, 27].map(i => parseFloat(parts[i]) || 0),
    askVolumes: [20, 22, 24, 26, 28].map(i => parseInt(parts[i]) || 0),
    isUp:        price >= prevClose,
    isLimitUp:   price > 0 && prevClose > 0 && (price / prevClose - 1) * 100 >= 9.9,
    isLimitDown: price > 0 && prevClose > 0 && (price / prevClose - 1) * 100 <= -9.9,
    vwap: 0,
  }
}

export async function fetchQuotes(codes: string[]): Promise<StockQuote[]> {
  if (codes.length === 0) return []
  const query = codes.map(c => {
    if (c.startsWith('60')) return `sh${c}`
    if (c.startsWith('00')) return `sz${c}`
    return c
  }).join(',')

  const url = `${TENCENT_API}${query}`
  const res = await fetch(url, {
    headers: { 'Referer': 'https://finance.qq.com' },
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`API error: ${res.status}`)

  // 腾讯 API 返回 GBK 编码 → 用 TextDecoder('gb18030') 正确解码
  const buffer = await res.arrayBuffer()
  const uint8 = new Uint8Array(buffer)
  const text = new TextDecoder('gb18030').decode(uint8)

  const lines = text.trim().split('\n')
  const quotes: StockQuote[] = []
  for (const line of lines) {
    const match = line.match(/="(.+)"/)
    if (!match) continue
    const quote = parseTencentRecord(match[1])
    if (quote) quotes.push(quote)
  }

  return quotes
}

export async function fetchSectorBoard(): Promise<Record<string, { name: string; change: number }>> {
  // 大盘 + 板块（电子元件板块）
  const boardCodes = ['sh000001', 'sz399001', 'sz399006', 'sh883441']
  const quotes = await fetchQuotes(boardCodes)
  const map: Record<string, { name: string; change: number }> = {}
  for (const q of quotes) {
    map[q.code] = { name: q.name, change: q.zs }
  }
  return map
}

export const STOCK_INFO: Record<string, {
  name: string; board: string; anchor: string; boardCode: string
}> = {
  '002575': { name: '群兴玩具', board: '电子元件', anchor: '600666', boardCode: '883441' },
  '600666': { name: '奥瑞德',   board: '电子元件', anchor: '',      boardCode: '883441' },
}

// ── 分时行情 ────────────────────────────────────────────────────────
const INTRADAY_API = 'https://web.ifzq.gtimg.cn/appstock/app/minute/query'

export async function fetchIntraday(code: string): Promise<IntradayData | null> {
  const prefix = code.startsWith('60') ? 'sh' : 'sz'
  const url = `${INTRADAY_API}?_var=min_data&param=${prefix}${code},,,,320,`
  try {
    const res = await fetch(url, {
      headers: { 'Referer': 'https://finance.qq.com' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const text = new TextDecoder('utf-8').decode(buffer)
    const json = text.replace(/^[^=]+=/, '')
    const data = JSON.parse(json)
    const minuteData = data?.data?.[`${prefix}${code}`]
    if (!minuteData) return null
    const prevClose = minuteData.qfq || minuteData.yclose || 0
    const todayOpen = minuteData.open || 0
    const rawBars: [string, number, number][] = minuteData.data || []
    const bars: MinuteBar[] = rawBars.map(([time, price, vol]) => ({ time, price, volume: vol || 0, avgPrice: price }))
    return {
      code,
      name: minuteData.name || code,
      prevClose: parseFloat(prevClose) || 0,
      todayOpen: parseFloat(todayOpen) || 0,
      bars,
    }
  } catch {
    return null
  }
}

// ── 板块成分股排行 ────────────────────────────────────────────────
const SECTOR_API = 'https://proxy.finance.qq.com/ifzqgtstock/appstock/app/rank/getSectorMembers'

export async function fetchSectorLeaders(boardCode: string, num = 8): Promise<BoardMember[]> {
  if (!boardCode) return []
  try {
    const url = `${SECTOR_API}?plat=pc&industryCode=${boardCode}&type=&start=0&num=${num}&_var=sector_data`
    const res = await fetch(url, {
      headers: { 'Referer': 'https://finance.qq.com' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const text = await res.text()
    const jsonStr = text.replace(/^[^=]+=/, '')
    const data = JSON.parse(jsonStr)
    const members: [string, string, number, number][] = data?.data?.[boardCode]?.sector_stocks || []
    return members.map(([code, name, price, zs]: [string, string, number, number]) => ({
      code,
      name,
      price: parseFloat(String(price)) || 0,
      zs: parseFloat(String(zs)) || 0,
    }))
  } catch {
    return []
  }
}

// ── 预定义板块列表 ────────────────────────────────────────────────
export const BOARD_LIST = [
  { code: 'sh000001', name: '上证指数' },
  { code: 'sz399001', name: '深证成指' },
  { code: 'sz399006', name: '创业板指' },
  { code: 'sh883441', name: '电子元件' },
  { code: 'sh886038', name: '半导体' },
  { code: 'sh884110', name: '宁德时代产业链' },
  { code: 'sh884160', name: '新能源车' },
  { code: 'sh801050', name: '光学光电子' },
  { code: 'sh801760', name: '人工智能' },
  { code: 'sh801750', name: '软件开发' },
]
