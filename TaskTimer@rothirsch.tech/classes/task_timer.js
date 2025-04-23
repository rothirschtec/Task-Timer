// classes/task_timer.js
//
// Status‑area indicator, task list & JSON persistence – fixed for
// event handling and settings panes on GNOME Shell 46 (GJS 1.78).
// Updated with daily data storage and reset functionality.

import GObject   from 'gi://GObject';
import St        from 'gi://St';
import Clutter   from 'gi://Clutter';
import Gio       from 'gi://Gio';
import GLib      from 'gi://GLib';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Slider    from 'resource:///org/gnome/shell/ui/slider.js';
import * as Dialog    from 'resource:///org/gnome/shell/ui/dialog.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import { TaskItem }     from './task_item.js';
import { CheckboxItem } from './checkbox_item.js';
import TaskSettings     from './task_settings.js';
import CheckboxSettings from './checkbox_settings.js';
import * as Utils       from './utils.js';

const PLUS_ICON = Gio.icon_new_for_string('list-add-symbolic');
const HISTORY_ICON = Gio.icon_new_for_string('document-open-recent-symbolic');

/* ~/.config/TaskTimer/state.json */
const CONFIG_DIR = GLib.build_filenamev([GLib.get_user_config_dir(), 'TaskTimer']);
const STATE_FILE = GLib.build_filenamev([CONFIG_DIR, 'state.json']);

