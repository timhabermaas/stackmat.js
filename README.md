Stackmat.js
===========

Stackmat.js is a library for JavaScript which helps you to access the Stackmat Timer from your web application.

Usage
-----

First, create a `StackmatTimer` object and pass in callback functions for when the timer is *running*, has been *stopped* or has been *reset*

    var options = {
      onRunning: function(state) { console.log("Current Time: " + state.getTimeAsString()) },
      onStopped: function(state) { console.log("Timer stopped") },
      onReset: function(state) { console.log("Timer reset") }
    };
    var timer = new StackmatTimer(options);

then enable capturing input by calling `start`

    timer.start();

If you don't want your callbacks to be called anymore, call `timer.stop()`.

Each callback function gets one argument: The current state of the Stackmat timer — an object of `StackmatState`. Available methods:

    state.getTimeAsString()       // => "0:32.12"
    state.getTimeInMilliseconds() // => 32120
    state.isRunning()             // => false
    state.isStopped()             // => true
    state.isReset()               // => false

Be aware
--------

The names `onStopped` and `onReset` might suggest that these functions are called exactly once, but that is not the case: Like `onRunning` they are called every time a signal from the Stackmat timer has been received and successfully decoded.