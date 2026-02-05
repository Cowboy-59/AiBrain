# SpockAI Chat UI Components

This directory contains the Electron-based chat window implementation.

## Structure

```
ui/
├── app.ts        - Main Electron application
├── docking.ts    - Window docking functionality
├── messages.tsx  - Chat message display component
├── input.tsx     - Input field component
├── tray.ts       - System tray implementation
└── styles/       - CSS styles
```

## Components

### app.ts
Main Electron shell that creates and manages the dockable chat window.
- Creates BrowserWindow with frame customization
- Handles window lifecycle events
- Manages IPC communication with renderer

### docking.ts
Window docking functionality for snap-to-edge behavior.
- Detects screen edges during drag
- Implements snap zones (left, right, top, bottom)
- Saves/restores dock position

### messages.tsx
React component for displaying chat messages.
- Renders user and assistant messages
- Supports markdown formatting
- Auto-scrolls to latest message
- Shows typing indicator

### input.tsx
React component for message input.
- Text area with auto-resize
- Send button
- Keyboard shortcuts (Ctrl+Enter to send)
- Command history navigation

### tray.ts
System tray icon and menu.
- Shows SpockAI icon in system tray
- Context menu with quick actions
- Notification badge for unread count
- Toggle window visibility on click

## Development

```bash
# Install Electron dependencies
pnpm add electron electron-builder

# Run in development
pnpm dev:chat

# Build for production
pnpm build:chat
```

## Configuration

Window settings can be configured in the chat config:

```typescript
interface WindowConfig {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  alwaysOnTop: boolean;
  skipTaskbar: boolean;
}
```

## IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `chat:send` | Renderer → Main | Send chat message |
| `chat:receive` | Main → Renderer | Receive response |
| `chat:status` | Bidirectional | Get/update status |
| `window:dock` | Renderer → Main | Request dock position |
| `window:close` | Renderer → Main | Close window |
