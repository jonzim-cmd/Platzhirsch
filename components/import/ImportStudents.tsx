"use client"
import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/Button'

type Row = Record<string, any>

export function ImportStudents() {
  const [errors, setErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<null | { createdStudents: number; updatedStudents: number; createdClasses: number; errors: { index: number; message: string }[] }>(null)

  function fetchWithTimeout(resource: RequestInfo | URL, options: RequestInit & { timeoutMs?: number } = {}) {
    const { timeoutMs = 15000, ...rest } = options
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    return fetch(resource, { ...rest, signal: controller.signal }).finally(() => clearTimeout(id))
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErrors([])
    setResult(null)
    const reader = new FileReader()
    reader.onload = async () => {
      const data = reader.result
      try {
        if (!data) return
        let workbook: XLSX.WorkBook
        if (typeof data === 'string') {
          // CSV string
          workbook = XLSX.read(data, { type: 'string' })
        } else {
          // ArrayBuffer (xlsx or csv)
          workbook = XLSX.read(data as ArrayBuffer, { type: 'array' })
        }
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' })
        // Auto-map exact headers: foreName, klasse.name, externKey
        const rows = json.map((r) => ({
          foreName: String(r['foreName'] ?? '').trim(),
          className: String(r['klasse.name'] ?? '').trim(),
          externalKey: String(r['externKey'] ?? '').trim(),
        }))
        await doImport(rows)
      } catch (err: any) {
        setErrors([err?.message || 'Fehler beim Lesen der Datei'])
      }
    }
    const isText = file.name.toLowerCase().endsWith('.csv')
    if (isText) reader.readAsText(file)
    else reader.readAsArrayBuffer(file)
  }

  async function doImport(rows: { foreName: string; className: string; externalKey: string }[]) {
    setImporting(true)
    setErrors([])
    setResult(null)
    try {
      const res = await fetchWithTimeout('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }), timeoutMs: 15000 })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        let message = 'Import fehlgeschlagen'
        try {
          const parsed = text ? JSON.parse(text) : null
          message = parsed?.error || message
        } catch {
          message = text || message
        }
        throw new Error(message)
      }
      const text = await res.text()
      const data = text ? JSON.parse(text) : null
      setResult(data)
    } catch (e: any) {
      const isAbort = e?.name === 'AbortError' || /aborted/i.test(String(e?.message))
      const msg = isAbort ? 'Zeitüberschreitung: Server nicht erreichbar (mögliche DB-Verbindung).' : (e?.message ?? 'Import fehlgeschlagen')
      setErrors([msg])
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="text-sm" />
        <p className="text-xs text-fg-muted">Erwartete Spalten (exakt): foreName, klasse.name, externKey. Der Import startet automatisch.</p>
        {importing && <span className="text-xs text-fg-muted">Import läuft…</span>}
      </div>

      {result && (
        <div className="rounded border border-neutral-900 bg-neutral-900/30 p-4 text-sm">
          <div className="grid gap-1">
            <div>Neu angelegte Schüler: <span className="text-primary">{result.createdStudents}</span></div>
            <div>Aktualisierte Schüler: <span className="text-primary">{result.updatedStudents}</span></div>
            <div>Neu angelegte Klassen: <span className="text-primary">{result.createdClasses}</span></div>
            {result.errors.length > 0 && (
              <div className="mt-2 text-red-300">Fehler: {result.errors.length} – z. B. in Zeilen: {result.errors.slice(0,5).map(e => e.index+1).join(', ')}{result.errors.length>5?'…':''}</div>
            )}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded border border-red-900 bg-red-950/30 p-3 text-sm text-red-200">
          {errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}
    </div>
  )
}
