import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_DEDUPE_MS,
  NOTIFICATION_HISTORY_LIMIT,
  NOTIFICATION_HISTORY_MAX_AGE_MS,
  buildNotificationDedupeKey,
  isEntryExpired,
  pruneNotificationHistory
} from './notification-panel-history'
import type { NotificationPanelEntry } from './notification-panel-types'

function makeEntry(overrides: Partial<NotificationPanelEntry> = {}): NotificationPanelEntry {
  return {
    id: 'test',
    source: 'agent-task-complete',
    status: 'unread',
    createdAt: 0,
    readAt: null,
    worktreeId: 'repo::/path',
    paneKey: 'tab:leaf',
    tabId: 'tab',
    leafId: 'leaf',
    repoId: 'repo',
    title: 'Test',
    body: 'Body',
    agentType: 'claude',
    agentState: 'done',
    worktreeLabel: 'feature',
    repoLabel: 'my-repo',
    interrupted: false,
    ...overrides
  }
}

describe('buildNotificationDedupeKey', () => {
  it('combines source, worktreeId, and paneKey', () => {
    expect(
      buildNotificationDedupeKey({ source: 'agent-task-complete', worktreeId: 'w1', paneKey: 'p1' })
    ).toBe('agent-task-complete::w1::p1')
  })

  it('uses fallbacks for null values', () => {
    expect(
      buildNotificationDedupeKey({ source: 'terminal-bell', worktreeId: null, paneKey: null })
    ).toBe('terminal-bell::global::none')
  })
})

describe('pruneNotificationHistory', () => {
  const now = 1_000_000_000_000

  it('removes superseded entries', () => {
    const entries = [
      makeEntry({ id: 'a', status: 'superseded', createdAt: now }),
      makeEntry({ id: 'b', status: 'unread', createdAt: now })
    ]
    const result = pruneNotificationHistory(entries, now, NOTIFICATION_HISTORY_LIMIT)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('b')
  })

  it('removes entries older than 7 days', () => {
    const entries = [
      makeEntry({ id: 'old', createdAt: now - NOTIFICATION_HISTORY_MAX_AGE_MS - 1 }),
      makeEntry({ id: 'fresh', createdAt: now })
    ]
    const result = pruneNotificationHistory(entries, now, NOTIFICATION_HISTORY_LIMIT)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('fresh')
  })

  it('respects the limit', () => {
    const entries = Array.from({ length: 200 }, (_, i) =>
      makeEntry({ id: `e${i}`, createdAt: now - i * 1000 })
    )
    const result = pruneNotificationHistory(entries, now, NOTIFICATION_HISTORY_LIMIT)
    expect(result).toHaveLength(NOTIFICATION_HISTORY_LIMIT)
  })

  it('sorts newest-first', () => {
    const entries = [
      makeEntry({ id: 'old', createdAt: now - 5000 }),
      makeEntry({ id: 'new', createdAt: now }),
      makeEntry({ id: 'mid', createdAt: now - 2000 })
    ]
    const result = pruneNotificationHistory(entries, now, NOTIFICATION_HISTORY_LIMIT)
    expect(result.map((e) => e.id)).toEqual(['new', 'mid', 'old'])
  })
})

describe('isEntryExpired', () => {
  const now = 1_000_000_000_000

  it('returns true for entries older than max age', () => {
    expect(
      isEntryExpired(makeEntry({ createdAt: now - NOTIFICATION_HISTORY_MAX_AGE_MS - 1 }), now)
    ).toBe(true)
  })

  it('returns false for fresh entries', () => {
    expect(isEntryExpired(makeEntry({ createdAt: now }), now)).toBe(false)
  })
})

describe('constants', () => {
  it('has expected values', () => {
    expect(NOTIFICATION_DEDUPE_MS).toBe(5000)
    expect(NOTIFICATION_HISTORY_LIMIT).toBe(100)
    expect(NOTIFICATION_HISTORY_MAX_AGE_MS).toBe(7 * 24 * 60 * 60 * 1000)
  })
})
