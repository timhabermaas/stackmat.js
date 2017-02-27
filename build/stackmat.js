(function() {
  var Stackmat,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  Stackmat = {};

  Stackmat.State = (function() {
    function State() {
      this.running = false;
      this.digits = [0, 0, 0, 0, 0];
      this.leftHandPressed = false;
      this.rightHandPressed = false;
      this.reset = true;
    }

    State.prototype.update = function(signal) {
      var status;
      this.leftHandPressed = this.rightHandPressed = false;
      status = signal.getStatus();
      switch (status) {
        case " ":
          this.running = true;
          this.reset = false;
          break;
        case "S":
          this.running = false;
          this.reset = false;
          break;
        case "I":
          this.running = false;
          this.reset = true;
          break;
        case "L":
          this.leftHandPressed = true;
          break;
        case "R":
          this.rightHandPressed = true;
          break;
        case "C":
          this.running = false;
          this.leftHandPressed = true;
          this.rightHandPressed = true;
      }
      return this.digits = signal.getDigits();
    };

    State.prototype.isRunning = function() {
      return this.running;
    };

    State.prototype.isReset = function() {
      return this.reset;
    };

    State.prototype.isLeftHandPressed = function() {
      return this.leftHandPressed;
    };

    State.prototype.isRightHandPressed = function() {
      return this.rightHandPressed;
    };

    State.prototype.getTimeAsString = function() {
      return this.digits[0] + ":" + this.digits[1] + this.digits[2] + "." + this.digits[3] + this.digits[4];
    };

    State.prototype.getTimeInMilliseconds = function() {
      var hundreds, seconds;
      seconds = this.digits[0] * 60 + this.digits[1] * 10 + this.digits[2];
      hundreds = this.digits[3] * 10 + this.digits[4];
      return seconds * 1000 + hundreds * 10;
    };

    return State;

  })();

  Stackmat.Signal = (function() {
    function Signal(options) {
      var d;
      this.status = String.fromCharCode(options.status);
      this.digits = (function() {
        var j, len, ref, results;
        ref = options.digits;
        results = [];
        for (j = 0, len = ref.length; j < len; j++) {
          d = ref[j];
          results.push(d - 48);
        }
        return results;
      })();
    }

    Signal.prototype.getStatus = function() {
      return this.status;
    };

    Signal.prototype.getDigits = function() {
      return this.digits;
    };

    return Signal;

  })();

  Stackmat.SignalDecoder = (function() {
    var characterInString, isValidPacket, sumOfDigits;

    function SignalDecoder() {}

    characterInString = function(character, string) {
      return string.indexOf(character) !== -1;
    };

    sumOfDigits = function(digits) {
      var d, m, values;
      values = (function() {
        var j, len, results;
        results = [];
        for (j = 0, len = digits.length; j < len; j++) {
          d = digits[j];
          results.push(d - 48);
        }
        return results;
      })();
      return m = values.reduce(function(t, s) {
        return t + s;
      });
    };

    isValidPacket = function(data) {
      return characterInString(String.fromCharCode(data[0]), "IA SLRC") && characterInString(String.fromCharCode(data[1]), "0123456789") && characterInString(String.fromCharCode(data[2]), "0123456789") && characterInString(String.fromCharCode(data[3]), "0123456789") && characterInString(String.fromCharCode(data[4]), "0123456789") && characterInString(String.fromCharCode(data[5]), "0123456789") && sumOfDigits(data.slice(1, 6)) === data[6] - 64 && data[7] === 10 && data[8] === 13;
    };

    SignalDecoder.prototype.decode = function(data) {
      if (!isValidPacket(data)) {
        return void 0;
      }
      return new Stackmat.Signal({
        status: data[0],
        digits: data.slice(1, 6)
      });
    };

    return SignalDecoder;

  })();

  Stackmat.AudioHardware = (function() {
    function AudioHardware(source, callback) {
      this.source = source;
      this.node = source.context.createJavaScriptNode(4096 * 2, 1, 1);
      this.callback = callback;
      this.node.onaudioprocess = (function(_this) {
        return function(e) {
          return _this.callback(e.inputBuffer.getChannelData(0));
        };
      })(this);
      source.connect(this.node);
      this.node.connect(source.context.destination);
    }

    return AudioHardware;

  })();

  Stackmat.RS232Decoder = (function() {
    var decodeBits, floatSignalToBinary, getBitsFromRunLengthEncodedSignal, getPacket, runLengthEncode;

    function RS232Decoder(ticksPerBit) {
      this.decode = bind(this.decode, this);
      this.findBeginningOfSignal = bind(this.findBeginningOfSignal, this);
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
      var bitsCount, e, i, ref, x;
      x = (function() {
        var j, len, results;
        results = [];
        for (j = 0, len = array.length; j < len; j++) {
          e = array[j];
          results.push((bitsCount = Math.round(e.length / period), (function() {
            var k, ref, results1;
            results1 = [];
            for (i = k = 1, ref = bitsCount; 1 <= ref ? k <= ref : k >= ref; i = 1 <= ref ? ++k : --k) {
              results1.push(e.bit);
            }
            return results1;
          })()));
        }
        return results;
      })();
      return (ref = []).concat.apply(ref, x);
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
      var i, j, results;
      results = [];
      for (i = j = 0; j <= 8; i = ++j) {
        results.push(decodeBits(data, i * 10));
      }
      return results;
    };

    RS232Decoder.prototype.decode = function(data) {
      var bits, e, runLengthEncoded, startIndex;
      bits = (function() {
        var j, len, results;
        results = [];
        for (j = 0, len = data.length; j < len; j++) {
          e = data[j];
          results.push(floatSignalToBinary(e));
        }
        return results;
      })();
      startIndex = this.findBeginningOfSignal(bits);
      runLengthEncoded = runLengthEncode(bits.slice(startIndex, +(bits.length - 1) + 1 || 9e9));
      bits = getBitsFromRunLengthEncodedSignal(runLengthEncoded, this.ticksPerBit);
      return getPacket(bits.slice(1, +(bits.length - 1) + 1 || 9e9));
    };

    return RS232Decoder;

  })();

  Stackmat.Timer = (function() {
    var audioContext, getUserMedia, supported;

    supported = function() {
      return !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
    };

    getUserMedia = function() {
      return navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    };

    audioContext = function() {
      var context, error;
      try {
        context = window.AudioContext || window.webkitAudioContext;
        return new context();
      } catch (error1) {
        error = error1;
        console.error('API Audio not supported. :(', error);
        throw new Error('API Audio not supported. :(');
      }
    };

    function Timer(options) {
      this.stop = bind(this.stop, this);
      this.start = bind(this.start, this);
      this.signalFetched = bind(this.signalFetched, this);
      if (!supported()) {
        alert("You need a recent browser in order to connect your Stackmat Timer.");
        return;
      }
      this.onRunning = options.onRunning || function() {};
      this.onStopping = options.onStopping || function() {};
      this.onResetting = options.onResetting || function() {};
      this.signalReceived = options.signalReceived || function() {};
      this.capturing = false;
      this.state = new Stackmat.State();
      this.rs232Decoder = new Stackmat.RS232Decoder(audioContext().sampleRate / 1200);
      this.stackmatSignalDecoder = new Stackmat.SignalDecoder();
      getUserMedia({
        audio: true
      }, (function(_this) {
        return function(stream) {
          var microphone;
          microphone = audioContext().createMediaStreamSource(stream);
          return _this.device = new Stackmat.AudioHardware(microphone, _this.signalFetched);
        };
      })(this));
    }

    Timer.prototype.signalFetched = function(signal) {
      var packet;
      if (this.capturing) {
        packet = this.rs232Decoder.decode(signal);
        if (packet == null) {
          return;
        }
        signal = this.stackmatSignalDecoder.decode(packet);
        if (signal == null) {
          return;
        }
        this.state.update(signal);
        return this.signalReceived(this.state);
      }
    };

    Timer.prototype.start = function() {
      return this.capturing = true;
    };

    Timer.prototype.stop = function() {
      return this.capturing = false;
    };

    return Timer;

  })();

  (typeof exports !== "undefined" && exports !== null ? exports : this).Stackmat = Stackmat;

}).call(this);
