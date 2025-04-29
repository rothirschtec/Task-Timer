// classes/task_timer.js
// Update with custom navigation controls instead of scrollbars

import GObject   from 'gi://GObject';
import St        from 'gi://St';
import Clutter   from 'gi://Clutter';
import Gio       from 'gi://Gio';
import GLib      from 'gi://GLib';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Slider    from 'resource:///org/gnome/shell/ui/slider.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import { TaskItem }     from './task_item.js';
import { CheckboxItem } from './checkbox_item.js';
import TaskSettings     from './task_settings.js';
import CheckboxSettings from './checkbox_settings.js';
import * as Utils       from './utils.js';

const PLUS_ICON = Gio.icon_new_for_string('list-add-symbolic');
const HISTORY_ICON = Gio.icon_new_for_string('document-open-recent-symbolic');
const UP_ICON = Gio.icon_new_for_string('go-up-symbolic');
const DOWN_ICON = Gio.icon_new_for_string('go-down-symbolic');

/* ~/.config/TaskTimer/state.json */
const CONFIG_DIR = GLib.build_filenamev([GLib.get_user_config_dir(), 'TaskTimer']);
const STATE_FILE = GLib.build_filenamev([CONFIG_DIR, 'state.json']);

// Set how many tasks to display at once
const VISIBLE_TASKS = 15;

