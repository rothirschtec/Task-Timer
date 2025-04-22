function generateColor () {
    const hex = () => Math.floor(Math.random() * 255).toString(16).padStart(2, '0');
    return `#${hex()}${hex()}${hex()}`;
}
var generate_color = generateColor;

function convertTime (sec) {
    sec = Math.floor(sec / 60);
    const h = Math.floor(sec / 60);
    const m = sec - h * 60;
    return `${h.toString().padStart(2, ' ')}:${m.toString().padStart(2, '0')}`;
}

function calcTotal (weekdays) {
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

function updateWeeklyTimes (weekdays, day, currTime, totalTime, lastStop = 0) {
    const map = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const key = map[day];
    weekdays[key] = `${convertTime(currTime)}/${convertTime(totalTime)}/${convertTime(lastStop)}`;
    return weekdays;
}

function elapsedTimeInSeconds (date) {
    return Math.floor((Date.now() - date.getTime()) / 1000);
}

function isSameDay (date) {
    const now = new Date();
    return date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();
}

function isNewWeek (date) {
    if (isSameDay(date)) return false;
    const today = (new Date()).getDay() || 7;
    const last = (date.getDay()) || 7;
    const diff = Math.round(Math.abs((Date.now() - date) / 864e5));
    return today <= last || diff > 7;
}

function addNewLines (text, POS = 60) {
    if (text.length <= POS) return text;
    let out = '', line = '';
    for (const word of text.split(' ')) {
        if (line.length + word.length + 1 <= POS)
            line += (line ? ' ' : '') + word;
        else { out += line + '\n '; line = word; }
    }
    return out + line;
}

export {
    generateColor, generate_color,
    convertTime, calcTotal, updateWeeklyTimes,
    elapsedTimeInSeconds, isSameDay, isNewWeek, addNewLines,
};
