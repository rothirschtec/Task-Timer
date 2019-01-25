
const Main = imports.ui.main;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Shell = imports.gi.Shell;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const TaskItem = Extension.imports.classes.task_item;
const Utils = Extension.imports.classes.utils;

const ADD_ICON = Gio.icon_new_for_string(Extension.path + "/icons/add_task_icon.png");

function TaskSettings(task, totalTime){
  this._init(task);
}

TaskSettings.prototype = {
  __proto__: PopupMenu.PopupMenuSection.prototype,

  _init : function(task, totalTime){
      PopupMenu.PopupMenuSection.prototype._init.call(this);
      this.task = task;
      this.totalTime = totalTime;
      //Set up Boxlayouts for the settings
      this.weeklyLabels = new St.BoxLayout();
      this.weeklyLabels.set_vertical(false);
      this.weeklyLabels.add_style_class_name("settings-box");
      this.weeklyNumbers = new St.BoxLayout();
      this.weeklyNumbers.set_vertical(false);
      this.weeklyNumbers.add_style_class_name("settings-box");
      this.currTimeBox = new St.BoxLayout();
      this.currTimeBox.set_vertical(false);
      this.currTimeBox.add_style_class_name("settings-box");
      this.newNameBox = new St.BoxLayout();
      //Create view for weekly timeSlider
      let weekLabel = new St.Label({text:_("Mon")});
      weekLabel.add_style_class_name("weekday-label");
      this.weeklyLabels.add_actor(weekLabel);
      weekLabel = new St.Label({text:_("Tue")});
      weekLabel.add_style_class_name("weekday-label");
      this.weeklyLabels.add_actor(weekLabel);
      weekLabel = new St.Label({text:_("Wed")});
      weekLabel.add_style_class_name("weekday-label");
      this.weeklyLabels.add_actor(weekLabel);
      weekLabel = new St.Label({text:_("Thu")});
      weekLabel.add_style_class_name("weekday-label");
      this.weeklyLabels.add_actor(weekLabel);
      weekLabel = new St.Label({text:_("Fri")});
      weekLabel.add_style_class_name("weekday-label");
      this.weeklyLabels.add_actor(weekLabel);
      weekLabel = new St.Label({text:_("Sat")});
      weekLabel.add_style_class_name("weekday-label");
      this.weeklyLabels.add_actor(weekLabel);
      weekLabel = new St.Label({text:_("Sun")});
      weekLabel.add_style_class_name("weekday-label");
      this.weeklyLabels.add_actor(weekLabel);

      this.mondayLabel = new St.Label();
      this.mondayLabel.add_style_class_name("weekday-times");
      this.mondayLabel.text = this.task.weekdays.monday;
      this.weeklyNumbers.add_actor(this.mondayLabel);
      this.tuesdayLabel = new St.Label();
      this.tuesdayLabel.add_style_class_name("weekday-times");
      this.tuesdayLabel.text = this.task.weekdays.tuesday;
      this.weeklyNumbers.add_actor(this.tuesdayLabel);
      this.wednesdayLabel = new St.Label();
      this.wednesdayLabel.add_style_class_name("weekday-times");
      this.wednesdayLabel.text = this.task.weekdays.wednesday;
      this.weeklyNumbers.add_actor(this.wednesdayLabel);
      this.thursdayLabel = new St.Label();
      this.thursdayLabel.add_style_class_name("weekday-times");
      this.thursdayLabel.text = this.task.weekdays.thursday;
      this.weeklyNumbers.add_actor(this.thursdayLabel);
      this.fridayLabel = new St.Label();
      this.fridayLabel.add_style_class_name("weekday-times");
      this.fridayLabel.text = this.task.weekdays.friday;
      this.weeklyNumbers.add_actor(this.fridayLabel);
      this.saturdayLabel = new St.Label();
      this.saturdayLabel.add_style_class_name("weekday-times");
      this.saturdayLabel.text = this.task.weekdays.saturday;
      this.weeklyNumbers.add_actor(this.saturdayLabel);
      this.sundayLabel = new St.Label();
      this.sundayLabel.add_style_class_name("weekday-times");
      this.sundayLabel.text = this.task.weekdays.sunday;
      this.weeklyNumbers.add_actor(this.sundayLabel);


      // Create Label and slider for current time _onSliderValueChange
      let label = new St.Label({text:_("Current time:")});
      label.add_style_class_name("settings-label");
      this.currTimeSlider = new Slider.Slider(this.task.currTime/this.task.time);
      this.currTimeSlider.actor.add_style_class_name("time-slider");
      this.currTimeSlider.connect('value-changed', Lang.bind(this, this._onCurrTimeChange));
      this.currTimeBox.add_actor(label);
      this.currTimeBox.add_actor(this.currTimeSlider.actor);

      this.actor.add_actor(this.weeklyLabels);
      this.actor.add_actor(this.weeklyNumbers);
      this.actor.add_actor((new PopupMenu.PopupSeparatorMenuItem).actor);
      this.actor.add_actor(this.currTimeBox)
  },

  _onCurrTimeChange : function(slider, value){
    let time = Math.floor(value*(this.task.time/60));
    this.task.currTime = time*60;
    this.emit('update_signal', this.task);
    this._updateWeeklyTimes();
  },

  _updateWeeklyTimes : function(){
      this.mondayLabel.text = this.task.weekdays.monday;
      this.tuesdayLabel.text = this.task.weekdays.tuesday;
      this.wednesdayLabel.text = this.task.weekdays.wednesday;
      this.thursdayLabel.text = this.task.weekdays.thursday;
      this.fridayLabel.text = this.task.weekdays.friday;
      this.saturdayLabel.text = this.task.weekdays.saturday;
      this.sundayLabel.text = this.task.weekdays.sunday;
  },

  destroy : function() {
      this.currTimeSlider.actor.disconnect('value-changed');
  }

}
