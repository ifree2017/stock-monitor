'use client'
import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Holding } from '@/app/types/stock'

interface PortfolioContextType {
  holdings: Holding[]
  addHolding: (h: Omit<Holding, 'id'>) => void
  removeHolding: (id: string) => void
  updateHolding: (id: string, updates: Partial<Holding>) => void
  getHolding: (code: string) => Holding | undefined
}

const PortfolioContext = createContext<PortfolioContextType | null>(null)

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [holdings, setHoldings] = useState<Holding[]>([
    { id: '1', code: '002575', name: '群兴玩具', shares: 1000, avgCost: 8.50 },
  ])

  const addHolding = useCallback((h: Omit<Holding, 'id'>) => {
    setHoldings(prev => [...prev, { ...h, id: Date.now().toString() }])
  }, [])

  const removeHolding = useCallback((id: string) => {
    setHoldings(prev => prev.filter(h => h.id !== id))
  }, [])

  const updateHolding = useCallback((id: string, updates: Partial<Holding>) => {
    setHoldings(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h))
  }, [])

  const getHolding = useCallback((code: string) => {
    return holdings.find(h => h.code === code)
  }, [holdings])

  return (
    <PortfolioContext.Provider value={{ holdings, addHolding, removeHolding, updateHolding, getHolding }}>
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext)
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider')
  return ctx
}
