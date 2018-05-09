function Progress(time, width) {
    let int = ((width - 30) / 5) + 30
    $('#progress').append(`
        <svg width=${width} height="50">
            <rect width="calc(100% - 6px)" x="5" y="5" height="20" rx="8" ry="8" style="fill:rgb(120,120,120); stroke-width:2; stroke:rgb(60,60,60); border-radius: 10px" />
            <rect id="progress-bar" width="0" x="6" y="6" height="18" rx="8" ry="8" style="fill:#FFDE75; border-radius-left: "10px" />
            <text x=${30} y="40" fill="white">8am</text>
            <text x=${1*int} y="40" fill="white">9am</text>
            <text x=${2*int} y="40" fill="white">10am</text>
            <text x=${3*int} y="40" fill="white">11am</text>
            <text x=${4*int} y="40" fill="white">12pm</text>
            <text x=${5*int} y="40" fill="white">1pm</text>
        </svg>`
    )
    UpdateTime(time);
}

function UpdateTime(seconds) {
  $('#progress-bar').attr('width', (seconds*100)/(5*60*60) + '%');
}

$(document).ready(function() {
  $('#progress').click(()=> {
    if (!PAUSED) {
      PAUSED = true;
      console.log(RUNNING);
      Object.keys(RUNNING).forEach(i => {
        RUNNING[i].timer.pause();
        RUNNING[i].marker.pause();
      });
    } else {
      PAUSED = false;
      Object.keys(RUNNING).forEach(i => {
        RUNNING[i].timer.resume();
        RUNNING[i].marker.start();
      });
      runTrips();
    }
  });
});
