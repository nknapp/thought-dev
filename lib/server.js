'use strict'

var express = require('express')
var serveIndex = require('serve-index')
var qfs = require('q-io/fs')
var marked = require('marked')
var exphbs = require('express-handlebars')
var path = require('path')
var browserSync = require('browser-sync')
var connectBrowserSync = require('connect-browser-sync')

module.exports =
  class Server {
    constructor (rootDir, port, thoughtRunner) {
      this.rootDir = rootDir
      this.port = port
      this.browserSync = browserSync({logSnippet: false})
      var app = this.app = express()

      app.engine('handlebars', exphbs({
        defaultLayout: 'main',
        layoutsDir: path.resolve(__dirname, '../express/layouts')
      }))
      app.set('view engine', 'handlebars')
      app.set('views', path.resolve(__dirname, '../express/views'))

      app.use(connectBrowserSync(this.browserSync))

      // Load and deliver markdown-files (as info-page with Thought data)
      app.use((req, res, next) => {
        const filePath = req.path.replace(/^\//, '')
        thoughtRunner.targetFiles()
          .done((targetFiles) => {
            if (targetFiles.indexOf(filePath) > 0) {
              return qfs.read(path.join(rootDir, filePath))
                .then((contents) => {
                  res.render('thought', {
                    markdown: marked(contents),
                    filename: req.path
                  })
                })
                .catch((err) => next(err))
            } else {
              next()
            }
          })
      })

      app.use('/assets', express.static(path.resolve(__dirname, '..', 'express', 'assets')))
      app.get('/assets/github-markdown.css', (req, res, next) => {
        res.sendFile(require.resolve('github-markdown-css/github-markdown.css'))
      })

      app.use(express.static(rootDir))
      app.use(serveIndex(rootDir))
    }

    run () {
      console.log('Trying to listen on port ' + this.port)
      this.app.listen(this.port, () => {
        console.log('Server started on port %d', this.port)
      })
    }

    reload (files) {
      browserSync.reload(files)
    }
}
