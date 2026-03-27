'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authApi } from '../api/client'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginPage() {
  const router = useRouter()
  const { login, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) router.push('/')
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login({ email, password })
      login(res.token, res.user)
      router.push('/')
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">A股监控台</h1>
          <p className="text-slate-400 text-sm">登录您的账户</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-xl p-6 space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-500/40 rounded-lg px-3 py-2 text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-slate-400 text-sm mb-1.5">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? '登录中…' : '登录'}
          </button>
          <p className="text-center text-slate-400 text-sm">
            还没有账户？<Link href="/register" className="text-blue-400 hover:text-blue-300">立即注册</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
