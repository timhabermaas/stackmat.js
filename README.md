# Stackmat.js

[![Build Status](https://travis-ci.org/timhabermaas/stackmat.js.svg?branch=master)](https://travis-ci.org/timhabermaas/stackmat.js)
[![npm version](https://badge.fury.io/js/stackmat.js.svg)](https://www.npmjs.com/package/stackmat.js)

Stackmat.js is a library for JavaScript which helps you to access the Stackmat Timer from your web application.

Demo: http://timhabermaas.github.io/stackmat.js/

## Installation
```shell
npm install stackmat.js
```

## Usage

First, create a `Stackmat.Timer` object and pass in a callback function which gets called every time the timer sends a signal - around five times a second.

```javascript
import { Stackmat } from 'stackmat.js';

const options = {
  signalReceived(state) {
    console.log("Current Time: " + state.getTimeAsString())
  }
};

const timer = new Stackmat.Timer(options);
```

then enable capturing input by calling `start`

```javascript
timer.start();
```

If you don't want to receive any further data call `timer.stop()`.

The `signalReceived` callback gets one argument: The current state of the Stackmat timer.
Available methods on it are:

```javascript
state.getTimeAsString();       // => "0:32.12"
state.getTimeInMilliseconds(); // => 32120
state.isRunning();             // => true
state.isReset();               // => false
state.isLeftHandPressed();     // => true
state.isRightHandPressed();    // => false
```

More options:

```javascript
const options = {
    onNonSupportedBrowser(){...},
    signalReceived(state){...}
}
```


## Contribute

You must have [Node.js](https://nodejs.org).

```shell
# Clone this repository
git clone git@github.com:timhabermaas/stackmat.js.git

# Install the dependencies
cd stackmat.js
npm install
```

Build the library  (and run tests):

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
