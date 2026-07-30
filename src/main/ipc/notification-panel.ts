import { app, ipcMain } from 'electron'
import type { Store } from '../persistence'
import {
  createOrFocusNotificationPanel,
  closeNotificationPanel,
  getNotificationPanelWindow,
  isNotificationPanelRenderer
} from '../window/notification-panel-window'
import { safelyRevealWindow } from '../window/focus-existing-window'
import { getTrustedUIRendererWindow, isTrustedUIRenderer, sendToTrustedUIRenderer } from './ui'
import { parsePaneKey } from '../../shared/stable-pane-id'
import { NotificationHistoryStore } from './notification-history-store'
import type {
  NotificationHistoryState,
  NotificationPanelEntry,
  NotificationPanelSnapshot,
  NotificationRevealRequest
} from '../../shared/notification-panel-types'

let lastSnapshot: NotificationPanelSnapshot | null = null
let historyStore: NotificationHistoryStore | null = null
let autoOpenStore: Store | null = null

export function publishNotificationToPanel(entry: NotificationPanelEntry): void {
  if (historyStore) {
    const shouldAutoOpen =
      autoOpenStore?.getSettings().notifications.panelAutoOpenOnNotification === true &&
      getNotificationPanelWindow() === null
    historyStore.appendEntry(entry)
    if (shouldAutoOpen && autoOpenStore) {
      createOrFocusNotificationPanel(autoOpenStore)
    }
    return
  }
  const panel = getNotificationPanelWindow()
  if (panel) {
    panel.webContents.send('notification:panel:new', entry)
  }
  if (lastSnapshot) {
    lastSnapshot = {
      ...lastSnapshot,
      active: [entry, ...lastSnapshot.active],
      totalUnread: lastSnapshot.totalUnread + 1,
      generatedAt: Date.now()
    }
  }
  sendToTrustedUIRenderer('notification:panelUnreadChanged', lastSnapshot?.totalUnread ?? 1)
}

export function registerNotificationPanelHandlers(store: Store): void {
  autoOpenStore = store
  historyStore = new NotificationHistoryStore(
    {
      load: () => store.getState().notificationHistory ?? { entries: [], lastPrunedAt: 0 },
      save: (state: NotificationHistoryState) => store.setState({ notificationHistory: state })
    },
    () => store.getSettings().notifications.panelHistoryLimit ?? 100
  )

  ipcMain.removeHandler('notificationPanel:open')
  ipcMain.removeHandler('notificationPanel:close')
  ipcMain.removeHandler('notificationPanel:toggle')
  ipcMain.removeHandler('notificationPanel:getPanelOpen')
  ipcMain.removeHandler('notificationPanel:getHistory')
  ipcMain.removeHandler('notificationPanel:dismiss')
  ipcMain.removeHandler('notificationPanel:clearHistory')
  ipcMain.removeHandler('notificationPanel:revealNotification')
  ipcMain.removeHandler('notificationPanel:ackNotification')

  historyStore.subscribe((snapshot) => {
    lastSnapshot = snapshot
    const panel = getNotificationPanelWindow()
    if (panel) {
      panel.webContents.send('notification:panel:snapshot', snapshot)
    }
    sendToTrustedUIRenderer('notification:panelUnreadChanged', snapshot.totalUnread)
  })

  ipcMain.handle('notificationPanel:open', (event): void => {
    if (!isTrustedUIRenderer(event.sender)) {
      return
    }
    createOrFocusNotificationPanel(store)
  })

  ipcMain.handle('notificationPanel:close', (event): void => {
    if (!isNotificationPanelRenderer(event.sender)) {
      return
    }
    closeNotificationPanel()
  })

  ipcMain.handle('notificationPanel:toggle', (event): void => {
    if (!isTrustedUIRenderer(event.sender)) {
      return
    }
    if (getNotificationPanelWindow()) {
      closeNotificationPanel()
    } else {
      createOrFocusNotificationPanel(store)
    }
  })

  ipcMain.handle('notificationPanel:getPanelOpen', (event): boolean =>
    isTrustedUIRenderer(event.sender) ? getNotificationPanelWindow() !== null : false
  )

  ipcMain.handle('notificationPanel:getHistory', (event): NotificationPanelSnapshot | null => {
    if (!isNotificationPanelRenderer(event.sender)) {
      return null
    }
    lastSnapshot = historyStore!.toSnapshot()
    return lastSnapshot
  })

  ipcMain.handle(
    'notificationPanel:dismiss',
    (event, id: string): NotificationPanelSnapshot | null => {
      if (!isNotificationPanelRenderer(event.sender)) {
        return null
      }
      historyStore!.dismissEntry(id)
      lastSnapshot = historyStore!.toSnapshot()
      sendToTrustedUIRenderer('notification:panelUnreadChanged', lastSnapshot.totalUnread)
      return lastSnapshot
    }
  )

  ipcMain.handle('notificationPanel:clearHistory', (event): NotificationPanelSnapshot | null => {
    if (!isNotificationPanelRenderer(event.sender)) {
      return null
    }
    historyStore!.clearHistory()
    lastSnapshot = historyStore!.toSnapshot()
    sendToTrustedUIRenderer('notification:panelUnreadChanged', 0)
    return lastSnapshot
  })

  ipcMain.handle(
    'notificationPanel:revealNotification',
    (event, args: NotificationRevealRequest): void => {
      if (!isNotificationPanelRenderer(event.sender)) {
        return
      }
      const mainWindow = getTrustedUIRendererWindow()
      if (!mainWindow) {
        return
      }
      safelyRevealWindow(mainWindow)
      if (args.worktreeId) {
        mainWindow.webContents.send('ui:activateWorktree', {
          repoId: args.repoId,
          worktreeId: args.worktreeId
        })
      }
      const paneTarget = args.paneKey ? parsePaneKey(args.paneKey) : null
      if (paneTarget) {
        mainWindow.webContents.send('ui:focusTerminal', {
          tabId: paneTarget.tabId,
          worktreeId: args.worktreeId,
          leafId: paneTarget.leafId,
          ackPaneKeyOnSuccess: args.paneKey,
          flashFocusedPane: true,
          scrollToBottomIfOutputSinceLastView: true
        })
      }
      try {
        app.focus({ steal: true })
      } catch {
        // best-effort
      }
    }
  )

  ipcMain.handle('notificationPanel:ackNotification', (event, paneKey: string): void => {
    if (!isNotificationPanelRenderer(event.sender)) {
      return
    }
    sendToTrustedUIRenderer('ui:ackDashboardAgent', paneKey)
  })
}
