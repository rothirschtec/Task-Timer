# Task Timer Extension - GNOME Shell 46.0 Update

## Files to Update

1. `metadata.json` - Update to include GNOME Shell 46.0
2. `extension.js` - Simplified to avoid import issues
3. `classes/task_timer.js` - Completely rewritten for compatibility
4. `classes/task_item.js` - Completely rewritten for compatibility

## Installation Steps

1. Backup your current extension:
   ```bash
   cp -r ~/.local/share/gnome-shell/extensions/TaskTimer@rothirsch.tech ~/TaskTimer-backup
   ```

2. Replace the files with the updated versions:
   ```bash
   cp metadata.json ~/.local/share/gnome-shell/extensions/TaskTimer@rothirsch.tech/
   cp extension.js ~/.local/share/gnome-shell/extensions/TaskTimer@rothirsch.tech/
   cp task_timer.js ~/.local/share/gnome-shell/extensions/TaskTimer@rothirsch.tech/classes/
   cp task_item.js ~/.local/share/gnome-shell/extensions/TaskTimer@rothirsch.tech/classes/
   ```

3. Restart GNOME Shell:

   - Press Alt+F2

   - Type 'r' and press Enter

4. Enable the extension:
   ```bash
   gnome-extensions enable TaskTimer@rothirsch.tech
   ```

## Key Changes Made

1. **Avoid Modern JavaScript Features**

   - No arrow functions

   - No ES6 imports/exports

   - Traditional callback approach

2. **Improved Signal Handling**

   - More robust connect/disconnect pattern

   - Better cleanup on destroy

3. **Timer Implementation Updates**

   - Using GLib.timeout_add_seconds without the 'import' syntax

   - Properly removing timeouts when not needed

4. **Compatibility with GNOME Shell 46.0**

   - Updated API usage patterns

   - Better widget initialization

## Troubleshooting

If issues persist, check the GNOME Shell logs:

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

You can also test the extension in a nested GNOME Shell:

```bash
dbus-run-session -- gnome-shell --nested --wayland
```
