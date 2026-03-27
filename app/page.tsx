'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { StockQuote, AnalysisResult, Holding, IntradayData } from './types/stock'
import { fetchQuotes, fetchIntraday, fetchSectorBoard } from './lib/stockApi'
import { analyzeStock } from './lib/analysis'
import { LineChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from 'recharts'

// ── helpers ───────────────────────────────────────────────────────
function fmt(n: number, d = 2) { return n.toFixed(d) }
function fmtAmt(n: number) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(2)}万`
  return n.toFixed(0)
}
function cColor(zs: number) { return zs > 0 ? 'text-red-400' : zs < 0 ? 'text-green-400' : 'text-slate-400' }
function bgColor(zs: number) {
  return zs > 0 ? 'bg-red-500/10 border-red-500/20' : zs < 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-slate-800 border-slate-700'
}

// ── signal badge ─────────────────────────────────────────────────
function SignalBadge({ signal }: { signal: AnalysisResult['signal'] }) {
  const map: Record<string, { cls: string; label: string }> = {
    '强烈买入': { cls: 'bg-gradient-to-r from-red-600 to-orange-500', label: '🔥 强烈买入' },
    '买入':     { cls: 'bg-red-500', label: '↑ 买入' },
    '持有':     { cls: 'bg-amber-600', label: '◆ 持有' },
    '减仓':     { cls: 'bg-amber-700', label: '↓ 减仓' },
    '卖出':     { cls: 'bg-slate-700 border border-slate-600', label: '✕ 卖出' },
  }
  const { cls, label } = map[signal] ?? { cls: 'bg-slate-700', label: signal }
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white ${cls}`}>{label}</span>
}

