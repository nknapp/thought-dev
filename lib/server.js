'use strict'

var express = require('express')
var serveIndex = require('serve-index')
var qfs = require('q-io/fs')
var Q = require('q')
var marked = require('marked')
var hbs = require('express-hbs')
var path = require('path')
var browserSync = require('browser-sync')
var connectBrowserSync = require('connect-browser-sync')
var bodyParser = require('body-parser')
var cp = require('child_process')

module.exports =
  class Server {
    constructor (rootDir, port, thoughtRunner) {
      this.rootDir = rootDir
      this.port = port
      this.browserSync = browserSync({logSnippet: false})
      var app = this.app = express()

      app.engine('hbs', hbs.express4({
        partialsDir: path.resolve(__dirname, '../express/partials'),
        layoutsDir: path.resolve(__dirname, '../express/layouts'),
        defaultLayout: path.resolve(__dirname, '../express/layouts/main.hbs')
      }))
      app.set('view engine', 'hbs')
      app.set('views', path.resolve(__dirname, '../express/views'))

      app.use(connectBrowserSync(this.browserSync))

      // Load and deliver markdown-files (as info-page with Thought data)
      app.use((req, res, next) => {
        const filePath = req.path.replace(/^\//, '')
        Q.all([thoughtRunner.targetFiles(), thoughtRunner.config])
          .spread((targetFiles, config) => {
            // Is the request file really a target file of Thought?
            if (targetFiles.indexOf(filePath) >= 0) {
              return qfs.read(path.join(rootDir, filePath))
                .then((contents) => {
                  res.render('thought', {
                    markdown: marked(contents),
                    filename: req.path,
                    partials: config.handlebars.partials,
                    templateName: filePath + '.hbs',
                    template: config.handlebars.templates[filePath + '.hbs'],
                    configJson: JSON.stringify(config, null, 2)
                  })
                })
                .catch((err) => next(err))
            } else {
              next()
            }
          })
          .done()
      })

      app.use('/assets', express.static(path.resolve(__dirname, '..', 'express', 'assets')))
      app.use(bodyParser.urlencoded({extended: false}))
      app.get('/assets/github-markdown.css', (req, res, next) => {
        res.sendFile(require.resolve('github-markdown-css/github-markdown.css'))
      })
      app.get('/assets/highlight.pack.js', (req, res, next) => {
        res.sendFile(require.resolve('highlightjs/highlight.pack.js'))
      })
      app.get('/assets/highlight.css', (req, res, next) => {
        res.sendFile(require.resolve('highlightjs/styles/github.css'))
      })
      app.post('/open-editor', (req, res, next) => {
        var filepath = computeFilepath(req)
        qfs.exists(filepath)
          .then((exists) => {
            if (!exists) {
              return Q.all([thoughtRunner.config, qfs.makeTree(path.dirname(filepath))])
                .spread((config) => {
                  var currentContent
                  switch (req.body.type) {
                    case 'partial':
                      currentContent = config.handlebars.partials[req.body.name].contents
                      break
                    case 'template':
                      currentContent = config.handlebars.templates[req.body.name].contents
                      break
                  }
                  return qfs.write(filepath, currentContent)
                })
            }
          })
          .then(() => {
            cp.spawn('sh', ['-c', `${process.env['EDITOR']} ${filepath}`], {
              env: process.env,
              stdio: 'inherit'
            })
            res.send(JSON.stringify({success: true}))
          })
          .catch((e) => next(e))
      })

      app.post('/revert', (req, res, next) => {
        var filepath = computeFilepath(req)
        qfs.remove(filepath)
          .then(() => res.send(JSON.stringify({success: true})))
          .catch((e) => next(e))
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

function computeFilepath (req) {
  switch (req.body.type) {
    case 'partial':
      return path.join('.thought', 'partials', path.normalize(req.body.name))
    case 'template':
      return path.join('.thought', 'templates', path.normalize(req.body.name))
  }
}
