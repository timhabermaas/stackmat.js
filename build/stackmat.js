(function() {
  var StackmatSignalDecoder, StackmatState, StackmatTimer,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  StackmatSignalDecoder = (function() {

    function StackmatSignalDecoder() {}

    StackmatSignalDecoder.prototype.decode = function(callback) {
      var s;
      s = {
        status: 'S',
        timeArray: ['1', '1', '0', '0', '1']
      };
      return callback(s);
    };

    return StackmatSignalDecoder;

  })();

  StackmatState = (function() {

    function StackmatState(options) {
      var digits, e, hundreds, seconds;
      digits = (function() {
        var _i, _len, _ref, _results;
        _ref = options.timeArray;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          e = _ref[_i];
          _results.push(e - '0');
        }
        return _results;
      })();
      seconds = digits[0] * 60 + digits[1] * 10 + digits[2];
      hundreds = digits[3] * 10 + digits[4];
      this.time = seconds * 1000 + hundreds;
      this.status = options.status;
    }

    StackmatState.prototype.getCurrentTime = function() {
      return this.time;
    };

    StackmatState.prototype.isRunning = function() {
      return this.status === ' ';
    };

    StackmatState.prototype.isStopped = function() {
      return this.status === 'S';
    };

    return StackmatState;

  })();

  StackmatTimer = (function() {

    function StackmatTimer(options) {
      this.start = __bind(this.start, this);

      this.signalFetched = __bind(this.signalFetched, this);

      this.fetchSignal = __bind(this.fetchSignal, this);
      this.interval = options.interval || 1000;
      this.onRunning = options.onRunning || function() {};
      this.onStopped = options.onStopped || function() {};
    }

    StackmatTimer.prototype.fetchSignal = function() {
      var decoder;
      decoder = new StackmatSignalDecoder();
      return decoder.decode(this.signalFetched);
    };

    StackmatTimer.prototype.signalFetched = function(signal) {
      var state;
      state = new StackmatState(signal);
      if (state == null) {
        return;
      }
      if (state.isRunning()) {
        this.onRunning(state);
      }
      if (state.isStopped()) {
        return this.onStopped(state);
      }
    };

    StackmatTimer.prototype.start = function() {
      return setInterval(this.fetchSignal, this.interval);
    };

    return StackmatTimer;

  })();

  (typeof exports !== "undefined" && exports !== null ? exports : this).StackmatTimer = StackmatTimer;

}).call(this);
