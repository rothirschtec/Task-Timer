
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Extension.imports.classes.utils;

const CLOSE_ICON = Gio.icon_new_for_string(Extension.path + "/icons/close_icon.png");
const PLAY_ICON = Gio.icon_new_for_string(Extension.path + "/icons/play_icon.png");
const PAUSE_ICON = Gio.icon_new_for_string(Extension.path + "/icons/pause_icon.png");
const RESTART_ICON = Gio.icon_new_for_string(Extension.path + "/icons/restart_icon.png");
const PROGRESS_BAR_LENGTH = 400;



function Task(task){
  this._init(task);
}
Task.prototype = {
  __proto__: PopupMenu.PopupMenuItem.prototype,
  _init: function(task){
    this.task = task;
    PopupMenu.PopupMenuItem.prototype._init.call(this, this.task.name, false);
    this.actor.add_style_class_name("task");
    this.label.add_style_class_name("label");
    this.durationLabel = new St.Label();
    this.durationLabel.add_style_class_name("durationLabel");
    this.durationLabel.text = Utils.convertTime(this.task.currTime) + "  / " + Utils.convertTime(this.task.time);
    this.actor.add_actor(this.durationLabel);
    var pixels = Math.floor((this.task.currTime / this.task.time) * PROGRESS_BAR_LENGTH);
    this.actor.set_style('background-color:' + this.task.color + '; background-position:' + pixels + 'px 0px;');
    this.connections = [];

    //Set menu buttons
    this.btn_delete = new St.Button({style_class: 'delete_button', label: ''});
    let icon = new St.Icon({icon_size: 12, gicon: CLOSE_ICON, style_class: 'delete_button'});
    this.btn_delete.add_actor(icon);
    this.btn_play = new St.Button({label: ""});
    icon = new St.Icon({icon_size: 12, gicon: PLAY_ICON});
    this.btn_play.add_actor(icon);
    this.btn_pause = new St.Button({label: ""});
    icon = new St.Icon({icon_size: 12, gicon: PAUSE_ICON,});
    this.btn_pause.add_actor(icon);
    this.btn_restart = new St.Button({label: ""});
    icon = new St.Icon({icon_size: 12, gicon: RESTART_ICON,});
    this.btn_restart.add_actor(icon);
    this.actor.add_actor(this.btn_play);
    this.actor.add_actor(this.btn_pause);
    this.actor.add_actor(this.btn_restart);
    this.actor.add_actor(this.btn_delete);
    this.btn_pause.hide();

    //connect buttons to events
    let conn = this.btn_delete.connect('clicked', Lang.bind(this, this._delete_task));
    this.connections.push([this.btn_delete, conn]);
    conn = this.btn_play.connect("clicked", Lang.bind(this, this._startStop));
    this.connections.push([this.btn_play, conn]);
    conn = this.btn_pause.connect("clicked", Lang.bind(this, this._startStop));
    this.connections.push([this.btn_pause, conn]);
    conn = this.btn_restart.connect("clicked", Lang.bind(this, this._restart));
    this.connections.push([this.btn_restart, conn]);
  },

  _update : function(){
      var duration = this.task.time;
          this.task.currTime = this.task.currTime + 1;
          this.task.dateTime = new Date();
          this.task.weekdays = Utils.updateWeeklyTimes(this.task.weekdays, (new Date).getDay(), this.task.currTime, this.task.time);
          this.emit('update_signal', this.task);
          this.durationLabel.text = Utils.convertTime(this.task.currTime) + "  / " + Utils.convertTime(this.task.time);

      if (this.task.currTime == duration){
          Main.notify("Time limit of " + this.task.name + " reached!");
      } else if (this.task.currTime > duration){
          if (this.task.currTime % 2 == 0){
            this.actor.set_style('background-color:' + this.task.color + '; background-position: 400px 0px;');
          } else {
            this.actor.set_style('background-position: 400px 0px;');
          }
      } else {
          var pixels = Math.floor((this.task.currTime / duration) * PROGRESS_BAR_LENGTH);
          this.actor.set_style('background-color:' + this.task.color + '; background-position:' + pixels + 'px 0px;');
      }
      this._time_count_id = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._update));
  },

  _startStop : function(){
      this.task.running = !this.task.running;
      if(this.task.running){
        this.btn_play.hide();
        this.btn_pause.show();
        this.emit('stop_signal', this.task);
        this._update();
      } else {
        if (this.task.currTime > this.task.time){
            this.actor.set_style('background-color:' + this.task.color + '; background-position: 400px 0px;');
        }
        this.btn_play.show();
        this.btn_pause.hide();
        this.emit('update_signal', this.task);
        Mainloop.source_remove(this._time_count_id);
      }
  },

  _restart : function(){
      this.task.currTime = 0;
      this.task.running = false;
      Mainloop.source_remove(this._time_count_id);
      this._startStop();
  },

  destroy: function(){
    Mainloop.source_remove(this._time_count_id);
    for (var connection of this.connections.reverse())
        connection[0].disconnect(connection[1]);
    this.connections = null;
    this.actor.destroy();
  },

  _delete_task: function(){
      this.emit('delete_signal', this.task);
      this.destroy();
  }
}
