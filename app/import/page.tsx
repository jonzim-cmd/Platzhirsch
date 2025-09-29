import { ImportStudents } from '@/components/import/ImportStudents'

export default function ImportPage() {
  return (
    <main className="container py-8 grid gap-6">
      <h1 className="text-xl font-semibold">Import: Schüler (XLSX/CSV)</h1>
      <p className="text-sm text-fg-muted">Datei mit Spalten foreName, klasse.name, externKey. Du kannst die Spalten im nächsten Schritt zuordnen.</p>
      <ImportStudents />
    </main>
  )
}

