
<task>
Refaktoriere die Datei `Editor.tsx`, die aktuell monolithisch und sehr lang ist.
Ziel: Eine modulare, klar strukturierte Codebasis, ohne bestehende Funktionalität oder Logik zu verändern.

<goals>
- Erhalte 100 % der bisherigen Funktionalität und API-Verträge.
- Baue die Architektur in kleinere, logische Komponenten auf (z. B. UI-Subkomponenten, Hooks, Utility-Module).
- Stelle sicher, dass alle Zustände und Props aus einer **Single Source of Truth** stammen.
- Reduziere doppelte Zustände oder redundante useState-Hooks.
- Nutze idiomatisches React + TypeScript.
</goals>

<context>
- Framework: React (TypeScript)
- Ziel-Datei: `Editor.tsx`
- Stack: Plain JS/TS, React, eventuell TailwindCSS oder modulare CSS-Dateien
- Funktionalität darf nicht verändert werden (nur interne Struktur)
</context>

<code_editing_rules>
<guiding_principles>
- Teile die Komponente entlang klarer Verantwortlichkeiten auf (UI, State Management, Logic).
- Erstelle bei Bedarf folgende Unterdateien im gleichen Verzeichnis:
  • `EditorHeader.tsx`
  • `EditorCanvas.tsx`
  • `EditorSidebar.tsx`
  • `useEditorState.ts`
  • `editorUtils.ts`
- Verwende Props-Drilling nur, wenn zwingend nötig — bevorzuge Context oder Custom Hooks.
- Halte alle Datenflüsse deterministisch und konsistent.
- Kommentare in bestehenden Funktionen beibehalten.
</guiding_principles>

<refactoring_process>
1. Analysiere `Editor.tsx` und identifiziere logische Abschnitte.
2. Plane eine modulare Aufteilung basierend auf Verantwortlichkeiten.
3. Extrahiere wiederverwendbare oder unabhängige Teile in separate Komponenten/Hooks.
4. Verifiziere, dass die Datenquelle (State, Context, Props) eindeutig bleibt.
5. Prüfe den neuen Code auf TypeScript-Konsistenz, PropTypes, und Imports.
6. Führe zum Schluss eine Selbstprüfung durch:
   - Gleiche UI? ✅
   - Gleiche Interaktionen? ✅
   - Gleiche Datenflüsse? ✅
   - Code kürzer, lesbarer, modularer? ✅
</refactoring_process>
</code_editing_rules>

<persistence>
- Sei entscheidungsfreudig bei der Modularisierung.
- Dokumentiere Annahmen inline im Code als Kommentare (z. B. // TODO: verify prop flow).
- Führe keine semantischen Änderungen ein.
- Keine Nachfragen – triff sinnvolle Annahmen und handle konsistent.
</persistence>

<self_reflection>
Denke zuerst kurz über die logische Struktur eines modularen Editors nach
(z. B. State-Layer, Rendering-Layer, Interaction-Layer).
Plane dann die Extraktion der Komponenten in Schichten.
Wenn du überzeugt bist, dass die Struktur kohärent ist, starte erst dann mit der eigentlichen Refaktorisierung.
</self_reflection>

<output_expectation>
- Gib eine klare Datei-Struktur aus (Verzeichnisbaum).
- Zeige für jede neue Datei den vollständigen TypeScript-Code.
- Erkläre in 2–3 Sätzen, welche Verantwortung jede neue Datei übernimmt.
</output_expectation>
</task>
