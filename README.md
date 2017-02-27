# Stackmat.js

Stackmat.js is a library for JavaScript which helps you to access the Stackmat Timer from your web application.

## Usage

First, create a `Stackmat.Timer` object and pass in a callback function which gets called every time the timer sends a signal - around five times a second.

```javascript
var options = {
  signalReceived: function(state) {
    console.log("Current Time: " + signal.getTimeAsString())
  }
};
var timer = new Stackmat.Timer(options);
```

then enable capturing input by calling `start`

```javascript
timer.start();
```

If you don't want to receive any further data call `timer.stop()`.

The `signalReceived` callback gets one argument: The current state of the Stackmat timer. Available methods on it are:

```javascript
state.getTimeAsString();       // => "0:32.12"
state.getTimeInMilliseconds(); // => 32120
state.isRunning();             // => true
state.isReset();               // => false
state.isLeftHandPressed();     // => true
state.isRightHandPressed();    // => false
```

## Contribute

Build the library:

```shell
npm run build
```

Run tests:

```shell
npm run test

# or

npm run test:auto
```

Run the example:

```shell
npm run example
```
