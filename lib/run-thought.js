/*!
 * thought-dev <https://github.com/nknapp/thought-dev>
 *
 * Copyright (c) 2016 Nils Knappmeier.
 * Released under the MIT license.
 */
'use strict'

var customize = require('customize')
var write = require('customize-write-files')
var Q = require('q')
var _ = require('lodash')

module.exports =
  class RunThought {
    constructor (cwd) {
      this.cwd = cwd
      this.reset()
    }

    /**
     * Reset Thought, run Thought and store the promise for the result (withough writing the file)
     * @returns {*}
     */
    reset () {
      this.customize = customize()
        .load(require('thought/customize.js')(this.cwd))
        .merge({
          handlebars: {
            partialWrapper: wrapPart('partials')
          }
        })
      /**
       * Promise for the merged Thought-config
       * @type {Promise.<Object>}
       */
      this.config = this.customize.buildConfig()
      /**
       * Promise for the resulting data (without writing to disk)
       * @type {Promise.<Object>}
       */
      this.result = this.customize.run()
      return Q.all([this.config, this.result])
    }

    /**
     * Return a promise for the target files of the output
     * @return {Promise<string[]>} the target files (as promise)
     */
    targetFiles () {
      // this.run has the structure
      // {
      //    engineName: {
      //      fileName: "contents",
      //      ...
      //    },
      //     ...
      // }
      // We want all fileNames
      return this.result.then((result) => {
        let files = {}
        // engines
        Object.keys(result).forEach((engineName) => {
          // filenames
          Object.keys(result[engineName]).forEach((fileName) => {
            // collect them in an object
            files[fileName] = true
          })
        })
        return Object.keys(files)
      })
    }

    /**
     * Run Thought and write target files. Wrap whole template with "partial"
     * @returns {Promise.<string[]>} a promise for the written filenames
     */
    run () {
      return this.result
        .then((result) => _.mapValues(result, (engineResult) => _.mapValues(engineResult, wrapPart('templates'))))
        .then(write(this.cwd))
    }
}

function wrapPart (prefix) {
  return function wrapPartial (contents, name) {
    return `<!-- part name='${prefix}/${name}' -->
${contents}<!-- /part -->
`
  }
}
