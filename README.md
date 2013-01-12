Stackmat.js
===========

Stackmat.js is a library for JavaScript which helps you to access the Stackmat Timer from your web application.

Usage
-----

First, create a `Stackmat.Timer` object and pass in callback functions for when the timer is *running*, has been *stopped* or has been *reset*

    var options = {
      onRunning: function(signal) { console.log("Current Time: " + signal.getTimeAsString()) },
      onStopped: function(signal) { console.log("Timer stopped") },
      onReset: function(signal) { console.log("Timer reset") }
    };
    var timer = new Stackmat.Timer(options);

then enable capturing input by calling `start`

    timer.start();

If you don't want your callbacks to be called anymore, call `timer.stop()`.

Each callback function gets one argument: The most recent signal of the Stackmat timer — an object of `Stackmat.Signal`. Available methods:

    state.getTimeAsString()       // => "0:32.12"
    state.getTimeInMilliseconds() // => 32120
    state.isRunning()             // => false
    state.isStopped()             // => true
    state.isReset()               // => false

Be aware
--------

The names `onStopped` and `onReset` might suggest that these functions are called exactly once, but that is not the case: Like `onRunning` they are called every time a signal from the Stackmat timer has been received and successfully decoded.