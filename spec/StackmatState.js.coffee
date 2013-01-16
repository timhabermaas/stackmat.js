createSignal = (state, digits) ->
  {
    getStatus: ->
      state
    getDigits: ->
      digits
  }

createSignalFromState = (state)->
  createSignal state, [0, 0, 0, 0, 0]

createSignalFromDigits = (digits) ->
  createSignal "I", digits

describe "Stackmat.State#update, time as string", ->
  state = undefined

  beforeEach ->
    state = new Stackmat.State()

  it "is set to '0:00.00' after initialization", ->
    expect(state.getTimeAsString()).toBe("0:00.00")

  it "gets the time after updating", ->
    state.update(createSignalFromDigits([1, 3, 0, 2, 8]))
    expect(state.getTimeAsString()).toBe("1:30.28")

describe "Stackmat.State#update, time in milliseconds", ->
  state = undefined

  beforeEach ->
    state = new Stackmat.State()

  it "is set to '0:00.00' after initialization", ->
    expect(state.getTimeInMilliseconds()).toBe(0)

  it "gets the time after updating", ->
    state.update(createSignalFromDigits([1, 3, 0, 2, 8]))
    expect(state.getTimeInMilliseconds()).toBe(90280)

describe "Stackmat.State#update, reset state", ->
  state = undefined

  beforeEach ->
    state = new Stackmat.State()

  it "is reset after initialization", ->
    expect(state.isReset()).toBe(true)

  it "changes from running to stopped if the timer is being reset", ->
    startTimer()
    state.update(createSignalFromState("I"))
    expect(state.isRunning()).toBe(false)

  it "is not reset once the timer starts", ->
    state.update(createSignalFromState(" "))
    expect(state.isReset()).toBe(false)

  it "is not reset if the timer is stopped", ->
    state.update(createSignalFromState("S"))
    expect(state.isReset()).toBe(false)


describe "Stackmat.State#update, running state", ->
  state = undefined

  beforeEach ->
    state = new Stackmat.State()

  startTimer = ->
    state.update(createSignalFromState(" "))

  it "isn't running after initialization", ->
    expect(state.isRunning()).toBe(false)

  it "changes to running if the signal state is running", ->
    state.update(createSignalFromState(" "))
    expect(state.isRunning()).toBe(true)

  it "changes from running to being stopped", ->
    startTimer()
    state.update(createSignalFromState("S"))
    expect(state.isRunning()).toBe(false)

  it "doesn't change state if at most one hand touches sensor", ->
    left_signal = createSignalFromState("L")
    right_signal = createSignalFromState("R")
    state.update(left_signal)
    expect(state.isRunning()).toBe(false)
    state.update(right_signal)
    expect(state.isRunning()).toBe(false)

describe "Stackmat.State#update, hands", ->
  state = undefined

  beforeEach ->
    state = new Stackmat.State()

  it "keeps note of when the left hand touches the stackmat", ->
    state.update(createSignalFromState("L"))
    expect(state.isLeftHandPressed()).toBe(true)
    expect(state.isRightHandPressed()).toBe(false)

  it "keeps note of when the left hand touches the stackmat", ->
    state.update(createSignalFromState("R"))
    expect(state.isLeftHandPressed()).toBe(false)
    expect(state.isRightHandPressed()).toBe(true)

  it "resets other hand properly", ->
    state.update(createSignalFromState("R"))
    state.update(createSignalFromState("L"))
    expect(state.isRightHandPressed()).toBe(false)

  it "resets hands when signal changes to running", ->
    state.update(createSignalFromState("R"))
    state.update(createSignalFromState(" "))
    expect(state.isLeftHandPressed()).toBe(false)
    expect(state.isRightHandPressed()).toBe(false)

  it "sets both hands if signal is 'C'", ->
    state.update(createSignalFromState("C"))
    expect(state.isLeftHandPressed()).toBe(true)
    expect(state.isRightHandPressed()).toBe(true)
