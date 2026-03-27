'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { StockQuote, AnalysisResult, IntradayData, MonitorItem, BoardMember } from './types/stock'
import { fetchQuotes, fetchIntraday, fetchSectorBoard, fetchSectorLeaders, BOARD_LIST } from './lib/stockApi'
import { analyzeStock } from './lib/analysis'
import { LineChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, YAxis, BarChart, Bar, Cell } from 'recharts'

// ── 成交分时图（量柱）────────────────────────────────────────────
function VolumeBars({ bars, prevClose }: { bars: MinuteBar[]; prevClose: number }) {
  if (!bars || bars.length === 0) return null
  const maxVol = Math.max(...bars.map(b => b.volume), 1)
  const upColor = '#ef4444'
  const downColor = '#22c55e'
  const data = bars.map(b => ({
    time: b.time,
    price: b.price,
    volume: b.volume,
    isUp: b.price >= prevClose,
  }))
  return (
    <div className="h-12 bg-slate-900/50 rounded-lg px-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
          <YAxis hide domain={[0, maxVol * 1.1]} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 6, fontSize: 10, color: '#e2e8f0', padding: '2px 6px' }}
            formatter={(v: number, name: string) => [name === 'volume' ? `${(v / 10000).toFixed(1)}万手` : v.toFixed(2), name === 'volume' ? '成交量' : '价格']}
            labelStyle={{ color: '#64748b', fontSize: 9 }}
          />
          <Bar dataKey="volume" radius={[1, 1, 0, 0]} isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.isUp ? upColor : downColor} fillOpacity={0.6} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── 五档行情 ───────────────────────────────────────────────────
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

