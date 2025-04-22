/* Utility helpers */

export function generateColor () {
    const h = () => Math.floor(Math.random() * 255).toString(16).padStart(2, '0');
    return `#${h()}${h()}${h()}`;
}
export const generate_color = generateColor;   // legacy alias

/** Return “H:MM” rounded to whole minutes */
export function convertTime (sec) {
    sec = Math.floor(sec / 60);
    const h = Math.floor(sec / 60);
    const m = sec - h * 60;
    return `${h.toString().padStart(1, '0')}:${m.toString().padStart(2, '0')}`;
}

/** Return “M:SS” with seconds — used while a task is running */
export function mmss (sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

