import type { AgentStatusState, AgentType } from './agent-status-types'

export type NotificationPanelEntrySource = 'agent-task-complete' | 'terminal-bell'

export type NotificationPanelEntryStatus = 'unread' | 'read' | 'superseded'

export type NotificationPanelEntry = {
  id: string
  source: NotificationPanelEntrySource
  status: NotificationPanelEntryStatus
  createdAt: number
  readAt: number | null
  worktreeId: string | null
  paneKey: string | null
  tabId: string | null
  leafId: string | null
  repoId: string | null
  title: string
  body: string
  agentType: AgentType | null
  agentState: AgentStatusState | null
  worktreeLabel: string | null
  repoLabel: string | null
  interrupted: boolean
}

export type NotificationPanelSnapshot = {
  active: NotificationPanelEntry[]
  history: NotificationPanelEntry[]
  totalUnread: number
  generatedAt: number
}

export type NotificationHistoryState = {
  entries: NotificationPanelEntry[]
  lastPrunedAt: number
}

export type NotificationDismissResult = {
  snapshot: NotificationPanelSnapshot
}

export type NotificationClearResult = {
  snapshot: NotificationPanelSnapshot
}

export type NotificationRevealRequest = {
  id: string
  worktreeId: string | null
  paneKey: string | null
  repoId: string | null
}