export default GObject.registerClass(
class TaskTimer extends PanelMenu.Button {

    _init() {
        super._init(0.0, 'Task Timer');

        /* initialize state */
        this._tasks = [];
        this._taskHistory = {};
        this._lastDate = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
        
        /* load saved tasks */
        this._loadState();

        /* top‑bar label */
        this._label = new St.Label({ text: '0:00 / 0:00',
                                     y_align: Clutter.ActorAlign.CENTER });
        this.add_child(this._label);

        /* popup layout */
        this._taskSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._taskSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._buildNewTaskRow();
        this._buildCheckboxRow();
        this._buildHistoryMenu();

        /* recreate tasks */
        this._tasks.forEach(t => {
            if (t.isCheckbox) {
                this._insertCheckboxRow(t, false);
            } else {
                this._insertTaskRow(t, false);
            }
        });
        this._updateIndicator();

        /* autosave */
        this._autosaveID = GLib.timeout_add_seconds(
            GLib.PRIORITY_LOW, 30,
            () => { this._saveState(); return GLib.SOURCE_CONTINUE; });
            
        // Backup timer for indicator updates (not critical now with direct updates)
        this._updateTimerID = GLib.timeout_add_seconds(
            GLib.PRIORITY_LOW, 5,
            () => { this._updateIndicator(); return GLib.SOURCE_CONTINUE; });
    }

    /* ─────────── "＋ New task …" ─────────── */
    _buildNewTaskRow() {
        this._newRow = new PopupMenu.PopupSubMenuMenuItem(_('＋ New task…'), true);
        this.menu.addMenuItem(this._newRow);

        // Create a proper layout container with clear styling
        const box = new St.BoxLayout({ 
            style_class: 'popup-combobox-item',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'spacing: 8px; padding: 12px;'
        });
        
        // Ensure the text entry is properly sized and visible
        this._entry = new St.Entry({ 
            hint_text: _('Task name…'),
            style_class: 'popup-menu-item',
            x_expand: true,
            can_focus: true
        });
        
        // Make sure slider has reasonable width and styling
        this._slider = new Slider.Slider(0);
        this._slider.actor.set_width(200);
        
        // Ensure the add button is visible and styled properly
        this._addBtn = new St.Button({ 
            child: new St.Icon({ gicon: PLUS_ICON }),
            style_class: 'popup-menu-item'
        });

        // Properly add all elements to the layout
        box.add_child(this._entry);
        box.add_child(new St.Label({ text: _('  min ') }));
        box.add_child(this._slider.actor);
        box.add_child(this._addBtn);
        
        // Make sure the box is properly added to the menu
        this._newRow.menu.box.add_child(box);

        /* signals */
        this._addBtn.connect('clicked', () => this._onAdd());
        this._slider.connect('notify::value', () => {
            const m = Math.round(this._slider.value * 1440);
            this._newRow.label.text = m ? _(`＋ New task… (${m} min)`)
                                        : _('＋ New task…');
        });
    }
    
    /* ─────────── "＋ New checklist…" ─────────── */
    _buildCheckboxRow() {
        this._checkboxRow = new PopupMenu.PopupSubMenuMenuItem(_('＋ New checklist…'), true);
        this.menu.addMenuItem(this._checkboxRow);

        // Create a better container with proper styling
        const box = new St.BoxLayout({ 
            style_class: 'new-task-container',
            x_expand: true,
            vertical: false,
            style: 'spacing: 12px; padding: 16px; min-height: 50px;'
        });
        
        // Make entry field larger and more visible
        this._checkEntry = new St.Entry({ 
            hint_text: _('List name…'),
            style_class: 'task-entry',
            x_expand: true,
            can_focus: true,
            style: 'min-width: 180px; margin-right: 10px;'
        });
        
        // Create a container for slider and label
        const sliderBox = new St.BoxLayout({ vertical: false });
        const boxesLabel = new St.Label({ text: _('boxes'), style: 'margin: 0 8px;' });
        
        this._checkSlider = new Slider.Slider(0);
        this._checkSlider.actor.set_width(200);
        
        sliderBox.add_child(boxesLabel);
        sliderBox.add_child(this._checkSlider.actor);
        
        // Style the add button
        this._checkAddBtn = new St.Button({ 
            child: new St.Icon({ gicon: PLUS_ICON }),
            style_class: 'task-add-button',
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
    }
    
    /* ─────────── History Menu ─────────── */
    _buildHistoryMenu() {
        this._historyItem = new PopupMenu.PopupSubMenuMenuItem(_('View History…'), true);
        this._historyItem.icon.gicon = HISTORY_ICON;
        this.menu.addMenuItem(this._historyItem);
        
        this._updateHistoryMenu();
    }
    
    _updateHistoryMenu() {
        // Clear existing items
        this._historyItem.menu.removeAll();
        
        // Add days from history
        const dates = Object.keys(this._taskHistory || {}).sort().reverse();
        if (dates.length === 0) {
            // No history
            const noHistoryItem = new PopupMenu.PopupMenuItem(_('No history available'));
            noHistoryItem.setSensitive(false);
            this._historyItem.menu.addMenuItem(noHistoryItem);
        } else {
            // Add last 7 days of history
            dates.slice(0, 7).forEach(date => {
                const dateItem = new PopupMenu.PopupMenuItem(this._formatDateForDisplay(date));
                dateItem.connect('activate', () => {
                    this._showHistoryForDate(date);
                });
                this._historyItem.menu.addMenuItem(dateItem);
            });
        }
    }
    
    _formatDateForDisplay(dateStr) {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString();
        } catch (e) {
            return dateStr;
        }
    }
    
    _showHistoryForDate(dateStr) {
        if (!this._taskHistory[dateStr]) {
            return;
        }
        
        // Create a modal dialog to show history
        const dialog = new ModalDialog.ModalDialog();
        dialog.contentLayout.style = 'width: 500px; max-height: 400px;';
        
        // Title
        const title = new St.Label({
            text: _(`Task History for ${this._formatDateForDisplay(dateStr)}`),
            style_class: 'history-title',
            style: 'font-weight: bold; font-size: 16px; text-align: center; margin-bottom: 15px;'
        });
        dialog.contentLayout.add_child(title);
        
        // Task list
        const scrollView = new St.ScrollView({
            style_class: 'history-scroll',
            y_expand: true
        });
        const taskBox = new St.BoxLayout({
            vertical: true,
            style: 'spacing: 10px; padding: 10px;'
        });
        scrollView.add_actor(taskBox);
        
        // Add task entries
        const historyTasks = this._taskHistory[dateStr];
        historyTasks.forEach(task => {
            if (task.isCheckbox) {
                // Checkbox task
                const checkboxRow = new St.BoxLayout({
                    style_class: 'history-task-row',
                    style: `background-color: ${task.color}; border-radius: 8px; padding: 10px;`
                });
                
                checkboxRow.add_child(new St.Label({
                    text: task.name,
                    x_expand: true
                }));
                
                // Add checkbox indicators
                const checkboxContainer = new St.BoxLayout({
                    style: 'spacing: 5px;'
                });
                
                if (task.checked && task.checkCount) {
                    const checkedCount = task.checked.filter(Boolean).length;
                    checkboxContainer.add_child(new St.Label({
                        text: `${checkedCount}/${task.checkCount} completed`,
                        style: 'font-style: italic;'
                    }));
                }
                
                checkboxRow.add_child(checkboxContainer);
                taskBox.add_child(checkboxRow);
            } else {
                // Timer task
                const taskRow = new St.BoxLayout({
                    style_class: 'history-task-row',
                    style: `background-color: ${task.color}; border-radius: 8px; padding: 10px;`
                });
                
                taskRow.add_child(new St.Label({
                    text: task.name,
                    x_expand: true
                }));
                
                taskRow.add_child(new St.Label({
                    text: `${Utils.mmss(task.currTime)} / ${Utils.mmss(task.planned)}`,
                    style: task.currTime > task.planned ? 'color: #f55;' : ''
                }));
                
                taskBox.add_child(taskRow);
            }
        });
        
        dialog.contentLayout.add_child(scrollView);
        
        // OK button
        dialog.setButtons([{
            label: _('Close'),
            action: () => dialog.close(),
            key: Clutter.KEY_Escape
        }]);
        
        dialog.open();
    }

    _onAdd() {
        const name = this._entry.get_text().trim();
        const mins = Math.round(this._slider.value * 1440);
        if (!name || !mins) return this._flashRow();

        /* reset UI */
        this._entry.set_text('');
        this._slider.value   = 0;
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
        weekdays[dayKey] = `0:00/${Utils.convertTime(mins * 60)}/0:00`;

        const task = {
            name, 
            planned: mins * 60, 
            currTime: 0, 
            lastStop: 0,
            color: Utils.generateColor(), 
            running: false,
            weekdays: weekdays,
            description: _('Enter description here!'),
            createdOn: this._lastDate // Store creation date
        };
        this._tasks.unshift(task);
        this._insertTaskRow(task, true);
    }

    _onAddCheckbox() {
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
        this._tasks.unshift(task);
        this._insertCheckboxRow(task, true);
    }

    _flashRow() {
        this._newRow.label.set_style('color:#f55');
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 700,
            () => { this._newRow.label.set_style(''); return GLib.SOURCE_REMOVE; });
    }

    _flashCheckboxRow() {
        this._checkboxRow.label.set_style('color:#f55');
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 700,
            () => { this._checkboxRow.label.set_style(''); return GLib.SOURCE_REMOVE; });
    }

    /* ─────────── task rows ─────────── */
    _insertTaskRow(task, save) {
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

        this._taskSection.addMenuItem(row, 0);
        if (save) { this._updateIndicator(); this._saveState(); }
    }

    _insertCheckboxRow(task, save) {
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

        this._taskSection.addMenuItem(row, 0);
        if (save) { this._saveState(); }
    }

    _deleteTask(row) {
        if (row._settingsRow) row._settingsRow.destroy();
        row.destroy();
        this._tasks = this._tasks.filter(t => t !== row.task);
        this._updateIndicator();
        this._saveState();
    }

    _moveRow(row, dir) {
        const items = this._taskSection._getMenuItems();
        const idx   = items.indexOf(row), tgt = idx + dir;
        if (tgt < 0 || tgt >= items.length) return;
        this._taskSection.moveMenuItem(row, tgt);

        /* reorder backing array */
        const [t] = this._tasks.splice(idx, 1);
        this._tasks.splice(tgt, 0, t);
        this._saveState();
    }

    /* ─────────── per‑task settings ─────────── */
    _openSettings(row) {
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
        this._taskSection.addMenuItem(settings, idx + 1);
        row._settingsRow = settings;
    }
    
    _openCheckboxSettings(row) {
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
        this._taskSection.addMenuItem(settings, idx + 1);
        row._settingsRow = settings;
    }
    
    _closeSettings(row) {
        if (row._settingsRow) { 
            row._settingsRow.destroy(); 
            row._settingsRow = null; 
        }
    }

    /* ─────────── indicator ─────────── */
    _updateIndicator() {
        let spent = 0, planned = 0;
        this._tasks.forEach(t => { 
            // Skip checkbox items in the indicator
            if (!t.isCheckbox) {
                spent += t.currTime; 
                planned += t.planned;
            }
        });
        this._label.text = `${Utils.mmss(spent)} / ${Utils.mmss(planned)}`;
    }
    
    // Direct update method that TaskItems can call
    forceUpdateNow() {
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
    }

    /* ─────────── persistence ─────────── */
    _ensureDir() {
        if (!GLib.file_test(CONFIG_DIR, GLib.FileTest.IS_DIR))
            GLib.mkdir_with_parents(CONFIG_DIR, 0o700);
    }
    
    _saveState() {
        this._ensureDir();
        try { 
            // Create the data structure with dates
            const saveData = {
                lastDate: this._lastDate,
                tasks: this._tasks,
                taskHistory: this._taskHistory
            };
            
            GLib.file_set_contents(STATE_FILE, JSON.stringify(saveData)); 
        }
        catch (e) { log(`TaskTimer: save failed – ${e}`); }
    }
    
    _loadState() {
        this._ensureDir();
        if (!GLib.file_test(STATE_FILE, GLib.FileTest.EXISTS)) return;
        try {
            const [ok, bytes] = GLib.file_get_contents(STATE_FILE);
            if (ok) {
                const data = JSON.parse(imports.byteArray.toString(bytes));
                
                // Store historical data separately
                this._taskHistory = data.taskHistory || {};
                
                // Check if we need to use today's data or create new
                const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                
                if (data.lastDate === today && data.tasks) {
                    // Use today's data
                    this._tasks = data.tasks;
                    this._lastDate = today;
                    log(`TaskTimer: Loaded current day's data (${today})`);
                } else {
                    // New day - initialize with zero values but preserve names/structures
                    this._lastDate = today;
                    
                    if (data.lastDate && data.tasks && data.tasks.length > 0) {
                        log(`TaskTimer: New day detected! Storing previous day (${data.lastDate}) in history`);
                        // Store previous day's data in history
                        this._taskHistory[data.lastDate] = data.tasks;
                        // Initialize new day based on previous tasks
                        this._tasks = this._initializeNewDay(data.tasks);
                    } else {
                        // First run or no previous tasks
                        this._tasks = [];
                    }
                }
            }
        } catch (e) { log(`TaskTimer: load failed – ${e}`); }
    }
    
    // New function to initialize a new day with zeroed values
    _initializeNewDay(previousTasks) {
        log("TaskTimer: Initializing new day with reset values");
        return previousTasks.map(task => {
            const newTask = {...task};
            
            if (task.isCheckbox) {
                // Reset checkbox values
                newTask.checked = Array(task.checkCount).fill(false);
                log(`TaskTimer: Reset checkboxes for "${task.name}"`);
            } else {
                // Reset timer values but keep planned time
                newTask.currTime = 0;
                newTask.lastStop = 0;
                newTask.running = false;
                
                // Reset current day in weekdays
                const dayIndex = new Date().getDay();
                const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const today = dayMap[dayIndex];
                
                // Format: "current/planned/lastStop"
                // Preserve the planned time from previous day
                const plannedTime = Utils.convertTime(task.planned);
                newTask.weekdays[today] = `0:00/${plannedTime}/0:00`;
                
                log(`TaskTimer: Reset timer for "${task.name}", planned: ${plannedTime}`);
            }
            
            return newTask;
        });
    }

    /* ─────────── cleanup ─────────── */
    disable() {
        if (this._autosaveID) GLib.source_remove(this._autosaveID);
        this._autosaveID = 0;
        if (this._updateTimerID) GLib.source_remove(this._updateTimerID);
        this._updateTimerID = 0;
        this._saveState();
        this.menu.removeAll();
    }
});
