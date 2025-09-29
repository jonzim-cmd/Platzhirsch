import './globals.css'
import type { Metadata } from 'next'
import { Nav } from '@/components/Layout/Nav'

export const metadata: Metadata = {
  title: 'Sitzplan',
  description: 'Sitzpläne für Klassen und Räume',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  )
}
