// classes/task_timer.js
//
// Status‑area indicator, task list & JSON persistence – fixed for
// event handling and settings panes on GNOME Shell 46 (GJS 1.78).

import GObject   from 'gi://GObject';
import St        from 'gi://St';
import Clutter   from 'gi://Clutter';
import Gio       from 'gi://Gio';
import GLib      from 'gi://GLib';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Slider    from 'resource:///org/gnome/shell/ui/slider.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import { TaskItem }  from './task_item.js';
import TaskSettings  from './task_settings.js';
import * as Utils    from './utils.js';

const PLUS_ICON = Gio.icon_new_for_string('list-add-symbolic');

/* ~/.config/TaskTimer/state.json */
const CONFIG_DIR = GLib.build_filenamev([GLib.get_user_config_dir(), 'TaskTimer']);
const STATE_FILE = GLib.build_filenamev([CONFIG_DIR, 'state.json']);

export default GObject.registerClass(
class TaskTimer extends PanelMenu.Button {

    _init() {
        super._init(0.0, 'Task Timer');

        /* load saved tasks */
        this._tasks = [];
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

        /* recreate tasks */
        this._tasks.forEach(t => this._insertTaskRow(t, false));
        this._updateIndicator();

        /* autosave */
        this._autosaveID = GLib.timeout_add_seconds(
            GLib.PRIORITY_LOW, 30,
            () => { this._saveState(); return GLib.SOURCE_CONTINUE; });
    }

    /* ─────────── “＋ New task …” ─────────── */
    _buildNewTaskRow() {
        this._newRow = new PopupMenu.PopupSubMenuMenuItem(_('＋ New task…'), true);
        this.menu.addMenuItem(this._newRow);

        const box = new St.BoxLayout({ style_class: 'popup-combobox-item' });
        this._entry  = new St.Entry({ hint_text: _('Task name…'),
                                      style_class: 'popup-menu-item' });
        this._slider = new Slider.Slider(0);  this._slider.actor.set_width(100);
        this._addBtn = new St.Button({ child: new St.Icon({ gicon: PLUS_ICON }),
                                       style_class: 'popup-menu-item' });

        box.add_child(this._entry);
        box.add_child(new St.Label({ text: _('  min ') }));
        box.add_child(this._slider.actor);
        box.add_child(this._addBtn);
        this._newRow.menu.box.add_child(box);

        /* signals */
        this._addBtn.connect('clicked', () => this._onAdd());
        this._slider.connect('notify::value', () => {
            const m = Math.round(this._slider.value * 100);
            this._newRow.label.text = m ? _(`＋ New task… (${m} min)`)
                                        : _('＋ New task…');
        });
    }

    // In task_timer.js
    _onAdd() {
        const name = this._entry.get_text().trim();
        const mins = Math.round(this._slider.value * 100);
        if (!name || !mins) return this._flashRow();

        /* reset UI */
        this._entry.set_text('');
        this._slider.value = 0;
        this._newRow.label.text = _('＋ New task…');

        const task = {
            name, 
            planned: mins * 60, // This converts minutes to seconds correctly
            currTime: 0, 
            lastStop: 0,
            color: Utils.generateColor(), 
            running: false,
            weekdays: { /* ... */ },
            description: _('Enter description here!'),
        };
        this._tasks.unshift(task);
        this._insertTaskRow(task, true);
    }
    _flashRow() {
        this._newRow.label.set_style('color:#f55');
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 700,
            () => { this._newRow.label.set_style(''); return GLib.SOURCE_REMOVE; });
    }

    /* ─────────── task rows ─────────── */
    _insertTaskRow(task, save) {
        const row = new TaskItem(task);

        row.connect('delete_signal',        () => this._deleteTask(row));
        row.connect('moveUp_signal',        () => this._moveRow(row, -1));
        row.connect('moveDown_signal',      () => this._moveRow(row,  1));
        row.connect('update_signal',        () => this._updateIndicator());
        row.connect('settings_signal',      () => this._openSettings(row));
        row.connect('closeSettings_signal', () => this._closeSettings(row));

        this._taskSection.addMenuItem(row, 0);
        if (save) { this._updateIndicator(); this._saveState(); }
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
        /* close any other open settings pane */
        this._taskSection._getMenuItems().forEach(item => {
            if (item !== row && item._settingsRow) {
                item._settingsRow.destroy();
                item._settingsRow = null;
                if (item.settingsOpen) item.settingsOpen = false;
            }
        });

        const settings = new TaskSettings(row.task, row.task.currTime);
        settings.connect('update_signal', () => this._updateIndicator());

        const idx = this._taskSection._getMenuItems().indexOf(row);
        this._taskSection.addMenuItem(settings, idx + 1);
        row._settingsRow = settings;
    }
    _closeSettings(row) {
        if (row._settingsRow) { row._settingsRow.destroy(); row._settingsRow = null; }
    }

    /* ─────────── indicator ─────────── */
    _updateIndicator() {
        let spent = 0, planned = 0;
        this._tasks.forEach(t => { spent += t.currTime; planned += t.planned; });
        this._label.text = `${Utils.convertTime(spent)} / ${Utils.convertTime(planned)}`;
    }

    /* ─────────── persistence ─────────── */
    _ensureDir() {
        if (!GLib.file_test(CONFIG_DIR, GLib.FileTest.IS_DIR))
            GLib.mkdir_with_parents(CONFIG_DIR, 0o700);
    }
    _saveState() {
        this._ensureDir();
        try { GLib.file_set_contents(STATE_FILE, JSON.stringify(this._tasks)); }
        catch (e) { log(`TaskTimer: save failed – ${e}`); }
    }
    _loadState() {
        this._ensureDir();
        if (!GLib.file_test(STATE_FILE, GLib.FileTest.EXISTS)) return;
        try {
            const [ok, bytes] = GLib.file_get_contents(STATE_FILE);
            if (ok) {
                const arr = JSON.parse(imports.byteArray.toString(bytes));
                if (Array.isArray(arr)) this._tasks = arr;
            }
        } catch (e) { log(`TaskTimer: load failed – ${e}`); }
    }

    /* ─────────── cleanup ─────────── */
    disable() {
        if (this._autosaveID) GLib.source_remove(this._autosaveID);
        this._autosaveID = 0;
        this._saveState();
        this.menu.removeAll();
    }
});

