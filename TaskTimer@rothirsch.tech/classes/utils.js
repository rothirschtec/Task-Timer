/* Utility helpers — ES module */

export function generateColor() {
    const h = () => Math.floor(Math.random() * 255).toString(16).padStart(2, '0');
    return `#${h()}${h()}${h()}`;
}
export const generate_color = generateColor;          // legacy alias

export function convertTime(sec) {
    sec = Math.floor(sec / 60);
    const h = Math.floor(sec / 60);
    const m = sec - h * 60;
    return `${h.toString().padStart(1, '0')}:${m.toString().padStart(2, '0')}`;
}
export function mmss(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ------- weekly helpers (unchanged from original) ------- */
export function calcTotal(weekdays) {
    let totMax = 0, totCurr = 0;
    for (const key in weekdays) {
        const [curr, max] = weekdays[key].split('/');
        const [ch, cm] = curr.split(':').map(Number);
        const [mh, mm] = max .split(':').map(Number);
        totCurr += ch * 3600 + cm * 60;
        totMax  += mh * 3600 + mm * 60;
    }
    return `${convertTime(totCurr)}\n${convertTime(totMax)}`;
}
export function updateWeeklyTimes (weekdays, day, currTime, totalTime, lastStop = 0) {
    const map = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const key = map[day];
    weekdays[key] =
        `${convertTime(currTime)}/${convertTime(totalTime)}/${convertTime(lastStop)}`;
    return weekdays;
}
export function elapsedTimeInSeconds(date) {
    return Math.floor((Date.now() - date.getTime()) / 1000);
}
export function isSameDay(date) {
    const now = new Date();
    return date.getFullYear() === now.getFullYear()
        && date.getMonth()    === now.getMonth()
        && date.getDate()     === now.getDate();
}
export function isNewWeek(date) {
    if (isSameDay(date)) return false;
    const today = (new Date()).getDay() || 7;
    const last  = (date.getDay())       || 7;
    const diff  = Math.round(Math.abs((Date.now() - date) / 864e5));
    return today <= last || diff > 7;
}
export function addNewLines(text, POS = 60) {
    if (text.length <= POS) return text;
    let out = '', line = '';
    for (const word of text.split(' ')) {
        if (line.length + word.length + 1 <= POS)
            line += (line ? ' ' : '') + word;
        else { out += line + '\n '; line = word; }
    }
    return out + line;
}

/* Parse time input in various formats (mm:ss, mmm, etc.) */
export function parseTimeInput(text) {
    // Handle empty or invalid input
    if (!text || text.trim() === '') {
        return null;
    }
    
    // Check for mm:ss format
    if (text.includes(':')) {
        const parts = text.split(':');
        if (parts.length === 2) {
            const minutes = parseInt(parts[0], 10);
            const seconds = parseInt(parts[1], 10);
            
            if (!isNaN(minutes) && !isNaN(seconds) && seconds < 60) {
                return (minutes * 60) + seconds;
            }
        }
    } 
    // Handle single number as minutes
    else {
        const minutes = parseInt(text, 10);
        if (!isNaN(minutes)) {
            return minutes * 60;
        }
    }
    
    return null; // Invalid input
}