// ── helpers ───────────────────────────────────────────────────────
function fmt(n: number, d = 2) { return n.toFixed(d) }
function fmtAmt(n: number) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(2)}万`
  return n.toFixed(0)
}
function cC(zs: number) { return zs > 0 ? 'text-red-400' : zs < 0 ? 'text-green-400' : 'text-slate-400' }
function cBg(zs: number) {
  return zs > 0 ? 'bg-red-500/10 border-red-500/20' : zs < 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-slate-800 border-slate-700'
}

// ── 分时迷你图 ───────────────────────────────────────────────────
function MiniChart({ bars, price, prevClose, zs }: { bars: [string, number][]; price: number; prevClose: number; zs: number }) {
  const strokeColor = zs >= 0 ? '#ef4444' : '#22c55e'
  const data = bars.map(([time, p]) => ({ time, price: p }))
  const domain: [number, number] = [
    Math.min(...data.map(d => d.price), prevClose) * 0.998,
    Math.max(...data.map(d => d.price), prevClose) * 1.002,
  ]
  if (data.length === 0) {
    const fake = Array.from({ length: 30 }, (_, i) => ({ time: `${i}`, price: prevClose > 0 ? price : 10 }))
    return (
      <div className="h-16 bg-slate-900/50 rounded-lg flex items-center justify-center">
        <span className="text-slate-600 text-[10px]">暂无分时数据</span>
      </div>
    )
  }
  return (
    <div className="h-16 bg-slate-900/50 rounded-lg px-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
          <YAxis domain={domain} hide />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 6, fontSize: 10, color: '#e2e8f0', padding: '2px 6px' }}
            formatter={(v: number) => [v.toFixed(2), '']}
            labelStyle={{ color: '#64748b', fontSize: 9 }}
          />
          <ReferenceLine y={prevClose} stroke="#475569" strokeDasharray="2 2" />
          <Line type="monotone" dataKey="price" stroke={strokeColor} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── 监控标的一览（按涨跌幅排序）────────────────────────────────
function MonitorOverviewPanel({ items, quotes }: { items: MonitorItem[]; quotes: Record<string, StockQuote> }) {
  const sorted = [...items]
    .map(item => ({ item, quote: quotes[item.code] }))
    .filter(x => x.quote)
    .sort((a, b) => (b.quote?.zs ?? 0) - (a.quote?.zs ?? 0))

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-3">
      <h3 className="text-xs font-semibold mb-2 flex items-center gap-1">
        <span>📊</span> 监控标的一览
        <span className="text-slate-500 font-normal text-[10px] ml-1">— 按涨跌幅排序</span>
      </h3>
      <div className="space-y-0.5 max-h-52 overflow-y-auto">
        {sorted.map(({ item, quote }) => (
          <div key={item.id} className="flex items-center justify-between text-xs py-1 px-1 rounded hover:bg-slate-700/40">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`text-[10px] px-1 py-0.5 rounded font-mono flex-shrink-0 font-bold ${
                item.isHolding ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {item.isHolding ? '💼' : '⚓'}
              </span>
              <span className="text-slate-300 truncate">{quote?.name}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                (quote?.zs ?? 0) > 0 ? 'bg-red-500/20 text-red-400' :
                (quote?.zs ?? 0) < 0 ? 'bg-green-500/20 text-green-400' :
                'bg-slate-700 text-slate-400'
              }`}>
                {(quote?.zs ?? 0) > 0 ? '+' : ''}{(quote?.zs ?? 0).toFixed(2)}%
              </span>
              <span className="text-slate-400 font-mono text-[10px] w-14 text-right">{quote?.price.toFixed(2)}</span>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="text-slate-600 text-xs text-center py-4">暂无数据</div>
        )}
      </div>
    </div>
  )
}

// ── 锚点关联面板 ─────────────────────────────────────────────────
function AnchorPanel({ anchorQuote, item, allQuotes }: {
  anchorQuote: StockQuote | null
  item: MonitorItem
  allQuotes: Record<string, StockQuote>
}) {
  if (!anchorQuote) return null
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-3">
      <h3 className="text-xs font-semibold mb-2">⚓ 锚点对比 <span className="text-slate-500 font-normal">— {item.anchorName}</span></h3>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold font-mono" style={{ color: anchorQuote.zs > 0 ? '#ef4444' : '#22c55e' }}>
            {anchorQuote.price.toFixed(2)}
          </div>
          <div className={`text-xs ${cC(anchorQuote.zs)}`}>
            {anchorQuote.zs > 0 ? '+' : ''}{anchorQuote.zs.toFixed(2)}%
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500">锚点代码</div>
          <div className="text-xs font-mono text-slate-300">{item.anchorCode}</div>
        </div>
      </div>
      {/* 相对强弱 */}
      <div className="mt-2 text-[10px] text-slate-500">
        {(() => {
          const mainQuote = allQuotes[item.code]
          if (!mainQuote) return null
          const diff = mainQuote.zs - anchorQuote.zs
          return (
            <span className={diff > 0 ? 'text-red-400' : diff < 0 ? 'text-green-400' : 'text-slate-400'}>
              {diff > 0 ? `↑ 强于锚点 +${diff.toFixed(2)}%` : diff < 0 ? `↓ 弱于锚点 ${diff.toFixed(2)}%` : '= 与锚点持平'}
            </span>
          )
        })()}
      </div>
    </div>
  )
}

// ── 操作建议面板 ─────────────────────────────────────────────────
function AdvicePanel({ result }: { result: AnalysisResult }) {
  const { stock, momentum, signal, advice, resonance, pnl } = result
  const signalCls = signal === '强烈买入' ? 'from-red-600 to-orange-500'
    : signal === '买入' ? 'bg-red-500'
    : signal === '持有' ? 'bg-amber-600'
    : signal === '减仓' ? 'bg-amber-700'
    : 'bg-slate-700'
  const limitUpPrice = parseFloat((stock.prevClose * 1.1).toFixed(2))
  const isLimitUp = Math.abs(stock.price - limitUpPrice) < 0.01 && stock.zs >= 9.9

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-300">📊 分析</h3>
        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${signal.includes('买入') ? 'bg-gradient-to-r ' + signalCls : signalCls}`}>
          {signal}
        </div>
      </div>

      {/* 持仓盈亏 */}
      {pnl && (
        <div className={`flex justify-between text-xs px-2 py-1.5 rounded-lg ${pnl.amount >= 0 ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
          <span className="text-slate-400">持仓盈亏</span>
          <span className={pnl.amount >= 0 ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'}>
            {pnl.amount >= 0 ? '+' : ''}{fmtAmt(pnl.amount)} ({pnl.rate >= 0 ? '+' : ''}{pnl.rate.toFixed(2)}%)
          </span>
        </div>
      )}

      {/* 共振 */}
      {resonance && (
        <div className={`rounded-lg px-2 py-1.5 text-[11px] border ${resonance.direction === '共振上涨' ? 'bg-red-500/10 border-red-500/20 text-red-400' : resonance.direction === '共振下跌' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
          <span className="font-semibold">{resonance.direction}</span>
          <span className="text-slate-500 ml-1">强度{resonance.strength}/100</span>
          <div className="text-[10px] mt-0.5 text-slate-500">{resonance.description}</div>
        </div>
      )}

      {/* 关键指标 */}
      <div className="grid grid-cols-3 gap-1 text-[10px]">
        {[
          { label: '动量', value: momentum },
          { label: '涨停距', value: stock.prevClose > 0 ? `${((stock.price / (stock.prevClose * 1.1) - 1) * -100).toFixed(1)}%` : '—' },
          { label: '委比', value: stock.bid1Volume + stock.ask1Volume > 0 ? `${(((stock.bid1Volume - stock.ask1Volume) / (stock.bid1Volume + stock.ask1Volume)) * 100).toFixed(1)}%` : '—' },
          { label: '开盘', value: stock.open.toFixed(2) },
          { label: '最高', value: stock.high.toFixed(2), cls: 'text-red-400' },
          { label: '最低', value: stock.low.toFixed(2), cls: 'text-green-400' },
        ].map(item => (
          <div key={item.label} className="bg-slate-900/60 rounded px-1.5 py-1">
            <span className="text-slate-500">{item.label}</span>
            <div className={`font-mono ${(item as {cls?: string}).cls || 'text-slate-200'}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* 建议文字 */}
      <div className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line bg-slate-900/40 rounded-lg px-2 py-1.5">
        {advice}
      </div>

      {/* 支撑/阻力 */}
      <div className="grid grid-cols-2 gap-1">
        <div className="bg-slate-900/60 rounded px-2 py-1">
          <div className="text-slate-500 text-[9px] mb-0.5">支撑</div>
          <div className="text-green-400 font-mono text-[10px]">{result.support.slice(0, 3).map(s => s.toFixed(2)).join(' | ')}</div>
        </div>
        <div className="bg-slate-900/60 rounded px-2 py-1">
          <div className="text-slate-500 text-[9px] mb-0.5">压力</div>
          <div className="text-red-400 font-mono text-[10px]">{result.resistance.slice(0, 3).map(r => r.toFixed(2)).join(' | ')}</div>
        </div>
      </div>
    </div>
  )
}

// ── 单股监控卡片 ─────────────────────────────────────────────────
function MonitorCard({ item, quote, analysis, intraday, allQuotes, onRemove, onUpdate }: {
  item: MonitorItem
  quote: StockQuote | null
  analysis?: AnalysisResult
  intraday: [string, number][] | null
  allQuotes: Record<string, StockQuote>
  onRemove: () => void
  onUpdate: (updates: Partial<MonitorItem>) => void
}) {
  const limitUpPrice = ((quote?.prevClose ?? 0) * 1.1).toFixed(2)
  const isLimitUp = quote ? Math.abs(quote.price - parseFloat(limitUpPrice)) < 0.01 && quote.zs >= 9.9 : false
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    anchorCode: item.anchorCode,
    anchorName: item.anchorName,
    boardCode: item.boardCode,
    boardName: item.boardName,
    shares: item.holding?.shares ?? 0,
    avgCost: item.holding?.avgCost ?? 0,
  })

  const handleSave = () => {
    onUpdate({
      anchorCode: form.anchorCode,
      anchorName: form.anchorName,
      boardCode: form.boardCode,
      boardName: form.boardName,
      holding: item.isHolding ? { shares: form.shares, avgCost: form.avgCost } : undefined,
    })
    setEditing(false)
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${item.isHolding ? 'border-blue-500/30 bg-blue-500/3' : 'border-slate-700 bg-slate-800/40'}`}>
      {/* 头部 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {item.isHolding && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">💼持仓</span>}
          <div>
            <span className="font-bold text-sm">{quote?.name || item.name}</span>
            <span className="text-slate-500 text-xs ml-1 font-mono">{item.code}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isLimitUp && <span className="text-red-400 text-[10px]">🔒涨停</span>}
          <button onClick={onRemove} className="text-slate-600 hover:text-red-400 text-xs transition-colors">✕</button>
        </div>
      </div>

      {/* 价格 */}
      {quote ? (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono" style={{ color: quote.zs > 0 ? '#ef4444' : quote.zs < 0 ? '#22c55e' : '#94a3b8' }}>
            {quote.price.toFixed(2)}
          </span>
          <span className={`text-sm font-medium ${cC(quote.zs)}`}>{quote.zs > 0 ? '+' : ''}{quote.zs.toFixed(2)}%</span>
          <span className="text-xs text-slate-500">{quote.time}</span>
        </div>
      ) : (
        <div className="text-slate-500 text-sm">加载中…</div>
      )}

      {/* 分时价格线 + 成交量柱 */}
      <PriceChart data={intraday} />
      <VolumeBars data={intraday} />

      {/* 五档行情 */}
      {quote && (
        <OrderBook quote={quote} />
      )}

      {/* 持仓信息 */}
      {item.isHolding && item.holding && (
        <div className={`flex justify-between text-xs px-2 py-1.5 rounded-lg ${(analysis?.pnl?.amount ?? 0) >= 0 ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
          <span className="text-slate-400">浮盈 {item.holding.shares}股/{item.holding.avgCost}元</span>
          {analysis?.pnl && (
            <span className={(analysis.pnl.amount >= 0 ? 'text-red-400' : 'text-green-400') + ' font-semibold'}>
              {analysis.pnl.amount >= 0 ? '+' : ''}{fmtAmt(analysis.pnl.amount)} ({analysis.pnl.rate >= 0 ? '+' : ''}{analysis.pnl.rate.toFixed(2)}%)
            </span>
          )}
        </div>
      )}

      {/* 分析建议 */}
      {analysis && <AdvicePanel result={analysis} />}

      {/* 锚点/板块设置 */}
      <div className="border-t border-slate-700 pt-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">锚点 / 板块</span>
          <button onClick={() => setEditing(e => !e)} className="text-[10px] text-blue-400 hover:text-blue-300">
            {editing ? '取消' : '⚙ 设置'}
          </button>
        </div>
        <div className="flex gap-2 text-[10px]">
          <span className="bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">⚓ {item.anchorName || '未设置'}</span>
          <span className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">📊 {item.boardName || '未设置'}</span>
        </div>

        {editing && (
          <div className="bg-slate-900/60 rounded-lg p-2 space-y-2 text-xs">
            {/* 持仓编辑 */}
            {item.isHolding && (
              <div className="border-b border-slate-700 pb-2 mb-1">
                <p className="text-slate-400 text-[9px] mb-1">💼 持仓信息</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-slate-500 text-[9px]">股数</label>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs" type="number" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: Number(e.target.value) }))} placeholder="1000" />
                  </div>
                  <div>
                    <label className="text-slate-500 text-[9px]">成本价</label>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs" type="number" step="0.01" value={form.avgCost} onChange={e => setForm(f => ({ ...f, avgCost: Number(e.target.value) }))} placeholder="8.50" />
                  </div>
                </div>
              </div>
            )}
            {/* 锚点 */}
            <div>
              <label className="text-slate-500 text-[9px]">⚓ 锚点股票代码</label>
              <input className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs" value={form.anchorCode} onChange={e => setForm(f => ({ ...f, anchorCode: e.target.value }))} placeholder="如 600666" />
            </div>
            <div>
              <label className="text-slate-500 text-[9px]">锚点名称</label>
              <input className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs" value={form.anchorName} onChange={e => setForm(f => ({ ...f, anchorName: e.target.value }))} placeholder="如 奥瑞德" />
            </div>
            {/* 板块 */}
            <div>
              <label className="text-slate-500 text-[9px]">📊 关联板块</label>
              <select className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs" value={form.boardCode} onChange={e => {
                const b = BOARD_LIST.find(b => b.code === e.target.value)
                setForm(f => ({ ...f, boardCode: e.target.value, boardName: b?.name || f.boardName }))
              }}>
                {BOARD_LIST.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </div>
            <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs py-1.5 rounded transition-colors font-medium">保存</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 添加标的弹窗 ─────────────────────────────────────────────────
function AddStockModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (item: Omit<MonitorItem, 'id'>) => void }) {
  const [form, setForm] = useState({ code: '', name: '', isHolding: false, shares: 0, avgCost: 0, anchorCode: '600666', anchorName: '奥瑞德', boardCode: 'BK1028', boardName: '电子元件' })

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-600 rounded-2xl p-5 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-sm mb-4">添加监控标的</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">股票代码</label>
            <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" placeholder="如 600666" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.replace(/\D/g, '') }))} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">股票名称</label>
            <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" placeholder="如 奥瑞德" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isHolding" checked={form.isHolding} onChange={e => setForm(f => ({ ...f, isHolding: e.target.checked }))} className="accent-blue-500 w-4 h-4" />
            <label htmlFor="isHolding" className="text-xs text-slate-300">设为持仓股</label>
          </div>
          {form.isHolding && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">股数</label>
                <input className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white text-xs" type="number" value={form.shares || ''} onChange={e => setForm(f => ({ ...f, shares: Number(e.target.value) }))} placeholder="1000" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">成本价</label>
                <input className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white text-xs" type="number" step="0.01" value={form.avgCost || ''} onChange={e => setForm(f => ({ ...f, avgCost: Number(e.target.value) }))} placeholder="8.50" />
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs bg-slate-700 hover:bg-slate-600 transition-colors">取消</button>
          <button onClick={() => {
            if (!form.code) return
            const cleanCode = form.code.replace(/\D/g, '').padStart(6, '0')
            onAdd({
              code: cleanCode,
              name: form.name || cleanCode,
              isHolding: form.isHolding,
              anchorCode: form.anchorCode,
              anchorName: form.anchorName,
              boardCode: form.boardCode,
              boardName: form.boardName,
              holding: form.isHolding ? { shares: form.shares, avgCost: form.avgCost } : undefined,
            })
            setForm({ code: '', name: '', isHolding: false, shares: 0, avgCost: 0, anchorCode: '600666', anchorName: '奥瑞德', boardCode: 'BK1028', boardName: '电子元件' })
            onClose()
          }} className="flex-1 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 transition-colors font-medium">添加</button>
        </div>
      </div>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────
export default function StockMonitorPage() {
  const [items, setItems] = useState<MonitorItem[]>([])
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({})
  const [analyses, setAnalyses] = useState<Record<string, AnalysisResult>>({})
  const [intraday, setIntraday] = useState<Record<string, IntradayData | null>>({})
  const [boards, setBoards] = useState<Record<string, { name: string; change: number }>>({})
  const [sectorMembers, setSectorMembers] = useState<BoardMember[]>([])
  const [lastUpdate, setLastUpdate] = useState('—')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const autoTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // 初始化：从 localStorage 加载
  useEffect(() => {
    const saved = (() => {
      try { return JSON.parse(localStorage.getItem('stock-monitor-config') || 'null') as MonitorItem[] | null } catch { return null }
    })()
    setItems(saved || [
      { id: '1', code: '002575', name: '群兴玩具', isHolding: true, holding: { shares: 1000, avgCost: 8.50 }, anchorCode: '600666', anchorName: '奥瑞德', boardCode: 'sh883441', boardName: '电子元件' },
      { id: '2', code: '600666', name: '奥瑞德', isHolding: false, anchorCode: '', anchorName: '', boardCode: 'sh883441', boardName: '电子元件' },
    ])
  }, [])

  // 保存到 localStorage
  const saveItems = useCallback((newItems: MonitorItem[]) => {
    setItems(newItems)
    try { localStorage.setItem('stock-monitor-config', JSON.stringify(newItems)) } catch {}
  }, [])

  const loadData = useCallback(async () => {
    if (items.length === 0) return
    setIsLoading(true)
    setError(null)
    try {
      const allCodes = items.map(i => i.code)
      const allAnchorCodes = Array.from(new Set(items.map(i => i.anchorCode).filter(Boolean)))
      const uniqueCodes = Array.from(new Set([...allCodes, ...allAnchorCodes]))
      const allBoardCodes = Array.from(new Set(items.map(i => i.boardCode).filter(Boolean)))
      const quoteCodes = Array.from(new Set([...uniqueCodes, ...allBoardCodes]))

      const [quotesArr, boardData] = await Promise.all([
        fetchQuotes(quoteCodes),
        fetchSectorBoard(),
      ])

      const qMap: Record<string, StockQuote> = {}
      for (const q of quotesArr) qMap[q.code] = q
      setQuotes(qMap)
      setBoards(boardData)

      // 分析
      const aMap: Record<string, AnalysisResult> = {}
      for (const item of items) {
        const quote = qMap[item.code]
        if (!quote) continue
        const anchorQuote = item.anchorCode ? qMap[item.anchorCode] : null
        const boardChange = boardData['sh000001']?.change || 0
        const holding = item.isHolding && item.holding
          ? { id: item.id, code: item.code, name: item.name, shares: item.holding.shares, avgCost: item.holding.avgCost }
          : undefined
        aMap[item.code] = analyzeStock(quote, anchorQuote, boardChange, holding)
      }
      setAnalyses(aMap)

      // 分时（只拉前3个）
      const intraCodes = items.slice(0, 3).map(i => i.code)
      const intraResults = await Promise.allSettled(intraCodes.map(code => fetchIntraday(code)))
      const intraMap: Record<string, IntradayData | null> = {}
      intraCodes.forEach((code, i) => {
        const result = intraResults[i]
        intraMap[code] = result.status === 'fulfilled' ? result.value : null
      })
      setIntraday(intraMap)

      // 概念板块成分股（取第一个标的的板块）
      const primaryItem = items[0]
      if (primaryItem?.boardCode) {
        const boardInfo = BOARD_LIST.find(b => b.code === primaryItem.boardCode)
        const t = boardInfo?.t || '2'
        const members = await fetchSectorLeaders(primaryItem.boardCode, t, 10)
        setSectorMembers(members)
      }

      setLastUpdate(new Date().toLocaleTimeString('zh-CN'))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '获取数据失败')
    } finally {
      setIsLoading(false)
    }
  }, [items])

  useEffect(() => { if (items.length > 0) loadData() }, [loadData])
  useEffect(() => {
    autoTimer.current = setInterval(loadData, 30_000)
    return () => { if (autoTimer.current) clearInterval(autoTimer.current) }
  }, [loadData])

  const removeItem = (id: string) => saveItems(items.filter(i => i.id !== id))
  const updateItem = (id: string, updates: Partial<MonitorItem>) => {
    saveItems(items.map(i => i.id === id ? { ...i, ...updates } : i))
    // 如果锚点变了，刷新锚点行情
    if (updates.anchorCode !== undefined || updates.boardCode !== undefined) {
      setTimeout(loadData, 500)
    }
  }
  const addItem = (item: Omit<MonitorItem, 'id'>) => {
    const newItem: MonitorItem = { ...item, id: Date.now().toString() }
    saveItems([...items, newItem])
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-sm">📈 A股实时监控</h1>
            <p className="text-slate-500 text-[10px]">最后更新 {lastUpdate} · 每30s自动刷新</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(true)} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">+ 添加标的</button>
            <button onClick={loadData} disabled={isLoading} className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors">
              <svg className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isLoading ? '…' : '刷新'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* 错误 */}
        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 text-xs">
            ⚠ {error}
          </div>
        )}

        {/* 大盘指数条 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Object.entries(boards).map(([code, info]) => (
            <div key={code} className={`flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs ${cBg(info.change)}`}>
              <span className="text-slate-400 mr-2">{info.name}</span>
              <span className={`font-medium ${cC(info.change)}`}>{info.change > 0 ? '+' : ''}{info.change.toFixed(2)}%</span>
            </div>
          ))}
        </div>

        {/* 主布局：监控网格 + 侧边栏 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 左：监控标的卡片网格 */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map(item => (
              <MonitorCard
                key={item.id}
                item={item}
                quote={quotes[item.code] || null}
                analysis={analyses[item.code]}
                intraday={intraday[item.code] || null}
                allQuotes={quotes}
                onRemove={() => removeItem(item.id)}
                onUpdate={(u) => updateItem(item.id, u)}
              />
            ))}
            {items.length === 0 && (
              <div className="col-span-2 text-center py-16 text-slate-500 text-sm">
                点击右上角「+ 添加标的」开始监控
              </div>
            )}
          </div>

          {/* 右：监控一览 + 概念板块 */}
          <div className="space-y-3">
            <MonitorOverviewPanel items={items} quotes={quotes} />
            {sectorMembers.length > 0 && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-3">
                <h3 className="text-xs font-semibold mb-2 flex items-center gap-1">
                  <span>📊</span> 概念板块
                  <span className="text-slate-500 font-normal text-[10px] ml-1">
                    — {items[0]?.boardName || '电子元件'}
                  </span>
                </h3>
                <div className="space-y-0.5 max-h-52 overflow-y-auto">
                  {[...sectorMembers].sort((a, b) => b.zs - a.zs).map(m => (
                    <div key={m.code} className="flex items-center justify-between text-xs py-0.5 px-1 rounded hover:bg-slate-700/40">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-[10px] px-1 py-0.5 rounded font-mono flex-shrink-0 font-bold ${
                          m.zs > 0 ? 'bg-red-500/20 text-red-400' :
                          m.zs < 0 ? 'bg-green-500/20 text-green-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {m.zs > 0 ? '+' : ''}{m.zs.toFixed(2)}%
                        </span>
                        <span className="text-slate-300 truncate">{m.name}</span>
                      </div>
                      <span className="text-slate-400 font-mono flex-shrink-0 ml-2 text-[11px]">{m.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-slate-600 text-[10px] pb-4">
          数据来源：腾讯财经免费行情接口 · 本地存储不涉及后端<br />
          本工具仅供参考，不构成投资建议。股市有风险，投资需谨慎。
        </div>
      </main>

      <AddStockModal open={showAdd} onClose={() => setShowAdd(false)} onAdd={addItem} />
    </div>
  )
}
