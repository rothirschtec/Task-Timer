// classes/checkbox_item.js
import GObject  from 'gi://GObject';
import St       from 'gi://St';
import Gio      from 'gi://Gio';
import GLib     from 'gi://GLib';
import Clutter  from 'gi://Clutter';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main      from 'resource:///org/gnome/shell/ui/main.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Utils from './utils.js';

const DELETE_ICON  = Gio.icon_new_for_string('user-trash-symbolic');
const UP_ICON      = Gio.icon_new_for_string('go-up-symbolic');
const DOWN_ICON    = Gio.icon_new_for_string('go-down-symbolic');
const GEAR_ICON    = Gio.icon_new_for_string('emblem-system-symbolic');
const CHECK_ICON   = Gio.icon_new_for_string('object-select-symbolic');
const UNCHECK_ICON = Gio.icon_new_for_string('checkbox-symbolic');

export const CheckboxItem = GObject.registerClass(
{
    Signals: {
        'delete_signal':        {},
        'moveUp_signal':        {},
        'moveDown_signal':      {},
        'update_signal':        {},
        'settings_signal':      {},
        'closeSettings_signal': {},
    },
},
class CheckboxItem extends PopupMenu.PopupBaseMenuItem {

    _init(task, parent) {
        super._init({
            reactive: true,
            can_focus: false,
            activate: false,
            style_class: 'checkbox-row',
        });

        // Store parent reference
        this._parent = parent;

        // Disable default behavior
        this._activatable = false;
        if (this._pressId) {
            this.disconnect(this._pressId);
            this._pressId = 0;
        }
        if (this._releaseId) {
            this.disconnect(this._releaseId);
            this._releaseId = 0;
        }

        this.task = task;
        this.settingsOpen = false;
        this._buildLayout();
        this._connectSignals();
    }

    _buildLayout() {
        // Name
        this._name = new St.Label({ 
            text: this.task.name,
            x_expand: true
        });
        
        // Checkboxes container
        this._checkboxContainer = new St.BoxLayout({
            style_class: 'checkbox-container'
        });
        
        // Create checkboxes
        this._checkboxes = [];
        for (let i = 0; i < this.task.checkCount; i++) {
            const isChecked = this.task.checked && this.task.checked[i];
            const icon = isChecked ? CHECK_ICON : UNCHECK_ICON;
            
            const checkbox = new St.Button({
                style_class: 'checkbox-button',
                reactive: true,
                can_focus: true,
                track_hover: true,
                child: new St.Icon({ gicon: icon }),
            });
            
            // Store checkbox state
            checkbox.isChecked = isChecked;
            checkbox.index = i;
            
            this._checkboxes.push(checkbox);
            this._checkboxContainer.add_child(checkbox);
        }
        
        // Control buttons
        this._delete = new St.Button({
            style_class: 'task-button',
            reactive: true,
            can_focus: true,
            track_hover: true,
            child: new St.Icon({ gicon: DELETE_ICON }),
        });
        this._up = new St.Button({
            style_class: 'task-button',
            reactive: true,
            can_focus: true,
            track_hover: true,
            child: new St.Icon({ gicon: UP_ICON }),
        });
        this._down = new St.Button({
            style_class: 'task-button',
            reactive: true,
            can_focus: true,
            track_hover: true,
            child: new St.Icon({ gicon: DOWN_ICON }),
        });
        this._gear = new St.Button({
            style_class: 'task-button',
            reactive: true,
            can_focus: true,
            track_hover: true,
            child: new St.Icon({ gicon: GEAR_ICON }),
        });
        
        const controlButtons = new St.BoxLayout();
        controlButtons.add_child(this._delete);
        controlButtons.add_child(this._up);
        controlButtons.add_child(this._down);
        controlButtons.add_child(this._gear);
        
        // Add everything to the container
        this.add_child(this._name);
        this.add_child(this._checkboxContainer);
        this.add_child(controlButtons);
        
        // Set background color
        this.set_style(`background-color:${this.task.color};`);
    }

    _connectSignals() {
        // Connect checkbox click handlers
        this._checkboxes.forEach(checkbox => {
            checkbox.connect('clicked', () => {
                log("TaskTimer: Checkbox clicked");
                checkbox.isChecked = !checkbox.isChecked;
                
                // Update icon
                const icon = checkbox.isChecked ? CHECK_ICON : UNCHECK_ICON;
                checkbox.child.set_gicon(icon);
                
                // Update task data
                if (!this.task.checked) {
                    this.task.checked = [];
                }
                this.task.checked[checkbox.index] = checkbox.isChecked;
                
                // Signal update for saving
                this.emit('update_signal');
            });
        });
        
        // Control button handlers
        this._delete.connect('clicked', () => {
            log("TaskTimer: Delete checkbox item clicked");
            this.emit('delete_signal');
        });
        this._up.connect('clicked', () => {
            log("TaskTimer: Up checkbox item clicked");
            this.emit('moveUp_signal');
        });
        this._down.connect('clicked', () => {
            log("TaskTimer: Down checkbox item clicked");
            this.emit('moveDown_signal');
        });
        this._gear.connect('clicked', this._onGearClicked.bind(this));
    }
    
    _onGearClicked() {
        log(`CheckboxItem: Gear clicked - task=${this.task.name}, settingsOpen=${this.settingsOpen}`);
        
        // Toggle settings state
        this.settingsOpen = !this.settingsOpen;
        
        // Emit the right signal
        if (this.settingsOpen) {
            log("CheckboxItem: Emitting settings_signal");
            this.emit('settings_signal');
        } else {
            log("CheckboxItem: Emitting closeSettings_signal");
            this.emit('closeSettings_signal');
        }
    }

    destroy() {
        super.destroy();
    }
});
