// classes/task_item.js
import GObject                       from 'gi://GObject';
import St                            from 'gi://St';
import Gio                           from 'gi://Gio';
import GLib                          from 'gi://GLib';
import * as Main                     from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu                from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { gettext as _ }              from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Utils from './utils.js';

const PLAY_ICON   = Gio.icon_new_for_string('media-playback-start-symbolic');
const PAUSE_ICON  = Gio.icon_new_for_string('media-playback-pause-symbolic');
const ALARM_ICON  = Gio.icon_new_for_string('alarm-symbolic');

export const TaskItem = GObject.registerClass(
class TaskItem extends PopupMenu.PopupBaseMenuItem {

    _init(task) {
        super._init({ reactive: true });

        this._task    = task;
        this._timerId = 0;

        this._stateIcon = new St.Icon({ gicon: PLAY_ICON, style_class: 'popup-menu-icon' });
        this.add_child(this._stateIcon);

        this._nameLabel = new St.Label({ text: task.name, x_expand: true });
        this.add_child(this._nameLabel);

        this._timeLabel = new St.Label();
        this.add_child(this._timeLabel);

        this._updateTimeLabel();
    }

    /* click toggles running */
    activate(event) {
        super.activate(event);
        this._toggle();
    }

    _toggle() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
            this._stateIcon.gicon = PLAY_ICON;
        } else {
            this._stateIcon.gicon = PAUSE_ICON;
            this._tick(); /* first tick now */
            this._timerId = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT, 1,
                () => { this._tick(); return GLib.SOURCE_CONTINUE; });
        }
    }

    _tick() {
        this._task.currTime++;
        this._updateTimeLabel();

        if (this._task.currTime === this._task.planned)
            Main.notify(_('“%s” reached planned time').format(this._task.name));
        if (this._task.currTime === this._task.planned)
            this._stateIcon.gicon = ALARM_ICON;
    }

    _updateTimeLabel() {
        const c = Utils.convertTime(this._task.currTime);
        const p = Utils.convertTime(this._task.planned);
        this._timeLabel.text = `${c} / ${p}`;
        this._timeLabel.set_style(this._task.currTime > this._task.planned ? 'color:#f55' : '');
    }

    destroy() {
        if (this._timerId) GLib.source_remove(this._timerId);
        super.destroy();
    }
});

