audioContext = new webkitAudioContext()

class StackmatState
  constructor: (options) -> # TODO rename options
    @digits = (String.fromCharCode(d) for d in options.digits)
    digits = (d - 48 for d in options.digits)
    seconds = digits[0] * 60 + digits[1] * 10 + digits[2]
    hundreds = digits[3] * 10 + digits[4];
    @time = seconds * 1000 + hundreds * 10; # TODO -> function
    @status = String.fromCharCode options.status

  getTimeInMilliseconds: ->
    @time

  getTimeAsString: ->
    "#{@digits[0]}:#{@digits[1]}#{@digits[2]}.#{@digits[3]}#{@digits[4]}"

  isRunning: ->
    @status == ' ' # TODO breaks if one pad is touched

  isStopped: ->
    @status == 'S'

  isReset: ->
    @status == 'I'

class StackmatSignalDecoder
  constructor: (data) ->
    @data = data

  characterInString: (character, string) =>
    string.indexOf(character) != -1

  sumOfDigits: (digits) =>
    values = (d - 48 for d in digits)
    m = values.reduce (t, s) -> t + s

  isValidPacket: (data) => # TODO performance
    @characterInString(String.fromCharCode(data[0]), "IA SLRC") and
    @characterInString(String.fromCharCode(data[1]), "0123456789") and
    @characterInString(String.fromCharCode(data[2]), "0123456789") and
    @characterInString(String.fromCharCode(data[3]), "0123456789") and
    @characterInString(String.fromCharCode(data[4]), "0123456789") and
    @characterInString(String.fromCharCode(data[5]), "0123456789") and
    @sumOfDigits(data[1..5]) == data[6] - 64 and
    @data[7] == 10 and
    @data[8] == 13

  decode: =>
    return undefined unless @isValidPacket(@data)

    new StackmatState
      status: @data[0]
      digits: @data[1..5] # TODO [1..5] duplicated

class AudioHardware
  constructor: (source, callback) ->
    @source = source
    @node = source.context.createJavaScriptNode(4096 * 4, 2, 2)
    @callback = callback
    @node.onaudioprocess = (e) =>
      @callback(e.inputBuffer.getChannelData(0))

    source.connect(@node)
    @node.connect(source.context.destination)

class RS232Decoder
  constructor: (data) ->
    @data = data

  floatSignalToBinary: (signal) =>
    if signal < 0
      return 1
    if signal > 0
      return 0
    return undefined

  findBeginningOfSignal: (data) =>
    oneCount = 0
    waitingForZero = false

    i = 0
    while i < data.length
      bit = data[i]
      if bit == 1
        oneCount += 1
      if oneCount > 1900
        waitingForZero = true
      if bit == 0
        oneCount = 0
        if waitingForZero
          return i
      i += 1 # TODO rearrange

    return undefined

  runLengthEncode: (data) =>
    lastBit = -1
    result = []

    i = 0
    while i < data.length
      if lastBit != data[i]
        result.push {bit: data[i], length: 1}
        lastBit = data[i]
      else
        result[result.length - 1].length += 1
      i += 1

    result

  getBitsFromRunLengthEncodedSignal: (array, period) =>
    x = ((
      bitsCount = Math.round(e.length / period)
      (e.bit for i in [1..bitsCount])
    ) for e in array)
    [].concat x...

  decodeBits: (data, offset) =>
    result = 0
    i = 0
    while i < 8 # TODO rewrite in CoffeeScript
      result += data[offset + i] << i
      i += 1
    result

  getPacket: (data) =>
    (@decodeBits(data, i * 10) for i in [0..8])

  decode: =>
    bits = (@floatSignalToBinary(e) for e in @data)
    startIndex = @findBeginningOfSignal(bits)

    runLengthEncoded = @runLengthEncode(bits[startIndex..(bits.length - 1)])
    bits = @getBitsFromRunLengthEncodedSignal(runLengthEncoded, 36.75)
    @getPacket(bits[1..(bits.length - 1)])

class StackmatTimer
  constructor: (options) ->
    @interval = options.interval || 1000 # control how often user wants to be messaged per second
    # is actually timeout
    @onRunning = options.onRunning || ->
    @onStopped = options.onStopped || ->
    @onReset = options.onReset || ->
    @capturing = false

    navigator.webkitGetUserMedia {audio: true}, (stream) =>
      microphone = audioContext.createMediaStreamSource(stream)
      @device = new AudioHardware(microphone, @signalFetched)

  notTimedOut: =>
    true # TODO @interval < time ...

  signalFetched: (signal) =>
    if @capturing and @notTimedOut()
      rs232 = new RS232Decoder(signal)
      packet = rs232.decode()
      return unless packet?

      decoder = new StackmatSignalDecoder(packet)
      state = decoder.decode()
      return unless state?

      if state.isRunning()
        @onRunning(state)
      if state.isStopped()
        @onStopped(state)
      if state.isReset()
        @onReset(state)

  start: =>
    @capturing = true

  stop: =>
    @capturing = false

(exports ? this).StackmatTimer = StackmatTimer
