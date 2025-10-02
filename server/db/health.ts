let lastDbFailure = 0

export function noteDbFailure() {
  lastDbFailure = Date.now()
}

export function shouldShortCircuit(ms: number = 30000) {
  return Date.now() - lastDbFailure < ms
}

