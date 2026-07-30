import type { NotificationPanelEntry } from './notification-panel-types'

export const NOTIFICATION_DEDUPE_MS = 5_000
export const NOTIFICATION_HISTORY_LIMIT = 100
export const NOTIFICATION_HISTORY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function buildNotificationDedupeKey(e: {
  worktreeId: string | null
  paneKey: string | null
  source: string
}): string {
  return `${e.source}::${e.worktreeId ?? 'global'}::${e.paneKey ?? 'none'}`
}

export function pruneNotificationHistory(
  entries: NotificationPanelEntry[],
  now: number,
  limit: number = NOTIFICATION_HISTORY_LIMIT
): NotificationPanelEntry[] {
  const fresh = entries.filter((e) => e.status !== 'superseded')
  const withinWindow = fresh.filter((e) => now - e.createdAt < NOTIFICATION_HISTORY_MAX_AGE_MS)
  return withinWindow.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
}

export function isEntryExpired(entry: NotificationPanelEntry, now: number): boolean {
  return now - entry.createdAt >= NOTIFICATION_HISTORY_MAX_AGE_MS
}
