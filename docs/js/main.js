(function() {
    'use strict';

    window.onload = function() {
      var timer = new Stackmat.Timer({
        interval: 1000,
        signalReceived: function(state) {
          if (state.isRunning()) {
            document.getElementById("time").className = "running";
            document.getElementById("time").innerHTML = state.getTimeAsString();
          } else if (state.isReset()) {
            document.getElementById("time").className = "";
            document.getElementById("time").innerHTML = "Reset";
          } else {
            document.getElementById("time").className = "stopped";
            document.getElementById("time").innerHTML = state.getTimeAsString();
          }
        }
      });

      timer.start();
    };
})();
