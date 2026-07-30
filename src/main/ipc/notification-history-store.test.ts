import { describe, expect, it, vi } from 'vitest'
import { NotificationHistoryStore } from './notification-history-store'
import type { NotificationPanelEntry } from '../../shared/notification-panel-types'

function makeEntry(overrides: Partial<NotificationPanelEntry> = {}): NotificationPanelEntry {
  return {
    id: 'test',
    source: 'agent-task-complete',
    status: 'unread',
    createdAt: Date.now(),
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

function createStore(entries: NotificationPanelEntry[] = []) {
  const persistence = {
    load: vi.fn().mockReturnValue({ entries, lastPrunedAt: 0 }),
    save: vi.fn()
  }
  const getHistoryLimit = vi.fn().mockReturnValue(100)
  return {
    store: new NotificationHistoryStore(persistence, getHistoryLimit),
    persistence,
    getHistoryLimit
  }
}

describe('NotificationHistoryStore', () => {
  it('loads initial state from persistence', () => {
    const entry = makeEntry()
    const { store } = createStore([entry])
    expect(store.getState().entries).toHaveLength(1)
  })

  it('appends an entry and persists', () => {
    const { store, persistence } = createStore()
    store.appendEntry(makeEntry({ id: 'a' }))
    expect(store.getState().entries).toHaveLength(1)
    expect(persistence.save).toHaveBeenCalled()
  })

  it('dismisses an entry by id', () => {
    const { store } = createStore()
    store.appendEntry(makeEntry({ id: 'a' }))
    const result = store.dismissEntry('a')
    expect(result).toBe(true)
    expect(store.getState().entries[0].status).toBe('read')
    expect(store.getState().entries[0].readAt).not.toBeNull()
  })

  it('returns false when dismissing a non-existent entry', () => {
    const { store } = createStore()
    expect(store.dismissEntry('missing')).toBe(false)
  })

  it('clears all history', () => {
    const { store } = createStore()
    store.appendEntry(makeEntry({ id: 'a' }))
    store.appendEntry(makeEntry({ id: 'b' }))
    store.clearHistory()
    expect(store.getState().entries).toHaveLength(0)
  })

  it('supersedes duplicate entries within cooldown window', () => {
    const { store } = createStore()
    const now = Date.now()
    store.appendEntry(makeEntry({ id: 'a', createdAt: now, paneKey: 'tab:leaf' }))
    const result = store.appendEntry(
      makeEntry({ id: 'b', createdAt: now + 100, paneKey: 'tab:leaf' })
    )
    expect(result.superseded).toHaveLength(1)
    expect(result.superseded[0].id).toBe('a')
    // superseded entries are pruned immediately by pruneNotificationHistory
    expect(store.getState().entries).toHaveLength(1)
    expect(store.getState().entries[0].id).toBe('b')
  })

  it('does not supersede entries outside cooldown window', () => {
    const { store } = createStore()
    const now = Date.now()
    store.appendEntry(makeEntry({ id: 'a', createdAt: now - 10_000, paneKey: 'tab:leaf' }))
    const result = store.appendEntry(makeEntry({ id: 'b', createdAt: now, paneKey: 'tab:leaf' }))
    expect(result.superseded).toHaveLength(0)
  })

  it('toSnapshot separates active from history', () => {
    const { store } = createStore()
    const now = Date.now()
    store.appendEntry(
      makeEntry({ id: 'a', status: 'unread', createdAt: now, paneKey: 'tab1:leaf1' })
    )
    store.appendEntry(
      makeEntry({ id: 'b', status: 'read', createdAt: now - 1000, paneKey: 'tab2:leaf2' })
    )
    const snapshot = store.toSnapshot()
    expect(snapshot.active).toHaveLength(1)
    expect(snapshot.history).toHaveLength(1)
    expect(snapshot.totalUnread).toBe(1)
  })

  it('notifies subscribers on append', () => {
    const { store } = createStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.appendEntry(makeEntry())
    expect(listener).toHaveBeenCalled()
  })
})
