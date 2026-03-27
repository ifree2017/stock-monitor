// 持仓信息（用户配置）
export interface Holding {
  id: string
  code: string
  name: string
  shares: number        // 股数
  avgCost: number      // 成本价
}

// 单个监控标的
export interface MonitorItem {
  id: string
  code: string
  name: string
  isHolding: boolean   // 是否为持仓股
  holding?: {         // 持仓信息（isHolding=true时）
    shares: number
    avgCost: number
  }
  anchorCode: string   // 锚点股票代码
  anchorName: string
  boardCode: string    // 关联板块代码
  boardName: string
}

// 板块信息
export interface BoardInfo {
  code: string
  name: string
  isIndex?: boolean
  t?: string  // '2'=行业 '3'=概念
}

// 共振结果
export interface ResonanceResult {
  direction: '共振上涨' | '共振下跌' | '分化' | '独立'
  strength: number
  description: string
}

// 分析结果
export interface AnalysisResult {
  stock: StockQuote
  support: number[]
  resistance: number[]
  momentum: '极强' | '较强' | '中性' | '较弱' | '极弱'
  signal: '强烈买入' | '买入' | '持有' | '减仓' | '卖出'
  advice: string
  resonance?: ResonanceResult
  pnl?: { amount: number; rate: number }
}

// 分时数据
export interface MinuteBar {
  time: string
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

// 行情数据
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

// 板块成分股排行
export interface BoardMember {
  code: string
  name: string
  price: number
  zs: number
}
