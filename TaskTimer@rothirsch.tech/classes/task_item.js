import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Utils from './utils.js';

const TaskItem = GObject.registerClass(
class TaskItem extends PopupMenu.PopupMenuItem {
    _init(task) {
        super._init(task.name);
        this.task = task;
        this._timerId = 0;

        this.durationLabel = new St.Label({ text: Utils.convertTime(task.currTime) });
        this.actor.add_child(this.durationLabel);
        this._update();
    }

    _update() {
        this.durationLabel.text = `${Utils.convertTime(this.task.currTime)} / ${Utils.convertTime(this.task.time)}`;
    }

    start() {
        if (this._timerId) return;
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this.task.currTime++;
            this._update();
            return GLib.SOURCE_CONTINUE;
        });
    }

    stop() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
        }
    }

    destroy() {
        this.stop();
        super.destroy();
    }
});

export default TaskItem;
