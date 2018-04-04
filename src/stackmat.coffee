Stackmat = {}

class Stackmat.State
  constructor: ->
    @running = false
    @digits = [0, 0, 0, 0, 0]
    @leftHandPressed = false
    @rightHandPressed = false
    @reset = true

  update: (signal) ->
    @leftHandPressed = @rightHandPressed = false

    status = signal.getStatus() # TODO status vs state is very confusing

    switch status
      when " "
        @running = true
        @reset = false
      when "S"
        @running = false
        @reset = false
      when "I"
        @running = false
        @reset = true
      when "L"
        @leftHandPressed = true
      when "R"
        @rightHandPressed = true
      when "C"
        @running = false
        @leftHandPressed = true
        @rightHandPressed = true

    @digits = signal.getDigits()

  isRunning: ->
    @running

  isReset: ->
    @reset

  isLeftHandPressed: ->
    @leftHandPressed

  isRightHandPressed: ->
    @rightHandPressed

  getTimeAsString: ->
    "#{@digits[0]}:#{@digits[1]}#{@digits[2]}.#{@digits[3]}#{@digits[4]}"

  getTimeInMilliseconds: ->
    seconds = @digits[0] * 60 + @digits[1] * 10 + @digits[2]
    hundreds = @digits[3] * 10 + @digits[4]
    seconds * 1000 + hundreds * 10

class Stackmat.Signal
  constructor: (options) -> # TODO rename options
    @status = String.fromCharCode options.status
    @digits = (d - 48 for d in options.digits)

  getStatus: ->
    @status

  getDigits: ->
    @digits

class Stackmat.SignalDecoder
  characterInString = (character, value) ->
    value.indexOf(character) isnt -1

  sumOfDigits = (digits) ->
    values = (d - 48 for d in digits)
    m = values.reduce (t, s) -> t + s

  isValidPacket = (data) -> # TODO performance
    characterInString(String.fromCharCode(data[0]), "IA SLRC") and
    characterInString(String.fromCharCode(data[1]), "0123456789") and
    characterInString(String.fromCharCode(data[2]), "0123456789") and
    characterInString(String.fromCharCode(data[3]), "0123456789") and
    characterInString(String.fromCharCode(data[4]), "0123456789") and
    characterInString(String.fromCharCode(data[5]), "0123456789") and
    sumOfDigits(data[1..5]) is data[6] - 64 and
    data[7] is 10 and
    data[8] is 13

  decode: (data) ->
    return undefined unless isValidPacket(data)

    new Stackmat.Signal
      status: data[0]
      digits: data[1..5] # TODO [1..5] duplicated

class Stackmat.AudioHardware
  constructor: (source, callback) ->
    @source = source
    # 36.75 pro bit. 9 bytes, 10 bits/byte => 90 bit => 90*36.75 = 3307 ticks. => min 3307*2 = 6608 ticks
    @node = source.context.createScriptProcessor(4096 * 2, 1, 1)
    @callback = callback
    @node.onaudioprocess = (e) =>
      @callback(e.inputBuffer.getChannelData(0))

    source.connect(@node)
    @node.connect(source.context.destination)

class Stackmat.RS232Decoder
  constructor: (ticksPerBit) ->
    @ticksPerBit = ticksPerBit

  floatSignalToBinary = (signal) ->
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
      if bit is 1
        oneCount += 1
      if oneCount > 9 * @ticksPerBit # there's no byte in a package which contains 8 bits of 1
                                     # that translates to 9 * ticksPerBit
        waitingForZero = true
      if bit is 0
        oneCount = 0
        if waitingForZero
          return i
      i += 1 # TODO rearrange

    return undefined

  runLengthEncode = (data) ->
    lastBit = -1
    result = []

    i = 0
    while i < data.length
      if lastBit isnt data[i]
        result.push {bit: data[i], length: 1}
        lastBit = data[i]
      else
        result[result.length - 1].length += 1
      i += 1

    result

  getBitsFromRunLengthEncodedSignal = (array, period) ->
    x = ((
      bitsCount = Math.round(e.length / period)
      (e.bit for i in [1..bitsCount])
    ) for e in array)
    [].concat x...

  decodeBits = (data, offset) ->
    result = 0
    i = 0
    while i < 8 # TODO rewrite in CoffeeScript
      result += data[offset + i] << i
      i += 1
    result

  getPacket = (data) ->
    (decodeBits(data, i * 10) for i in [0..8])

  decode: (data) =>
    bits = (floatSignalToBinary(e) for e in data)
    startIndex = @findBeginningOfSignal(bits)

    runLengthEncoded = runLengthEncode(bits[startIndex..(bits.length - 1)])
    bits = getBitsFromRunLengthEncodedSignal(runLengthEncoded, @ticksPerBit)
    getPacket(bits[1..(bits.length - 1)])

class Stackmat.Timer
  supported = ->
    !!(navigator.getUserMedia or
      navigator.webkitGetUserMedia or
      navigator.mozGetUserMedia or
      navigator.msGetUserMedia)

  getUserMedia = ->
    # FIXME : `navigator.getUserMedia` is deprecated. (https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getUserMedia)
    # Must use the new API : `navigator.mediaDevices.getUserMedia` (https://developer.mozilla.org/fr/docs/Web/API/MediaDevices/getUserMedia)
    navigator.getUserMedia or
      navigator.webkitGetUserMedia or
      navigator.mozGetUserMedia or
      navigator.msGetUserMedia

  audioContext = ->
    try
      context = window.AudioContext or window.webkitAudioContext
      new context()
    catch error
      console.error('API Audio not supported. :(', error)
      throw new Error('API Audio not supported. :(')

  constructor: (options) ->
    if not supported()
      if options?.onNonSupportedBrowser
        options.onNonSupportedBrowser()
      else
        alert "You need a recent browser in order to connect your Stackmat Timer."
      return

    # TODO : implement those 3 options
    @onRunning = options.onRunning or ->
    @onStopping = options.onStopping or ->
    @onResetting = options.onResetting or ->

    @signalReceived = options.signalReceived or ->
    @capturing = false

    @state = new Stackmat.State()

    @rs232Decoder = new Stackmat.RS232Decoder(audioContext().sampleRate / 1200)
    @stackmatSignalDecoder = new Stackmat.SignalDecoder()

    success = (stream) =>
      microphone = audioContext().createMediaStreamSource(stream)
      @device = new Stackmat.AudioHardware(microphone, @signalFetched)

    fail = (err) ->
      console.log "Fail to connect to audio device", err

    if navigator.mediaDevices and navigator.mediaDevices.getUserMedia
      navigator.mediaDevices.getUserMedia({audio: {optional: [{echoCancellation: false}]}}).then(success).catch(fail)
    else
      getUserMedia().call navigator, {audio: {optional: [{echoCancellation: false}]}}, success, fail

  signalFetched: (signal) =>
    if @capturing
      packet = @rs232Decoder.decode(signal)
      return unless packet?

      signal = @stackmatSignalDecoder.decode(packet)
      return unless signal?

      @state.update(signal)
      @signalReceived(@state)

  start: =>
    @capturing = true

  stop: =>
    @capturing = false

(exports ? this).Stackmat = Stackmat
