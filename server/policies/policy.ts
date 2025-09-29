// Simple, extensible policy layer. Currently allow-all.

export type Actor = {
  id: string
  role: 'anonymous'
}

export function currentActor(): Actor {
  // Later, map to authenticated user/org
  return { id: 'anonymous', role: 'anonymous' }
}

export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'

export function checkPolicy(_actor: Actor, _action: Action, _resource: string): boolean {
  // Allow all for MVP. Extend here later.
  return true
}

