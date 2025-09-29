"use client"
import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/Button'
import { importStudentsAction } from '@/server/actions/import'

type Row = Record<string, any>

const REQUIRED = [
  { key: 'foreName', label: 'foreName' },
  { key: 'className', label: 'klasse.name' },
  { key: 'externalKey', label: 'externKey' },
]

export function ImportStudents() {
  const [rawRows, setRawRows] = useState<Row[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [previewRows, setPreviewRows] = useState<{ foreName: string; className: string; externalKey: string }[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<null | { createdStudents: number; updatedStudents: number; createdClasses: number; errors: { index: number; message: string }[] }>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErrors([])
    setResult(null)
    const reader = new FileReader()
    reader.onload = () => {
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
        setRawRows(json)
        const hdrs = Object.keys(json[0] || {})
        setHeaders(hdrs)
        // try auto-map exact matches
        const auto: Record<string, string> = {}
        REQUIRED.forEach((r) => {
          const found = hdrs.find((h) => h.trim().toLowerCase() === r.label.toLowerCase())
          if (found) auto[r.key] = found
        })
        setMapping(auto)
      } catch (err: any) {
        setErrors([err?.message || 'Fehler beim Lesen der Datei'])
      }
    }
    const isText = file.name.toLowerCase().endsWith('.csv')
    if (isText) reader.readAsText(file)
    else reader.readAsArrayBuffer(file)
  }

  const canMap = headers.length > 0
  const mapOk = useMemo(() => REQUIRED.every((r) => mapping[r.key]), [mapping])

  function buildPreview() {
    if (!mapOk) return
    const rows = rawRows.map((r) => ({
      foreName: String(r[mapping['foreName']] ?? '').trim(),
      className: String(r[mapping['className']] ?? '').trim(),
      externalKey: String(r[mapping['externalKey']] ?? '').trim(),
    }))
    setPreviewRows(rows)
  }

  async function doImport() {
    setImporting(true)
    setErrors([])
    setResult(null)
    try {
      const res = await importStudentsAction({ rows: previewRows })
      setResult(res)
    } catch (e: any) {
      setErrors([e?.message ?? 'Import fehlgeschlagen'])
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="text-sm" />
        <p className="text-xs text-fg-muted">Erwartete Spalten: foreName, klasse.name, externKey</p>
      </div>

      {canMap && (
        <div className="grid gap-3">
          <h3 className="text-sm font-medium">Spalten zuordnen</h3>
          <div className="grid gap-2 md:grid-cols-3">
            {REQUIRED.map((r) => (
              <label key={r.key} className="text-sm text-fg-muted grid gap-1">
                <span>{r.label}</span>
                <select
                  className="rounded bg-neutral-900 px-2 py-2 border border-neutral-800"
                  value={mapping[r.key] || ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [r.key]: e.target.value }))}
                >
                  <option value="">– wählen –</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div>
            <Button onClick={buildPreview} disabled={!mapOk}>Vorschau erstellen</Button>
          </div>
        </div>
      )}

      {previewRows.length > 0 && (
        <div className="grid gap-3">
          <h3 className="text-sm font-medium">Vorschau ({previewRows.length} Zeilen)</h3>
          <div className="overflow-auto rounded border border-neutral-900">
            <table className="w-full text-sm">
              <thead className="bg-neutral-900/50">
                <tr>
                  <th className="px-3 py-2 text-left">foreName</th>
                  <th className="px-3 py-2 text-left">klasse.name</th>
                  <th className="px-3 py-2 text-left">externKey</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-t border-neutral-900">
                    <td className="px-3 py-2">{r.foreName}</td>
                    <td className="px-3 py-2">{r.className}</td>
                    <td className="px-3 py-2">{r.externalKey}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={doImport} variant="primary" disabled={importing}>Importieren</Button>
            {importing && <span className="text-xs text-fg-muted">Import läuft…</span>}
          </div>
        </div>
      )}

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

