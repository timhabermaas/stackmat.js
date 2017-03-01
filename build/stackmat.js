/**
 * stackmat.js - Access the Stackmat Timer from within JavaScript using the HTML5 Audio API.
 * @version v1.0.0 - Wed Mar 01 2017 20:04:38 GMT+0100 (CET)
 * @link https://github.com/timhabermaas/stackmat.js
 * @license MIT
 */
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
        if (options != null ? options.onNonSupportedBrowser : void 0) {
          options.onNonSupportedBrowser();
        } else {
          alert("You need a recent browser in order to connect your Stackmat Timer.");
        }
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LENBQUEscUJBQUQsR0FBeUIsSUFBSSxRQUFRLENBQUMsYUFBYixDQUFBO01BRXpCLFlBQUEsQ0FBYTtRQUFDLEtBQUEsRUFBTyxJQUFSO09BQWIsRUFBNEIsQ0FBQSxTQUFBLEtBQUE7ZUFBQSxTQUFDLE1BQUQ7QUFDMUIsY0FBQTtVQUFBLFVBQUEsR0FBYSxZQUFBLENBQUEsQ0FBYyxDQUFDLHVCQUFmLENBQXVDLE1BQXZDO2lCQUNiLEtBQUMsQ0FBQSxNQUFELEdBQVUsSUFBSSxRQUFRLENBQUMsYUFBYixDQUEyQixVQUEzQixFQUF1QyxLQUFDLENBQUEsYUFBeEM7UUFGZ0I7TUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQTVCO0lBckJXOztvQkF5QmIsYUFBQSxHQUFlLFNBQUMsTUFBRDtBQUNiLFVBQUE7TUFBQSxJQUFHLElBQUMsQ0FBQSxTQUFKO1FBQ0UsTUFBQSxHQUFTLElBQUMsQ0FBQSxZQUFZLENBQUMsTUFBZCxDQUFxQixNQUFyQjtRQUNULElBQWMsY0FBZDtBQUFBLGlCQUFBOztRQUVBLE1BQUEsR0FBUyxJQUFDLENBQUEscUJBQXFCLENBQUMsTUFBdkIsQ0FBOEIsTUFBOUI7UUFDVCxJQUFjLGNBQWQ7QUFBQSxpQkFBQTs7UUFFQSxJQUFDLENBQUEsS0FBSyxDQUFDLE1BQVAsQ0FBYyxNQUFkO2VBQ0EsSUFBQyxDQUFBLGNBQUQsQ0FBZ0IsSUFBQyxDQUFBLEtBQWpCLEVBUkY7O0lBRGE7O29CQVdmLEtBQUEsR0FBTyxTQUFBO2FBQ0wsSUFBQyxDQUFBLFNBQUQsR0FBYTtJQURSOztvQkFHUCxJQUFBLEdBQU0sU0FBQTthQUNKLElBQUMsQ0FBQSxTQUFELEdBQWE7SUFEVDs7Ozs7O0VBR1Isc0RBQUMsVUFBVSxJQUFYLENBQWdCLENBQUMsUUFBakIsR0FBNEI7QUFsUDVCIiwiZmlsZSI6InN0YWNrbWF0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiU3RhY2ttYXQgPSB7fVxuXG5jbGFzcyBTdGFja21hdC5TdGF0ZVxuICBjb25zdHJ1Y3RvcjogLT5cbiAgICBAcnVubmluZyA9IGZhbHNlXG4gICAgQGRpZ2l0cyA9IFswLCAwLCAwLCAwLCAwXVxuICAgIEBsZWZ0SGFuZFByZXNzZWQgPSBmYWxzZVxuICAgIEByaWdodEhhbmRQcmVzc2VkID0gZmFsc2VcbiAgICBAcmVzZXQgPSB0cnVlXG5cbiAgdXBkYXRlOiAoc2lnbmFsKSAtPlxuICAgIEBsZWZ0SGFuZFByZXNzZWQgPSBAcmlnaHRIYW5kUHJlc3NlZCA9IGZhbHNlXG5cbiAgICBzdGF0dXMgPSBzaWduYWwuZ2V0U3RhdHVzKCkgIyBUT0RPIHN0YXR1cyB2cyBzdGF0ZSBpcyB2ZXJ5IGNvbmZ1c2luZ1xuXG4gICAgc3dpdGNoIHN0YXR1c1xuICAgICAgd2hlbiBcIiBcIlxuICAgICAgICBAcnVubmluZyA9IHRydWVcbiAgICAgICAgQHJlc2V0ID0gZmFsc2VcbiAgICAgIHdoZW4gXCJTXCJcbiAgICAgICAgQHJ1bm5pbmcgPSBmYWxzZVxuICAgICAgICBAcmVzZXQgPSBmYWxzZVxuICAgICAgd2hlbiBcIklcIlxuICAgICAgICBAcnVubmluZyA9IGZhbHNlXG4gICAgICAgIEByZXNldCA9IHRydWVcbiAgICAgIHdoZW4gXCJMXCJcbiAgICAgICAgQGxlZnRIYW5kUHJlc3NlZCA9IHRydWVcbiAgICAgIHdoZW4gXCJSXCJcbiAgICAgICAgQHJpZ2h0SGFuZFByZXNzZWQgPSB0cnVlXG4gICAgICB3aGVuIFwiQ1wiXG4gICAgICAgIEBydW5uaW5nID0gZmFsc2VcbiAgICAgICAgQGxlZnRIYW5kUHJlc3NlZCA9IHRydWVcbiAgICAgICAgQHJpZ2h0SGFuZFByZXNzZWQgPSB0cnVlXG5cbiAgICBAZGlnaXRzID0gc2lnbmFsLmdldERpZ2l0cygpXG5cbiAgaXNSdW5uaW5nOiAtPlxuICAgIEBydW5uaW5nXG5cbiAgaXNSZXNldDogLT5cbiAgICBAcmVzZXRcblxuICBpc0xlZnRIYW5kUHJlc3NlZDogLT5cbiAgICBAbGVmdEhhbmRQcmVzc2VkXG5cbiAgaXNSaWdodEhhbmRQcmVzc2VkOiAtPlxuICAgIEByaWdodEhhbmRQcmVzc2VkXG5cbiAgZ2V0VGltZUFzU3RyaW5nOiAtPlxuICAgIFwiI3tAZGlnaXRzWzBdfToje0BkaWdpdHNbMV19I3tAZGlnaXRzWzJdfS4je0BkaWdpdHNbM119I3tAZGlnaXRzWzRdfVwiXG5cbiAgZ2V0VGltZUluTWlsbGlzZWNvbmRzOiAtPlxuICAgIHNlY29uZHMgPSBAZGlnaXRzWzBdICogNjAgKyBAZGlnaXRzWzFdICogMTAgKyBAZGlnaXRzWzJdXG4gICAgaHVuZHJlZHMgPSBAZGlnaXRzWzNdICogMTAgKyBAZGlnaXRzWzRdXG4gICAgc2Vjb25kcyAqIDEwMDAgKyBodW5kcmVkcyAqIDEwXG5cbmNsYXNzIFN0YWNrbWF0LlNpZ25hbFxuICBjb25zdHJ1Y3RvcjogKG9wdGlvbnMpIC0+ICMgVE9ETyByZW5hbWUgb3B0aW9uc1xuICAgIEBzdGF0dXMgPSBTdHJpbmcuZnJvbUNoYXJDb2RlIG9wdGlvbnMuc3RhdHVzXG4gICAgQGRpZ2l0cyA9IChkIC0gNDggZm9yIGQgaW4gb3B0aW9ucy5kaWdpdHMpXG5cbiAgZ2V0U3RhdHVzOiAtPlxuICAgIEBzdGF0dXNcblxuICBnZXREaWdpdHM6IC0+XG4gICAgQGRpZ2l0c1xuXG5jbGFzcyBTdGFja21hdC5TaWduYWxEZWNvZGVyXG4gIGNoYXJhY3RlckluU3RyaW5nID0gKGNoYXJhY3Rlciwgc3RyaW5nKSAtPlxuICAgIHN0cmluZy5pbmRleE9mKGNoYXJhY3RlcikgaXNudCAtMVxuXG4gIHN1bU9mRGlnaXRzID0gKGRpZ2l0cykgLT5cbiAgICB2YWx1ZXMgPSAoZCAtIDQ4IGZvciBkIGluIGRpZ2l0cylcbiAgICBtID0gdmFsdWVzLnJlZHVjZSAodCwgcykgLT4gdCArIHNcblxuICBpc1ZhbGlkUGFja2V0ID0gKGRhdGEpIC0+ICMgVE9ETyBwZXJmb3JtYW5jZVxuICAgIGNoYXJhY3RlckluU3RyaW5nKFN0cmluZy5mcm9tQ2hhckNvZGUoZGF0YVswXSksIFwiSUEgU0xSQ1wiKSBhbmRcbiAgICBjaGFyYWN0ZXJJblN0cmluZyhTdHJpbmcuZnJvbUNoYXJDb2RlKGRhdGFbMV0pLCBcIjAxMjM0NTY3ODlcIikgYW5kXG4gICAgY2hhcmFjdGVySW5TdHJpbmcoU3RyaW5nLmZyb21DaGFyQ29kZShkYXRhWzJdKSwgXCIwMTIzNDU2Nzg5XCIpIGFuZFxuICAgIGNoYXJhY3RlckluU3RyaW5nKFN0cmluZy5mcm9tQ2hhckNvZGUoZGF0YVszXSksIFwiMDEyMzQ1Njc4OVwiKSBhbmRcbiAgICBjaGFyYWN0ZXJJblN0cmluZyhTdHJpbmcuZnJvbUNoYXJDb2RlKGRhdGFbNF0pLCBcIjAxMjM0NTY3ODlcIikgYW5kXG4gICAgY2hhcmFjdGVySW5TdHJpbmcoU3RyaW5nLmZyb21DaGFyQ29kZShkYXRhWzVdKSwgXCIwMTIzNDU2Nzg5XCIpIGFuZFxuICAgIHN1bU9mRGlnaXRzKGRhdGFbMS4uNV0pIGlzIGRhdGFbNl0gLSA2NCBhbmRcbiAgICBkYXRhWzddIGlzIDEwIGFuZFxuICAgIGRhdGFbOF0gaXMgMTNcblxuICBkZWNvZGU6IChkYXRhKSAtPlxuICAgIHJldHVybiB1bmRlZmluZWQgdW5sZXNzIGlzVmFsaWRQYWNrZXQoZGF0YSlcblxuICAgIG5ldyBTdGFja21hdC5TaWduYWxcbiAgICAgIHN0YXR1czogZGF0YVswXVxuICAgICAgZGlnaXRzOiBkYXRhWzEuLjVdICMgVE9ETyBbMS4uNV0gZHVwbGljYXRlZFxuXG5jbGFzcyBTdGFja21hdC5BdWRpb0hhcmR3YXJlXG4gIGNvbnN0cnVjdG9yOiAoc291cmNlLCBjYWxsYmFjaykgLT5cbiAgICBAc291cmNlID0gc291cmNlXG4gICAgIyAzNi43NSBwcm8gYml0LiA5IGJ5dGVzLCAxMCBiaXRzL2J5dGUgPT4gOTAgYml0ID0+IDkwKjM2Ljc1ID0gMzMwNyB0aWNrcy4gPT4gbWluIDMzMDcqMiA9IDY2MDggdGlja3NcbiAgICBAbm9kZSA9IHNvdXJjZS5jb250ZXh0LmNyZWF0ZUphdmFTY3JpcHROb2RlKDQwOTYgKiAyLCAxLCAxKVxuICAgIEBjYWxsYmFjayA9IGNhbGxiYWNrXG4gICAgQG5vZGUub25hdWRpb3Byb2Nlc3MgPSAoZSkgPT5cbiAgICAgIEBjYWxsYmFjayhlLmlucHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDApKVxuXG4gICAgc291cmNlLmNvbm5lY3QoQG5vZGUpXG4gICAgQG5vZGUuY29ubmVjdChzb3VyY2UuY29udGV4dC5kZXN0aW5hdGlvbilcblxuY2xhc3MgU3RhY2ttYXQuUlMyMzJEZWNvZGVyXG4gIGNvbnN0cnVjdG9yOiAodGlja3NQZXJCaXQpIC0+XG4gICAgQHRpY2tzUGVyQml0ID0gdGlja3NQZXJCaXRcblxuICBmbG9hdFNpZ25hbFRvQmluYXJ5ID0gKHNpZ25hbCkgLT5cbiAgICBpZiBzaWduYWwgPCAwXG4gICAgICByZXR1cm4gMVxuICAgIGlmIHNpZ25hbCA+IDBcbiAgICAgIHJldHVybiAwXG4gICAgcmV0dXJuIHVuZGVmaW5lZFxuXG4gIGZpbmRCZWdpbm5pbmdPZlNpZ25hbDogKGRhdGEpID0+XG4gICAgb25lQ291bnQgPSAwXG4gICAgd2FpdGluZ0Zvclplcm8gPSBmYWxzZVxuXG4gICAgaSA9IDBcbiAgICB3aGlsZSBpIDwgZGF0YS5sZW5ndGhcbiAgICAgIGJpdCA9IGRhdGFbaV1cbiAgICAgIGlmIGJpdCBpcyAxXG4gICAgICAgIG9uZUNvdW50ICs9IDFcbiAgICAgIGlmIG9uZUNvdW50ID4gOSAqIEB0aWNrc1BlckJpdCAjIHRoZXJlJ3Mgbm8gYnl0ZSBpbiBhIHBhY2thZ2Ugd2hpY2ggY29udGFpbnMgOCBiaXRzIG9mIDFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjIHRoYXQgdHJhbnNsYXRlcyB0byA5ICogdGlja3NQZXJCaXRcbiAgICAgICAgd2FpdGluZ0Zvclplcm8gPSB0cnVlXG4gICAgICBpZiBiaXQgaXMgMFxuICAgICAgICBvbmVDb3VudCA9IDBcbiAgICAgICAgaWYgd2FpdGluZ0Zvclplcm9cbiAgICAgICAgICByZXR1cm4gaVxuICAgICAgaSArPSAxICMgVE9ETyByZWFycmFuZ2VcblxuICAgIHJldHVybiB1bmRlZmluZWRcblxuICBydW5MZW5ndGhFbmNvZGUgPSAoZGF0YSkgLT5cbiAgICBsYXN0Qml0ID0gLTFcbiAgICByZXN1bHQgPSBbXVxuXG4gICAgaSA9IDBcbiAgICB3aGlsZSBpIDwgZGF0YS5sZW5ndGhcbiAgICAgIGlmIGxhc3RCaXQgaXNudCBkYXRhW2ldXG4gICAgICAgIHJlc3VsdC5wdXNoIHtiaXQ6IGRhdGFbaV0sIGxlbmd0aDogMX1cbiAgICAgICAgbGFzdEJpdCA9IGRhdGFbaV1cbiAgICAgIGVsc2VcbiAgICAgICAgcmVzdWx0W3Jlc3VsdC5sZW5ndGggLSAxXS5sZW5ndGggKz0gMVxuICAgICAgaSArPSAxXG5cbiAgICByZXN1bHRcblxuICBnZXRCaXRzRnJvbVJ1bkxlbmd0aEVuY29kZWRTaWduYWwgPSAoYXJyYXksIHBlcmlvZCkgLT5cbiAgICB4ID0gKChcbiAgICAgIGJpdHNDb3VudCA9IE1hdGgucm91bmQoZS5sZW5ndGggLyBwZXJpb2QpXG4gICAgICAoZS5iaXQgZm9yIGkgaW4gWzEuLmJpdHNDb3VudF0pXG4gICAgKSBmb3IgZSBpbiBhcnJheSlcbiAgICBbXS5jb25jYXQgeC4uLlxuXG4gIGRlY29kZUJpdHMgPSAoZGF0YSwgb2Zmc2V0KSAtPlxuICAgIHJlc3VsdCA9IDBcbiAgICBpID0gMFxuICAgIHdoaWxlIGkgPCA4ICMgVE9ETyByZXdyaXRlIGluIENvZmZlZVNjcmlwdFxuICAgICAgcmVzdWx0ICs9IGRhdGFbb2Zmc2V0ICsgaV0gPDwgaVxuICAgICAgaSArPSAxXG4gICAgcmVzdWx0XG5cbiAgZ2V0UGFja2V0ID0gKGRhdGEpIC0+XG4gICAgKGRlY29kZUJpdHMoZGF0YSwgaSAqIDEwKSBmb3IgaSBpbiBbMC4uOF0pXG5cbiAgZGVjb2RlOiAoZGF0YSkgPT5cbiAgICBiaXRzID0gKGZsb2F0U2lnbmFsVG9CaW5hcnkoZSkgZm9yIGUgaW4gZGF0YSlcbiAgICBzdGFydEluZGV4ID0gQGZpbmRCZWdpbm5pbmdPZlNpZ25hbChiaXRzKVxuXG4gICAgcnVuTGVuZ3RoRW5jb2RlZCA9IHJ1bkxlbmd0aEVuY29kZShiaXRzW3N0YXJ0SW5kZXguLihiaXRzLmxlbmd0aCAtIDEpXSlcbiAgICBiaXRzID0gZ2V0Qml0c0Zyb21SdW5MZW5ndGhFbmNvZGVkU2lnbmFsKHJ1bkxlbmd0aEVuY29kZWQsIEB0aWNrc1BlckJpdClcbiAgICBnZXRQYWNrZXQoYml0c1sxLi4oYml0cy5sZW5ndGggLSAxKV0pXG5cbmNsYXNzIFN0YWNrbWF0LlRpbWVyXG4gIHN1cHBvcnRlZCA9IC0+XG4gICAgISEobmF2aWdhdG9yLmdldFVzZXJNZWRpYSBvclxuICAgICAgbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSBvclxuICAgICAgbmF2aWdhdG9yLm1vekdldFVzZXJNZWRpYSBvclxuICAgICAgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhKVxuXG4gIGdldFVzZXJNZWRpYSA9IC0+XG4gICAgIyBGSVhNRSA6IGBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhYCBpcyBkZXByZWNhdGVkLiAoaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL05hdmlnYXRvci9nZXRVc2VyTWVkaWEpXG4gICAgIyBNdXN0IHVzZSB0aGUgbmV3IEFQSSA6IGBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYWAgKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2ZyL2RvY3MvV2ViL0FQSS9NZWRpYURldmljZXMvZ2V0VXNlck1lZGlhKVxuICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgb3JcbiAgICAgIG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEgb3JcbiAgICAgIG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgb3JcbiAgICAgIG5hdmlnYXRvci5tc0dldFVzZXJNZWRpYVxuXG4gIGF1ZGlvQ29udGV4dCA9IC0+XG4gICAgdHJ5XG4gICAgICBjb250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCBvciB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0XG4gICAgICBuZXcgY29udGV4dCgpXG4gICAgY2F0Y2ggZXJyb3JcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0FQSSBBdWRpbyBub3Qgc3VwcG9ydGVkLiA6KCcsIGVycm9yKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBUEkgQXVkaW8gbm90IHN1cHBvcnRlZC4gOignKVxuXG4gIGNvbnN0cnVjdG9yOiAob3B0aW9ucykgLT5cbiAgICBpZiBub3Qgc3VwcG9ydGVkKClcbiAgICAgIGlmIG9wdGlvbnM/Lm9uTm9uU3VwcG9ydGVkQnJvd3NlclxuICAgICAgICBvcHRpb25zLm9uTm9uU3VwcG9ydGVkQnJvd3NlcigpXG4gICAgICBlbHNlXG4gICAgICAgIGFsZXJ0IFwiWW91IG5lZWQgYSByZWNlbnQgYnJvd3NlciBpbiBvcmRlciB0byBjb25uZWN0IHlvdXIgU3RhY2ttYXQgVGltZXIuXCJcbiAgICAgIHJldHVyblxuXG4gICAgIyBUT0RPIDogaW1wbGVtZW50IHRob3NlIDMgb3B0aW9uc1xuICAgIEBvblJ1bm5pbmcgPSBvcHRpb25zLm9uUnVubmluZyBvciAtPlxuICAgIEBvblN0b3BwaW5nID0gb3B0aW9ucy5vblN0b3BwaW5nIG9yIC0+XG4gICAgQG9uUmVzZXR0aW5nID0gb3B0aW9ucy5vblJlc2V0dGluZyBvciAtPlxuXG4gICAgQHNpZ25hbFJlY2VpdmVkID0gb3B0aW9ucy5zaWduYWxSZWNlaXZlZCBvciAtPlxuICAgIEBjYXB0dXJpbmcgPSBmYWxzZVxuXG4gICAgQHN0YXRlID0gbmV3IFN0YWNrbWF0LlN0YXRlKClcblxuICAgIEByczIzMkRlY29kZXIgPSBuZXcgU3RhY2ttYXQuUlMyMzJEZWNvZGVyKGF1ZGlvQ29udGV4dCgpLnNhbXBsZVJhdGUgLyAxMjAwKVxuICAgIEBzdGFja21hdFNpZ25hbERlY29kZXIgPSBuZXcgU3RhY2ttYXQuU2lnbmFsRGVjb2RlcigpXG5cbiAgICBnZXRVc2VyTWVkaWEge2F1ZGlvOiB0cnVlfSwgKHN0cmVhbSkgPT5cbiAgICAgIG1pY3JvcGhvbmUgPSBhdWRpb0NvbnRleHQoKS5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzdHJlYW0pXG4gICAgICBAZGV2aWNlID0gbmV3IFN0YWNrbWF0LkF1ZGlvSGFyZHdhcmUobWljcm9waG9uZSwgQHNpZ25hbEZldGNoZWQpXG5cbiAgc2lnbmFsRmV0Y2hlZDogKHNpZ25hbCkgPT5cbiAgICBpZiBAY2FwdHVyaW5nXG4gICAgICBwYWNrZXQgPSBAcnMyMzJEZWNvZGVyLmRlY29kZShzaWduYWwpXG4gICAgICByZXR1cm4gdW5sZXNzIHBhY2tldD9cblxuICAgICAgc2lnbmFsID0gQHN0YWNrbWF0U2lnbmFsRGVjb2Rlci5kZWNvZGUocGFja2V0KVxuICAgICAgcmV0dXJuIHVubGVzcyBzaWduYWw/XG5cbiAgICAgIEBzdGF0ZS51cGRhdGUoc2lnbmFsKVxuICAgICAgQHNpZ25hbFJlY2VpdmVkKEBzdGF0ZSlcblxuICBzdGFydDogPT5cbiAgICBAY2FwdHVyaW5nID0gdHJ1ZVxuXG4gIHN0b3A6ID0+XG4gICAgQGNhcHR1cmluZyA9IGZhbHNlXG5cbihleHBvcnRzID8gdGhpcykuU3RhY2ttYXQgPSBTdGFja21hdFxuIl19
