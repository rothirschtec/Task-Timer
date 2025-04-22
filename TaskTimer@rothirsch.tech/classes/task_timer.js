// classes/task_timer.js  —  TaskTimer indicator with JSON persistence
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
import * as Utils    from './utils.js';

const PLUS_ICON = Gio.icon_new_for_string('list-add-symbolic');

const CONFIG_DIR = GLib.build_filenamev([GLib.get_user_config_dir(), 'TaskTimer']);
const STATE_FILE = GLib.build_filenamev([CONFIG_DIR, 'state.json']);

export default GObject.registerClass(
class TaskTimer extends PanelMenu.Button {

    /* ---------------- constructor ---------------- */
    _init() {
        super._init(0.0, 'Task Timer');
        this._tasks = [];
        this._loadState();

        /* indicator */
        this._label = new St.Label({ text: '0:00 / 0:00',
                                     y_align: Clutter.ActorAlign.CENTER });
        this.add_child(this._label);

        /* popup */
        this._taskSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._taskSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._buildNewTaskRow();

        /* recreate saved rows */
        for (const t of this._tasks)
            this._taskSection.addMenuItem(new TaskItem(t));
        this._updateIndicator();

        /* autosave */
        this._autosaveID = GLib.timeout_add_seconds(
            GLib.PRIORITY_LOW, 30,
            () => { this._saveState(); return GLib.SOURCE_CONTINUE; });
    }

    /* ------------ “＋ New task …” row ------------ */
    _buildNewTaskRow() {
        this._newRow = new PopupMenu.PopupSubMenuMenuItem(_('＋ New task…'), true);
        this.menu.addMenuItem(this._newRow);

        const box = new St.BoxLayout({ style_class: 'popup-combobox-item' });
        this._entry = new St.Entry({ hint_text: _('Task name…'),
                                     style_class: 'popup-menu-item' });
        box.add_child(this._entry);
        box.add_child(new St.Label({ text: _('  min ') }));

        this._slider = new Slider.Slider(0);          // 0–1 → 0–100 min
        this._slider.actor.set_width(100);
        box.add_child(this._slider.actor);

        this._addBtn = new St.Button({ child: new St.Icon({ gicon: PLUS_ICON }) });
        box.add_child(this._addBtn);

        this._newRow.menu.box.add_child(box);

        this._addBtn.connect('clicked', () => this._onAdd());
        this._slider.connect('notify::value', () => {
            const m = Math.round(this._slider.value * 100);
            this._newRow.label.text = m ? _(`＋ New task… (${m} min)`)
                                        : _('＋ New task…');
        });
    }

    /* ------------- add a task ------------- */
    _onAdd() {
        const name = this._entry.get_text().trim();
        const mins = Math.round(this._slider.value * 100);
        if (!name || !mins)
            return this._flashRow();

        /* reset UI */
        this._entry.set_text('');
        this._slider.value = 0;                  // ← property, not function
        this._newRow.label.text = _('＋ New task…');

        /* data + UI */
        const task = { name, planned: mins * 60, currTime: 0 };
        this._tasks.unshift(task);
        this._taskSection.addMenuItem(new TaskItem(task), 0);

        this._updateIndicator();
        this._saveState();
    }

    _flashRow() {
        this._newRow.label.set_style('color:#f55');
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 700,
            () => { this._newRow.label.set_style(''); return GLib.SOURCE_REMOVE; });
    }

    /* ------------- indicator text ------------- */
    _updateIndicator() {
        let spent = 0, planned = 0;
        for (const t of this._tasks) {
            spent   += t.currTime;
            planned += t.planned;
        }
        this._label.text = `${Utils.convertTime(spent)} / ${Utils.convertTime(planned)}`;
    }

    /* ------------- persistence ------------- */
    _ensureDir() {
        if (!GLib.file_test(CONFIG_DIR, GLib.FileTest.IS_DIR))
            GLib.mkdir_with_parents(CONFIG_DIR, 0o700);
    }

    _saveState() {
        this._ensureDir();
        try { GLib.file_set_contents(STATE_FILE, JSON.stringify(this._tasks)); }
        catch (e) { log(`TaskTimer: save failed: ${e}`); }
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
        } catch (e) { log(`TaskTimer: load failed: ${e}`); }
    }

    /* ------------- cleanup ------------- */
    disable() {
        if (this._autosaveID)
            GLib.source_remove(this._autosaveID);
        this._autosaveID = 0;

        this._saveState();          // save, don't clear _tasks
        this.menu.removeAll();
    }
});

