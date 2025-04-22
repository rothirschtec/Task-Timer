// GNOME Shell extension code
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;

// Global variable to store our extension instance
let taskTimer;

function init() {
    // No initialization needed
}

function enable() {
    try {
        // Directly import the task_timer module to avoid modern import syntax
        const Me = ExtensionUtils.getCurrentExtension();
        const task_timer = Me.imports.classes.task_timer;
        
        // Create a new instance of TaskTimer
        taskTimer = new task_timer.TaskTimer();
        
        // Add it to the panel
        Main.panel.addToStatusArea('taskTimer', taskTimer);
    } catch (e) {
        log('Task Timer: Error enabling extension: ' + e.message);
        logError(e);
    }
}

function disable() {
    try {
        if (taskTimer) {
            taskTimer.disable();
            taskTimer.destroy();
            taskTimer = null;
        }
    } catch (e) {
        log('Task Timer: Error disabling extension: ' + e.message);
        logError(e);
    }
}
