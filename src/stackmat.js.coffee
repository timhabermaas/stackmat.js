class StackmatSignalDecoder
  decode: (callback) ->
    s = {
      status: 'S'
      timeArray: ['1', '1', '0', '0', '1'] # TODO use string?
    }
    callback(s); # TODO return undefined if signal isn't correct

class StackmatState
  constructor: (options) -> # TODO rename options
    digits = (e - '0' for e in options.timeArray)
    seconds = digits[0] * 60 + digits[1] * 10 + digits[2]
    hundreds = digits[3] * 10 + digits[4];
    @time = seconds * 1000 + hundreds; # TODO -> function
    @status = options.status

  getCurrentTime: ->
    @time

  isRunning: ->
    @status == ' '
  isStopped: ->
    @status == 'S'


class StackmatTimer
  constructor: (options) ->
    @interval = options.interval || 1000
    @onRunning = options.onRunning || ->
    @onStopped = options.onStopped || ->

  fetchSignal: =>
    decoder = new StackmatSignalDecoder();
    decoder.decode(@signalFetched);

  signalFetched: (signal) =>
    state = new StackmatState(signal)
    return unless state?

    if state.isRunning()
      @onRunning(state)
    if state.isStopped()
      @onStopped(state)

  start: => # TODO which arrow do we want here?
    setInterval(@fetchSignal, @interval)

(exports ? this).StackmatTimer = StackmatTimer
