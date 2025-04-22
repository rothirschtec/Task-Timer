// Task Timer implementation
const Main = imports.ui.main;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Shell = imports.gi.Shell;

// Extension utilities
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Import our other classes
const TaskItem = Me.imports.classes.task_item;
const Utils = Me.imports.classes.utils;
const task_settings = Me.imports.classes.task_settings;

// Icons
const ADD_ICON = Gio.icon_new_for_string(Me.path + "/icons/add_icon.png");

// Constants
const KEY_RETURN = 65293;
const KEY_ENTER = 65421;

// TaskTimer constructor
function TaskTimer() {
    this.next_id = 0;
    this._init();
}

// TaskTimer prototype
TaskTimer.prototype = {
    __proto__: PanelMenu.Button.prototype,

    _init: function() {
        // Initialize config directory
        this.dirPath = GLib.get_home_dir() + "/.config/TaskTimer/";
        if (!GLib.file_test(this.dirPath, GLib.FileTest.EXISTS)) {
            GLib.mkdir_with_parents(this.dirPath, 511);
        }
        
        this.saveFile = this.dirPath + "saveFile.json";
        this._load();
        
        // Initialize PanelMenu.Button with 0 as menu alignment and "task-timer" as name
        PanelMenu.Button.prototype._init.call(this, 0.0, "task-timer");
        
        // Create the label for the panel
        this.buttonText = new St.Label({y_align: Clutter.ActorAlign.CENTER});
        this.buttonText.text = Utils.convertTime(this.currTime) + ' / ' + Utils.convertTime(this.totalTime);
        this.buttonText.set_style("text-align:center;");
        this.add_child(this.buttonText);
        
        // Create main layout container
        this.mainBox = new St.BoxLayout({vertical: true});
        
        // Create task box section
        let taskBox = new PopupMenu.PopupMenuSection('taskBox');
        taskBox.actor.add_style_class_name("task-box");
        taskBox.one = false;
        
        // Custom submenu handler
        taskBox._setOpenedSubMenu = function(subMenu) {
            if(taskBox.one) return;
            taskBox.one = true;

            for (let i = 0; i < taskBox._getMenuItems().length; i++) {
                let item = taskBox._getMenuItems()[i];
                if (item.menu) {
                    item.menu.close();
                }
            }
            
            if (subMenu != null) {
                subMenu.open();
            }
            taskBox.one = false;
        };
        
        this.taskBox = taskBox;

        // Create scrollview for tasks
        let scrollView = new St.ScrollView({
            style_class: 'vfade',
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
        });
        
        scrollView.add_actor(this.taskBox.actor);
        this.mainBox.add_actor(scrollView);
        
        // Add separator
        let separator = new PopupMenu.PopupSeparatorMenuItem();
        this.mainBox.add_actor(separator.actor);
        
        // Create new task entry
        this.newTask = new St.Entry({
            name: "newTask",
            hint_text: _("Name..."),
            track_hover: true,
            can_focus: true
        });
        
        this.newTask.add_style_class_name("new-task-entry");
        let taskText = this.newTask.clutter_text;
        taskText.set_max_length(50);
        
        // Key press handler for task entry
        let that = this; // Store reference to this for callbacks
        taskText.connect('key-press-event', function(o, e) {
            let symbol = e.get_key_symbol();
            if (symbol == KEY_RETURN || symbol == KEY_ENTER) {
                if (that.time != 0 && !isNaN(that.time)) {
                    that._create_task(o.get_text());
                    taskText.set_text('');
                    that.btn_add.show();
                    that.newTaskSection.actor.hide();
                }
            }
        });
        
        // Add button
        this.btn_add = new St.Button({label: "", track_hover: true});
        let icon = new St.Icon({icon_size: 30, gicon: ADD_ICON});
        this.btn_add.add_actor(icon);
        
        // New task section
        this.newTaskSection = new PopupMenu.PopupMenuSection();
        this.timeHeader = new St.Button({
            label: _("New Task"), 
            track_hover: true, 
            y_align: Clutter.ActorAlign.CENTER
        });
        
        this.timeHeader.add_style_class_name("new-task-header");
        
        let self = this; // Another reference for callbacks
        this.timeHeader.connect('clicked', function() {
            self._onNewTaskClose();
        });
        
        // Task entry container
        this.newTaskBox = new St.BoxLayout({vertical: false});
        
        // Time label
        this.timeLabel = new St.Label({
            text: _("0:00"), 
            y_align: Clutter.ActorAlign.CENTER
        });
        
        this.timeLabel.add_style_class_name("time-label");
        this.timeSlider = new Slider.Slider(0);
        this.timeSlider.actor.add_style_class_name("new-task-slider");
        
        // Slider value change handler
        this.timeSlider.connect('value-changed', function(slider, value) {
            self._onSliderValueChange(slider, value);
        });
        
        // Enter button
        this.btn_enter = new St.Button({label: ""});
        this.btn_enter.add_style_class_name("enter-button");
        
        this.btn_enter.connect("clicked", function() {
            self._onEnterClicked();
        });
        
        icon = new St.Icon({icon_size: 20, gicon: ADD_ICON});
        this.btn_enter.add_actor(icon);
        
        // Add all elements to containers
        this.newTaskBox.add_actor(this.timeLabel);
        this.newTaskBox.add_actor(this.newTask);
        this.newTaskBox.add_actor(this.btn_enter);
        
        this.mainBox.add_actor(this.btn_add);
        
        this.btn_add.connect('clicked', function() {
            self._onAddClicked();
        });
        
        this.newTaskSection.actor.add_actor(this.timeHeader);
        this.newTaskSection.actor.add_actor(this.timeSlider.actor);
        this.newTaskSection.actor.add_actor(this.newTaskBox);
        this.newTaskSection.actor.add_style_class_name("new-task-box");
        this.newTaskSection.actor.hide();
        
        this.mainBox.add_actor(this.newTaskSection.actor);
        this.menu.box.add(this.mainBox);
        
        // Add existing tasks
        for (let id in this.listOfTasks) {
            this._add_task(this.listOfTasks[id]);
        }
    },

    // Button handlers
    _onAddClicked: function() {
        this.btn_add.hide();
        this.newTaskSection.actor.show();
    },

    _onNewTaskClose: function() {
        this.btn_add.show();
        this.newTaskSection.actor.hide();
    },

    _onEnterClicked: function() {
        if (this.time != 0 && this.newTask.get_text() != "") {
            this._create_task(this.newTask.get_text());
            this.newTask.set_text("");
            this.btn_add.show();
            this.newTaskSection.actor.hide();
        } else if (this.time == 0 && this.newTask.get_text() == "") {
            Main.notify(_("Please specify time and name"));
        } else if (this.time == 0) {
            Main.notify(_("Please specify a time"));
        } else if (this.newTask.get_text() == "") {
            Main.notify(_("Please enter a name"));
        }
    },

    _onSliderValueChange: function(slider, value) {
        this.time = Math.floor(Math.floor(value * (1440 - this.totalTime / 60)) / 5) * 5;
        let hours = (Math.floor(this.time / 60.0));
        let minutes = this.time - (60 * hours);
        hours = hours.toString();
        if (minutes < 10) minutes = "0" + minutes.toString(); else minutes = minutes.toString();
        this.timeLabel.text = hours + ":" + minutes;
    },

    // Task management
    _create_task: function(text) {
        if (text == '' || text == '\n') return;
        
        let id = this.next_id;
        let color = Utils.generate_color();
        let weekdays = {
            "sunday": "0:00/0:00",
            "monday": "0:00/0:00",
            "tuesday": "0:00/0:00",
            "wednesday": "0:00/0:00",
            "thursday": "0:00/0:00",
            "friday": "0:00/0:00",
            "saturday": "0:00/0:00"
        };
        
        weekdays = Utils.updateWeeklyTimes(weekdays, (new Date()).getDay(), 0, this.time * 60);
        
        let task = {
            "id": id,
            "name": text,
            "description": "Enter description here!",
            "time": this.time * 60,
            "currTime": 0,
            "lastStop": 0,
            "color": color,
            "running": false,
            "dateTime": new Date(),
            "weekdays": weekdays
        };
        
        this.listOfTasks[id] = task;
        this.next_id += 1;
        this.totalTime += this.time * 60;
        this._save();
        this.buttonText.text = Utils.convertTime(this.currTime) + " / " + Utils.convertTime(this.totalTime);
        this._add_task(task);
    },

    _add_task: function(task) {
        let item = new TaskItem.Task(task);
        this.taskBox.addMenuItem(item);
        this.timeSlider._moveHandle(0, 0);
        
        let self = this;
        
        item.connect('delete_signal', function(o, task) {
            self._delete_task(o, task);
        });
        
        item.connect('update_signal', function(o, task) {
            self._update_task(o, task);
        });
        
        item.connect('stop_signal', function(o, task) {
            self._stop_all_but_current(o, task);
        });
        
        item.connect('settings_signal', function(o, task) {
            self._settings(o, task);
        });
        
        item.connect('closeSettings_signal', function(o, task) {
            self._closeSettings(o, task);
        });
        
        item.connect('moveUp_signal', function(o, task) {
            self._moveTaskUp(o, task);
        });
        
        item.connect('moveDown_signal', function(o, task) {
            self._moveTaskDown(o, task);
        });
        
        if (task.running) {
            item.task.running = false;
            item._startStop();
        }
    },

    // Settings handlers
    _settings: function(o, task) {
        for (let i = 0; i < this.taskBox._getMenuItems().length; i++) {
            let item = this.taskBox._getMenuItems()[i];
            if (item.task && item.task.id != task.id && item.settingsOpen) {
                item._openCloseSettings();
            }
        }
        
        this.btn_add.hide();
        this.newTaskSection.actor.hide();
        let i = 1;
        let spentTime = 0;
        
        for (let id in this.listOfTasks) {
            if (id != task.id) {
                if (this.listOfTasks[id].currTime > this.listOfTasks[id].time) {
                    spentTime += this.listOfTasks[id].currTime;
                } else {
                    spentTime += this.listOfTasks[id].time;
                }
            }
        }
        
        for (let i = 0; i < this.taskBox._getMenuItems().length; i++) {
            let item = this.taskBox._getMenuItems()[i];
            if (item.task && item.task.id == task.id) {
                this.taskSettings = new task_settings.TaskSettings(task, spentTime);
                
                let self = this;
                this.taskSettings.connect('update_signal', function(o, task) {
                    self._update_from_settings(o, task);
                });
                
                this.taskBox.addMenuItem(this.taskSettings, i + 1);
                break;
            }
        }
    },

    _closeSettings: function(o, task) {
        if (this.taskSettings != null) {
            // GJS doesn't like disconnect() with signals, so we use disconnectAll()
            if (this.taskSettings.disconnectAll) {
                this.taskSettings.disconnectAll();
            } else if (this.taskSettings.actor && this.taskSettings.actor.disconnect) {
                // Try to disconnect the specific signal
                try {
                    let signals = this.taskSettings.actor.get_signal_ids();
                    for (let i = 0; i < signals.length; i++) {
                        if (signals[i].name === 'update_signal') {
                            this.taskSettings.actor.disconnect(signals[i].id);
                        }
                    }
                } catch (e) {
                    // If that fails, just destroy the widget
                    log("Error disconnecting signal: " + e.message);
                }
            }
            
            this.taskSettings.destroy();
            this.btn_add.show();
        }
    },

    // Task list navigation
    _moveTaskUp: function(o, task) {
        let taskIndex = -1;
        let settingsIndex = -1;
        
        // Find task and settings indices
        for (let i = 0; i < this.taskBox._getMenuItems().length; i++) {
            let item = this.taskBox._getMenuItems()[i];
            if (item.task && item.task.id === task.id) {
                taskIndex = i;
            } else if (this.taskSettings && item === this.taskSettings) {
                settingsIndex = i;
            }
        }
        
        // Move task and its settings up if possible
        if (taskIndex > 0 && settingsIndex > 0) {
            this.taskBox.moveMenuItem(this.taskSettings, settingsIndex - 1);
            this.taskBox.moveMenuItem(this.taskBox._getMenuItems()[taskIndex], taskIndex - 1);
            this._updateList();
        }
    },

    _moveTaskDown: function(o, task) {
        let taskIndex = -1;
        
        // Find task index
        for (let i = 0; i < this.taskBox._getMenuItems().length; i++) {
            let item = this.taskBox._getMenuItems()[i];
            if (item.task && item.task.id === task.id) {
                taskIndex = i;
                break;
            }
        }
        
        // Move task and its settings down if possible
        if (taskIndex >= 0 && taskIndex < this.taskBox._getMenuItems().length - 2) {
            this.taskBox.moveMenuItem(this.taskBox._getMenuItems()[taskIndex], taskIndex + 2);
            if (this.taskSettings) {
                this.taskBox.moveMenuItem(this.taskSettings, taskIndex + 2);
            }
            this._updateList();
        }
    },

    _updateList: function() {
        // Clear task list
        let newList = {};
        let i = 0;
        
        // Rebuild task list with new order
        for (let j = 0; j < this.taskBox._getMenuItems().length; j++) {
            let item = this.taskBox._getMenuItems()[j];
            if (item.isTask) {
                item.task.id = i;
                newList[i] = item.task;
                i++;
            }
        }
        
        this.listOfTasks = newList;
        this._save();
    },

    // Task control
    _stop_all_but_current: function(o, task) {
        for (let i = 0; i < this.taskBox._getMenuItems().length; i++) {
            let item = this.taskBox._getMenuItems()[i];
            if (item.task && item.task.running && item.task.id != task.id) {
                item._startStop();
            }
        }
    },

    _delete_task: function(o, task) {
        this._closeSettings();
        delete this.listOfTasks[task.id];
        this._save();
        
        this.currTime = 0;
        this.totalTime = 0;
        
        for (let id in this.listOfTasks) {
            this.currTime += this.listOfTasks[id].currTime;
            this.totalTime += this.listOfTasks[id].time;
        }
        
        this.buttonText.text = Utils.convertTime(this.currTime) + " / " + Utils.convertTime(this.totalTime);
    },

    _update_task: function(o, task) {
        this.listOfTasks[task.id] = task;
        this._save();
        
        this.currTime = 0;
        for (let id in this.listOfTasks) {
            this.currTime += this.listOfTasks[id].currTime;
        }
        
        this.buttonText.text = Utils.convertTime(this.currTime) + " / " + Utils.convertTime(this.totalTime);
    },

    _update_from_settings: function(o, task) {
        this.listOfTasks[task.id] = task;
        this._save();
        
        for (let i = 0; i < this.taskBox._getMenuItems().length; i++) {
            let item = this.taskBox._getMenuItems()[i];
            if (item.task && item.task.id == task.id) {
                item._update(false);
                break;
            }
        }
        
        this.currTime = 0;
        for (let id in this.listOfTasks) {
            this.currTime += this.listOfTasks[id].currTime;
        }
        
        this.buttonText.text = Utils.convertTime(this.currTime) + " / " + Utils.convertTime(this.totalTime);
    },

    // Persistence
    _save: function() {
        let file = Gio.file_new_for_path(this.saveFile);
        let out = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
        Shell.write_string_to_stream(out, JSON.stringify(this.listOfTasks));
        out.close(null);
    },

    _load: function() {
        if (!GLib.file_test(this.saveFile, GLib.FileTest.EXISTS))
            GLib.file_set_contents(this.saveFile, "{}");

        let content = Shell.get_file_contents_utf8_sync(this.saveFile);
        this.listOfTasks = JSON.parse(content);

        this.next_id = 0;
        this.totalTime = 0;
        this.currTime = 0;
        
        for (let id in this.listOfTasks) {
            this.next_id = Math.max(this.next_id, parseInt(id));
            
            if (Utils.isSameDay(new Date(this.listOfTasks[id].dateTime))) {
                if (this.listOfTasks[id].running) {
                    let elapsedTime = Utils.elapsedTimeInSeconds(new Date(this.listOfTasks[id].dateTime));
                    this.listOfTasks[id].currTime += elapsedTime;
                }
            } else {
                this.listOfTasks[id].currTime = 0;
                this.listOfTasks[id].running = false;
                this.listOfTasks[id].lastStop = 0;
                
                if (Utils.isNewWeek(new Date(this.listOfTasks[id].dateTime))) {
                    this.listOfTasks[id].weekdays = {
                        "sunday": "0:00/0:00",
                        "monday": "0:00/0:00",
                        "tuesday": "0:00/0:00",
                        "wednesday": "0:00/0:00",
                        "thursday": "0:00/0:00",
                        "friday": "0:00/0:00",
                        "saturday": "0:00/0:00"
                    };
                }
            }
            
            this.totalTime += this.listOfTasks[id].time;
            this.currTime += this.listOfTasks[id].currTime;
        }
        
        this.next_id++;
    },

    // Cleanup
    disable: function() {
        for (let i = 0; i < this.taskBox._getMenuItems().length; i++) {
            let task = this.taskBox._getMenuItems()[i];
            if (task.destroy) {
                try {
                    task.destroy();
                } catch (e) {
                    log("Error destroying task: " + e.message);
                }
            }
        }
        
        this.taskBox.removeAll();
    }
};
