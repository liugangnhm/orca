import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  buildManagedCommandHook,
  createManagedCommandMatcher,
  getSharedManagedScriptPath,
  isPlainObject,
  removeManagedCommands,
  wrapPosixHookCommand,
  wrapWindowsGitBashHookCommand,
  type HookDefinition,
  type HooksConfig
} from '../agent-hooks/installer-utils'

export type ClaudeCompatibleHookSettings = {
  configDirName: '.claude' | '.openclaude' | '.codebuddy'
  scriptBaseName: 'claude-hook' | 'openclaude-hook' | 'codebuddy-hook'
}

// Why: readonly hooks allow `as const` event literal arrays (CLAUDE_EVENTS,
// CODEBUDDY_EVENTS) to flow through the install pipeline unchanged; the
// definition is reshaped into a mutable HookDefinition before write.
export type HookEventSpec = {
  eventName: string
  definition: {
    matcher?: string
    hooks?: readonly {
      type: string
      command: string
      timeout?: number
      [key: string]: unknown
    }[]
    [key: string]: unknown
  }
}

export const CLAUDE_HOOK_SETTINGS: ClaudeCompatibleHookSettings = {
  configDirName: '.claude',
  scriptBaseName: 'claude-hook'
}

export const OPENCLAUDE_HOOK_SETTINGS: ClaudeCompatibleHookSettings = {
  configDirName: '.openclaude',
  scriptBaseName: 'openclaude-hook'
}

export const CODEBUDDY_HOOK_SETTINGS: ClaudeCompatibleHookSettings = {
  configDirName: '.codebuddy',
  scriptBaseName: 'codebuddy-hook'
}

export const CLAUDE_EVENTS = [
  { eventName: 'UserPromptSubmit', definition: { hooks: [{ type: 'command', command: '' }] } },
  { eventName: 'Stop', definition: { hooks: [{ type: 'command', command: '' }] } },
  // Why: OpenClaude skips normal Stop hooks after API/model errors and emits
  // StopFailure instead; without this hook Orca leaves the turn spinning.
  { eventName: 'StopFailure', definition: { hooks: [{ type: 'command', command: '' }] } },
  // Why: subagent/teammate lifecycle feeds the sidebar's child rows and keeps
  // a pane 'working' while background children outlive the lead's turn.
  // TeammateIdle parks turn-based teammates without trusting their permanently
  // "running" background_tasks entry to gate the pane.
  // Older Claude builds ignore unregistered event names (StopFailure precedent).
  { eventName: 'SubagentStart', definition: { hooks: [{ type: 'command', command: '' }] } },
  { eventName: 'SubagentStop', definition: { hooks: [{ type: 'command', command: '' }] } },
  { eventName: 'TeammateIdle', definition: { hooks: [{ type: 'command', command: '' }] } },
  // Why: PreToolUse gives the dashboard a live readout of the in-flight tool
  // (name + input preview) before it completes.
  {
    eventName: 'PreToolUse',
    definition: { matcher: '*', hooks: [{ type: 'command', command: '' }] }
  },
  {
    eventName: 'PostToolUse',
    definition: { matcher: '*', hooks: [{ type: 'command', command: '' }] }
  },
  {
    eventName: 'PostToolUseFailure',
    definition: { matcher: '*', hooks: [{ type: 'command', command: '' }] }
  },
  {
    eventName: 'PermissionRequest',
    definition: { matcher: '*', hooks: [{ type: 'command', command: '' }] }
  }
] as const

// Why: CodeBuddy follows the Claude Code Hooks spec but only emits these five
// events (per its docs); registering unsupported ones could error on run.
// UserPromptSubmit/PreToolUse/PostToolUse drive working + the live tool readout,
// Stop drives done. Notification (permission_prompt/idle_prompt/elicitation_dialog)
// fires while CodeBuddy blocks on a human answer or approval; without it Orca
// never learns the agent is waiting and raises no attention notification.
// Interrupt fallback (server.ts) covers cancellation since CodeBuddy's Stop
// payload carries no `is_interrupt`.
export const CODEBUDDY_EVENTS = [
  { eventName: 'UserPromptSubmit', definition: { hooks: [{ type: 'command', command: '' }] } },
  { eventName: 'Stop', definition: { hooks: [{ type: 'command', command: '' }] } },
  {
    eventName: 'PreToolUse',
    definition: { matcher: '*', hooks: [{ type: 'command', command: '' }] }
  },
  {
    eventName: 'PostToolUse',
    definition: { matcher: '*', hooks: [{ type: 'command', command: '' }] }
  },
  // Why: no matcher so every notification_type (permission_prompt, idle_prompt,
  // auth_success, ...) reaches Orca; the listener filters by type.
  { eventName: 'Notification', definition: { hooks: [{ type: 'command', command: '' }] } }
] as const

export function getConfigPath(settings = CLAUDE_HOOK_SETTINGS): string {
  return join(homedir(), settings.configDirName, 'settings.json')
}

export function getStatusLineScriptBaseName(settings = CLAUDE_HOOK_SETTINGS): string {
  return settings.scriptBaseName.replace(/-hook$/, '-statusline')
}

export function getStatusLineScriptFileName(settings = CLAUDE_HOOK_SETTINGS): string {
  return process.platform === 'win32'
    ? `${getStatusLineScriptBaseName(settings)}.cmd`
    : getPosixStatusLineScriptFileName(settings)
}

