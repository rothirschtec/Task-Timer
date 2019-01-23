
function generate_color() {
    let red = Math.floor(Math.random()*255).toString(16);
    if (red.length == 1) red = "0" + red;
    let blue = Math.floor(Math.random()*255).toString(16);
    if (blue.length == 1) blue = "0" + blue;
    let green = Math.floor(Math.random()*255).toString(16);
    if (green.length == 1) green = "0" + green;
    return "#" + red + blue + green;
}

function convertTime(time){
    time = Math.floor(time / 60);
    hours = Math.floor(time / 60);
    minutes = time - (hours*60);
    if (minutes < 10) {
        minStr = "0" + minutes.toString();
    } else {
        minStr = minutes.toString();
    }
    hStr = hours.toString();
    return hStr + ":" + minStr;
}

function updateWeeklyTimes(weekdays, day, currTime, totalTime){
    switch(day) {
      case 0:
        weekdays.sunday = convertTime(currTime) + " / " + convertTime(totalTime);
        break;
      case 1:
        weekdays.monday = convertTime(currTime) + " / " + convertTime(totalTime);
        break;
      case 2:
        weekdays.tuesday = convertTime(currTime) + " / " + convertTime(totalTime);
        break;
      case 3:
        weekdays.wednesday = convertTime(currTime) + " / " + convertTime(totalTime);
        break;
      case 4:
        weekdays.thursday = convertTime(currTime) + " / " + convertTime(totalTime);
        break;
      case 5:
        weekdays.friday = convertTime(currTime) + " / " + convertTime(totalTime);
        break;
      case 6:
        weekdays.saturday = convertTime(currTime) + " / " + convertTime(totalTime);
        break;
    }
    return weekdays;
}

function elapsedTimeInSeconds(date){
  now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / 1000);
}

function isSameDay(date){
  now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDay() === now.getDay();
}
