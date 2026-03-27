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

// ── 分时行情（东方财富趋势 API，更完整）─────────────────────────
export async function fetchIntraday(code: string): Promise<IntradayData | null> {
  const secid = code.startsWith('60') ? `1.${code}` : `0.${code}`
  const url = `https://push2.eastmoney.com/api/qt/stock/trends2/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ndays=1&iscr=0`
  try {
    const res = await fetch(url, {
      headers: { 'Referer': 'https://quote.eastmoney.com', 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    const trends: string[] = data?.data?.trends || []
    const prevClose = parseFloat(data?.data?.preClose || '0') || 0
    const todayOpen = parseFloat(data?.data?.open || '0') || 0
    const name = data?.data?.name || code
    // trends 格式: "时间,开,高,低,收,成交量,成交额,VWAP"  或  "时间,价格,成交量,成交额"
    const bars: MinuteBar[] = trends.map(raw => {
      const parts = raw.split(',')
      if (parts.length >= 5) {
        return {
          time: parts[0] || '',
          price: parseFloat(parts[4]) || 0,
          volume: parseInt(parts[5]) || 0,
          avgPrice: parseFloat(parts[7]) || 0,
        }
      } else {
        return {
          time: parts[0] || '',
          price: parseFloat(parts[1]) || 0,
          volume: parseInt(parts[2]) || 0,
          avgPrice: 0,
        }
      }
    })
    return { code, name, prevClose, todayOpen, bars }
  } catch {
    return null
  }
}

// ── 板块成分股排行（东方财富，支持行业+概念）─────────────────────
export async function fetchSectorLeaders(boardCode: string, t = '2', num = 8): Promise<BoardMember[]> {
  if (!boardCode) return []
  const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${num}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=b:${boardCode}&fields=f12,f14,f3,f4`
  try {
    const res = await fetch(url, {
      headers: { 'Referer': 'https://quote.eastmoney.com', 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    const items: Array<{ f12: string; f14: string; f3: number; f4: number }> = data?.data?.diff || []
    return items.map(item => ({
      code: item.f12 || '',
      name: item.f14 || '',
      price: parseFloat(String(item.f4)) || 0,
      zs: parseFloat(String(item.f3)) || 0,
    }))
  } catch {
    return []
  }
}

// ── 预定义板块列表 ────────────────────────────────────────────────
// t:2 = 行业板块, t:3 = 概念板块
export const BOARD_LIST = [
  { code: 'sh000001', name: '上证指数', isIndex: true },
  { code: 'sz399001', name: '深证成指', isIndex: true },
  { code: 'sz399006', name: '创业板指', isIndex: true },
  { code: 'BK1028', name: '电子元件', t: '2' },
  { code: 'BK1039', name: '半导体', t: '2' },
  { code: 'BK1173', name: '锂矿概念', t: '3' },
  { code: 'BK0894', name: '阿兹海默', t: '3' },
  { code: 'BK1146', name: '减肥药', t: '3' },
  { code: 'BK0855', name: '纳米银', t: '3' },
  { code: 'BK1021', name: '宁德时代产业链', t: '3' },
  { code: 'BK0864', name: '新能源汽车', t: '3' },
  { code: 'BK0732', name: '人工智能', t: '3' },
  { code: 'BK0728', name: '机器人概念', t: '3' },
  { code: 'BK0675', name: '苹果概念', t: '3' },
]
