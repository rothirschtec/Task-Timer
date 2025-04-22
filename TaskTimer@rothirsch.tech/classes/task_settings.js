/* Settings pane — ES‑module */

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import St             from 'gi://St';
import Gio            from 'gi://Gio';
import * as Slider    from 'resource:///org/gnome/shell/ui/slider.js';

import ExtensionUtils from 'resource:///org/gnome/shell/misc/extensionUtils.js';   // ← default
const Me = ExtensionUtils.getCurrentExtension();

import * as Utils from './utils.js';

const KEY_RETURN = 65293;
const KEY_ENTER  = 65421;
const SECONDS_OF_DAY = 86400;

function TaskSettings (task, totalTime) { this._init(task,totalTime); }

TaskSettings.prototype = {
    __proto__: PopupMenu.PopupMenuSection.prototype,

    _init (task, totalTime) {
        PopupMenu.PopupMenuSection.prototype._init.call(this);
        this.task     = task;
        this.restTime = SECONDS_OF_DAY - totalTime;

        /* description */
        this.descriptionBox = new St.BoxLayout({ style_class:'settings-box' });
        this.descriptionBtn = new St.Button({
            label: Utils.addNewLines(task.description), style_class:'description-btn',
        });
        this.description    = new St.Entry({
            text: task.description, can_focus:true, style_class:'description-label',
        });
        this.description.hide();
        this._hook(this.descriptionBtn,'clicked',()=>this._editDesc());

        this.descriptionBox.add(this.descriptionBtn,this.description);

        /* sliders */
        this._makeSlider(_('Current time:'), task.currTime,
            v=>{ task.currTime=v; this._updateWeekly(); });
        this._makeSlider(_('Total time:'), task.time,
            v=>{ task.time=v;     this._updateWeekly(); });

        /* weekly rows */
        this._makeWeekHeader();
        this._makeWeekNumbers();

        this.actor.add_actor(new PopupMenu.PopupSeparatorMenuItem().actor);
        this.actor.add_actor(this.descriptionBox);
        this.actor.add_actor(new PopupMenu.PopupSeparatorMenuItem().actor);
    },

    _makeSlider (label,start,cb) {
        const row=new St.BoxLayout({ style_class:'settings-box' });
        row.add(new St.Label({ text:label, style_class:'settings-label' }));
        const slider=new Slider.Slider(start/this.restTime);
        slider.actor.add_style_class_name('time-slider');
        this._hook(slider,'value-changed',(_s,v)=>cb(Math.floor(v*(this.restTime/60))*60));
        row.add(slider.actor); this.actor.add_actor(row);
    },

    _makeWeekHeader () {
        const row=new St.BoxLayout({ style_class:'settings-box' });
        ['', 'Mon','Tue','Wed','Thu','Fri','Sat','Sun','Total'].forEach(t=>
            row.add(new St.Label({
                text:_(t), style_class:t===''?'weekday-header':'weekday-label',
            })));
        this.actor.add_actor(row);
    },

    _makeWeekNumbers () {
        const row=new St.BoxLayout({ style_class:'settings-box' });
        row.add(new St.Label({ text:_('Current:\nMax:'), style_class:'weekday-header' }));
        const mk=d=>new St.Label({ text:d.replace('/','\n'), style_class:'weekday-times' });
        this.weekRows = {
            monday   : mk(this.task.weekdays.monday   ),
            tuesday  : mk(this.task.weekdays.tuesday  ),
            wednesday: mk(this.task.weekdays.wednesday),
            thursday : mk(this.task.weekdays.thursday ),
            friday   : mk(this.task.weekdays.friday   ),
            saturday : mk(this.task.weekdays.saturday ),
            sunday   : mk(this.task.weekdays.sunday   ),
        };
        Object.values(this.weekRows).forEach(l=>row.add(l));
        this.totalLabel = new St.Label({
            text: Utils.calcTotal(this.task.weekdays), style_class:'weekday-times',
        });
        row.add(this.totalLabel); this.actor.add_actor(row);
    },

    _editDesc () {
        this.description.show(); this.descriptionBtn.hide();
        const txt=this.description.clutter_text;
        this._hook(txt,'key_focus_out',()=>this._commitDesc());
        this._hook(txt,'key-press-event',(_o,e)=>{
            if ([KEY_RETURN,KEY_ENTER].includes(e.get_key_symbol())) this._commitDesc();
        });
    },

    _commitDesc () {
        this.description.hide(); this.descriptionBtn.show();
        this.task.description = this.description.text || _('Enter description here!');
        this.descriptionBtn.label = Utils.addNewLines(this.task.description);
        this.emit('update_signal',this.task);
    },

    _updateWeekly () {
        const d=this.task.weekdays;
        const r=this.weekRows;
        r.monday.text    = d.monday   .replace('/','\n');
        r.tuesday.text   = d.tuesday  .replace('/','\n');
        r.wednesday.text = d.wednesday.replace('/','\n');
        r.thursday.text  = d.thursday .replace('/','\n');
        r.friday.text    = d.friday   .replace('/','\n');
        r.saturday.text  = d.saturday .replace('/','\n');
        r.sunday.text    = d.sunday   .replace('/','\n');
        this.totalLabel.text = Utils.calcTotal(d);
        this.emit('update_signal',this.task);
    },

    _hook (o,sig,cb){ (this._c=this._c||[]).push([o,o.connect(sig,cb)]); },

    destroy () {
        (this._c||[]).forEach(([o,id])=>{ try{o.disconnect(id);}catch{} });
        PopupMenu.PopupMenuSection.prototype.destroy.call(this);
    },
};

export default TaskSettings;

