// classes/task_timer.js
import GObject   from 'gi://GObject';
import St        from 'gi://St';
import Clutter   from 'gi://Clutter';
import Gio       from 'gi://Gio';
import GLib      from 'gi://GLib';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Slider    from 'resource:///org/gnome/shell/ui/slider.js';
import { gettext as _ }  from 'resource:///org/gnome/shell/extensions/extension.js';

import { TaskItem }  from './task_item.js';
import * as Utils    from './utils.js';

const PLUS_ICON = Gio.icon_new_for_string('list-add-symbolic');

export default GObject.registerClass(
class TaskTimer extends PanelMenu.Button {

    _init() {
        super._init(0.0, 'Task Timer');

        /* ---------------------------------------------------------------- data */
        this._tasks = [];

        /* ---------------------------------------------------------------- indicator label */
        this._label = new St.Label({
            text: '0:00 / 0:00',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._label);

        /* ---------------------------------------------------------------- popup menu */
        this._taskSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._taskSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        /* “＋ New task …” expandable row ------------------------------ */
        this._newRow = new PopupMenu.PopupSubMenuMenuItem(_('＋ New task…'), true);
        this.menu.addMenuItem(this._newRow);

        const box   = new St.BoxLayout({ style_class: 'popup-combobox-item' });

        this._entry = new St.Entry({
            hint_text: _('Task name…'),
            style_class: 'popup-menu-item',
        });
        box.add_child(this._entry);

        box.add_child(new St.Label({ text: _('  min ') }));

        this._slider = new Slider.Slider(0);               // 0 → 1  (0‑100 min)
        this._slider.actor.set_width(100);
        box.add_child(this._slider.actor);

        this._addBtn = new St.Button({
            child: new St.Icon({ gicon: PLUS_ICON }),
            style_class: 'popup-menu-item',
        });
        box.add_child(this._addBtn);

        this._newRow.menu.box.add_child(box);

        /* ------------------------------------------------------------- signals */
        this._addBtn.connect('clicked', () => this._onAdd());

        /*  GJS 1.78+: Slider emits property notifications, not value‑changed.   */
        this._slider.connect('notify::value', () => {
            const mins = Math.round(this._slider.value * 100);
            this._newRow.label.text = mins
                ? _(`＋ New task… (${mins} min)`)
                : _('＋ New task…');
        });
    }

    /* ---------------------------------------------------------------- add task */
    _onAdd() {
        const name = this._entry.get_text().trim();
        const mins = Math.round(this._slider.value * 100);

        if (!name || !mins) {
            this._flashRow();
            return;
        }
        /* reset UI */
        this._entry.set_text('');
        this._slider.set_value(0);
        this._newRow.label.text = _('＋ New task…');

        const task = { name, planned: mins * 60, currTime: 0 };
        this._tasks.unshift(task);

        const item = new TaskItem(task);
        this._taskSection.addMenuItem(item, 0);
        this._updateIndicator();
    }

    _flashRow() {
        this._newRow.label.set_style('color:#f55');
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 700,
            () => { this._newRow.label.set_style(''); return GLib.SOURCE_REMOVE; });
    }

    /* ----------------------------------------------------------- indicator text */
    _updateIndicator() {
        let spent = 0, planned = 0;
        for (const t of this._tasks) {
            spent   += t.currTime;
            planned += t.planned;
        }
        this._label.text = `${Utils.convertTime(spent)} / ${Utils.convertTime(planned)}`;
    }

    /* ------------------------------------------------------- cleanup on disable */
    disable() {
        this.menu.removeAll();
        this._tasks = [];
    }
});