export default GObject.registerClass(
class TaskTimer extends PanelMenu.Button {

    _init() {
        super._init(0.0, 'Task Timer');

        try {
            /* initialize state */
            this._tasks = [];
            this._taskHistory = {};
            this._lastDate = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
            this._tasksOffset = 0; // Initial offset in the tasks display
            
            /* load saved tasks */
            this._loadState();

            /* top‑bar label */
            this._label = new St.Label({ 
                text: '0:00 / 0:00',
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'tasktimer-time-label'
            });
            this.add_child(this._label);

            /* Add class to menu for scoped CSS */
            this.menu.actor.add_style_class_name('tasktimer-popup');
            this.menu.actor.set_width(500);

            /* Create navigation controls and task container */
            this._createTaskSectionWithNavigation();
            
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this._buildNewTaskRow();
            this._buildCheckboxRow();
            
            /* recreate tasks */
            this._updateTaskDisplay();
            this._updateIndicator();

            /* autosave */
            this._autosaveID = GLib.timeout_add_seconds(
                GLib.PRIORITY_LOW, 30,
                () => { this._saveState(); return GLib.SOURCE_CONTINUE; });
                
            // Backup timer for indicator updates (not critical now with direct updates)
            this._updateTimerID = GLib.timeout_add_seconds(
                GLib.PRIORITY_LOW, 5,
                () => { this._updateIndicator(); return GLib.SOURCE_CONTINUE; });
                
            log("TaskTimer: Initialization complete");
        } catch (e) {
            log(`TaskTimer: Error during initialization: ${e.message}`);
            
            // Fallback to basic initialization if something went wrong
            if (!this._label) {
                this._label = new St.Label({ text: '0:00 / 0:00',
                                     y_align: Clutter.ActorAlign.CENTER });
                this.add_child(this._label);
            }
            
            // Reset to empty state
            this._tasks = [];
            this._taskHistory = {};
            this._lastDate = new Date().toISOString().split('T')[0];
        }
    }

    /* Create task container with navigation buttons for scrolling */
    _createTaskSectionWithNavigation() {
        // Main container for tasks
        const navContainer = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            style_class: 'tasktimer-nav-container'
        });
        
        // Create a vertical layout for the entire section
        const mainBox = new St.BoxLayout({
            vertical: true,
            style_class: 'tasktimer-main-box'
        });
        
        // Create top navigation button if we have more than VISIBLE_TASKS
        this._upButton = new St.Button({
            style_class: 'tasktimer-nav-button',
            child: new St.Icon({ icon_name: 'go-up-symbolic' }),
            x_expand: true,
            can_focus: true,
            visible: false
        });
        
        // Show page indicator 
        this._pageIndicator = new St.Label({
            text: "1/1",
            style_class: 'tasktimer-page-indicator',
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true
        });
        
        // Top navigation bar
        const topNav = new St.BoxLayout({
            style_class: 'tasktimer-top-nav',
            x_expand: true
        });
        
        topNav.add_child(this._upButton);
        topNav.add_child(this._pageIndicator);
        
        // Create the task section that will contain currently visible tasks
        this._taskSection = new PopupMenu.PopupMenuSection();
        
        // Create bottom navigation button
        this._downButton = new St.Button({
            style_class: 'tasktimer-nav-button',
            child: new St.Icon({ icon_name: 'go-down-symbolic' }),
            x_expand: true,
            can_focus: true,
            visible: false
        });
        
        // Put everything together
        mainBox.add_child(topNav);
        mainBox.add_child(this._taskSection.actor);
        mainBox.add_child(this._downButton);
        
        navContainer.actor.add_child(mainBox);
        this.menu.addMenuItem(navContainer);
        
        // Connect navigation signals
        this._upButton.connect('clicked', () => {
            this._scrollTasksUp();
        });
        
        this._downButton.connect('clicked', () => {
            this._scrollTasksDown();
        });
        
        // Listen for task count changes
        this.connect('destroy', () => {
            // Clean up
        });
    }
    
    /* Scroll tasks upward (showing previous) */
    _scrollTasksUp() {
        if (this._tasksOffset > 0) {
            this._tasksOffset--;
            this._updateTaskDisplay();
        }
    }
    
    /* Scroll tasks downward (showing next) */
    _scrollTasksDown() {
        if (this._tasksOffset < this._tasks.length - VISIBLE_TASKS) {
            this._tasksOffset++;
            this._updateTaskDisplay();
        }
    }
    
    /* Update which tasks are displayed based on current offset */
    _updateTaskDisplay() {
        try {
            // Clear current task display
            this._taskSection.removeAll();
            
            // Determine if we need navigation
            const totalPages = Math.ceil(this._tasks.length / VISIBLE_TASKS);
            const currentPage = Math.floor(this._tasksOffset / VISIBLE_TASKS) + 1;
            
            this._pageIndicator.text = `${currentPage}/${totalPages > 0 ? totalPages : 1}`;
            
            // Show/hide navigation buttons based on position
            this._upButton.visible = this._tasksOffset > 0;
            this._downButton.visible = this._tasksOffset < this._tasks.length - VISIBLE_TASKS;
            
            // Only display VISIBLE_TASKS number of tasks starting from offset
            const visibleTasks = this._tasks.slice(this._tasksOffset, this._tasksOffset + VISIBLE_TASKS);
            
            // Display the visible tasks
            visibleTasks.forEach(task => {
                if (task.isCheckbox) {
                    this._insertCheckboxRow(task, false, false);
                } else {
                    this._insertTaskRow(task, false, false);
                }
            });
            
        } catch (e) {
            log(`TaskTimer: Error updating task display: ${e.message}`);
        }
    }

    /* ─────────── "＋ New task …" ─────────── */
    _buildNewTaskRow() {
        try {
            this._newRow = new PopupMenu.PopupSubMenuMenuItem(_('＋ New task…'), true);
            this.menu.addMenuItem(this._newRow);

            // Create a proper layout container with clear styling
            const box = new St.BoxLayout({ 
                style_class: 'tasktimer-combobox-item',
                x_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
                style: 'spacing: 8px; padding: 12px;'
            });
            
            // Ensure the text entry is properly sized and visible
            this._entry = new St.Entry({ 
                hint_text: _('Task name…'),
                style_class: 'tasktimer-new-task-entry',
                x_expand: true,
                can_focus: true
            });
            
            // Make sure slider has reasonable width and styling
            this._slider = new Slider.Slider(0);
            this._slider.actor.add_style_class_name('tasktimer-new-task-slider');
            
            // Add time input text field
            this._timeEntry = new St.Entry({
                hint_text: _('mm:ss'),
                style_class: 'tasktimer-time-entry',
                can_focus: true,
                width: 80
            });
            
            // Ensure the add button is visible and styled properly
            this._addBtn = new St.Button({ 
                child: new St.Icon({ gicon: PLUS_ICON }),
                style_class: 'tasktimer-button'
            });

            // Properly add all elements to the layout
            box.add_child(this._entry);
            
            // Create a container for time input elements
            const timeBox = new St.BoxLayout({
                style_class: 'tasktimer-time-input-box',
                y_align: Clutter.ActorAlign.CENTER
            });
            
            timeBox.add_child(new St.Label({ text: _('Time:') }));
            timeBox.add_child(this._slider.actor);
            timeBox.add_child(this._timeEntry);
            
            box.add_child(timeBox);
            box.add_child(this._addBtn);
            
            // Make sure the box is properly added to the menu
            this._newRow.menu.box.add_child(box);

            /* signals */
            this._addBtn.connect('clicked', () => this._onAdd());
            
            // Connect the slider to update the text field
            this._slider.connect('notify::value', () => {
                const m = Math.round(this._slider.value * 1440);
                this._newRow.label.text = m ? _(`＋ New task… (${m} min)`)
                                            : _('＋ New task…');
                
                // Update time entry text to match slider
                if (!this._timeEntry.has_key_focus()) {
                    const minutes = Math.floor(m);
                    const seconds = 0;
                    this._timeEntry.set_text(`${minutes}:${seconds.toString().padStart(2, '0')}`);
                }
            });
            
            // Connect time entry to update slider when text changes
            this._timeEntry.clutter_text.connect('text-changed', () => {
                const text = this._timeEntry.get_text();
                const seconds = Utils.parseTimeInput(text);
                
                if (seconds !== null) {
                    // Convert to slider value (between 0-1)
                    const minutes = seconds / 60;
                    const maxMinutes = 1440; // 24 hours
                    const newValue = Math.min(1, minutes / maxMinutes);
                    
                    // Only update if significantly different to avoid loops
                    if (Math.abs(this._slider.value - newValue) > 0.001) {
                        this._slider.value = newValue;
                        const displayMinutes = Math.round(minutes);
                        this._newRow.label.text = displayMinutes ? 
                            _(`＋ New task… (${displayMinutes} min)`) : 
                            _('＋ New task…');
                    }
                }
            });
            
            // Handle return/enter key press
            this._timeEntry.clutter_text.connect('key-press-event', (_o, e) => {
                const symbol = e.get_key_symbol();
                if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
                    this._onAdd();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
            
            // Handle return/enter key press in task name field
            this._entry.clutter_text.connect('key-press-event', (_o, e) => {
                const symbol = e.get_key_symbol();
                if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
                    this._onAdd();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
        } catch (e) {
            log(`TaskTimer: Error in _buildNewTaskRow: ${e.message}`);
        }
    }

    /* ─────────── "＋ New checklist…" ─────────── */
    _buildCheckboxRow() {
        try {
            this._checkboxRow = new PopupMenu.PopupSubMenuMenuItem(_('＋ New checklist…'), true);
            this.menu.addMenuItem(this._checkboxRow);

            // Create a better container with proper styling
            const box = new St.BoxLayout({ 
                style_class: 'tasktimer-new-task-box',
                x_expand: true,
                vertical: false,
                style: 'spacing: 12px; padding: 16px; min-height: 50px;'
            });
            
            // Make entry field larger and more visible
            this._checkEntry = new St.Entry({ 
                hint_text: _('List name…'),
                style_class: 'tasktimer-new-task-entry',
                x_expand: true,
                can_focus: true,
                style: 'min-width: 180px; margin-right: 10px;'
            });
            
            // Create a container for slider and label
            const sliderBox = new St.BoxLayout({ vertical: false });
            const boxesLabel = new St.Label({ text: _('boxes'), style: 'margin: 0 8px;' });
            
            this._checkSlider = new Slider.Slider(0);
            this._checkSlider.actor.add_style_class_name('tasktimer-new-task-slider');
            this._checkSlider.actor.set_width(200);
            
            sliderBox.add_child(boxesLabel);
            sliderBox.add_child(this._checkSlider.actor);
            
            // Style the add button
            this._checkAddBtn = new St.Button({ 
                child: new St.Icon({ gicon: PLUS_ICON }),
                style_class: 'tasktimer-button',
                style: 'margin-left: 10px;'
            });

            // Add all elements to layout in correct order
            box.add_child(this._checkEntry);
            box.add_child(sliderBox);
            box.add_child(this._checkAddBtn);
            
            this._checkboxRow.menu.box.add_child(box);

            /* signals */
            this._checkAddBtn.connect('clicked', () => this._onAddCheckbox());
            this._checkSlider.connect('notify::value', () => {
                const boxes = Math.round(this._checkSlider.value * 10) + 1;
                this._checkboxRow.label.text = boxes ? _(`＋ New checklist… (${boxes} boxes)`)
                                                : _('＋ New checklist…');
            });
        } catch (e) {
            log(`TaskTimer: Error in _buildCheckboxRow: ${e.message}`);
        }
    }

    _onAdd() {
        try {
            const name = this._entry.get_text().trim();
            
            // Get time from time entry if it has text, otherwise use slider
            let seconds;
            const timeText = this._timeEntry.get_text().trim();
            if (timeText) {
                seconds = Utils.parseTimeInput(timeText);
                if (seconds === null) {
                    // If time entry has invalid format, use slider
                    seconds = Math.round(this._slider.value * 1440) * 60;
                }
            } else {
                // Use slider value
                seconds = Math.round(this._slider.value * 1440) * 60;
            }
            
            const mins = Math.round(seconds / 60);
            if (!name || !mins) return this._flashRow();
    
            /* reset UI */
            this._entry.set_text('');
            this._slider.value = 0;
            this._timeEntry.set_text('');
            this._newRow.label.text = _('＋ New task…');
    
            // Get current day for weekdays initialization
            const today = new Date();
            const dayIndex = today.getDay();
            const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayKey = dayMap[dayIndex];
            
            // Initialize weekdays with all days at 0:00 except today
            const weekdays = {
                sunday: '0:00/0:00/0:00',
                monday: '0:00/0:00/0:00',
                tuesday: '0:00/0:00/0:00',
                wednesday: '0:00/0:00/0:00',
                thursday: '0:00/0:00/0:00',
                friday: '0:00/0:00/0:00',
                saturday: '0:00/0:00/0:00'
            };
            
            // Set planned time for today
            weekdays[dayKey] = `0:00/${Utils.convertTime(seconds)}/0:00`;
    
            const task = {
                name, 
                planned: seconds, 
                currTime: 0, 
                lastStop: 0,
                color: Utils.generateColor(), 
                running: false,
                weekdays: weekdays,
                description: _('Enter description here!'),
                createdOn: this._lastDate // Store creation date
            };
            
            // Add to the beginning of the tasks array
            this._tasks.unshift(task);
            
            // Update display and save changes
            this._tasksOffset = 0; // Reset to the top to show the new task
            this._updateTaskDisplay();
            this._updateIndicator();
            this._saveState();
            
        } catch (e) {
            log(`TaskTimer: Error in _onAdd: ${e.message}`);
        }
    }

    _onAddCheckbox() {
        try {
            const name = this._checkEntry.get_text().trim();
            const boxes = Math.round(this._checkSlider.value * 10) + 1; // 1-11 boxes
            if (!name) return this._flashCheckboxRow();

            /* reset UI */
            this._checkEntry.set_text('');
            this._checkSlider.value = 0;
            this._checkboxRow.label.text = _('＋ New checklist…');

            const task = {
                name, 
                isCheckbox: true,
                checkCount: boxes,
                checked: Array(boxes).fill(false),
                color: Utils.generateColor(),
                description: _('Enter description here!'),
                createdOn: this._lastDate // Store creation date
            };
            
            // Add to the beginning of the tasks array
            this._tasks.unshift(task);
            
            // Update display and save changes
            this._tasksOffset = 0; // Reset to the top to show the new checkbox
            this._updateTaskDisplay();
            this._saveState();
            
        } catch (e) {
            log(`TaskTimer: Error in _onAddCheckbox: ${e.message}`);
        }
    }

    _flashRow() {
        try {
            this._newRow.label.set_style('color:#f55');
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 700,
                () => { this._newRow.label.set_style(''); return GLib.SOURCE_REMOVE; });
        } catch (e) {
            log(`TaskTimer: Error in _flashRow: ${e.message}`);
        }
    }

    _flashCheckboxRow() {
        try {
            this._checkboxRow.label.set_style('color:#f55');
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 700,
                () => { this._checkboxRow.label.set_style(''); return GLib.SOURCE_REMOVE; });
        } catch (e) {
            log(`TaskTimer: Error in _flashCheckboxRow: ${e.message}`);
        }
    }

    /* ─────────── task rows ─────────── */
    _insertTaskRow(task, save, updateDisplay = true) {
        try {
            // Pass this (the TaskTimer) as the parent
            const row = new TaskItem(task, this);

            // Make absolutely sure these connections work
            row.connect('delete_signal', () => {
                log("TaskTimer: Delete signal received");
                this._deleteTask(row);
            });
            row.connect('moveUp_signal', () => {
                log("TaskTimer: MoveUp signal received");
                this._moveRow(row, -1);
            });
            row.connect('moveDown_signal', () => {
                log("TaskTimer: MoveDown signal received");
                this._moveRow(row, 1);
            });
            row.connect('update_signal', () => {
                log("TaskTimer: Update signal received");
                this._updateIndicator();
            });
            row.connect('settings_signal', () => {
                log("TaskTimer: Settings signal received");
                this._openSettings(row);
            });
            row.connect('closeSettings_signal', () => {
                log("TaskTimer: Close settings signal received");
                this._closeSettings(row);
            });

            this._taskSection.addMenuItem(row);
            
            if (save) { 
                this._updateIndicator(); 
                this._saveState(); 
                
                if (updateDisplay) {
                    this._updateTaskDisplay();
                }
            }
        } catch (e) {
            log(`TaskTimer: Error in _insertTaskRow: ${e.message}`);
        }
    }

    _insertCheckboxRow(task, save, updateDisplay = true) {
        try {
            const row = new CheckboxItem(task, this);

            row.connect('delete_signal', () => {
                log("TaskTimer: Delete checkbox item clicked");
                this._deleteTask(row);
            });
            row.connect('moveUp_signal', () => {
                log("TaskTimer: Up checkbox item clicked");
                this._moveRow(row, -1);
            });
            row.connect('moveDown_signal', () => {
                log("TaskTimer: Down checkbox item clicked");
                this._moveRow(row, 1);
            });
            row.connect('update_signal', () => this._saveState());
            // Add settings signal handlers
            row.connect('settings_signal', () => {
                log("TaskTimer: Checkbox settings signal received");
                this._openCheckboxSettings(row);
            });
            row.connect('closeSettings_signal', () => {
                log("TaskTimer: Close checkbox settings signal received");
                this._closeSettings(row);
            });

            this._taskSection.addMenuItem(row);
            
            if (save) { 
                this._saveState(); 
                
                if (updateDisplay) {
                    this._updateTaskDisplay();
                }
            }
        } catch (e) {
            log(`TaskTimer: Error in _insertCheckboxRow: ${e.message}`);
        }
    }

    _deleteTask(row) {
        try {
            if (row._settingsRow) row._settingsRow.destroy();
            row.destroy();
            
            // Find and remove task
            const index = this._tasks.indexOf(row.task);
            if (index !== -1) {
                this._tasks.splice(index, 1);
            }
            
            // Adjust offset if necessary to prevent empty display
            if (this._tasksOffset >= this._tasks.length) {
                this._tasksOffset = Math.max(0, this._tasks.length - VISIBLE_TASKS);
            }
            
            // Update display
            this._updateTaskDisplay();
            this._updateIndicator();
            this._saveState();
        } catch (e) {
            log(`TaskTimer: Error in _deleteTask: ${e.message}`);
        }
    }

    _moveRow(row, dir) {
        try {
            // Find the index of the task in the array
            const taskIndex = this._tasks.indexOf(row.task);
            if (taskIndex === -1) return;
            
            // Calculate the target index
            const targetIndex = taskIndex + dir;
            
            // Check if target is valid
            if (targetIndex < 0 || targetIndex >= this._tasks.length) return;
            
            // Move the task in the array
            const [task] = this._tasks.splice(taskIndex, 1);
            this._tasks.splice(targetIndex, 0, task);
            
            // Adjust offset if necessary
            if (this._tasksOffset > 0 && taskIndex < this._tasksOffset && targetIndex >= this._tasksOffset) {
                // Task moved out of view downward
                this._tasksOffset++;
            } else if (this._tasksOffset > 0 && taskIndex >= this._tasksOffset && targetIndex < this._tasksOffset) {
                // Task moved out of view upward
                this._tasksOffset--;
            }
            
            // Update display and save
            this._updateTaskDisplay();
            this._saveState();
        } catch (e) {
            log(`TaskTimer: Error in _moveRow: ${e.message}`);
        }
    }

    /* ─────────── per‑task settings ─────────── */
    _openSettings(row) {
        try {
            log("TaskTimer: Opening settings for " + row.task.name);
            
            /* close any other open settings pane */
            this._taskSection._getMenuItems().forEach(item => {
                if (item !== row && item._settingsRow) {
                    item._settingsRow.destroy();
                    item._settingsRow = null;
                    if (item.settingsOpen) item.settingsOpen = false;
                }
            });

            const settings = new TaskSettings(row.task, row.task.currTime);
            settings.connect('update_signal', () => {
                log("TaskTimer: Settings update signal received");
                this._updateIndicator();
                row._refreshBg(); // Make sure to update bg color if changed
                row._updateTimeLabel(); // Add this line to update the time display
            });
            
            const idx = this._taskSection._getMenuItems().indexOf(row);
            if (idx !== -1) {
                this._taskSection.addMenuItem(settings, idx + 1);
                row._settingsRow = settings;
            }
        } catch (e) {
            log(`TaskTimer: Error in _openSettings: ${e.message}`);
        }
    }
    
    _openCheckboxSettings(row) {
        try {
            log("TaskTimer: Opening checkbox settings for " + row.task.name);
            
            /* close any other open settings pane */
            this._taskSection._getMenuItems().forEach(item => {
                if (item !== row && item._settingsRow) {
                    item._settingsRow.destroy();
                    item._settingsRow = null;
                    if (item.settingsOpen) item.settingsOpen = false;
                }
            });

            // Create a simpler settings panel for checkboxes (no time settings)
            const settings = new CheckboxSettings(row.task);
            settings.connect('update_signal', () => {
                log("TaskTimer: Checkbox settings update signal received");
                row.set_style(`background-color:${row.task.color};`); // Update bg color if changed
            });

            const idx = this._taskSection._getMenuItems().indexOf(row);
            if (idx !== -1) {
                this._taskSection.addMenuItem(settings, idx + 1);
                row._settingsRow = settings;
            }
        } catch (e) {
            log(`TaskTimer: Error in _openCheckboxSettings: ${e.message}`);
        }
    }
    
    _closeSettings(row) {
        try {
            if (row._settingsRow) { 
                row._settingsRow.destroy(); 
                row._settingsRow = null; 
            }
        } catch (e) {
            log(`TaskTimer: Error in _closeSettings: ${e.message}`);
        }
    }

    /* ─────────── indicator ─────────── */
    _updateIndicator() {
        try {
            let spent = 0, planned = 0;
            this._tasks.forEach(t => { 
                // Skip checkbox items in the indicator
                if (!t.isCheckbox) {
                    spent += t.currTime; 
                    planned += t.planned;
                }
            });
            this._label.text = `${Utils.mmss(spent)} / ${Utils.mmss(planned)}`;
        } catch (e) {
            log(`TaskTimer: Error in _updateIndicator: ${e.message}`);
            // Fallback to a default value
            this._label.text = '0:00 / 0:00';
        }
    }
    
    // Direct update method that TaskItems can call
    forceUpdateNow() {
        try {
            let spent = 0, planned = 0;
            this._tasks.forEach(t => { 
                // Skip checkbox items in the indicator
                if (!t.isCheckbox) {
                    spent += t.currTime; 
                    planned += t.planned;
                }
            });
            this._label.text = `${Utils.mmss(spent)} / ${Utils.mmss(planned)}`;
            return true;
        } catch (e) {
            log(`TaskTimer: Error in forceUpdateNow: ${e.message}`);
            return false;
        }
    }

    /* ─────────── persistence ─────────── */
    _ensureDir() {
        try {
            if (!GLib.file_test(CONFIG_DIR, GLib.FileTest.IS_DIR))
                GLib.mkdir_with_parents(CONFIG_DIR, 0o700);
            return true;
        } catch (e) {
            log(`TaskTimer: Error creating directory: ${e.message}`);
            return false;
        }
    }
    
    _saveState() {
        try {
            if (!this._ensureDir()) return;
            
            // Create the data structure with dates
            const saveData = {
                lastDate: this._lastDate,
                tasks: this._tasks,
                taskHistory: this._taskHistory || {}
            };
            
            GLib.file_set_contents(STATE_FILE, JSON.stringify(saveData)); 
            log("TaskTimer: State saved successfully");
        }
        catch (e) { log(`TaskTimer: Save failed – ${e.message}`); }
    }
    
    _loadState() {
        try {
            if (!this._ensureDir()) return;
            if (!GLib.file_test(STATE_FILE, GLib.FileTest.EXISTS)) {
                log("TaskTimer: No state file exists yet");
                return;
            }
            
            const [ok, bytes] = GLib.file_get_contents(STATE_FILE);
            if (ok) {
                // First check if we can parse the file
                let data;
                try {
                    const content = imports.byteArray.toString(bytes);
                    data = JSON.parse(content);
                    log("TaskTimer: Successfully parsed state file");
                } catch (parseError) {
                    log(`TaskTimer: Failed to parse state file: ${parseError.message}`);
                    // If parsing fails, back up the corrupted file and start fresh
                    this._backupCorruptedFile();
                    return;
                }
                
                // Make sure data has the right structure
                if (!data || typeof data !== 'object') {
                    log("TaskTimer: Invalid data structure in state file");
                    return;
                }
                
                // Store historical data separately (if it exists)
                if (data.taskHistory && typeof data.taskHistory === 'object') {
                    this._taskHistory = data.taskHistory;
                } else {
                    this._taskHistory = {};
                }
                
                // Get today's date
                const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                
                // Check if data has lastDate property and it's valid
                if (data.lastDate && typeof data.lastDate === 'string' && data.tasks && Array.isArray(data.tasks)) {
                    if (data.lastDate === today) {
                        // Use today's data
                        this._tasks = data.tasks;
                        this._lastDate = today;
                        log(`TaskTimer: Loaded current day's data (${today})`);
                    } else {
                        // New day - initialize with zero values but preserve names/structures
                        this._lastDate = today;
                        
                        log(`TaskTimer: New day detected! Storing previous day (${data.lastDate}) in history`);
                        // Store previous day's data in history
                        this._taskHistory[data.lastDate] = data.tasks;
                        // Initialize new day based on previous tasks
                        this._tasks = this._initializeNewDay(data.tasks);
                        
                        // Save the state after initializing the new day
                        this._saveState();
                    }
                } else {
                    // Handle old format or invalid data
                    log("TaskTimer: Using fallback data loading (old format or invalid data)");
                    if (Array.isArray(data)) {
                        // Old format - array of tasks
                        this._tasks = data;
                    } else if (data.tasks && Array.isArray(data.tasks)) {
                        // Has tasks array but invalid lastDate
                        this._tasks = data.tasks;
                    } else {
                        // Invalid format, start fresh
                        this._tasks = [];
                    }
                    this._lastDate = today;
                }
            }
        } catch (e) { 
            log(`TaskTimer: Load failed – ${e.message}`); 
            // Reset to default values
            this._tasks = [];
            this._taskHistory = {};
            this._lastDate = new Date().toISOString().split('T')[0];
        }
    }
    
    // Backup corrupted state file
    _backupCorruptedFile() {
        try {
            const backupFile = `${STATE_FILE}.backup-${Date.now()}`;
            log(`TaskTimer: Backing up corrupted state file to ${backupFile}`);
            
            const [ok, bytes] = GLib.file_get_contents(STATE_FILE);
            if (ok) {
                GLib.file_set_contents(backupFile, bytes);
            }
        } catch (e) {
            log(`TaskTimer: Failed to backup corrupted file: ${e.message}`);
        }
    }
    
    // Initialize a new day with zeroed values
    _initializeNewDay(previousTasks) {
        try {
            log("TaskTimer: Initializing new day with reset values");
            return previousTasks.map(task => {
                // Skip invalid tasks
                if (!task || typeof task !== 'object') {
                    return null;
                }
                
                // Make a copy of the task to avoid modifying the original
                const newTask = {...task};
                
                if (task.isCheckbox) {
                    // Reset checkbox values
                    newTask.checked = Array(task.checkCount || 0).fill(false);
                    log(`TaskTimer: Reset checkboxes for "${task.name}"`);
                } else {
                    // Reset timer values but keep planned time
                    newTask.currTime = 0;
                    newTask.lastStop = 0;
                    newTask.running = false;
                    
                    // Make sure weekdays exists
                    if (!newTask.weekdays || typeof newTask.weekdays !== 'object') {
                        newTask.weekdays = {
                            sunday: '0:00/0:00/0:00',
                            monday: '0:00/0:00/0:00',
                            tuesday: '0:00/0:00/0:00',
                            wednesday: '0:00/0:00/0:00',
                            thursday: '0:00/0:00/0:00',
                            friday: '0:00/0:00/0:00',
                            saturday: '0:00/0:00/0:00'
                        };
                    }
                    
                    // Reset current day in weekdays
                    const dayIndex = new Date().getDay();
                    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    const today = dayMap[dayIndex];
                    
                    // Format: "current/planned/lastStop"
                    // Preserve the planned time from previous day
                    const plannedTime = Utils.convertTime(newTask.planned || 0);
                    newTask.weekdays[today] = `0:00/${plannedTime}/0:00`;
                    
                    log(`TaskTimer: Reset timer for "${task.name}", planned: ${plannedTime}`);
                }
                
                return newTask;
            }).filter(task => task !== null); // Remove any null tasks
        } catch (e) {
            log(`TaskTimer: Error in _initializeNewDay: ${e.message}`);
            return []; // Return empty array on error
        }
    }

    /* ─────────── cleanup ─────────── */
    disable() {
        try {
            if (this._autosaveID) {
                GLib.source_remove(this._autosaveID);
                this._autosaveID = 0;
            }
            if (this._updateTimerID) {
                GLib.source_remove(this._updateTimerID);
                this._updateTimerID = 0;
            }
            this._saveState();
            this.menu.removeAll();
        } catch (e) {
            log(`TaskTimer: Error in disable: ${e.message}`);
        }
    }
});