export interface StockQuote {
  code: string
  name: string
  price: number
  prevClose: number
  open: number
  volume: number
  amount: number
  bid1Price: number
  bid1Volume: number
  ask1Price: number
  ask1Volume: number
  high: number
  low: number
  amplitude: number
  wz: number
  zs: number
  date: string
  time: string
  bidPrices: number[]
  bidVolumes: number[]
  askPrices: number[]
  askVolumes: number[]
  isUp: boolean
  isLimitUp: boolean
  isLimitDown: boolean
  vwap: number
}

export interface MinuteBar {
  time: string  // "09:30"
  price: number
  volume: number
  avgPrice: number
}

export interface IntradayData {
  code: string
  name: string
  prevClose: number
  todayOpen: number
  bars: MinuteBar[]
}

export interface Holding {
  id: string
  code: string
  name: string
  shares: number        // 持股数量
  avgCost: number       // 成本价
  targetCode?: string   // 关联的锚点股票代码
}

export interface ResonanceResult {
  direction: '共振上涨' | '共振下跌' | '分化' | '独立'
  strength: number       // 0-100
  description: string
}

export interface AnalysisResult {
  stock: StockQuote
  support: number[]
  resistance: number[]
  momentum: '极强' | '较强' | '中性' | '较弱' | '极弱'
  signal: '强烈买入' | '买入' | '持有' | '减仓' | '卖出'
  advice: string
  resonance?: ResonanceResult
  holding?: Holding
  pnl?: { amount: number; rate: number }
}
