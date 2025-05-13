// classes/timer_notification.js
// Modal dialog notification for completed timers

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

export const TimerCompletedDialog = GObject.registerClass(
class TimerCompletedDialog extends ModalDialog.ModalDialog {
    _init(taskName, plannedTime) {
        super._init({
            styleClass: 'timer-completed-dialog',
            destroyOnClose: true,
            shellReactive: true,
        });
        
        // Play alert sound (using GLib to access system sound)
        this._playAlertSound();
        
        // Set up auto-dismiss timer (30 seconds)
        this._autoDismissTimeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            30,  // 30 seconds
            () => {
                this.close();
                this._autoDismissTimeoutId = 0;
                return GLib.SOURCE_REMOVE;
            }
        );
        
        // Create a container for the dialog content
        const contentBox = new St.BoxLayout({
            vertical: true,
            style_class: 'timer-completed-content'
        });
        
        // Header with task name
        const headerLabel = new St.Label({
            text: _('Timer Completed!'),
            style_class: 'timer-completed-header'
        });
        
        // Task name 
        const taskLabel = new St.Label({
            text: taskName,
            style_class: 'timer-completed-task-name'
        });
        
        // Time information
        const timeLabel = new St.Label({
            text: _('Planned time (%s) has been reached').format(plannedTime),
            style_class: 'timer-completed-description'
        });
        
        // Add elements to the content box
        contentBox.add_child(headerLabel);
        contentBox.add_child(taskLabel);
        contentBox.add_child(timeLabel);
        
        // Add countdown label
        this._countdownLabel = new St.Label({
            text: _('This notification will close in 30 seconds'),
            style_class: 'timer-completed-countdown'
        });
        contentBox.add_child(this._countdownLabel);
        
        // Start countdown timer
        this._secondsRemaining = 30;
        this._countdownTimerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            1,  // Update every second
            () => {
                this._secondsRemaining--;
                if (this._secondsRemaining <= 0) {
                    return GLib.SOURCE_REMOVE;
                }
                this._countdownLabel.text = _('This notification will close in %d seconds').format(this._secondsRemaining);
                return GLib.SOURCE_CONTINUE;
            }
        );
        
        // Add the content box to the dialog
        this.contentLayout.add_child(contentBox);
        
        // Add action buttons
        this.addButton({
            label: _('Continue Timer'),
            action: () => {
                this.close();
            },
            key: Clutter.KEY_Escape
        });
        
        this.addButton({
            label: _('Snooze (5 min)'),
            action: () => {
                this._snoozeRequested = true;
                this.close();
            }
        });
        
        this.addButton({
            label: _('Stop Timer'),
            action: () => {
                this._shouldStopTimer = true;
                this.close();
            }
        });
        
        // Initialize flags
        this._shouldStopTimer = false;
        this._snoozeRequested = false;
    }
    
    // Getter to check if the timer should be stopped
    get shouldStopTimer() {
        return this._shouldStopTimer;
    }
    
    // Getter for snooze status
    get snoozeRequested() {
        return this._snoozeRequested;
    }
    
    // Clean up when dialog is closed
    close() {
        // Cancel auto-dismiss timer if it's running
        if (this._autoDismissTimeoutId) {
            GLib.source_remove(this._autoDismissTimeoutId);
            this._autoDismissTimeoutId = 0;
        }
        
        // Cancel countdown timer if it's running
        if (this._countdownTimerId) {
            GLib.source_remove(this._countdownTimerId);
            this._countdownTimerId = 0;
        }
        
        // Call parent close method
        super.close();
    }
    
    // Play alert sound using GLib
    _playAlertSound() {
        try {
            // Try to use system's sound-theme-freedesktop to play the 'alarm-clock-elapsed' sound
            GLib.spawn_command_line_async(
                'gdbus call --session --dest org.gnome.Shell ' +
                '--object-path /org/gnome/Shell ' +
                '--method org.gnome.Shell.PlaySystemSound ' +
                'alarm-clock-elapsed'
            );
        } catch (e) {
            log(`TimerCompletedDialog: Could not play sound: ${e.message}`);
            // Try fallback method if available
            try {
                GLib.spawn_command_line_async('canberra-gtk-play -i complete');
            } catch (e2) {
                log(`TimerCompletedDialog: Could not play fallback sound: ${e2.message}`);
            }
        }
    }
});
