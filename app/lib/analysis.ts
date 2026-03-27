import type { StockQuote, Holding, AnalysisResult, ResonanceResult } from '@/app/types/stock'

export function calculateResonance(
  target: StockQuote,
  anchor: StockQuote | null,
  boardChange: number,
): ResonanceResult {
  if (!anchor) {
    return { direction: '独立', strength: 0, description: '无锚点参考' }
  }

  const targetDir = target.zs > 0 ? 'up' : target.zs < 0 ? 'down' : 'flat'
  const anchorDir = anchor.zs > 0 ? 'up' : anchor.zs < 0 ? 'down' : 'flat'
  const boardDir = boardChange > 0 ? 'up' : boardChange < 0 ? 'down' : 'flat'

  const sameDir =
    targetDir === anchorDir && anchorDir === boardDir

  if (sameDir && target.zs > 0) {
    const strength = Math.min(100, Math.round((target.zs + anchor.zs + boardChange) / 3 * 20))
    return {
      direction: '共振上涨',
      strength,
      description: `三周期同向，${target.name}涨幅${target.zs.toFixed(2)}%，奥瑞德${anchor.zs.toFixed(2)}%，共振强度${strength}`,
    }
  }

  if (sameDir && target.zs < 0) {
    const strength = Math.min(100, Math.round((Math.abs(target.zs) + Math.abs(anchor.zs) + Math.abs(boardChange)) / 3 * 20))
    return {
      direction: '共振下跌',
      strength,
      description: `三周期同向下，分散风险为主`,
    }
  }

  // 分化
  const targetStronger = Math.abs(target.zs) > Math.abs(anchor.zs)
  return {
    direction: '分化',
    strength: Math.round(Math.abs(target.zs - anchor.zs) * 10),
    description: targetStronger
      ? `${target.name}独立走强，超越锚点和板块`
      : `${target.name}弱于锚点，注意补跌风险`,
  }
}

export function analyzeStock(
  stock: StockQuote,
  anchor: StockQuote | null,
  boardChange: number,
  holding?: Holding,
): AnalysisResult {
  const { support, resistance } = calculateLevels(stock)
  const momentum = calculateMomentum(stock)
  const resonance = calculateResonance(stock, anchor, boardChange)

  // 计算盈亏
  let pnl: { amount: number; rate: number } | undefined
  if (holding) {
    const currentValue = stock.price * holding.shares      // shares = 股数，直接乘
    const costValue = holding.avgCost * holding.shares
    pnl = {
      amount: currentValue - costValue,
      rate: ((stock.price / holding.avgCost - 1) * 100),
    }
  }

  // 生成信号
  const signal = generateSignal(stock, momentum, resonance, pnl)
  const advice = generateAdvice(stock, momentum, resonance, pnl, holding)

  return {
    stock,
    support,
    resistance,
    momentum,
    signal,
    advice,
    resonance,
    pnl,
  }
}

function calculateLevels(stock: StockQuote): { support: number[]; resistance: number[] } {
  const { price, prevClose, high, low, ask1Price, bid1Price } = stock
  const limitUp = parseFloat((prevClose * 1.1).toFixed(2))
  const limitDown = parseFloat((prevClose * 0.9).toFixed(2))

  const support = [
    parseFloat((price * 0.995).toFixed(2)),
    parseFloat((price * 0.99).toFixed(2)),
    limitDown,
  ].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)

  const resistance = [
    limitUp,
    parseFloat((price * 1.005).toFixed(2)),
    parseFloat((price * 1.01).toFixed(2)),
  ].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)

  return { support, resistance }
}

