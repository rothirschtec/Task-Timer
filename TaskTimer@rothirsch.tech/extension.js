/* extension.js — GNOME 45/46 compliant */

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main                   from 'resource:///org/gnome/shell/ui/main.js';

import TaskTimer from './classes/task_timer.js';

export default class TaskTimerExtension extends Extension {
    enable()  {
        this._indicator = new TaskTimer();
        Main.panel.addToStatusArea('task‑timer', this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}

