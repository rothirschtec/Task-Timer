// classes/checkbox_settings.js
import St       from 'gi://St';
import Gio      from 'gi://Gio';
import Clutter  from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Utils from './utils.js';

const KEY_RETURN = 65293;
const KEY_ENTER  = 65421;

// Predefined colors (same as in task_settings.js)
const COLORS = [
    '#4CAF50', // Green
    '#2196F3', // Blue
    '#9C27B0', // Purple
    '#F44336', // Red
    '#FF9800', // Orange
    '#607D8B', // Blue Gray
    '#00BCD4', // Cyan
    '#8BC34A', // Light Green
    '#FFC107', // Amber
    '#E91E63', // Pink
    '#795548', // Brown
];

/* Simple settings class for checkbox items */
export default class CheckboxSettings extends PopupMenu.PopupMenuSection {

    constructor(task) {
        super();
        
        log("CheckboxSettings: Initializing settings for " + task.name);
        this.task = task;
        
        // Ensure there's a description field
        if (!task.description) {
            task.description = _('Enter description here!');
        }

        /* description row */
        const descItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        const descBox = new St.BoxLayout({ style_class: 'settings-box' });
        
        this._descBtn = new St.Button({ 
            label: Utils.addNewLines(task.description),
            style_class: 'description-btn',
            reactive: true,
            can_focus: true,
        });
        this._descEntry = new St.Entry({ 
            text: task.description,
            style_class: 'description-label',
            reactive: true,
            can_focus: true,
        });
        this._descEntry.hide();
        descBox.add_child(this._descBtn);
        descBox.add_child(this._descEntry);
        descItem.add_child(descBox);
        this.addMenuItem(descItem);

        this._descBtn.connect('clicked', () => {
            log("CheckboxSettings: Description button clicked");
            this._descBtn.hide(); 
            this._descEntry.show();
            this._descEntry.grab_key_focus();
        });
        
        const saveDesc = () => {
            log("CheckboxSettings: Saving description");
            this._descEntry.hide(); 
            this._descBtn.show();
            this.task.color = this.task.color || Utils.generateColor(); // Ensure task has a color
            this.task.description = this._descEntry.get_text() || _('Enter description here!');
            this._descBtn.label = Utils.addNewLines(this.task.description);
            this.emit('update_signal');
        };
        
        this._descEntry.clutter_text.connect('key-focus-out', saveDesc);
        this._descEntry.clutter_text.connect('key-press-event',
            (_o,e) => { 
                if ([KEY_RETURN, KEY_ENTER].includes(e.get_key_symbol())) {
                    saveDesc();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });

        /* color picker row */
        const colorItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        const colorBox = new St.BoxLayout({ style_class: 'settings-box' });
        
        colorBox.add_child(new St.Label({ text: _('Color:'), style_class: 'settings-label' }));
        
        const colorGrid = new St.BoxLayout({ 
            style_class: 'color-grid',
            x_expand: true,
        });
        
        COLORS.forEach(color => {
            const colorBtn = new St.Button({
                style: `background-color: ${color}; width: 24px; height: 24px; margin: 2px; border-radius: 12px;`,
                reactive: true,
                can_focus: true,
            });
            colorBtn.connect('clicked', () => {
                log("CheckboxSettings: Color changed to " + color);
                this.task.color = color;
                this.emit('update_signal');
            });
            colorGrid.add_child(colorBtn);
        });
        
        // Random color button
        const randomBtn = new St.Button({
            label: _('Random'),
            style_class: 'random-color-btn',
            reactive: true,
            can_focus: true,
        });
        randomBtn.connect('clicked', () => {
            const newColor = Utils.generateColor();
            log("CheckboxSettings: Color changed to random: " + newColor);
            this.task.color = newColor;
            this.emit('update_signal');
        });
        
        colorBox.add_child(colorGrid);
        colorBox.add_child(randomBtn);
        colorItem.add_child(colorBox);
        this.addMenuItem(colorItem);
        
        log("CheckboxSettings: Initialization complete");
    }
}
