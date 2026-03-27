'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { modelConfigApi, type ModelConfig } from '../api/client'
import { useAuth } from '../../contexts/AuthContext'

export default function SettingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [config, setConfig] = useState<ModelConfig | null>(null)
  const [modelName, setModelName] = useState('gpt-4o-mini')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1')
  const [rateLimit, setRateLimit] = useState(50)
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    modelConfigApi.get().then(setConfig).catch(() => {})
  }, [user, router])

  useEffect(() => {
    if (config) {
      setModelName(config.model_name)
      setApiKey(config.api_key || '')
      setBaseUrl(config.base_url)
      setRateLimit(config.rate_limit_per_day)
      setEnabled(config.enabled)
    }
  }, [config])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaved(false)
    setLoading(true)
    try {
      const res = await modelConfigApi.upsert({
        model_name: modelName,
        api_key: apiKey,
        base_url: baseUrl,
        rate_limit_per_day: rateLimit,
        enabled,
      })
      setConfig(res)
      setSaved(true)
    } catch (err: any) {
      setError(err.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('确定删除自定义配置？将使用系统默认（每日50次）。')) return
    try {
      await modelConfigApi.delete()
      setConfig(null)
      setModelName('gpt-4o-mini')
      setApiKey('')
      setBaseUrl('https://api.openai.com/v1')
      setRateLimit(50)
      setEnabled(true)
    } catch (err: any) {
      setError(err.message || '删除失败')
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm mb-1">← 返回</button>
            <h1 className="text-xl font-bold">AI 模型配置</h1>
          </div>
          <div className="text-right text-sm text-slate-400">
            <div>{user.username}</div>
            <div className="text-xs">{user.email}</div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {error && (
            <div className="bg-red-500/20 border border-red-500/40 rounded-lg px-4 py-2 text-red-400 text-sm">{error}</div>
          )}
          {saved && (
            <div className="bg-green-500/20 border border-green-500/40 rounded-lg px-4 py-2 text-green-400 text-sm">保存成功 ✓</div>
          )}

          <div className="bg-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-slate-200 border-b border-slate-700 pb-2">模型设置</h2>
            <div>
              <label className="block text-slate-400 text-sm mb-1.5">模型名称</label>
              <input
                type="text"
                value={modelName}
                onChange={e => setModelName(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="gpt-4o-mini"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1.5">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="sk-..."
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1.5">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="https://api.openai.com/v1"
              />
              <p className="text-slate-500 text-xs mt-1">支持 OpenAI 兼容接口（OpenAI / Azure / Claude API 等）</p>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-slate-200 border-b border-slate-700 pb-2">次数限制</h2>
            <div>
              <label className="block text-slate-400 text-sm mb-1.5">每日分析次数上限</label>
              <input
                type="number"
                value={rateLimit}
                onChange={e => setRateLimit(parseInt(e.target.value) || 50)}
                min={1}
                max={9999}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <p className="text-slate-500 text-xs mt-1">
                未配置 API Key 时，系统默认每日 {50} 次
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enabled"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              <label htmlFor="enabled" className="text-slate-300 text-sm">启用自定义配置</label>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              {loading ? '保存中…' : '保存配置'}
            </button>
            {config && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 rounded-lg py-2.5 text-sm"
              >
                删除
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