export function getPosixStatusLineScriptFileName(settings = CLAUDE_HOOK_SETTINGS): string {
  return `${getStatusLineScriptBaseName(settings)}.sh`
}

export function getStatusLineScriptPath(settings = CLAUDE_HOOK_SETTINGS): string {
  return getSharedManagedScriptPath(getStatusLineScriptFileName(settings))
}

export function getManagedScriptFileName(settings = CLAUDE_HOOK_SETTINGS): string {
  return process.platform === 'win32'
    ? `${settings.scriptBaseName}.cmd`
    : getPosixManagedScriptFileName(settings)
}

export function getPosixManagedScriptFileName(settings = CLAUDE_HOOK_SETTINGS): string {
  return `${settings.scriptBaseName}.sh`
}

export function getManagedScriptPath(settings = CLAUDE_HOOK_SETTINGS): string {
  return getSharedManagedScriptPath(getManagedScriptFileName(settings))
}

export function getRemoteConfigPath(remoteHome: string, settings = CLAUDE_HOOK_SETTINGS): string {
  return `${remoteHome.replace(/\/$/, '')}/${settings.configDirName}/settings.json`
}

export function getManagedCommand(scriptPath: string): string {
  return process.platform === 'win32'
    ? wrapWindowsGitBashHookCommand(scriptPath)
    : wrapPosixHookCommand(scriptPath)
}

export function getRemoteManagedCommand(scriptPath: string): string {
  return wrapPosixHookCommand(scriptPath)
}

export function applyManagedHooks(
  config: HooksConfig,
  command: string,
  scriptFileName = getManagedScriptFileName(),
  events: readonly HookEventSpec[] = CLAUDE_EVENTS
): HooksConfig {
  const nextHooks = { ...config.hooks }
  const isManagedCommand = createManagedCommandMatcher(scriptFileName)

  for (const event of events) {
    const current = Array.isArray(nextHooks[event.eventName]) ? nextHooks[event.eventName] : []
    const cleaned = removeManagedCommands(current, isManagedCommand)
    const definition: HookDefinition = {
      ...event.definition,
      hooks: [buildManagedCommandHook(command)]
    }
    nextHooks[event.eventName] = [...cleaned, definition]
  }

  return { ...config, hooks: nextHooks }
}

export type StatusLineSlotState = 'managed' | 'user' | 'empty'

// Why: install policy needs "user owns the slot" vs "slot is empty" vs "ours" — an empty slot
// after a prior install means the user deleted the managed entry, which install must respect.
export function getStatusLineSlotState(
  config: HooksConfig,
  scriptFileName = getStatusLineScriptFileName()
): StatusLineSlotState {
  const isManagedCommand = createManagedCommandMatcher(scriptFileName)
  const current = config.statusLine
  const currentCommand =
    isPlainObject(current) && typeof current.command === 'string' ? current.command : null
  if (!currentCommand) {
    return 'empty'
  }
  return isManagedCommand(currentCommand) ? 'managed' : 'user'
}

// Why: records that the managed statusline was installed once, so a later empty slot reads as user opt-out.
export function getStatusLineInstallMarkerPath(settings = CLAUDE_HOOK_SETTINGS): string {
  return getSharedManagedScriptPath(`${getStatusLineScriptBaseName(settings)}.installed`)
}

// Why: statusLine is a single settings slot, not a hooks array — never overwrite a
// user-owned status line; the usage feed then simply falls back to the OAuth poll.
export function applyManagedStatusLine(
  config: HooksConfig,
  command: string,
  scriptFileName = getStatusLineScriptFileName()
): HooksConfig {
  if (getStatusLineSlotState(config, scriptFileName) === 'user') {
    return config
  }
  return { ...config, statusLine: { type: 'command', command } }
}

export function removeManagedStatusLine(
  config: HooksConfig,
  scriptFileName = getStatusLineScriptFileName()
): { config: HooksConfig; changed: boolean } {
  const isManagedCommand = createManagedCommandMatcher(scriptFileName)
  const current = config.statusLine
  const currentCommand =
    isPlainObject(current) && typeof current.command === 'string' ? current.command : null
  if (!currentCommand || !isManagedCommand(currentCommand)) {
    return { config, changed: false }
  }
  const next = { ...config }
  delete next.statusLine
  return { config: next, changed: true }
}

export function removeManagedHooks(
  config: HooksConfig,
  scriptFileName = getManagedScriptFileName()
): {
  config: HooksConfig
  changed: boolean
} {
  const nextHooks = { ...config.hooks }
  const isManagedCommand = createManagedCommandMatcher(scriptFileName)
  let changed = false

  for (const [eventName, definitions] of Object.entries(nextHooks)) {
    if (!Array.isArray(definitions)) {
      continue
    }
    const cleaned = removeManagedCommands(definitions, isManagedCommand)
    if (JSON.stringify(cleaned) !== JSON.stringify(definitions)) {
      changed = true
    }
    if (cleaned.length === 0) {
      delete nextHooks[eventName]
    } else {
      nextHooks[eventName] = cleaned
    }
  }

  return {
    config: { ...config, hooks: nextHooks },
    changed
  }
}
