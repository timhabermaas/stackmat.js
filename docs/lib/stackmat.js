/**
 * stackmat.js - Access the Stackmat Timer from within JavaScript using the HTML5 Audio API.
 * @version v1.0.0 - Thu Apr 05 2018 00:09:03 GMT+0200 (CEST)
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

    characterInString = function(character, value) {
      return value.indexOf(character) !== -1;
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
      this.node = source.context.createScriptProcessor(4096 * 2, 1, 1);
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
      var fail, success;
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
      success = (function(_this) {
        return function(stream) {
          var microphone;
          microphone = audioContext().createMediaStreamSource(stream);
          return _this.device = new Stackmat.AudioHardware(microphone, _this.signalFetched);
        };
      })(this);
      fail = function(err) {
        return console.log("Fail to connect to audio device", err);
      };
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({
          audio: {
            optional: [
              {
                echoCancellation: false
              }
            ]
          }
        }).then(success)["catch"](fail);
      } else {
        getUserMedia().call(navigator, {
          audio: {
            optional: [
              {
                echoCancellation: false
              }
            ]
          }
        }, success, fail);
      }
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QTs7UUFFQSxNQUFBLEdBQVMsSUFBQyxDQUFBLHFCQUFxQixDQUFDLE1BQXZCLENBQThCLE1BQTlCO1FBQ1QsSUFBYyxjQUFkO0FBQUEsaUJBQUE7O1FBRUEsSUFBQyxDQUFBLEtBQUssQ0FBQyxNQUFQLENBQWMsTUFBZDtlQUNBLElBQUMsQ0FBQSxjQUFELENBQWdCLElBQUMsQ0FBQSxLQUFqQixFQVJGOztJQURhOztvQkFXZixLQUFBLEdBQU8sU0FBQTthQUNMLElBQUMsQ0FBQSxTQUFELEdBQWE7SUFEUjs7b0JBR1AsSUFBQSxHQUFNLFNBQUE7YUFDSixJQUFDLENBQUEsU0FBRCxHQUFhO0lBRFQ7Ozs7OztFQUdSLHNEQUFDLFVBQVUsSUFBWCxDQUFnQixDQUFDLFFBQWpCLEdBQTRCO0FBMVA1QiIsImZpbGUiOiJzdGFja21hdC5qcyIsInNvdXJjZXNDb250ZW50IjpbIlN0YWNrbWF0ID0ge31cblxuY2xhc3MgU3RhY2ttYXQuU3RhdGVcbiAgY29uc3RydWN0b3I6IC0+XG4gICAgQHJ1bm5pbmcgPSBmYWxzZVxuICAgIEBkaWdpdHMgPSBbMCwgMCwgMCwgMCwgMF1cbiAgICBAbGVmdEhhbmRQcmVzc2VkID0gZmFsc2VcbiAgICBAcmlnaHRIYW5kUHJlc3NlZCA9IGZhbHNlXG4gICAgQHJlc2V0ID0gdHJ1ZVxuXG4gIHVwZGF0ZTogKHNpZ25hbCkgLT5cbiAgICBAbGVmdEhhbmRQcmVzc2VkID0gQHJpZ2h0SGFuZFByZXNzZWQgPSBmYWxzZVxuXG4gICAgc3RhdHVzID0gc2lnbmFsLmdldFN0YXR1cygpICMgVE9ETyBzdGF0dXMgdnMgc3RhdGUgaXMgdmVyeSBjb25mdXNpbmdcblxuICAgIHN3aXRjaCBzdGF0dXNcbiAgICAgIHdoZW4gXCIgXCJcbiAgICAgICAgQHJ1bm5pbmcgPSB0cnVlXG4gICAgICAgIEByZXNldCA9IGZhbHNlXG4gICAgICB3aGVuIFwiU1wiXG4gICAgICAgIEBydW5uaW5nID0gZmFsc2VcbiAgICAgICAgQHJlc2V0ID0gZmFsc2VcbiAgICAgIHdoZW4gXCJJXCJcbiAgICAgICAgQHJ1bm5pbmcgPSBmYWxzZVxuICAgICAgICBAcmVzZXQgPSB0cnVlXG4gICAgICB3aGVuIFwiTFwiXG4gICAgICAgIEBsZWZ0SGFuZFByZXNzZWQgPSB0cnVlXG4gICAgICB3aGVuIFwiUlwiXG4gICAgICAgIEByaWdodEhhbmRQcmVzc2VkID0gdHJ1ZVxuICAgICAgd2hlbiBcIkNcIlxuICAgICAgICBAcnVubmluZyA9IGZhbHNlXG4gICAgICAgIEBsZWZ0SGFuZFByZXNzZWQgPSB0cnVlXG4gICAgICAgIEByaWdodEhhbmRQcmVzc2VkID0gdHJ1ZVxuXG4gICAgQGRpZ2l0cyA9IHNpZ25hbC5nZXREaWdpdHMoKVxuXG4gIGlzUnVubmluZzogLT5cbiAgICBAcnVubmluZ1xuXG4gIGlzUmVzZXQ6IC0+XG4gICAgQHJlc2V0XG5cbiAgaXNMZWZ0SGFuZFByZXNzZWQ6IC0+XG4gICAgQGxlZnRIYW5kUHJlc3NlZFxuXG4gIGlzUmlnaHRIYW5kUHJlc3NlZDogLT5cbiAgICBAcmlnaHRIYW5kUHJlc3NlZFxuXG4gIGdldFRpbWVBc1N0cmluZzogLT5cbiAgICBcIiN7QGRpZ2l0c1swXX06I3tAZGlnaXRzWzFdfSN7QGRpZ2l0c1syXX0uI3tAZGlnaXRzWzNdfSN7QGRpZ2l0c1s0XX1cIlxuXG4gIGdldFRpbWVJbk1pbGxpc2Vjb25kczogLT5cbiAgICBzZWNvbmRzID0gQGRpZ2l0c1swXSAqIDYwICsgQGRpZ2l0c1sxXSAqIDEwICsgQGRpZ2l0c1syXVxuICAgIGh1bmRyZWRzID0gQGRpZ2l0c1szXSAqIDEwICsgQGRpZ2l0c1s0XVxuICAgIHNlY29uZHMgKiAxMDAwICsgaHVuZHJlZHMgKiAxMFxuXG5jbGFzcyBTdGFja21hdC5TaWduYWxcbiAgY29uc3RydWN0b3I6IChvcHRpb25zKSAtPiAjIFRPRE8gcmVuYW1lIG9wdGlvbnNcbiAgICBAc3RhdHVzID0gU3RyaW5nLmZyb21DaGFyQ29kZSBvcHRpb25zLnN0YXR1c1xuICAgIEBkaWdpdHMgPSAoZCAtIDQ4IGZvciBkIGluIG9wdGlvbnMuZGlnaXRzKVxuXG4gIGdldFN0YXR1czogLT5cbiAgICBAc3RhdHVzXG5cbiAgZ2V0RGlnaXRzOiAtPlxuICAgIEBkaWdpdHNcblxuY2xhc3MgU3RhY2ttYXQuU2lnbmFsRGVjb2RlclxuICBjaGFyYWN0ZXJJblN0cmluZyA9IChjaGFyYWN0ZXIsIHZhbHVlKSAtPlxuICAgIHZhbHVlLmluZGV4T2YoY2hhcmFjdGVyKSBpc250IC0xXG5cbiAgc3VtT2ZEaWdpdHMgPSAoZGlnaXRzKSAtPlxuICAgIHZhbHVlcyA9IChkIC0gNDggZm9yIGQgaW4gZGlnaXRzKVxuICAgIG0gPSB2YWx1ZXMucmVkdWNlICh0LCBzKSAtPiB0ICsgc1xuXG4gIGlzVmFsaWRQYWNrZXQgPSAoZGF0YSkgLT4gIyBUT0RPIHBlcmZvcm1hbmNlXG4gICAgY2hhcmFjdGVySW5TdHJpbmcoU3RyaW5nLmZyb21DaGFyQ29kZShkYXRhWzBdKSwgXCJJQSBTTFJDXCIpIGFuZFxuICAgIGNoYXJhY3RlckluU3RyaW5nKFN0cmluZy5mcm9tQ2hhckNvZGUoZGF0YVsxXSksIFwiMDEyMzQ1Njc4OVwiKSBhbmRcbiAgICBjaGFyYWN0ZXJJblN0cmluZyhTdHJpbmcuZnJvbUNoYXJDb2RlKGRhdGFbMl0pLCBcIjAxMjM0NTY3ODlcIikgYW5kXG4gICAgY2hhcmFjdGVySW5TdHJpbmcoU3RyaW5nLmZyb21DaGFyQ29kZShkYXRhWzNdKSwgXCIwMTIzNDU2Nzg5XCIpIGFuZFxuICAgIGNoYXJhY3RlckluU3RyaW5nKFN0cmluZy5mcm9tQ2hhckNvZGUoZGF0YVs0XSksIFwiMDEyMzQ1Njc4OVwiKSBhbmRcbiAgICBjaGFyYWN0ZXJJblN0cmluZyhTdHJpbmcuZnJvbUNoYXJDb2RlKGRhdGFbNV0pLCBcIjAxMjM0NTY3ODlcIikgYW5kXG4gICAgc3VtT2ZEaWdpdHMoZGF0YVsxLi41XSkgaXMgZGF0YVs2XSAtIDY0IGFuZFxuICAgIGRhdGFbN10gaXMgMTAgYW5kXG4gICAgZGF0YVs4XSBpcyAxM1xuXG4gIGRlY29kZTogKGRhdGEpIC0+XG4gICAgcmV0dXJuIHVuZGVmaW5lZCB1bmxlc3MgaXNWYWxpZFBhY2tldChkYXRhKVxuXG4gICAgbmV3IFN0YWNrbWF0LlNpZ25hbFxuICAgICAgc3RhdHVzOiBkYXRhWzBdXG4gICAgICBkaWdpdHM6IGRhdGFbMS4uNV0gIyBUT0RPIFsxLi41XSBkdXBsaWNhdGVkXG5cbmNsYXNzIFN0YWNrbWF0LkF1ZGlvSGFyZHdhcmVcbiAgY29uc3RydWN0b3I6IChzb3VyY2UsIGNhbGxiYWNrKSAtPlxuICAgIEBzb3VyY2UgPSBzb3VyY2VcbiAgICAjIDM2Ljc1IHBybyBiaXQuIDkgYnl0ZXMsIDEwIGJpdHMvYnl0ZSA9PiA5MCBiaXQgPT4gOTAqMzYuNzUgPSAzMzA3IHRpY2tzLiA9PiBtaW4gMzMwNyoyID0gNjYwOCB0aWNrc1xuICAgIEBub2RlID0gc291cmNlLmNvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKDQwOTYgKiAyLCAxLCAxKVxuICAgIEBjYWxsYmFjayA9IGNhbGxiYWNrXG4gICAgQG5vZGUub25hdWRpb3Byb2Nlc3MgPSAoZSkgPT5cbiAgICAgIEBjYWxsYmFjayhlLmlucHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDApKVxuXG4gICAgc291cmNlLmNvbm5lY3QoQG5vZGUpXG4gICAgQG5vZGUuY29ubmVjdChzb3VyY2UuY29udGV4dC5kZXN0aW5hdGlvbilcblxuY2xhc3MgU3RhY2ttYXQuUlMyMzJEZWNvZGVyXG4gIGNvbnN0cnVjdG9yOiAodGlja3NQZXJCaXQpIC0+XG4gICAgQHRpY2tzUGVyQml0ID0gdGlja3NQZXJCaXRcblxuICBmbG9hdFNpZ25hbFRvQmluYXJ5ID0gKHNpZ25hbCkgLT5cbiAgICBpZiBzaWduYWwgPCAwXG4gICAgICByZXR1cm4gMVxuICAgIGlmIHNpZ25hbCA+IDBcbiAgICAgIHJldHVybiAwXG4gICAgcmV0dXJuIHVuZGVmaW5lZFxuXG4gIGZpbmRCZWdpbm5pbmdPZlNpZ25hbDogKGRhdGEpID0+XG4gICAgb25lQ291bnQgPSAwXG4gICAgd2FpdGluZ0Zvclplcm8gPSBmYWxzZVxuXG4gICAgaSA9IDBcbiAgICB3aGlsZSBpIDwgZGF0YS5sZW5ndGhcbiAgICAgIGJpdCA9IGRhdGFbaV1cbiAgICAgIGlmIGJpdCBpcyAxXG4gICAgICAgIG9uZUNvdW50ICs9IDFcbiAgICAgIGlmIG9uZUNvdW50ID4gOSAqIEB0aWNrc1BlckJpdCAjIHRoZXJlJ3Mgbm8gYnl0ZSBpbiBhIHBhY2thZ2Ugd2hpY2ggY29udGFpbnMgOCBiaXRzIG9mIDFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjIHRoYXQgdHJhbnNsYXRlcyB0byA5ICogdGlja3NQZXJCaXRcbiAgICAgICAgd2FpdGluZ0Zvclplcm8gPSB0cnVlXG4gICAgICBpZiBiaXQgaXMgMFxuICAgICAgICBvbmVDb3VudCA9IDBcbiAgICAgICAgaWYgd2FpdGluZ0Zvclplcm9cbiAgICAgICAgICByZXR1cm4gaVxuICAgICAgaSArPSAxICMgVE9ETyByZWFycmFuZ2VcblxuICAgIHJldHVybiB1bmRlZmluZWRcblxuICBydW5MZW5ndGhFbmNvZGUgPSAoZGF0YSkgLT5cbiAgICBsYXN0Qml0ID0gLTFcbiAgICByZXN1bHQgPSBbXVxuXG4gICAgaSA9IDBcbiAgICB3aGlsZSBpIDwgZGF0YS5sZW5ndGhcbiAgICAgIGlmIGxhc3RCaXQgaXNudCBkYXRhW2ldXG4gICAgICAgIHJlc3VsdC5wdXNoIHtiaXQ6IGRhdGFbaV0sIGxlbmd0aDogMX1cbiAgICAgICAgbGFzdEJpdCA9IGRhdGFbaV1cbiAgICAgIGVsc2VcbiAgICAgICAgcmVzdWx0W3Jlc3VsdC5sZW5ndGggLSAxXS5sZW5ndGggKz0gMVxuICAgICAgaSArPSAxXG5cbiAgICByZXN1bHRcblxuICBnZXRCaXRzRnJvbVJ1bkxlbmd0aEVuY29kZWRTaWduYWwgPSAoYXJyYXksIHBlcmlvZCkgLT5cbiAgICB4ID0gKChcbiAgICAgIGJpdHNDb3VudCA9IE1hdGgucm91bmQoZS5sZW5ndGggLyBwZXJpb2QpXG4gICAgICAoZS5iaXQgZm9yIGkgaW4gWzEuLmJpdHNDb3VudF0pXG4gICAgKSBmb3IgZSBpbiBhcnJheSlcbiAgICBbXS5jb25jYXQgeC4uLlxuXG4gIGRlY29kZUJpdHMgPSAoZGF0YSwgb2Zmc2V0KSAtPlxuICAgIHJlc3VsdCA9IDBcbiAgICBpID0gMFxuICAgIHdoaWxlIGkgPCA4ICMgVE9ETyByZXdyaXRlIGluIENvZmZlZVNjcmlwdFxuICAgICAgcmVzdWx0ICs9IGRhdGFbb2Zmc2V0ICsgaV0gPDwgaVxuICAgICAgaSArPSAxXG4gICAgcmVzdWx0XG5cbiAgZ2V0UGFja2V0ID0gKGRhdGEpIC0+XG4gICAgKGRlY29kZUJpdHMoZGF0YSwgaSAqIDEwKSBmb3IgaSBpbiBbMC4uOF0pXG5cbiAgZGVjb2RlOiAoZGF0YSkgPT5cbiAgICBiaXRzID0gKGZsb2F0U2lnbmFsVG9CaW5hcnkoZSkgZm9yIGUgaW4gZGF0YSlcbiAgICBzdGFydEluZGV4ID0gQGZpbmRCZWdpbm5pbmdPZlNpZ25hbChiaXRzKVxuXG4gICAgcnVuTGVuZ3RoRW5jb2RlZCA9IHJ1bkxlbmd0aEVuY29kZShiaXRzW3N0YXJ0SW5kZXguLihiaXRzLmxlbmd0aCAtIDEpXSlcbiAgICBiaXRzID0gZ2V0Qml0c0Zyb21SdW5MZW5ndGhFbmNvZGVkU2lnbmFsKHJ1bkxlbmd0aEVuY29kZWQsIEB0aWNrc1BlckJpdClcbiAgICBnZXRQYWNrZXQoYml0c1sxLi4oYml0cy5sZW5ndGggLSAxKV0pXG5cbmNsYXNzIFN0YWNrbWF0LlRpbWVyXG4gIHN1cHBvcnRlZCA9IC0+XG4gICAgISEobmF2aWdhdG9yLmdldFVzZXJNZWRpYSBvclxuICAgICAgbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSBvclxuICAgICAgbmF2aWdhdG9yLm1vekdldFVzZXJNZWRpYSBvclxuICAgICAgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhKVxuXG4gIGdldFVzZXJNZWRpYSA9IC0+XG4gICAgIyBGSVhNRSA6IGBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhYCBpcyBkZXByZWNhdGVkLiAoaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL05hdmlnYXRvci9nZXRVc2VyTWVkaWEpXG4gICAgIyBNdXN0IHVzZSB0aGUgbmV3IEFQSSA6IGBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYWAgKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2ZyL2RvY3MvV2ViL0FQSS9NZWRpYURldmljZXMvZ2V0VXNlck1lZGlhKVxuICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgb3JcbiAgICAgIG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEgb3JcbiAgICAgIG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgb3JcbiAgICAgIG5hdmlnYXRvci5tc0dldFVzZXJNZWRpYVxuXG4gIGF1ZGlvQ29udGV4dCA9IC0+XG4gICAgdHJ5XG4gICAgICBjb250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCBvciB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0XG4gICAgICBuZXcgY29udGV4dCgpXG4gICAgY2F0Y2ggZXJyb3JcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0FQSSBBdWRpbyBub3Qgc3VwcG9ydGVkLiA6KCcsIGVycm9yKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBUEkgQXVkaW8gbm90IHN1cHBvcnRlZC4gOignKVxuXG4gIGNvbnN0cnVjdG9yOiAob3B0aW9ucykgLT5cbiAgICBpZiBub3Qgc3VwcG9ydGVkKClcbiAgICAgIGlmIG9wdGlvbnM/Lm9uTm9uU3VwcG9ydGVkQnJvd3NlclxuICAgICAgICBvcHRpb25zLm9uTm9uU3VwcG9ydGVkQnJvd3NlcigpXG4gICAgICBlbHNlXG4gICAgICAgIGFsZXJ0IFwiWW91IG5lZWQgYSByZWNlbnQgYnJvd3NlciBpbiBvcmRlciB0byBjb25uZWN0IHlvdXIgU3RhY2ttYXQgVGltZXIuXCJcbiAgICAgIHJldHVyblxuXG4gICAgIyBUT0RPIDogaW1wbGVtZW50IHRob3NlIDMgb3B0aW9uc1xuICAgIEBvblJ1bm5pbmcgPSBvcHRpb25zLm9uUnVubmluZyBvciAtPlxuICAgIEBvblN0b3BwaW5nID0gb3B0aW9ucy5vblN0b3BwaW5nIG9yIC0+XG4gICAgQG9uUmVzZXR0aW5nID0gb3B0aW9ucy5vblJlc2V0dGluZyBvciAtPlxuXG4gICAgQHNpZ25hbFJlY2VpdmVkID0gb3B0aW9ucy5zaWduYWxSZWNlaXZlZCBvciAtPlxuICAgIEBjYXB0dXJpbmcgPSBmYWxzZVxuXG4gICAgQHN0YXRlID0gbmV3IFN0YWNrbWF0LlN0YXRlKClcblxuICAgIEByczIzMkRlY29kZXIgPSBuZXcgU3RhY2ttYXQuUlMyMzJEZWNvZGVyKGF1ZGlvQ29udGV4dCgpLnNhbXBsZVJhdGUgLyAxMjAwKVxuICAgIEBzdGFja21hdFNpZ25hbERlY29kZXIgPSBuZXcgU3RhY2ttYXQuU2lnbmFsRGVjb2RlcigpXG5cbiAgICBzdWNjZXNzID0gKHN0cmVhbSkgPT5cbiAgICAgIG1pY3JvcGhvbmUgPSBhdWRpb0NvbnRleHQoKS5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzdHJlYW0pXG4gICAgICBAZGV2aWNlID0gbmV3IFN0YWNrbWF0LkF1ZGlvSGFyZHdhcmUobWljcm9waG9uZSwgQHNpZ25hbEZldGNoZWQpXG5cbiAgICBmYWlsID0gKGVycikgLT5cbiAgICAgIGNvbnNvbGUubG9nIFwiRmFpbCB0byBjb25uZWN0IHRvIGF1ZGlvIGRldmljZVwiLCBlcnJcblxuICAgIGlmIG5hdmlnYXRvci5tZWRpYURldmljZXMgYW5kIG5hdmlnYXRvci5tZWRpYURldmljZXMuZ2V0VXNlck1lZGlhXG4gICAgICBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYSh7YXVkaW86IHtvcHRpb25hbDogW3tlY2hvQ2FuY2VsbGF0aW9uOiBmYWxzZX1dfX0pLnRoZW4oc3VjY2VzcykuY2F0Y2goZmFpbClcbiAgICBlbHNlXG4gICAgICBnZXRVc2VyTWVkaWEoKS5jYWxsIG5hdmlnYXRvciwge2F1ZGlvOiB7b3B0aW9uYWw6IFt7ZWNob0NhbmNlbGxhdGlvbjogZmFsc2V9XX19LCBzdWNjZXNzLCBmYWlsXG5cbiAgc2lnbmFsRmV0Y2hlZDogKHNpZ25hbCkgPT5cbiAgICBpZiBAY2FwdHVyaW5nXG4gICAgICBwYWNrZXQgPSBAcnMyMzJEZWNvZGVyLmRlY29kZShzaWduYWwpXG4gICAgICByZXR1cm4gdW5sZXNzIHBhY2tldD9cblxuICAgICAgc2lnbmFsID0gQHN0YWNrbWF0U2lnbmFsRGVjb2Rlci5kZWNvZGUocGFja2V0KVxuICAgICAgcmV0dXJuIHVubGVzcyBzaWduYWw/XG5cbiAgICAgIEBzdGF0ZS51cGRhdGUoc2lnbmFsKVxuICAgICAgQHNpZ25hbFJlY2VpdmVkKEBzdGF0ZSlcblxuICBzdGFydDogPT5cbiAgICBAY2FwdHVyaW5nID0gdHJ1ZVxuXG4gIHN0b3A6ID0+XG4gICAgQGNhcHR1cmluZyA9IGZhbHNlXG5cbihleHBvcnRzID8gdGhpcykuU3RhY2ttYXQgPSBTdGFja21hdFxuIl19
