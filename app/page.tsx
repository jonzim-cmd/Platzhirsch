import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="container py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sitzplan</h1>
        <nav className="space-x-4 text-sm text-fg-muted">
          <Link href="/profiles" className="hover:text-fg">Profile</Link>
          <Link href="/classes" className="hover:text-fg">Klassen</Link>
          <Link href="/rooms" className="hover:text-fg">Räume</Link>
          <Link href="/students" className="hover:text-fg">Schüler</Link>
        </nav>
      </div>
      <section className="mt-10 grid gap-6">
        <div className="rounded-lg border border-neutral-800 bg-bg-soft p-6">
          <h2 className="text-lg font-medium">Loslegen</h2>
          <p className="mt-2 text-sm text-fg-muted">Wähle ein Profil und erstelle Klassen, Räume und Sitzpläne.</p>
          <div className="mt-4 flex gap-3">
            <Link className="rounded bg-primary/20 px-4 py-2 text-primary hover:bg-primary/30" href="/profiles">Profile</Link>
            <Link className="rounded bg-neutral-800 px-4 py-2 hover:bg-neutral-700" href="/classes">Klassen</Link>
            <Link className="rounded bg-neutral-800 px-4 py-2 hover:bg-neutral-700" href="/rooms">Räume</Link>
            <Link className="rounded bg-neutral-800 px-4 py-2 hover:bg-neutral-700" href="/students">Schüler</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
