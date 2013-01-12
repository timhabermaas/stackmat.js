(function() {
  var AudioHardware, RS232Decoder, StackmatSignalDecoder, StackmatState, StackmatTimer,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  StackmatState = (function() {

    function StackmatState(options) {
      var d, digits, hundreds, seconds;
      this.digits = (function() {
        var _i, _len, _ref, _results;
        _ref = options.digits;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          d = _ref[_i];
          _results.push(String.fromCharCode(d));
        }
        return _results;
      })();
      digits = (function() {
        var _i, _len, _ref, _results;
        _ref = options.digits;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          d = _ref[_i];
          _results.push(d - 48);
        }
        return _results;
      })();
      seconds = digits[0] * 60 + digits[1] * 10 + digits[2];
      hundreds = digits[3] * 10 + digits[4];
      this.time = seconds * 1000 + hundreds * 10;
      this.status = String.fromCharCode(options.status);
    }

    StackmatState.prototype.getTimeInMilliseconds = function() {
      return this.time;
    };

    StackmatState.prototype.getTimeAsString = function() {
      return "" + this.digits[0] + ":" + this.digits[1] + this.digits[2] + "." + this.digits[3] + this.digits[4];
    };

    StackmatState.prototype.isRunning = function() {
      return this.status === ' ';
    };

    StackmatState.prototype.isStopped = function() {
      return this.status === 'S';
    };

    StackmatState.prototype.isReset = function() {
      return this.status === 'I';
    };

    return StackmatState;

  })();

  StackmatSignalDecoder = (function() {
    var characterInString, isValidPacket, sumOfDigits,
      _this = this;

    function StackmatSignalDecoder() {
      this.decode = __bind(this.decode, this);

    }

    characterInString = function(character, string) {
      return string.indexOf(character) !== -1;
    };

    sumOfDigits = function(digits) {
      var d, m, values;
      values = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = digits.length; _i < _len; _i++) {
          d = digits[_i];
          _results.push(d - 48);
        }
        return _results;
      })();
      return m = values.reduce(function(t, s) {
        return t + s;
      });
    };

    isValidPacket = function(data) {
      return characterInString(String.fromCharCode(data[0]), "IA SLRC") && characterInString(String.fromCharCode(data[1]), "0123456789") && characterInString(String.fromCharCode(data[2]), "0123456789") && characterInString(String.fromCharCode(data[3]), "0123456789") && characterInString(String.fromCharCode(data[4]), "0123456789") && characterInString(String.fromCharCode(data[5]), "0123456789") && sumOfDigits(data.slice(1, 6)) === data[6] - 64 && data[7] === 10 && data[8] === 13;
    };

    StackmatSignalDecoder.prototype.decode = function(data) {
      if (!isValidPacket(data)) {
        return void 0;
      }
      return new StackmatState({
        status: data[0],
        digits: data.slice(1, 6)
      });
    };

    return StackmatSignalDecoder;

  }).call(this);

  AudioHardware = (function() {

    function AudioHardware(source, callback) {
      var _this = this;
      this.source = source;
      this.node = source.context.createJavaScriptNode(4096 * 2, 1, 1);
      this.callback = callback;
      this.node.onaudioprocess = function(e) {
        return _this.callback(e.inputBuffer.getChannelData(0));
      };
      source.connect(this.node);
      this.node.connect(source.context.destination);
    }

    return AudioHardware;

  })();

  RS232Decoder = (function() {
    var decodeBits, floatSignalToBinary, getBitsFromRunLengthEncodedSignal, getPacket, runLengthEncode,
      _this = this;

    function RS232Decoder(ticksPerBit) {
      this.decode = __bind(this.decode, this);

      this.findBeginningOfSignal = __bind(this.findBeginningOfSignal, this);
      this.ticksPerBit = ticksPerBit;
    }

    floatSignalToBinary = function(signal) {
      if (signal < 0) {
        return 1;
      }
      if (signal > 0) {
        return 0;
      }
      return void 0;
    };

    RS232Decoder.prototype.findBeginningOfSignal = function(data) {
      var bit, i, oneCount, waitingForZero;
      oneCount = 0;
      waitingForZero = false;
      i = 0;
      while (i < data.length) {
        bit = data[i];
        if (bit === 1) {
          oneCount += 1;
        }
        if (oneCount > 9 * this.ticksPerBit) {
          waitingForZero = true;
        }
        if (bit === 0) {
          oneCount = 0;
          if (waitingForZero) {
            return i;
          }
        }
        i += 1;
      }
      return void 0;
    };

    runLengthEncode = function(data) {
      var i, lastBit, result;
      lastBit = -1;
      result = [];
      i = 0;
      while (i < data.length) {
        if (lastBit !== data[i]) {
          result.push({
            bit: data[i],
            length: 1
          });
          lastBit = data[i];
        } else {
          result[result.length - 1].length += 1;
        }
        i += 1;
      }
      return result;
    };

    getBitsFromRunLengthEncodedSignal = function(array, period) {
      var bitsCount, e, i, x, _ref;
      x = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = array.length; _i < _len; _i++) {
          e = array[_i];
          _results.push((bitsCount = Math.round(e.length / period), (function() {
            var _j, _results1;
            _results1 = [];
            for (i = _j = 1; 1 <= bitsCount ? _j <= bitsCount : _j >= bitsCount; i = 1 <= bitsCount ? ++_j : --_j) {
              _results1.push(e.bit);
            }
            return _results1;
          })()));
        }
        return _results;
      })();
      return (_ref = []).concat.apply(_ref, x);
    };

    decodeBits = function(data, offset) {
      var i, result;
      result = 0;
      i = 0;
      while (i < 8) {
        result += data[offset + i] << i;
        i += 1;
      }
      return result;
    };

    getPacket = function(data) {
      var i, _i, _results;
      _results = [];
      for (i = _i = 0; _i <= 8; i = ++_i) {
        _results.push(decodeBits(data, i * 10));
      }
      return _results;
    };

    RS232Decoder.prototype.decode = function(data) {
      var bits, e, runLengthEncoded, startIndex;
      bits = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = data.length; _i < _len; _i++) {
          e = data[_i];
          _results.push(floatSignalToBinary(e));
        }
        return _results;
      })();
      startIndex = this.findBeginningOfSignal(bits);
      runLengthEncoded = runLengthEncode(bits.slice(startIndex, +(bits.length - 1) + 1 || 9e9));
      bits = getBitsFromRunLengthEncodedSignal(runLengthEncoded, this.ticksPerBit);
      return getPacket(bits.slice(1, +(bits.length - 1) + 1 || 9e9));
    };

    return RS232Decoder;

  }).call(this);

  StackmatTimer = (function() {
    var audioContext, supported,
      _this = this;

    supported = function() {
      return !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
    };

    audioContext = function() {
      if (typeof AudioContext === "function") {
        return new AudioContext();
      } else if (typeof webkitAudioContext === "function") {
        return new webkitAudioContext();
      } else {
        throw new Error('AudioContext not supported. :(');
      }
    };

    function StackmatTimer(options) {
      this.stop = __bind(this.stop, this);

      this.start = __bind(this.start, this);

      this.signalFetched = __bind(this.signalFetched, this);

      var _this = this;
      if (!supported()) {
        alert("You need a recent browser in order to connect your Stackmat Timer.");
        return;
      }
      this.onRunning = options.onRunning || function() {};
      this.onStopped = options.onStopped || function() {};
      this.onReset = options.onReset || function() {};
      this.capturing = false;
      this.rs232Decoder = new RS232Decoder(audioContext().sampleRate / 1200);
      this.stackmatSignalDecoder = new StackmatSignalDecoder();
      navigator.webkitGetUserMedia({
        audio: true
      }, function(stream) {
        var microphone;
        microphone = audioContext().createMediaStreamSource(stream);
        return _this.device = new AudioHardware(microphone, _this.signalFetched);
      });
    }

    StackmatTimer.prototype.signalFetched = function(signal) {
      var packet, state;
      if (this.capturing) {
        packet = this.rs232Decoder.decode(signal);
        if (packet == null) {
          return;
        }
        state = this.stackmatSignalDecoder.decode(packet);
        if (state == null) {
          return;
        }
        if (state.isRunning()) {
          this.onRunning(state);
        }
        if (state.isStopped()) {
          this.onStopped(state);
        }
        if (state.isReset()) {
          return this.onReset(state);
        }
      }
    };

    StackmatTimer.prototype.start = function() {
      return this.capturing = true;
    };

    StackmatTimer.prototype.stop = function() {
      return this.capturing = false;
    };

    return StackmatTimer;

  }).call(this);

  (typeof exports !== "undefined" && exports !== null ? exports : this).StackmatTimer = StackmatTimer;

}).call(this);
