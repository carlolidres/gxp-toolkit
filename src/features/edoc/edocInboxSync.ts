/** Lightweight inbox invalidation so AppShell badge and page hooks stay in sync. */

type Listener = () => void

const listeners = new Set<Listener>()

export function notifyEdocInboxChanged(): void {
  for (const listener of listeners) listener()
}

export function subscribeEdocInboxChanged(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
