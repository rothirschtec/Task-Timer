/* GNOME 46 entry‑point — exports default class */

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main                   from 'resource:///org/gnome/shell/ui/main.js';
import TaskTimer                   from './classes/task_timer.js';

export default class TaskTimerExtension extends Extension {
    enable()  {
        this._indicator = new TaskTimer();
        
        // Make sure the history structure exists
        this._indicator._taskHistory = this._indicator._taskHistory || {};
        
        // Ensure we have the current date
        const today = new Date().toISOString().split('T')[0];
        this._indicator._lastDate = this._indicator._lastDate || today;
        
        Main.panel.addToStatusArea('task-timer', this._indicator);
    }
    
    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
