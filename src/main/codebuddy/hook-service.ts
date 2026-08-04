import { ClaudeHookService } from '../claude/hook-service'
import { CODEBUDDY_EVENTS, CODEBUDDY_HOOK_SETTINGS } from '../claude/hook-settings'

// Why: CodeBuddy follows the Claude Code Hooks spec (verified against its docs:
// UserPromptSubmit/PreToolUse/PostToolUse/Stop + `.codebuddy/settings.json`),
// so the Claude hook service applies verbatim except for the narrower event set.
// Its Stop payload lacks `is_interrupt`; the server-side interrupt fallback
// synthesizes `done` when a session is cancelled without a Stop hook firing.
export const codebuddyHookService = new ClaudeHookService({
  agent: 'codebuddy',
  displayName: 'CodeBuddy',
  settings: CODEBUDDY_HOOK_SETTINGS,
  events: CODEBUDDY_EVENTS,
  hookSource: 'codebuddy'
})
