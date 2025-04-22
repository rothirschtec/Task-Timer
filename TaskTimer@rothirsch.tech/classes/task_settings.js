// classes/task_settings.js  — per‑task settings pane
import St       from 'gi://St';
import Gio      from 'gi://Gio';
import Clutter  from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Slider    from 'resource:///org/gnome/shell/ui/slider.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Utils from './utils.js';

const KEY_RETURN = 65293;
const KEY_ENTER  = 65421;
const SECONDS_PER_DAY = 86400;

// WCAG 2.0 AA compliant colors
const COLORS = [
    '#2272C8', // Blue
    '#3C9D4E', // Green
    '#6D4C9F', // Purple
    '#C42B1C', // Red
    '#7D5700', // Brown/Orange
    '#515C6B', // Blue Gray
    '#0797A8', // Teal
    '#71B238', // Light Green
    '#CB7300', // Orange
    '#B9227D', // Pink
];

/* ---------- plain ES class (no GObject.registerClass) ---------- */
export default class TaskSettings extends PopupMenu.PopupMenuSection {

    constructor(task, spentTime) {
        super();
        
        log("TaskSettings: Initializing settings for " + task.name);
        this.task = task;
        this.restTime = SECONDS_PER_DAY - spentTime;

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
            log("TaskSettings: Description button clicked");
            this._descBtn.hide(); 
            this._descEntry.show();
            this._descEntry.grab_key_focus();
        });
        
        const saveDesc = () => {
            log("TaskSettings: Saving description");
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
                style: `background-color: ${color}; width: 36px; height: 36px; margin: 4px; border-radius: 18px;`,
                reactive: true,
                can_focus: true,
            });
            colorBtn.connect('clicked', () => {
                log("TaskSettings: Color changed to " + color);
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
            log("TaskSettings: Color changed to random: " + newColor);
            this.task.color = newColor;
            this.emit('update_signal');
        });
        
        colorBox.add_child(colorGrid);
        colorBox.add_child(randomBtn);
        colorItem.add_child(colorBox);
        this.addMenuItem(colorItem);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        /* sliders */
        this._makeSlider(_('Current time:'), task.currTime,
            v => { task.currTime = v; this._updateWeek(); });
        this._makeSlider(_('Total time:'), task.planned,
            v => { task.planned = v;  this._updateWeek(); });

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        /* weekly table */
        this._makeWeekHeader();
        this._makeWeekNumbers();
        
        log("TaskSettings: Initialization complete");
    }

    /* ---- helpers ---- */
// In task_settings.js, find the _makeSlider method
_makeSlider(label, init, cb) {
    const item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    const row = new St.BoxLayout({ 
        style_class: 'settings-box',
        y_align: Clutter.ActorAlign.CENTER
    });
    
    // Label
    row.add_child(new St.Label({ 
        text: label, 
        style_class: 'settings-label'
    }));
    
    // Set maximum to 24 hours (1440 minutes)
    const maxMinutes = 1440;
    const initialMinutes = Math.floor(init / 60);
    
    // Slider - normalize value between 0 and 1 based on maxMinutes
    const slider = new Slider.Slider(Math.min(1, initialMinutes / maxMinutes));
    slider.actor.add_style_class_name('time-slider');
    
    // Text input with proper formatting
    const textBox = new St.Entry({
        text: Utils.mmss(init),
        style_class: 'time-entry',
        can_focus: true,
        reactive: true,
    });
    textBox.set_width(1440);
    
    // Connect slider to update text with precise minute mapping
    slider.connect('notify::value', () => {
        // Convert slider value to seconds with better precision
        const minutes = slider.value * maxMinutes;
        const seconds = Math.floor(minutes * 60);
        
        // Update text box if value changed
        if (Utils.mmss(seconds) !== textBox.get_text()) {
            textBox.set_text(Utils.mmss(seconds));
        }
        
        // Update task value
        cb(seconds);
    });
    
    // Connect text input to update slider
    textBox.clutter_text.connect('text-changed', () => {
        const text = textBox.get_text();
        const seconds = Utils.parseTimeInput(text);
        
        if (seconds !== null) {
            // Convert seconds to slider value (0-1 range)
            const minutes = seconds / 60;
            const newValue = Math.min(1, minutes / maxMinutes);
            
            if (Math.abs(slider.value - newValue) > 0.001) {
                slider.value = newValue;
                cb(seconds);
            }
        }
    });
    
    // Handle key events for Enter key
    textBox.clutter_text.connect('key-press-event', (_o, e) => {
        const symbol = e.get_key_symbol();
        if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
            const text = textBox.get_text();
            const seconds = Utils.parseTimeInput(text);
            
            if (seconds !== null) {
                textBox.set_text(Utils.mmss(seconds));
                const minutes = seconds / 60;
                slider.value = Math.min(1, minutes / maxMinutes);
                cb(seconds);
            } else {
                const minutes = slider.value * maxMinutes;
                const currentSeconds = Math.floor(minutes * 60);
                textBox.set_text(Utils.mmss(currentSeconds));
            }
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    });
    
    // Add elements to the row in the correct order
    row.add_child(slider.actor);
    row.add_child(textBox);
    
    item.add_child(row);
    this.addMenuItem(item);
}
    _makeWeekHeader() {
        const item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        const row = new St.BoxLayout({ style_class: 'settings-box' });
        ['', 'Mon','Tue','Wed','Thu','Fri','Sat','Sun','Total'].forEach(t =>
            row.add_child(new St.Label({
                text: _(t), style_class: t ? 'weekday-label' : 'weekday-header',
            })));
        item.add_child(row);
        this.addMenuItem(item);
    }

    _makeWeekNumbers() {
        const item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        const row = new St.BoxLayout({ style_class: 'settings-box' });
        row.add_child(new St.Label({ text: _('Current:\nMax:'), style_class: 'weekday-header' }));
        const mk = key => {
            const l = new St.Label({ style_class: 'weekday-times' });
            l.text  = this.task.weekdays[key].replace('/', '\n');
            row.add_child(l); return l;
        };
        this._week = {
            mon: mk('monday'), tue: mk('tuesday'), wed: mk('wednesday'),
            thu: mk('thursday'), fri: mk('friday'),
            sat: mk('saturday'), sun: mk('sunday')
        };
        this._total = new St.Label({ text: Utils.calcTotal(this.task.weekdays),
                                     style_class: 'weekday-times' });
        row.add_child(this._total);
        item.add_child(row);
        this.addMenuItem(item);
    }

    _updateWeek() {
        this._total.text = Utils.calcTotal(this.task.weekdays);
        this.emit('update_signal');
    }
}
