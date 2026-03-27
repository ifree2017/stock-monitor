'use client'
import { useState, useEffect } from 'react'
import { boardsApi, type BoardInfo, type BoardMember } from '../app/api/client'
import { BOARD_LIST } from '../app/lib/stockApi'

interface Props {
  onAdd: (code: string, name: string, boardCode: string, boardName: string) => void
  onClose: () => void
}

export default function StockPicker({ onAdd, onClose }: Props) {
  const [boards] = useState<BoardInfo[]>(BOARD_LIST.map(b => ({ code: b.code, name: b.name })))
  const [selectedBoard, setSelectedBoard] = useState<string>('')
  const [members, setMembers] = useState<BoardMember[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!selectedBoard) { setMembers([]); return }
    setLoading(true)
    boardsApi.members(selectedBoard).then(data => {
      setMembers(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [selectedBoard])

  const filtered = members.filter(m =>
    m.name.includes(filter) || m.code.includes(filter) || filter === ''
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-600 rounded-2xl w-[640px] max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="font-bold text-sm">📊 板块选股</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">×</button>
        </div>

        <div className="p-3 border-b border-slate-700">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {boards.map(b => (
              <button
                key={b.code}
                onClick={() => setSelectedBoard(b.code)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                  selectedBoard === b.code
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
          {selectedBoard && (
            <div className="mt-2">
              <input
                type="text"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="搜索股票名称或代码…"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loading && <div className="text-center text-slate-500 text-xs py-8">加载中…</div>}
          {!loading && selectedBoard && filtered.length === 0 && (
            <div className="text-center text-slate-500 text-xs py-8">暂无数据</div>
          )}
          {!loading && !selectedBoard && (
            <div className="text-center text-slate-500 text-xs py-8">请先选择一个板块</div>
          )}
          {filtered.slice(0, 50).map(m => {
            const board = boards.find(b => b.code === selectedBoard)
            return (
              <div key={m.code} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-700/50 group">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold flex-shrink-0 ${
                    m.zs > 0 ? 'bg-red-500/20 text-red-400' :
                    m.zs < 0 ? 'bg-green-500/20 text-green-400' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {m.zs > 0 ? '+' : ''}{m.zs.toFixed(2)}%
                  </span>
                  <span className="text-white text-xs font-medium truncate">{m.name}</span>
                  <span className="text-slate-500 text-[10px] flex-shrink-0">{m.code}</span>
                </div>
                <button
                  onClick={() => onAdd(m.code, m.name, selectedBoard, board?.name || '')}
                  className="opacity-0 group-hover:opacity-100 text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition-opacity flex-shrink-0"
                >
                  + 监控
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
