// Why: locks in the CodeBuddy install contract — the `.codebuddy/settings.json`
// shape, the narrow five-event set, the /hook/codebuddy script body, and remote
// install. CodeBuddy follows the Claude Code Hooks spec, so these tests pin the
// deltas from Claude (no statusLine, no unsupported events) that make it safe
// to run alongside the Claude-family installer logic.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/userData'
  }
}))

import { createManagedCommandMatcher } from '../agent-hooks/installer-utils'
import { createAgentHookMemorySftp } from '../agent-hooks/agent-hook-memory-sftp.test-fixture'
import { codebuddyHookService } from './hook-service'

const SCRIPT_FILE_NAME = process.platform === 'win32' ? 'codebuddy-hook.cmd' : 'codebuddy-hook.sh'
const isCodebuddyManagedCommand = createManagedCommandMatcher(SCRIPT_FILE_NAME)

function installWithTempHome(): string {
  const tmpHome = mkdtempSync(join(tmpdir(), 'orca-codebuddy-hooks-'))
  vi.stubEnv('HOME', tmpHome)
  vi.stubEnv('USERPROFILE', tmpHome)
  return tmpHome
}

function readSettings(tmpHome: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(tmpHome, '.codebuddy', 'settings.json'), 'utf-8')) as Record<
    string,
    unknown
  >
}

function hookCommands(settings: Record<string, unknown>, eventName: string): string[] {
  const definitions = (settings.hooks as Record<string, unknown[]>)[eventName] ?? []
  return definitions.flatMap((definition) =>
    ((definition as { hooks?: { command?: string }[] }).hooks ?? []).map(
      (hook) => hook.command ?? ''
    )
  )
}

describe('codebuddyHookService.install', () => {
  it('installs managed hooks into ~/.codebuddy/settings.json and posts to /hook/codebuddy', () => {
    const tmpHome = installWithTempHome()
    try {
      const status = codebuddyHookService.install()
      expect(status.state).toBe('installed')
      expect(status.agent).toBe('codebuddy')
      expect(status.configPath).toBe(join(tmpHome, '.codebuddy', 'settings.json'))

      const settings = readSettings(tmpHome)
      for (const eventName of [
        'UserPromptSubmit',
        'Stop',
        'PreToolUse',
        'PostToolUse',
        'Notification'
      ]) {
        expect(
          hookCommands(settings, eventName).some(isCodebuddyManagedCommand),
          `missing managed hook for ${eventName}`
        ).toBe(true)
      }
      // Why: CodeBuddy only emits these five events; registering the rest could error on run.
      for (const eventName of [
        'StopFailure',
        'SubagentStart',
        'SubagentStop',
        'TeammateIdle',
        'PermissionRequest',
        'PostToolUseFailure',
        'SessionStart',
        'PreCompact'
      ]) {
        expect(settings.hooks, `unexpected ${eventName}`).not.toHaveProperty(eventName)
      }
      // Why: the statusLine feed is Claude-only.
      expect(settings).not.toHaveProperty('statusLine')

      const script = readFileSync(join(tmpHome, '.orca', 'agent-hooks', SCRIPT_FILE_NAME), 'utf-8')
      expect(script).toContain('/hook/codebuddy')
    } finally {
      vi.unstubAllEnvs()
      rmSync(tmpHome, { recursive: true, force: true })
    }
  })

  it('preserves user-owned hooks while installing the managed entry', () => {
    const tmpHome = installWithTempHome()
    try {
      const settingsPath = join(tmpHome, '.codebuddy', 'settings.json')
      mkdirSync(join(tmpHome, '.codebuddy'), { recursive: true })
      writeFileSync(
        settingsPath,
        JSON.stringify({
          hooks: {
            UserPromptSubmit: [{ hooks: [{ type: 'command', command: '/usr/local/bin/my-hook' }] }]
          }
        })
      )

      expect(codebuddyHookService.install().state).toBe('installed')

      const settings = readSettings(tmpHome)
      expect(hookCommands(settings, 'UserPromptSubmit')).toContain('/usr/local/bin/my-hook')
      expect(hookCommands(settings, 'UserPromptSubmit').some(isCodebuddyManagedCommand)).toBe(true)
    } finally {
      vi.unstubAllEnvs()
      rmSync(tmpHome, { recursive: true, force: true })
    }
  })

  it('remove() drops the managed hooks and leaves user-owned entries', () => {
    const tmpHome = installWithTempHome()
    try {
      const settingsPath = join(tmpHome, '.codebuddy', 'settings.json')
      mkdirSync(join(tmpHome, '.codebuddy'), { recursive: true })
      writeFileSync(
        settingsPath,
        JSON.stringify({
          hooks: {
            UserPromptSubmit: [{ hooks: [{ type: 'command', command: '/usr/local/bin/my-hook' }] }]
          }
        })
      )

      expect(codebuddyHookService.install().state).toBe('installed')
      expect(codebuddyHookService.remove().state).toBe('not_installed')

      const settings = readSettings(tmpHome)
      expect(hookCommands(settings, 'UserPromptSubmit')).toEqual(['/usr/local/bin/my-hook'])
    } finally {
      vi.unstubAllEnvs()
      rmSync(tmpHome, { recursive: true, force: true })
    }
  })
})

describe('codebuddyHookService.installRemote', () => {
  const REMOTE_HOME = '/home/dev'

  it('installs the POSIX managed script and settings on the remote box', async () => {
    const { sftp, fs } = createAgentHookMemorySftp()
    const status = await codebuddyHookService.installRemote(sftp, REMOTE_HOME)
    expect(status.state).toBe('installed')

    const configPath = `${REMOTE_HOME}/.codebuddy/settings.json`
    const settings = JSON.parse(fs.files.get(configPath)!) as Record<string, unknown>
    for (const eventName of [
      'UserPromptSubmit',
      'Stop',
      'PreToolUse',
      'PostToolUse',
      'Notification'
    ]) {
      const commands = ((settings.hooks as Record<string, unknown[]>)[eventName] ?? []).flatMap(
        (definition) =>
          ((definition as { hooks?: { command?: string }[] }).hooks ?? []).map(
            (hook) => hook.command ?? ''
          )
      )
      expect(
        commands.some((command) => command.includes('/.orca/agent-hooks/codebuddy-hook.sh')),
        `missing remote managed hook for ${eventName}`
      ).toBe(true)
    }

    const script = fs.files.get(`${REMOTE_HOME}/.orca/agent-hooks/codebuddy-hook.sh`)
    expect(script).toContain('/hook/codebuddy')
    expect(script).toBeDefined()
    expect(fs.modes.get(`${REMOTE_HOME}/.orca/agent-hooks/codebuddy-hook.sh`)).toBe(0o755)
  })

  it('reports error when the remote config is malformed', async () => {
    const { sftp } = createAgentHookMemorySftp({
      [`${REMOTE_HOME}/.codebuddy/settings.json`]: '{"hooks": }'
    })
    const status = await codebuddyHookService.installRemote(sftp, REMOTE_HOME)
    expect(status.state).toBe('error')
  })
})
