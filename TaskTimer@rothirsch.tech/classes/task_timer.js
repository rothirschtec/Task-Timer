import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import TaskItem from './task_item.js';
import * as Utils from './utils.js';

const TaskTimer = GObject.registerClass(
class TaskTimer extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Task Timer');
        this.listOfTasks = {};
        this._idCounter = 0;

        this.label = new St.Label({ text: '0:00 / 0:00', y_align: Clutter.ActorAlign.CENTER });
        this.add_child(this.label);

        this.menuSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this.menuSection);
        this._loadTasks();
        this._updateLabel();
    }

    _loadTasks() {
        // Placeholder for loading logic
    }

    _updateLabel() {
        let curr = 0, total = 0;
        for (const id in this.listOfTasks) {
            curr += this.listOfTasks[id].currTime;
            total += this.listOfTasks[id].time;
        }
        this.label.text = `${Utils.convertTime(curr)} / ${Utils.convertTime(total)}`;
    }

    addTask(name, time) {
        const id = this._idCounter++;
        const task = {
            id,
            name,
            currTime: 0,
            time: time * 60,
        };
        this.listOfTasks[id] = task;

        const item = new TaskItem(task);
        this.menuSection.addMenuItem(item);
    }

    disable() {
        this.menu.removeAll();
    }
});

export default TaskTimer;

