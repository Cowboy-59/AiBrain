# SpockAI Instance Management

## Problem

Without instance management, launching SpockAI when one is already running causes:
- Duplicate Telegram polling (double-processing messages)
- Port conflicts on the web server (port 3000 already in use)
- Multiple system tray icons
- Duplicate scheduled check-ins firing
- Conflicting writes to `~/.spockai/` data files (memory, sessions, notes)

## User-Facing Behavior

When SpockAI is launched and an existing instance is detected:

**Dialog shown:**
> **SpockAI Already Running**
> SpockAI is already running in the system tray.
> What would you like to do?
>
> [Open existing chat session] [Start new instance anyway] [Cancel]

| Choice | What Happens |
|--------|-------------|
| Open existing chat session | First instance's chat window comes to front. Second instance quits. |
| Start new instance anyway | Both instances run simultaneously. Web server auto-increments port. |
| Cancel | Second instance quits silently. |

**"Open existing" is the recommended default** (pre-selected).

## Technical Implementation

### API: `app.requestSingleInstanceLock()`

Electron's built-in single-instance API using OS-level locks:
- **Windows**: Named pipes
- **macOS/Linux**: File locks via `flock`

The lock is held by the process and **automatically released when the process terminates**, even via crash or Task Manager kill. No stale PID files.

### Flow

```
Second instance launches
       |
       v
requestSingleInstanceLock() --> returns false
       |                              |
       |                    first instance receives
       |                    'second-instance' event
       |                    --> brings window to front
       v
dialog.showMessageBoxSync()
       |
   [user choice]
       |
  +----+----+--------+
  |         |        |
Open     New      Cancel
existing instance
  |         |        |
quit()   continue  quit()
         without
          lock
```

### Event: `second-instance`

Registered on the lock-holding (first) instance. Fires whenever another instance calls `requestSingleInstanceLock()`. Handler:
1. Restore window if minimized
2. Show window if hidden
3. Focus window

### "Start New Instance" Consequences

When the user explicitly chooses to run a second instance:
- Web server: Hits `EADDRINUSE` on port 3000, auto-increments to 3001
- Telegram: Both instances poll -- messages may be processed by either instance
- Check-ins: Both instances fire scheduled check-ins
- Data files: `fs.appendFileSync` is atomic for small writes, so daily logs interleave safely
- Vault: Read-only at runtime after initial load, so no conflicts

## Edge Cases

### Crash Recovery
The OS releases the lock when the process dies. No special handling needed. A new instance after a crash acquires the lock immediately.

### Multi-Monitor
`BrowserWindow.focus()` brings the window to the foreground on whichever monitor it was last positioned. No special multi-monitor code needed.

### Rapid Double-Click
The lock is acquired before the dialog can be shown, so only one instance gets the lock. The second shows the dialog.

### macOS Dock Click
The existing `activate` event handler calls `showChatWindow()`, which complements the `second-instance` handler.

## Files Modified

| File | Change |
|------|--------|
| `tray/main.js` line 1 | Added `dialog` to Electron imports |
| `tray/main.js` before `app.whenReady()` | ~40 lines: lock check, dialog, `second-instance` handler |