function calculateMomentum(stock: StockQuote): AnalysisResult['momentum'] {
  const { zs, amplitude, price, high, low, bid1Volume, ask1Volume } = stock
  const absZs = Math.abs(zs)
  const waveScore = amplitude / 2

  // 委比（买卖量对比）
  const totalVol = bid1Volume + ask1Volume
  const wbRatio = totalVol > 0 ? ((bid1Volume - ask1Volume) / totalVol * 100) : 0

  let score = 0
  score += Math.min(absZs / 10 * 30, 30)  // 涨跌幅得分
  score += Math.min(waveScore / 5 * 20, 20)  // 振幅得分
  score += Math.min(Math.max(wbRatio + 50, 0) / 100 * 30, 30)  // 委比得分
  score += Math.min(Math.max((price - low) / (high - low + 0.001) * 20, 0), 20)  // 位置得分

  if (score >= 75) return '极强'
  if (score >= 55) return '较强'
  if (score >= 35) return '中性'
  if (score >= 20) return '较弱'
  return '极弱'
}

function generateSignal(
  stock: StockQuote,
  momentum: AnalysisResult['momentum'],
  resonance: ResonanceResult,
  pnl?: { amount: number; rate: number },
): AnalysisResult['signal'] {
  const { isLimitUp, isLimitDown, zs } = stock
  if (isLimitUp) return '强烈买入'
  if (isLimitDown) return '卖出'

  // 有持仓时的信号
  if (pnl) {
    if (pnl.rate > 8 && momentum === '极强' && resonance.direction === '共振上涨') return '持有'
    if (pnl.rate > 10) return '减仓'
    if (pnl.rate < -5 && momentum === '极弱') return '卖出'
  }

  // 无持仓时的信号
  if (momentum === '极强' && resonance.direction === '共振上涨') return '强烈买入'
  if (momentum === '较强' && resonance.direction !== '共振下跌') return '买入'
  if (momentum === '极弱' || resonance.direction === '共振下跌') return '减仓'
  return '持有'
}

function generateAdvice(
  stock: StockQuote,
  momentum: AnalysisResult['momentum'],
  resonance: ResonanceResult,
  pnl?: { amount: number; rate: number },
  holding?: Holding,
): string {
  const { name, price, zs, high, prevClose } = stock
  const limitUpPrice = parseFloat((prevClose * 1.1).toFixed(2))

  let advice = ''

  if (isLimitUpStocks(stock)) {
    advice = `【${name}】封死涨停板（${price}元），主力控盘强势，明日大概率溢价。`
    if (holding) advice += ` 持仓浮盈${pnl!.rate.toFixed(1)}%，继续持有。`
    return advice
  }

  if (holding) {
    const action = pnl!.rate > 8 ? '建议分批减仓止盈' : pnl!.rate < -3 ? '注意止损线，建议减仓' : '可继续持有观察'
    advice = `【持仓分析】${name}（${price}元，${zs > 0 ? '+' : ''}${zs.toFixed(2)}%），${action}。\n`
  } else {
    advice = `【${name}】当前价格${price}元，${zs > 0 ? '上涨' : '下跌'}${Math.abs(zs).toFixed(2)}%。\n`
  }

  advice += `动量：${momentum}，板块共振：${resonance.direction}（强度${resonance.strength}）。\n`

  if (resonance.direction === '共振上涨' && momentum !== '极弱') {
    advice += `→ 积极信号：主力资金持续买入，可考虑买入或加仓。\n支撑位：${(stock.price * 0.995).toFixed(2)}元。`
  } else if (resonance.direction === '共振下跌') {
    advice += `→ 风险信号：与板块共振下跌，谨慎持仓或止损。`
  } else if (resonance.direction === '分化') {
    advice += `→ 注意分化：${resonance.description}。`
  } else {
    advice += `→ 当前震荡，建议观望为主，等待方向明确。`
  }

  if (high >= limitUpPrice * 0.98) {
    advice += `\n⚠️ 注意：价格接近涨停，留意炸板风险。`
  }

  return advice
}

function isLimitUpStocks(stock: StockQuote): boolean {
  const limitUpPrice = parseFloat((stock.prevClose * 1.1).toFixed(2))
  return Math.abs(stock.price - limitUpPrice) < 0.01 && stock.zs >= 9.9
}
