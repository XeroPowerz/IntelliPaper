import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Intelligence Paper — AI-native writing',
  description: 'A fluid, AI-first writing space.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

