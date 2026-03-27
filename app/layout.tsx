import type { Metadata } from 'next'
import './globals.css'
import { PortfolioProvider } from '@/contexts/PortfolioContext'

export const metadata: Metadata = {
  title: 'A股实时监控 | 群兴玩具 & 奥瑞德',
  description: '实时行情监控、板块共振分析、持仓管理',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-background text-foreground min-h-screen">
        <PortfolioProvider>
          {children}
        </PortfolioProvider>
      </body>
    </html>
  )
}
