import {
  NOTIFICATION_DEDUPE_MS,
  buildNotificationDedupeKey,
  pruneNotificationHistory
} from '../../shared/notification-panel-history'
import type {
  NotificationHistoryState,
  NotificationPanelEntry,
  NotificationPanelSnapshot
} from '../../shared/notification-panel-types'

type Listener = (snapshot: NotificationPanelSnapshot) => void

export type NotificationHistoryPersistence = {
  load(): NotificationHistoryState
  save(state: NotificationHistoryState): void
}

export class NotificationHistoryStore {
  private state: NotificationHistoryState
  private listeners = new Set<Listener>()

  constructor(
    private persistence: NotificationHistoryPersistence,
    private getHistoryLimit: () => number
  ) {
    this.state = this.persistence.load()
  }

  getState(): NotificationHistoryState {
    return this.state
  }

  toSnapshot(): NotificationPanelSnapshot {
    const now = Date.now()
    const maxAge = 7 * 24 * 60 * 60 * 1000
    const active = this.state.entries.filter(
      (e) => e.status === 'unread' && now - e.createdAt < maxAge
    )
    const history = this.state.entries.filter(
      (e) => e.status === 'read' || e.status === 'superseded'
    )
    return {
      active: [...active].sort((a, b) => b.createdAt - a.createdAt),
      history: [...history].sort((a, b) => b.createdAt - a.createdAt),
      totalUnread: active.length,
      generatedAt: now
    }
  }

  appendEntry(entry: NotificationPanelEntry): { superseded: NotificationPanelEntry[] } {
    const now = Date.now()
    const superseded: NotificationPanelEntry[] = []

    const dedupeKey = buildNotificationDedupeKey(entry)
    const existing = this.state.entries.find(
      (e) =>
        e.status === 'unread' &&
        buildNotificationDedupeKey(e) === dedupeKey &&
        now - e.createdAt < NOTIFICATION_DEDUPE_MS
    )

    if (existing) {
      existing.status = 'superseded'
      existing.readAt = now
      superseded.push(existing)
    }

    this.state.entries.push(entry)
    this.state.entries = pruneNotificationHistory(this.state.entries, now, this.getHistoryLimit())
    this.state.lastPrunedAt = now

    this.persistence.save(this.state)
    this.notify()
    return { superseded }
  }

  dismissEntry(id: string): boolean {
    const entry = this.state.entries.find((e) => e.id === id)
    if (!entry || entry.status === 'read') {
      return false
    }
    entry.status = 'read'
    entry.readAt = Date.now()
    this.persistence.save(this.state)
    this.notify()
    return true
  }

  clearHistory(): void {
    this.state.entries = []
    this.state.lastPrunedAt = Date.now()
    this.persistence.save(this.state)
    this.notify()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    const snapshot = this.toSnapshot()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }
}
