require "webrick"

root = File.expand_path("..", File.dirname(__FILE__))

server = WEBrick::HTTPServer.new(:Port => 8080, :DocumentRoot => root)

['INT', 'TERM'].each { |signal|
   trap(signal) { server.shutdown }
}
server.start
