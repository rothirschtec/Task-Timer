# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GNOME Shell extension called "Task Timer" that helps users plan their work day by timing tasks. The extension is designed for GNOME Shell versions 45 and 46.

## Development Commands

Since this is a GNOME Shell extension, there are no traditional build commands. Development workflow involves:

1. **Installation/Testing**:
   ```bash
   # Install extension to user directory
   cp -r TaskTimer@rothirsch.tech ~/.local/share/gnome-shell/extensions/

   # Enable the extension
   gnome-extensions enable TaskTimer@rothirsch.tech

   # Restart GNOME Shell to apply changes
   # Press Alt+F2, type 'r' and press Enter
   ```

2. **Development/Debugging**:
   ```bash
   # View GNOME Shell logs for debugging
   journalctl -f -o cat /usr/bin/gnome-shell

   # Test in nested GNOME Shell
   dbus-run-session -- gnome-shell --nested --wayland
   ```

## Architecture

The extension follows GNOME Shell extension patterns with ES6 modules:

- **Entry Point**: `extension.js` - Main extension class that extends `Extension`

- **Core Logic**: `classes/task_timer.js` - Main TaskTimer class extending `PanelMenu.Button`

- **Task Management**: `classes/task_item.js` - Individual task representation

- **Settings**: `classes/task_settings.js` and `classes/checkbox_settings.js` - Configuration UI

- **State Management**: Uses `~/.config/TaskTimer/state.json` for persistence

### Key Components

1. **TaskTimer** (`classes/task_timer.js`): Main panel button with popup menu containing task list
2. **TaskItem** (`classes/task_item.js`): Individual task with timer functionality
3. **State Management**: Robust save/load system with backup and temp files to prevent data loss
4. **History System**: Tracks task completion by date in `_taskHistory`

## Important Implementation Details

1. **GNOME Shell 46 Compatibility**: 

   - Uses modern ES6 imports with `resource://` URLs

   - Avoids deprecated APIs

   - Proper cleanup in `disable()` method

2. **State Persistence**: 

   - Uses atomic writes with temp files

   - Automatic backup creation

   - Handles shutdown gracefully with signal handlers

3. **UI Navigation**: 

   - Pagination system for large task lists (VISIBLE_TASKS = 15)

   - Custom navigation controls instead of scrollbars

   - Up/down icons for navigation

4. **Timer System**:

   - Uses `GLib.timeout_add_seconds` for timing

   - Proper cleanup of timeouts on destroy

   - Notification system for timer completion

## File Structure

```
TaskTimer@rothirsch.tech/
├── extension.js              # Main entry point
├── metadata.json            # Extension metadata
├── stylesheet.css           # UI styling
├── classes/
│   ├── task_timer.js       # Main timer logic
│   ├── task_item.js        # Individual task handling
│   ├── task_settings.js    # Task configuration UI
│   ├── checkbox_item.js    # Checkbox task type
│   ├── checkbox_settings.js # Checkbox configuration
│   ├── timer_notification.js # Timer notifications
│   └── utils.js            # Utility functions
└── icons/                  # UI icons (PNG format)
```

## Recent Development History

### Latest Session (2025-07-08)

- **Timer Notifications**: Added `timer_notification.js` with modal dialog system for timer completion

- **Round-up Feature**: Implemented per-task round-up functionality for time tracking

  - Round-up values: Off, 5min, 10min, 15min, 30min, 60min

  - Triggered when timer stops due to screen lock/logout

  - Configuration via cycling button in task settings (gear icon)

  - Implementation in `task_item.js:377-414` (`stopWithRoundUp()` method)

  - UI configuration in `task_settings.js:248-313` (`_makeRoundUpSetting()`)

### Current Branch Status

- Branch: `feature/port_to_46`

- Uncommitted changes in: `task_item.js`, `task_settings.js`, `task_timer.js`

- Last commit: "Timer notification" (94aafd6)

### Testing Notes

- Need to test round-up cycling button functionality after logout

- Round-up feature applies automatically when timers stop due to system events

## Key Constraints

- **No Build System**: Direct JavaScript files, no compilation step

- **GNOME Shell API**: Must use official GNOME Shell APIs and patterns

- **Memory Management**: Proper cleanup of signals, timeouts, and objects

- **State Atomicity**: Critical to prevent data loss during saves
