/*!
 * thought-dev <https://github.com/nknapp/thought-dev>
 *
 * Copyright (c) 2016 Nils Knappmeier.
 * Released under the MIT license.
 */
'use strict'

var chokidar = require('chokidar')
var EventEmitter = require('events').EventEmitter

module.exports =
  class Watcher extends EventEmitter {
    /**
     * Create a Watcher for running thought in the current directory
     * @param {string} watchRoot the working directory to use as project root
     * @param {RunThought} thoughtRunner the working directory to use as project root
     *
     * @api public
     */
    constructor (watchRoot, thoughtRunner) {
      super()
      this.thoughtRunner = thoughtRunner
      var gitIgnoreGlob = require('gitignore-globs')('.gitignore')
      console.log(gitIgnoreGlob)
      this.watcher = chokidar.watch(watchRoot, {
        ignored: '.git|' + gitIgnoreGlob.join('|'),
        ignoreInitial: true,
        atomic: true
      }).on('all', (file) => {
        console.log(file)
        this.emit('update', file)
        this.rerun()
      })
      this.rerun()
    }

    /**
     * Reset and re-run the thought process
     */
    rerun () {
      this.thoughtRunner.reset()
      return this.thoughtRunner.targetFiles()
        // Ignore updates on files created by Thought
        // to avoid endless loops
        .then((files) => this.watcher.unwatch(files))
        .then(() => this.thoughtRunner.run())
        .then((files) => this.emit('update', files))
    }

}
