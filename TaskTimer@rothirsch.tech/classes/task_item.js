// classes/task_item.js
// Compatible with GNOME Shell 46 (GJS 1.78)

import GObject  from 'gi://GObject';
import St       from 'gi://St';
import Gio      from 'gi://Gio';
import GLib     from 'gi://GLib';
import Clutter  from 'gi://Clutter';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main      from 'resource:///org/gnome/shell/ui/main.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Utils   from './utils.js';
import TaskSettings from './task_settings.js';

const PLAY_ICON    = Gio.icon_new_for_string('media-playback-start-symbolic');
const PAUSE_ICON   = Gio.icon_new_for_string('media-playback-pause-symbolic');
const RESTART_ICON = Gio.icon_new_for_string('view-refresh-symbolic');
const DELETE_ICON  = Gio.icon_new_for_string('user-trash-symbolic');
const UP_ICON      = Gio.icon_new_for_string('go-up-symbolic');
const DOWN_ICON    = Gio.icon_new_for_string('go-down-symbolic');
const GEAR_ICON    = Gio.icon_new_for_string('emblem-system-symbolic');

const PROGRESS_LEN = 400;

export const TaskItem = GObject.registerClass(
{
    Signals: {
        'delete_signal':        {},
        'moveUp_signal':        {},
        'moveDown_signal':      {},
        'update_signal':        {},  // Note: No parameter expected
        'settings_signal':      {},
        'closeSettings_signal': {},
    },
},
class TaskItem extends PopupMenu.PopupBaseMenuItem {

    _init(task) {
        super._init({
            reactive: true,
            can_focus: false,
            activate: false,
            style_class: 'task-row',
        });

        // Crucial: Disable default PopupMenuItem behavior
        this._activatable = false;
        if (this._pressId) {
            this.disconnect(this._pressId);
            this._pressId = 0;
        }
        if (this._releaseId) {
            this.disconnect(this._releaseId);
            this._releaseId = 0;
        }

        this.task = task;
        this._timerId = 0;
        this.settingsOpen = false;

        // Setup UI
        this._refreshBg();
        this._buildLayout();
        this._updateTimeLabel();
        this._connectSignals();
        
        // If task was running before, restart it
        if (task.running) {
            this._play.hide();
            this._pause.show();
            this._startTimer();
        }
    }

    _buildLayout() {
        // Left side - Play/Pause
        this._play = new St.Button({
            style_class: 'task-button',
            child: new St.Icon({ gicon: PLAY_ICON }),
        });
        this._pause = new St.Button({
            style_class: 'task-button',
            child: new St.Icon({ gicon: PAUSE_ICON }),
        });
        this._pause.hide();
        
        const left = new St.BoxLayout();
        left.add_child(this._play);
        left.add_child(this._pause);
        
        // Center - Name & Time
        this._name = new St.Label({ 
            text: this.task.name,
            x_expand: true
        });
        this._timeLbl = new St.Label();
        
        // Right side - Controls
        this._restart = new St.Button({
            style_class: 'task-button',
            child: new St.Icon({ gicon: RESTART_ICON }),
        });
        this._delete = new St.Button({
            style_class: 'task-button',
            child: new St.Icon({ gicon: DELETE_ICON }),
        });
        this._up = new St.Button({
            style_class: 'task-button',
            child: new St.Icon({ gicon: UP_ICON }),
        });
        this._down = new St.Button({
            style_class: 'task-button',
            child: new St.Icon({ gicon: DOWN_ICON }),
        });
        this._gear = new St.Button({
            style_class: 'task-button',
            child: new St.Icon({ gicon: GEAR_ICON }),
        });
        
        const right = new St.BoxLayout();
        right.add_child(this._restart);
        right.add_child(this._delete);
        right.add_child(this._up);
        right.add_child(this._down);
        right.add_child(this._gear);
        
        // Add everything to the container
        this.add_child(left);
        this.add_child(this._name);
        this.add_child(this._timeLbl);
        this.add_child(right);
    }

    _connectSignals() {
        // Button signals - use traditional functions for maximum compatibility
        this._play.connect('clicked', this._onPlayClicked.bind(this));
        this._pause.connect('clicked', this._onPauseClicked.bind(this));
        this._restart.connect('clicked', this._onRestartClicked.bind(this));
        this._delete.connect('clicked', this._onDeleteClicked.bind(this));
        this._up.connect('clicked', this._onUpClicked.bind(this));
        this._down.connect('clicked', this._onDownClicked.bind(this));
        this._gear.connect('clicked', this._onGearClicked.bind(this));
    }

    _onPlayClicked() {
        log("TaskTimer: Play clicked");
        this._play.hide();
        this._pause.show();
        this.task.running = true;
        this._startTimer();
    }

    _onPauseClicked() {
        log("TaskTimer: Pause clicked");
        this._pause.hide();
        this._play.show();
        this.task.running = false;
        this._stopTimer();
    }

    _onRestartClicked() {
        log("TaskTimer: Restart clicked");
        this.task.currTime = 0;
        this._updateTimeLabel();
        this._refreshBg();
        
        if (this.task.running) {
            this._stopTimer();
            this._startTimer();
        }
    }

    _onDeleteClicked() {
        log("TaskTimer: Delete clicked");
        this.emit('delete_signal');
    }

    _onUpClicked() {
        log("TaskTimer: Up clicked");
        this.emit('moveUp_signal');
    }

    _onDownClicked() {
        log("TaskTimer: Down clicked");
        this.emit('moveDown_signal');
    }

    _onGearClicked() {
        log("TaskTimer: Gear clicked");
        this.settingsOpen = !this.settingsOpen;
        
        if (this.settingsOpen) {
            this.emit('settings_signal');
        } else {
            this.emit('closeSettings_signal');
        }
    }

    _startTimer() {
        // Stop any existing timer
        this._stopTimer();
        
        // Log for debugging
        log("TaskTimer: Starting timer");
        
        // Setup timer with traditional function for maximum compatibility
        let self = this;
        function timerCallback() {
            if (!self || !self.task || !self.task.running) {
                log("TaskTimer: Timer stopped (task no longer running)");
                return false; // Stop the timer
            }
            
            self.task.currTime++;
            self._updateTimeLabel();
            self._refreshBg();
            
            if (self.task.currTime === self.task.planned) {
                Main.notify(_('"%s" reached planned time').format(self.task.name));
            }
            
            self.emit('update_signal');
            return true; // Keep the timer running
        }
        
        // Use timeout_add_seconds for better reliability
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, timerCallback);
        log("TaskTimer: Timer started with ID " + this._timerId);
        
        // Force an initial tick
        this.task.currTime++;
        this._updateTimeLabel();
        this._refreshBg();
        this.emit('update_signal');
    }

    _stopTimer() {
        if (this._timerId) {
            log("TaskTimer: Removing timer with ID " + this._timerId);
            GLib.Source.remove(this._timerId);
            this._timerId = 0;
        }
        
        this.task.lastStop = this.task.currTime;
        this.emit('update_signal');
    }

    _updateTimeLabel() {
        this._timeLbl.text = `${Utils.mmss(this.task.currTime)} / ${Utils.convertTime(this.task.planned)}`;
        this._timeLbl.set_style(this.task.currTime > this.task.planned ? 'color:#f55' : '');
    }

    _refreshBg() {
        const frac = Math.min(1, this.task.currTime / this.task.planned);
        const px = Math.floor(frac * PROGRESS_LEN);
        this.set_style(`background-color:${this.task.color};
                        background-image:url('icons/progress_bar.png');
                        background-position:${px}px 0;
                        background-repeat:no-repeat;`);
    }

    destroy() {
        this._stopTimer();
        super.destroy();
    }
});
