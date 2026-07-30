import './assets/main.css'

import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'
import { NotificationPanelRoot } from './components/notification-panel/NotificationPanelRoot'
import { RecoverableRenderErrorBoundary } from './components/error-boundaries/RecoverableRenderErrorBoundary'
import {
  installRendererCrashDiagnostics,
  recordRendererCrashBreadcrumb
} from './lib/crash-diagnostics'
import { applyDocumentTheme } from './lib/document-theme'
import { buildAppFontFamily } from './lib/app-font-family'
import { I18nProvider } from './i18n/I18nProvider'
import { translate } from './i18n/i18n'
import { useAppStore } from './store'
import type { GlobalSettings } from '../../shared/types'

recordRendererCrashBreadcrumb('notification_panel_bootstrap_started', { dev: import.meta.env.DEV })
installRendererCrashDiagnostics('notification-panel')

function applyPanelAppearance(settings: GlobalSettings | null): void {
  applyDocumentTheme(settings?.theme ?? 'system', { disableTransitions: false })
  document.documentElement.style.setProperty(
    '--app-font-family',
    buildAppFontFamily(settings?.appFontFamily)
  )
}

let startupSettings: GlobalSettings | null = null
try {
  startupSettings = window.api.settings.getSync()
} catch {
  // Async hydration below remains available if the startup read fails.
}
if (startupSettings) {
  useAppStore.setState({ settings: startupSettings })
}
applyPanelAppearance(startupSettings)

const rootElement = document.getElementById('root')
if (!rootElement) {
  recordRendererCrashBreadcrumb('notification_panel_root_missing')
  throw new Error('Notification panel root element not found.')
}

function PanelSettingsSync(): null {
  const settings = useAppStore((state) => state.settings)

  useEffect(() => {
    let disposed = false
    void useAppStore.getState().fetchKeybindings()
    const setSettings = (next: GlobalSettings): void => {
      if (!disposed) {
        useAppStore.setState({ settings: next })
      }
    }
    const offChanged = window.api.settings.onChanged((updates) => {
      const current = useAppStore.getState().settings
      if (current) {
        setSettings({ ...current, ...updates })
      }
    })
    void window.api.settings
      .get()
      .then(setSettings)
      .catch(() => undefined)
    return () => {
      disposed = true
      offChanged()
    }
  }, [])

  useEffect(() => {
    applyPanelAppearance(settings)
    if (settings?.theme !== 'system') {
      return
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (): void => applyDocumentTheme('system')
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [settings])

  return null
}

function PanelRoot(): React.JSX.Element {
  useTranslation()
  return (
    <RecoverableRenderErrorBoundary
      boundaryId="notification-panel.root"
      surface="notification-panel"
      title={translate(
        'notificationPanel.recoverableError.title',
        'Orca notifications hit an error.'
      )}
      description={translate(
        'notificationPanel.recoverableError.description',
        'The notification panel could not finish rendering. Retry to remount it, or reopen it.'
      )}
    >
      <NotificationPanelRoot />
    </RecoverableRenderErrorBoundary>
  )
}

createRoot(rootElement).render(
  <StrictMode>
    <I18nProvider>
      <PanelSettingsSync />
      <PanelRoot />
    </I18nProvider>
  </StrictMode>
)
recordRendererCrashBreadcrumb('notification_panel_bootstrap_rendered')
