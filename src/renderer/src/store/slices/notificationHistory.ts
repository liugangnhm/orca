import type { StateCreator } from 'zustand'
import type { NotificationPanelSnapshot } from '../../../../shared/notification-panel-types'
import type { AppState } from '../types'

const INITIAL_SNAPSHOT: NotificationPanelSnapshot = {
  active: [],
  history: [],
  totalUnread: 0,
  generatedAt: 0
}

export type NotificationHistorySlice = {
  notificationHistory: NotificationPanelSnapshot
  setNotificationHistory: (snapshot: NotificationPanelSnapshot) => void
  clearNotificationHistory: () => void
}

export const createNotificationHistorySlice: StateCreator<
  AppState,
  [],
  [],
  NotificationHistorySlice
> = (set) => ({
  notificationHistory: INITIAL_SNAPSHOT,
  setNotificationHistory: (snapshot) => set({ notificationHistory: snapshot }),
  clearNotificationHistory: () => set({ notificationHistory: INITIAL_SNAPSHOT })
})
