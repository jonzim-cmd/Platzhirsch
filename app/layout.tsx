import './globals.css'
import type { Metadata } from 'next'
import { TopBar } from '@/components/Layout/TopBar'

export const metadata: Metadata = {
  title: 'Sitzplan',
  description: 'Sitzpläne für Klassen und Räume',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark">
      <body>
        <TopBar />
        {children}
      </body>
    </html>
  )
}
