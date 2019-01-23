
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

function NewTaskMenu(){
  this._init();
}

NewTaskMenu.prototype = {
  __proto__: PanelMenu.Button.prototype,

  _init : function(){
      PanelMenu.Button.prototype._init.call(this, St.Align.START);
      let icon = new St.Icon({icon_size: 20, gicon: ADD_ICON});
      this.actor.add_actor(icon);
  }
}
