// Task item implementation
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;

// Extension utilities
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Import our other classes
const Utils = Me.imports.classes.utils;

// Icons
const CLOSE_ICON = Gio.icon_new_for_string(Me.path + "/icons/close_icon.png");
const PLAY_ICON = Gio.icon_new_for_string(Me.path + "/icons/play_icon.png");
const PAUSE_ICON = Gio.icon_new_for_string(Me.path + "/icons/pause_icon.png");
const RESTART_ICON = Gio.icon_new_for_string(Me.path + "/icons/restart_icon.png");
const SETTINGS_ICON = Gio.icon_new_for_string(Me.path + "/icons/settings_icon.png");
const UP_ICON = Gio.icon_new_for_string(Me.path + "/icons/up_icon.png");
const DOWN_ICON = Gio.icon_new_for_string(Me.path + "/icons/down_icon.png");

// Constants
const PROGRESS_BAR_LENGTH = 400;

// Task constructor
function Task(task) {
    this._init(task);
}

// Task prototype
Task.prototype = {
    __proto__: PopupMenu.PopupMenuItem.prototype,
    
    _init: function(task) {
        this.task = task;
        this.isTask = true;
        this.settingsOpen = false;
        
        // Call parent constructor
        PopupMenu.PopupMenuItem.prototype._init.call(this, this.task.name, {});
        
        // Style the item
        this.actor.add_style_class_name("task");
        this.label.add_style_class_name("label");
        
        // Add duration label
        this.durationLabel = new St.Label();
        this.durationLabel.add_style_class_name("durationLabel");
        this.durationLabel.text = Utils.convertTime(this.task.lastStop) + " / " + Utils.convertTime(this.task.currTime) + " / " + Utils.convertTime(this.task.time);
        this.actor.add_actor(this.durationLabel);
        
        // Set up progress bar style
        var pixels = Math.floor((this.task.currTime / this.task.time) * PROGRESS_BAR_LENGTH);
        this.actor.set_style('background-color:' + this.task.color + '; background-position:' + pixels + 'px 0px;');
        this.connections = [];

        // Set up button box
        this.buttonBox = new St.BoxLayout({vertical: false});
        this.buttonBox.add_style_class_name("button-box");
        
        // Delete button
        this.btn_delete = new St.Button({style_class: 'delete_button', label: ''});
        let icon = new St.Icon({icon_size: 12, gicon: CLOSE_ICON, style_class: 'task-buttons'});
        this.btn_delete.add_actor(icon);
        
        // Play button
        this.btn_play = new St.Button({label: ""});
        icon = new St.Icon({icon_size: 12, gicon: PLAY_ICON, style_class: 'task-buttons'});
        this.btn_play.add_actor(icon);
        
        // Pause button
        this.btn_pause = new St.Button({label: ""});
        icon = new St.Icon({icon_size: 12, gicon: PAUSE_ICON, style_class: 'task-buttons'});
        this.btn_pause.add_actor(icon);
        
        // Restart button
        this.btn_restart = new St.Button({label: ""});
        icon = new St.Icon({icon_size: 12, gicon: RESTART_ICON, style_class: 'task-buttons'});
        this.btn_restart.add_actor(icon);
        
        // Settings button
        this.btn_settings = new St.Button({label: ""});
        icon = new St.Icon({icon_size: 12, gicon: SETTINGS_ICON, style_class: 'task-buttons'});
        this.btn_settings.add_actor(icon);
        
        // Up button
        this.btn_up = new St.Button({label: ""});
        icon = new St.Icon({gicon: UP_ICON, style_class: 'move-buttons'});
        this.btn_up.add_actor(icon);
        
        // Down button
        this.btn_down = new St.Button({label: ""});
        icon = new St.Icon({gicon: DOWN_ICON, style_class: 'move-buttons'});
        this.btn_down.add_actor(icon);
        
        // Move box (contains up/down buttons)
        this.moveBox = new St.BoxLayout({vertical: true});
        this.moveBox.add_style_class_name("move-box");
        this.moveBox.add_actor(this.btn_up);
        this.moveBox.add_actor(this.btn_down);
        
        // Add all buttons to button box
        this.buttonBox.add_actor(this.btn_play);
        this.buttonBox.add_actor(this.btn_pause);
        this.buttonBox.add_actor(this.btn_restart);
        this.buttonBox.add_actor(this.btn_delete);
        this.buttonBox.add_actor(this.moveBox);
        this.buttonBox.add_actor(this.btn_settings);
        
        // Add button box to task item
        this.actor.add_actor(this.buttonBox);
        
        // Initially hide some buttons
        this.btn_pause.hide();
        this.btn_delete.hide();
        this.moveBox.hide();

        // Create reference for callbacks
        let self = this;
        
        // Connect button signals
        let conn = this.btn_delete.connect('clicked', function() {
            self._delete_task();
        });
        this.connections.push([this.btn_delete, conn]);
        
        conn = this.btn_play.connect("clicked", function() {
            self._startStop();
        });
        this.connections.push([this.btn_play, conn]);
        
        conn = this.btn_pause.connect("clicked", function() {
            self._startStop();
        });
        this.connections.push([this.btn_pause, conn]);
        
        conn = this.btn_restart.connect("clicked", function() {
            self._restart();
        });
        this.connections.push([this.btn_restart, conn]);
        
        conn = this.btn_settings.connect("clicked", function() {
            self._openCloseSettings();
        });
        this.connections.push([this.btn_settings, conn]);
        
        conn = this.btn_up.connect("clicked", function() {
            self._moveUp();
        });
        this.connections.push([this.btn_up, conn]);
        
        conn = this.btn_down.connect("clicked", function() {
            self._moveDown();
        });
        this.connections.push([this.btn_down, conn]);
    },

    // Update task timer display
    _update: function(loop = true) {
        var duration = this.task.time;
        this.task.currTime = this.task.currTime + 1;
        this.task.dateTime = new Date();
        this.task.weekdays = Utils.updateWeeklyTimes(this.task.weekdays, (new Date()).getDay(), this.task.currTime, this.task.time, this.task.lastStop);
        this.emit('update_signal', this.task);
        this.durationLabel.text = Utils.convertTime(this.task.lastStop) + " / " + Utils.convertTime(this.task.currTime) + " / " + Utils.convertTime(this.task.time);

        // Check time limit
        if (this.task.currTime == duration) {
            Main.notify("Time limit of " + this.task.name + " reached!");
        } else if (this.task.currTime > duration) {
            // Flash when over limit
            if (this.task.currTime % 2 == 0) {
                this.actor.set_style('background-color:' + this.task.color + '; background-position: 400px 0px;');
            } else {
                this.actor.set_style('background-position: 400px 0px;');
            }
        } else {
            // Update progress bar
            var pixels = Math.floor((this.task.currTime / duration) * PROGRESS_BAR_LENGTH);
            this.actor.set_style('background-color:' + this.task.color + '; background-position:' + pixels + 'px 0px;');
        }
        
        // Set up timer for next update if needed
        if (loop) {
            let self = this;
            this._time_count_id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, function() {
                self._update();
                return false; // Only run once
            });
        }
    },

    // Start or stop the timer
    _startStop: function() {
        this.task.running = !this.task.running;
        
        if (this.task.running) {
            this.btn_play.hide();
            this.btn_pause.show();
            this.emit('stop_signal', this.task);
            this._update();
        } else {
            if (this.task.currTime > this.task.time) {
                this.actor.set_style('background-color:' + this.task.color + '; background-position: 400px 0px;');
            }
            
            this.task.lastStop = this.task.currTime;
            this.task.weekdays = Utils.updateWeeklyTimes(this.task.weekdays, (new Date()).getDay(), this.task.currTime, this.task.time, this.task.lastStop);
            this.durationLabel.text = Utils.convertTime(this.task.lastStop) + " / " + Utils.convertTime(this.task.currTime) + " / " + Utils.convertTime(this.task.time);
            this.btn_play.show();
            this.btn_pause.hide();
            this.emit('update_signal', this.task);
            
            if (this._time_count_id) {
                GLib.source_remove(this._time_count_id);
                this._time_count_id = 0;
            }
        }
    },

    // Reset timer
    _restart: function() {
        this.task.currTime = 0;
        this.task.running = false;
        
        if (this._time_count_id) {
            GLib.source_remove(this._time_count_id);
            this._time_count_id = 0;
        }
        
        this._startStop();
    },

    // Move task up in list
    _moveUp: function() {
        this.emit('moveUp_signal', this.task);
    },

    // Move task down in list
    _moveDown: function() {
        this.emit('moveDown_signal', this.task);
    },

    // Toggle settings view
    _openCloseSettings: function() {
        if (this.settingsOpen) {
            this.emit('closeSettings_signal', this.task);
            this.btn_delete.hide();
            this.moveBox.hide();
            this.btn_restart.show();
            this.btn_play.show();
        } else {
            if (this.task.running) {
                this._startStop();
            }
            
            this.emit('settings_signal', this.task);
            this.moveBox.show();
            this.btn_play.hide();
            this.btn_pause.hide();
            this.btn_restart.hide();
            this.btn_delete.show();
        }
        
        this.settingsOpen = !this.settingsOpen;
    },

    // Clean up
    destroy: function() {
        if (this._time_count_id) {
            GLib.source_remove(this._time_count_id);
            this._time_count_id = 0;
        }
        
        for (let i = 0; i < this.connections.length; i++) {
            let connection = this.connections[i];
            if (connection[0] && connection[1]) {
                try {
                    connection[0].disconnect(connection[1]);
                } catch (e) {
                    // Handle disconnection errors
                    log("Failed to disconnect signal: " + e.message);
                }
            }
        }
        
        this.connections = null;
        
        // Destroy the actor
        if (this.actor) {
            this.actor.destroy();
        }
    },

    // Delete task
    _delete_task: function() {
        this.emit('delete_signal', this.task);
        this.destroy();
    }
};
