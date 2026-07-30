import { app, BrowserWindow, screen, type WebContents } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import type { Store } from '../persistence'
import { sendToTrustedUIRenderer } from '../ipc/ui'
import { installPrivilegedWindowNavigationPolicy } from './privileged-window-navigation'
import { rectHasVisibleAreaOnAnyDisplay } from './window-bounds-validation'

const MIN_WIDTH = 300
const MIN_HEIGHT = 200
const DEFAULT_WIDTH = 380
const DEFAULT_HEIGHT = 520
const DEFAULT_MARGIN = 16
const NOTIFICATION_PANEL_PARTITION = 'orca-notification-panel'

let notificationPanelWindow: BrowserWindow | null = null
const openListeners = new Set<(open: boolean) => void>()

export function getNotificationPanelWindow(): BrowserWindow | null {
  return notificationPanelWindow &&
    !notificationPanelWindow.isDestroyed() &&
    !notificationPanelWindow.webContents.isDestroyed()
    ? notificationPanelWindow
    : null
}

export function isNotificationPanelRenderer(sender: WebContents): boolean {
  return getNotificationPanelWindow()?.webContents === sender
}

export function onNotificationPanelOpenChanged(listener: (open: boolean) => void): () => void {
  openListeners.add(listener)
  return () => openListeners.delete(listener)
}

function broadcastOpenChanged(open: boolean): void {
  sendToTrustedUIRenderer('notification:panelOpenChanged', open)
  for (const listener of openListeners) {
    listener(open)
  }
}

export function createOrFocusNotificationPanel(store: Store | null): BrowserWindow {
  if (notificationPanelWindow && !notificationPanelWindow.isDestroyed()) {
    if (notificationPanelWindow.isMinimized()) {
      notificationPanelWindow.restore()
    }
    notificationPanelWindow.focus()
    return notificationPanelWindow
  }

  const savedBounds = resolveRestoredBounds(store)
  const bounds = savedBounds ?? getDefaultBounds()

  const window = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    maxWidth: 520,
    maxHeight: 720,
    title: 'Orca Notifications',
    show: false,
    frame: false,
    transparent: true,
    roundedCorners: true,
    hasShadow: true,
    alwaysOnTop: true,
    fullscreenable: false,
    resizable: true,
    movable: true,
    focusable: process.platform !== 'win32',
    skipTaskbar: true,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    ...(process.platform === 'darwin'
      ? { vibrancy: 'under-window', visualEffectState: 'active' }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      partition: NOTIFICATION_PANEL_PARTITION,
      webviewTag: false
    }
  })
  installPrivilegedWindowNavigationPolicy(window.webContents)
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false)
  )
  window.webContents.session.setPermissionCheckHandler(() => false)
  notificationPanelWindow = window
  broadcastOpenChanged(true)

  window.webContents.on('dom-ready', () => {
    if (!window.isDestroyed()) {
      window.webContents.setZoomLevel(store?.getUI().uiZoomLevel ?? 0)
    }
  })
  let lastFollowedZoomLevel = store?.getUI().uiZoomLevel ?? 0
  const unsubscribeUIChanged = store?.onUIChanged((ui) => {
    const level = ui.uiZoomLevel ?? 0
    if (level === lastFollowedZoomLevel) {
      return
    }
    lastFollowedZoomLevel = level
    if (!window.isDestroyed()) {
      window.webContents.setZoomLevel(level)
    }
  })

  window.once('ready-to-show', () => {
    if (!window.isDestroyed()) {
      window.show()
    }
  })

  let boundsTimer: ReturnType<typeof setTimeout> | null = null
  let windowClosing = false
  const saveBounds = (): void => {
    if (boundsTimer) {
      clearTimeout(boundsTimer)
    }
    boundsTimer = setTimeout(() => {
      boundsTimer = null
      if (windowClosing || window.isDestroyed() || window.isMinimized() || window.isFullScreen()) {
        return
      }
      const bounds = window.getBounds()
      if (bounds.width < MIN_WIDTH || bounds.height < MIN_HEIGHT) {
        return
      }
      store?.updateUI({ notificationPanelBounds: bounds })
    }, 500)
  }
  window.on('resize', saveBounds)
  window.on('move', saveBounds)

  const freezeBounds = (): void => {
    windowClosing = true
    if (boundsTimer) {
      clearTimeout(boundsTimer)
      boundsTimer = null
    }
  }
  window.on('close', freezeBounds)
  app.on('before-quit', freezeBounds)

  window.on('closed', () => {
    app.removeListener('before-quit', freezeBounds)
    unsubscribeUIChanged?.()
    if (notificationPanelWindow === window) {
      notificationPanelWindow = null
    }
    broadcastOpenChanged(false)
  })

  loadNotificationPanel(window)
  return window
}

export function closeNotificationPanel(): void {
  if (notificationPanelWindow && !notificationPanelWindow.isDestroyed()) {
    notificationPanelWindow.close()
  }
  notificationPanelWindow = null
}

function loadNotificationPanel(window: BrowserWindow): void {
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}/notification-panel.html`)
  } else {
    void window.loadFile(join(__dirname, '../renderer/notification-panel.html'))
  }
}

function getDefaultBounds(): { x: number; y: number; width: number; height: number } {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: workArea.x + workArea.width - DEFAULT_WIDTH - DEFAULT_MARGIN,
    y: workArea.y + workArea.height - DEFAULT_HEIGHT - DEFAULT_MARGIN,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT
  }
}

function resolveRestoredBounds(store: Store | null): {
  x: number
  y: number
  width: number
  height: number
} | null {
  const raw = store?.getUI().notificationPanelBounds ?? null
  if (
    raw &&
    raw.width >= MIN_WIDTH &&
    raw.height >= MIN_HEIGHT &&
    rectHasVisibleAreaOnAnyDisplay(raw, MIN_WIDTH / 2, MIN_HEIGHT / 2)
  ) {
    return raw
  }
  if (raw) {
    console.warn('[notification-panel] Discarding off-screen/near-min panel bounds:', raw)
  }
  return null
}
