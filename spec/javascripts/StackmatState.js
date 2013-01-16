(function() {
  var createSignal, createSignalFromDigits, createSignalFromState;

  createSignal = function(state, digits) {
    return {
      getStatus: function() {
        return state;
      },
      getDigits: function() {
        return digits;
      }
    };
  };

  createSignalFromState = function(state) {
    return createSignal(state, [0, 0, 0, 0, 0]);
  };

  createSignalFromDigits = function(digits) {
    return createSignal("I", digits);
  };

  describe("Stackmat.State#update, time as string", function() {
    var state;
    state = void 0;
    beforeEach(function() {
      return state = new Stackmat.State();
    });
    it("is set to '0:00.00' after initialization", function() {
      return expect(state.getTimeAsString()).toBe("0:00.00");
    });
    return it("gets the time after updating", function() {
      state.update(createSignalFromDigits([1, 3, 0, 2, 8]));
      return expect(state.getTimeAsString()).toBe("1:30.28");
    });
  });

  describe("Stackmat.State#update, time in milliseconds", function() {
    var state;
    state = void 0;
    beforeEach(function() {
      return state = new Stackmat.State();
    });
    it("is set to '0:00.00' after initialization", function() {
      return expect(state.getTimeInMilliseconds()).toBe(0);
    });
    return it("gets the time after updating", function() {
      state.update(createSignalFromDigits([1, 3, 0, 2, 8]));
      return expect(state.getTimeInMilliseconds()).toBe(90280);
    });
  });

  describe("Stackmat.State#update, reset state", function() {
    var state;
    state = void 0;
    beforeEach(function() {
      return state = new Stackmat.State();
    });
    it("is reset after initialization", function() {
      return expect(state.isReset()).toBe(true);
    });
    it("changes from running to stopped if the timer is being reset", function() {
      startTimer();
      state.update(createSignalFromState("I"));
      return expect(state.isRunning()).toBe(false);
    });
    it("is not reset once the timer starts", function() {
      state.update(createSignalFromState(" "));
      return expect(state.isReset()).toBe(false);
    });
    return it("is not reset if the timer is stopped", function() {
      state.update(createSignalFromState("S"));
      return expect(state.isReset()).toBe(false);
    });
  });

  describe("Stackmat.State#update, running state", function() {
    var startTimer, state;
    state = void 0;
    beforeEach(function() {
      return state = new Stackmat.State();
    });
    startTimer = function() {
      return state.update(createSignalFromState(" "));
    };
    it("isn't running after initialization", function() {
      return expect(state.isRunning()).toBe(false);
    });
    it("changes to running if the signal state is running", function() {
      state.update(createSignalFromState(" "));
      return expect(state.isRunning()).toBe(true);
    });
    it("changes from running to being stopped", function() {
      startTimer();
      state.update(createSignalFromState("S"));
      return expect(state.isRunning()).toBe(false);
    });
    return it("doesn't change state if at most one hand touches sensor", function() {
      var left_signal, right_signal;
      left_signal = createSignalFromState("L");
      right_signal = createSignalFromState("R");
      state.update(left_signal);
      expect(state.isRunning()).toBe(false);
      state.update(right_signal);
      return expect(state.isRunning()).toBe(false);
    });
  });

  describe("Stackmat.State#update, hands", function() {
    var state;
    state = void 0;
    beforeEach(function() {
      return state = new Stackmat.State();
    });
    it("keeps note of when the left hand touches the stackmat", function() {
      state.update(createSignalFromState("L"));
      expect(state.isLeftHandPressed()).toBe(true);
      return expect(state.isRightHandPressed()).toBe(false);
    });
    it("keeps note of when the left hand touches the stackmat", function() {
      state.update(createSignalFromState("R"));
      expect(state.isLeftHandPressed()).toBe(false);
      return expect(state.isRightHandPressed()).toBe(true);
    });
    it("resets other hand properly", function() {
      state.update(createSignalFromState("R"));
      state.update(createSignalFromState("L"));
      return expect(state.isRightHandPressed()).toBe(false);
    });
    it("resets hands when signal changes to running", function() {
      state.update(createSignalFromState("R"));
      state.update(createSignalFromState(" "));
      expect(state.isLeftHandPressed()).toBe(false);
      return expect(state.isRightHandPressed()).toBe(false);
    });
    return it("sets both hands if signal is 'C'", function() {
      state.update(createSignalFromState("C"));
      expect(state.isLeftHandPressed()).toBe(true);
      return expect(state.isRightHandPressed()).toBe(true);
    });
  });

}).call(this);