// ── 分时图 ───────────────────────────────────────────────────────
function MiniChart({ data, quote }: { data: IntradayData | null; quote: StockQuote }) {
  const isUp = quote.zs >= 0
  const strokeColor = isUp ? '#ef4444' : '#22c55e'
  const prevClose = data?.prevClose ?? quote.prevClose

  if (!data || data.bars.length === 0) {
    // 降级：生成模拟分时
    const fakeBars = Array.from({ length: 60 }, (_, i) => {
      const totalMin = 9 * 60 + 30 + i
      const h = Math.floor(totalMin / 60)
      const m = totalMin % 60
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const base = quote.prevClose || quote.price || 10
      const noise = Math.sin(i * 0.3) * 0.01 * base
      const price = parseFloat((quote.price + noise).toFixed(2))
      return { time, price }
    })
    return (
      <div className="bg-slate-900/60 rounded-lg p-2 h-24">
        <ResponsiveContainer width="100%" height={72}>
          <LineChart data={fakeBars} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 6, fontSize: 11, color: '#e2e8f0', padding: '4px 8px' }}
              formatter={(v: number) => [v.toFixed(2), '价格']}
              labelStyle={{ color: '#64748b', fontSize: 10 }}
            />
            <ReferenceLine y={prevClose} stroke="#475569" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="price" stroke="#64748b" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const domain: [number, number] = [
    Math.min(...data.bars.map(b => b.price), prevClose) * 0.998,
    Math.max(...data.bars.map(b => b.price), prevClose) * 1.002,
  ]

  return (
    <div className="bg-slate-900/60 rounded-lg p-2 h-24">
      <ResponsiveContainer width="100%" height={72}>
        <LineChart data={data.bars} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
          <YAxis domain={domain} hide />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 6, fontSize: 11, color: '#e2e8f0', padding: '4px 8px' }}
            formatter={(v: number) => [v.toFixed(2), '价格']}
            labelStyle={{ color: '#64748b', fontSize: 10 }}
          />
          <ReferenceLine y={prevClose} stroke="#475569" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="price" stroke={strokeColor} strokeWidth={1.5} dot={false} isAnimationActive={false} activeDot={{ r: 3, fill: strokeColor }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── 五档行情 ─────────────────────────────────────────────────────
function OrderBook({ quote }: { quote: StockQuote }) {
  const maxVol = Math.max(...quote.bidVolumes, ...quote.askVolumes, 1)
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
      <div className="space-y-0.5">
        <p className="text-slate-500 text-center text-[10px] mb-1">卖盘</p>
        {[...quote.askVolumes].reverse().map((vol, i) => (
          <div key={i} className="flex items-center gap-1 justify-end">
            <span className="w-10 text-right text-slate-400 font-mono text-[11px]">
              {vol >= 10000 ? `${(vol / 10000).toFixed(1)}万` : vol}
            </span>
            <div className="flex-1 flex justify-end">
              <div className="h-1.5 bg-red-500/50 rounded-sm" style={{ width: `${vol / maxVol * 100}%` }} />
            </div>
            <span className="w-12 text-right text-red-400 font-mono">{fmt(quote.askPrices[4 - i])}</span>
          </div>
        ))}
      </div>
      <div className="space-y-0.5">
        <p className="text-slate-500 text-center text-[10px] mb-1">买盘</p>
        {quote.bidVolumes.map((vol, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="w-12 text-green-400 font-mono">{fmt(quote.bidPrices[i])}</span>
            <div className="flex-1">
              <div className="h-1.5 bg-green-500/50 rounded-sm" style={{ width: `${vol / maxVol * 100}%` }} />
            </div>
            <span className="w-10 text-slate-400 font-mono text-[11px]">
              {vol >= 10000 ? `${(vol / 10000).toFixed(1)}万` : vol}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 分析面板 ─────────────────────────────────────────────────────
function AnalysisPanel({ result }: { result: AnalysisResult }) {
  const { stock, momentum, signal, advice, resonance, pnl } = result
  return (
    <div className="bg-slate-900/50 rounded-xl p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-300">📊 实时分析</h3>
        <SignalBadge signal={signal} />
      </div>

      {/* 持仓盈亏 */}
      {pnl && (
        <div className={`flex justify-between items-center px-3 py-1.5 rounded-lg text-xs ${pnl.amount >= 0 ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
          <span className="text-slate-400">持仓盈亏</span>
          <span className={pnl.amount >= 0 ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'}>
            {pnl.amount >= 0 ? '+' : ''}{fmtAmt(pnl.amount)}
            ({pnl.rate >= 0 ? '+' : ''}{pnl.rate.toFixed(2)}%)
          </span>
        </div>
      )}

      {/* 共振 */}
      {resonance && (
        <div className={`rounded-lg px-3 py-2 text-xs border ${resonance.direction === '共振上涨' ? 'bg-red-500/10 border-red-500/20 text-red-400' : resonance.direction === '共振下跌' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
          <div className="flex justify-between items-center">
            <span className="font-semibold">{resonance.direction}</span>
            <span className="text-slate-500">强度 {resonance.strength}/100</span>
          </div>
          <p className="text-[11px] mt-0.5 text-slate-400">{resonance.description}</p>
        </div>
      )}

      {/* 动量 */}
      <div className="grid grid-cols-4 gap-1.5 text-xs">
        {[
          { label: '动量', value: momentum },
          { label: '涨停距', value: stock.prevClose > 0 ? `${((stock.price / (stock.prevClose * 1.1) - 1) * -100).toFixed(1)}%` : '—' },
          { label: '委比', value: stock.bid1Volume + stock.ask1Volume > 0 ? `${(((stock.bid1Volume - stock.ask1Volume) / (stock.bid1Volume + stock.ask1Volume)) * 100).toFixed(1)}%` : '—' },
          { label: '振幅', value: `${stock.amplitude.toFixed(2)}%` },
        ].map(item => {
          const cls = (item as { label: string; value: string; cls?: string }).cls
          return (
          <div key={item.label} className="bg-slate-800/60 rounded-lg px-2 py-1.5 flex flex-col gap-0.5">
            <span className="text-slate-500 text-[9px]">{item.label}</span>
            <span className={`font-mono ${cls || 'text-slate-200'}`}>{item.value}</span>
          </div>
          )
        })}
      </div>

      {/* 建议 */}
      <div className="bg-slate-800/60 rounded-lg px-3 py-2.5 text-xs leading-relaxed text-slate-300 whitespace-pre-line">
        {advice}
      </div>

      {/* 支撑/阻力 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-800/60 rounded-lg px-3 py-1.5">
          <p className="text-slate-500 text-[9px] mb-1">支撑位</p>
          <div className="space-y-0.5">
            {result.support.map((s, i) => <div key={i} className="text-green-400 font-mono text-xs">{s.toFixed(2)}</div>)}
          </div>
        </div>
        <div className="bg-slate-800/60 rounded-lg px-3 py-1.5">
          <p className="text-slate-500 text-[9px] mb-1">压力位</p>
          <div className="space-y-0.5">
            {result.resistance.map((r, i) => <div key={i} className="text-red-400 font-mono text-xs">{r.toFixed(2)}</div>)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 单股卡片 ─────────────────────────────────────────────────────
function StockCard({ quote, analysis, isAnchor = false }: { quote: StockQuote; analysis?: AnalysisResult; isAnchor?: boolean }) {
  const limitUpPrice = parseFloat((quote.prevClose * 1.1).toFixed(2))
  const isLimitUp = Math.abs(quote.price - limitUpPrice) < 0.01 && quote.zs >= 9.9

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isAnchor ? 'border-yellow-500/30 bg-yellow-500/3' : 'border-border bg-card'} ${isLimitUp ? 'ring-1 ring-red-500/40' : ''}`}>
      {/* 头部 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base">{quote.name}</span>
            <span className="text-slate-500 text-xs font-mono">{quote.code}</span>
            {isAnchor && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">锚点</span>}
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono" style={{ color: quote.zs > 0 ? '#ef4444' : quote.zs < 0 ? '#22c55e' : '#94a3b8' }}>
              {quote.price.toFixed(2)}
            </span>
            <span className={`text-sm font-medium ${cColor(quote.zs)}`}>
              {quote.zs > 0 ? '+' : ''}{quote.zs.toFixed(2)}%
            </span>
            <span className={`text-xs ${cColor(quote.zs)}`}>
              {quote.wz > 0 ? '+' : ''}{quote.wz.toFixed(2)}元
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500">{quote.time || '—'}</div>
          {isLimitUp && <span className="text-red-400 glow-up text-xs font-bold">🔒 涨停</span>}
        </div>
      </div>

      {/* 关键指标 */}
      <div className="grid grid-cols-4 gap-1.5 text-xs">
        {[
          { label: '开盘', value: quote.open.toFixed(2) },
          { label: '最高', value: quote.high.toFixed(2), cls: 'text-red-400' },
          { label: '最低', value: quote.low.toFixed(2), cls: 'text-green-400' },
          { label: '振幅', value: `${quote.amplitude.toFixed(2)}%`, cls: 'text-slate-400' },
          { label: '昨收', value: quote.prevClose.toFixed(2) },
          { label: '成交额', value: fmtAmt(quote.amount) },
          { label: '成交量', value: `${(quote.volume / 10000).toFixed(1)}万手` },
          { label: '时间', value: quote.time || '—' },
        ].map(item => (
          <div key={item.label} className="bg-slate-800/40 rounded px-2 py-1.5 flex flex-col gap-0.5">
            <span className="text-slate-500 text-[9px]">{item.label}</span>
            <span className={`font-mono ${item.cls || 'text-slate-200'}`}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* 分时图 */}
      <MiniChart data={null} quote={quote} />

      {/* 五档 */}
      <OrderBook quote={quote} />

      {/* 分析建议（只对锚点显示） */}
      {analysis && <AnalysisPanel result={analysis} />}
    </div>
  )
}

// ── 大盘指数条 ───────────────────────────────────────────────────
function MarketBar({ boards }: { boards: Record<string, { name: string; change: number }> }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {Object.entries(boards).map(([code, info]) => (
        <div key={code} className={`flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs ${bgColor(info.change)}`}>
          <span className="text-slate-400 mr-2">{info.name}</span>
          <span className={`font-medium ${cColor(info.change)}`}>{info.change > 0 ? '+' : ''}{info.change.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  )
}

// ── 持仓配置面板 ─────────────────────────────────────────────────
function PortfolioPanel({ holdings, onUpdate }: {
  holdings: { code: string; name: string; shares: number; avgCost: number }[]
  onUpdate: (idx: number, updates: Partial<{ shares: number; avgCost: number }>) => void
}) {
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState({ shares: '', avgCost: '' })

  const startEdit = (idx: number, h: { shares: number; avgCost: number }) => {
    setEditing(idx)
    setForm({ shares: String(h.shares), avgCost: String(h.avgCost) })
  }

  const saveEdit = (idx: number) => {
    onUpdate(idx, { shares: Number(form.shares), avgCost: Number(form.avgCost) })
    setEditing(null)
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold mb-3">💼 持仓配置</h3>
      <div className="space-y-2">
        {holdings.map((h, idx) => (
          <div key={h.code} className="bg-slate-800/50 rounded-lg px-3 py-2.5 text-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-200">{h.name}</span>
                <span className="text-slate-500 font-mono">{h.code}</span>
              </div>
              <button onClick={() => startEdit(idx, h)} className="text-blue-400 hover:text-blue-300 text-[10px]">✏️ 编辑</button>
            </div>
            {editing === idx ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs w-full"
                  placeholder="股数"
                  value={form.shares}
                  onChange={e => setForm(f => ({ ...f, shares: e.target.value }))}
                />
                <input
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs w-full"
                  placeholder="成本价"
                  value={form.avgCost}
                  onChange={e => setForm(f => ({ ...f, avgCost: e.target.value }))}
                />
                <button onClick={() => saveEdit(idx)} className="col-span-2 bg-blue-600 hover:bg-blue-500 text-white text-xs py-1 rounded">保存</button>
              </div>
            ) : (
              <div className="text-slate-400">
                股数：<span className="text-slate-200">{h.shares.toLocaleString()}</span> 股
                · 成本：<span className="text-slate-200">{h.avgCost}</span> 元
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────
export default function StockMonitorPage() {
  const HOLDING_CODES = ['002575']
  const ANCHOR_CODES = ['600666']
  
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({})
  const [analyses, setAnalyses] = useState<Record<string, AnalysisResult>>({})
  const [boards, setBoards] = useState<Record<string, { name: string; change: number }>>({})
  const [holdings, setHoldings] = useState([
    { code: '002575', name: '群兴玩具', shares: 1000, avgCost: 8.50 },
  ])
  const [intraday, setIntraday] = useState<Record<string, IntradayData | null>>({})
  const [lastUpdate, setLastUpdate] = useState<string>('—')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const allCodes = [...HOLDING_CODES, ...ANCHOR_CODES]
      const [quotesArr, boardMap] = await Promise.all([
        fetchQuotes(allCodes),
        fetchSectorBoard(),
      ])

      const qMap: Record<string, StockQuote> = {}
      for (const q of quotesArr) qMap[q.code] = q
      setQuotes(qMap)

      setBoards(boardMap)

      // 计算分析
      const aMap: Record<string, AnalysisResult> = {}
      const q575 = qMap['002575']
      const q666 = qMap['600666']
      const boardChange = boardMap["sh000001"]?.change || 0

      if (q575) {
        const h = holdings.find(h => h.code === '002575')
        aMap['002575'] = analyzeStock(q575, q666, boardChange, h ? { id: '002575', code: '002575', name: '群兴玩具', shares: h.shares, avgCost: h.avgCost } : undefined)
      }
      if (q666) {
        aMap['600666'] = analyzeStock(q666, null, boardChange)
      }
      setAnalyses(aMap)

      // 分时数据
      const [intra575, intra666] = await Promise.all([
        fetchIntraday('002575'),
        fetchIntraday('600666'),
      ])
      setIntraday({ '002575': intra575, '600666': intra666 })

      setLastUpdate(new Date().toLocaleTimeString('zh-CN'))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '获取数据失败')
    } finally {
      setIsLoading(false)
    }
  }, [holdings])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    autoTimer.current = setInterval(loadData, 30_000)
    return () => { if (autoTimer.current) clearInterval(autoTimer.current) }
  }, [loadData])

  const q575 = quotes['002575']
  const q666 = quotes['600666']
  const boardChange = boards['sh000001']?.change || 0

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部 */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-base">📈 A股实时监控</h1>
            <p className="text-slate-500 text-[11px]">
              {q575 ? `${q575.name} vs ${q666?.name || ''}` : ''} · 最后更新 {lastUpdate}
              {autoTimer.current && <span className="ml-1">· 每30s自动刷新</span>}
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isLoading ? '刷新中…' : '刷新'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 space-y-4">
        {/* 错误 */}
        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 text-xs">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        {/* 大盘 */}
        <MarketBar boards={boards} />

        {/* 共振横幅 */}
        {analyses['002575']?.resonance && (
          <div className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-3 ${analyses['002575']!.resonance!.direction === '共振上涨' ? 'bg-red-500/10 border-red-500/20 text-red-400' : analyses['002575']!.resonance!.direction === '共振下跌' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
            <span className="text-lg">🔗</span>
            <div>
              <div className="font-semibold text-xs">{analyses['002575']!.resonance!.direction}</div>
              <div className="text-xs opacity-70">{analyses['002575']!.resonance!.description}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs text-slate-500">共振强度</div>
              <div className="text-lg font-bold">{analyses['002575']!.resonance!.strength}<span className="text-xs">/100</span></div>
            </div>
          </div>
        )}

        {/* 双股主监控区 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {q575 ? (
            <StockCard quote={q575} analysis={analyses['002575']} />
          ) : (
            <div className="rounded-xl border border-border bg-card p-4 text-center text-slate-500 text-sm py-12">
              {isLoading ? '加载群兴玩具行情中…' : '行情加载失败'}
            </div>
          )}
          {q666 ? (
            <StockCard quote={q666} analysis={analyses['600666']} isAnchor />
          ) : (
            <div className="rounded-xl border border-border bg-card p-4 text-center text-slate-500 text-sm py-12">
              {isLoading ? '加载奥瑞德行情中…' : '行情加载失败'}
            </div>
          )}
        </div>

        {/* 持仓配置 */}
        <PortfolioPanel holdings={holdings} onUpdate={(idx, updates) => {
          setHoldings(prev => prev.map((h, i) => i === idx ? { ...h, ...updates } : h))
        }} />

        <div className="text-center text-slate-600 text-[11px] pb-4 space-y-1">
          <p>数据来源：腾讯财经免费行情接口 · 每30秒自动刷新 · 手动点刷新获取最新</p>
          <p>本工具仅供参考，不构成投资建议。股市有风险，投资需谨慎。</p>
        </div>
      </main>
    </div>
  )
}
