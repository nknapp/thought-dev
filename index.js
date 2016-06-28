var Server = require('./lib/server.js')
var RunThought = require('./lib/run-thought.js')
var Watcher = require('./lib/watcher.js')

var cwd = process.cwd()
var thoughtRunner = new RunThought(cwd)
var server = new Server(cwd, 3000, thoughtRunner)
var watcher = new Watcher(cwd, thoughtRunner)

watcher.on('updater', function (files) {
  server.reload(files)
})

server.run()
