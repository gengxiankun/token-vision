import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TOKEN VISION | Hermes AI 消耗监控',
  description: 'Real-time Hermes AI token consumption dashboard with cosmic visualization',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen font-['Inter']">
        {children}
      </body>
    </html>
  )
}
