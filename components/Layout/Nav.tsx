import Link from 'next/link'
import { ActiveProfileNav } from './ActiveProfileNav'

export function Nav() {
  return (
    <header className="border-b border-neutral-900 bg-bg-soft/60 backdrop-blur">
      <div className="container flex h-12 items-center justify-between">
        <Link href="/" className="font-semibold">Sitzplan</Link>
        <nav className="space-x-4 text-sm text-fg-muted">
          <Link href="/profiles" className="hover:text-fg">Profile</Link>
          <Link href="/classes" className="hover:text-fg">Klassen</Link>
          <Link href="/rooms" className="hover:text-fg">Räume</Link>
          <Link href="/students" className="hover:text-fg">Schüler</Link>
          <Link href="/import" className="hover:text-fg">Import</Link>
          <Link href="/editor" className="hover:text-fg">Editor</Link>
          <ActiveProfileNav />
        </nav>
      </div>
    </header>
  )
}
