'use strict'

/* global $ */
/* global Ractive */

var PartialMarker = document.registerElement('partial-marker')
var TextWrapper = document.registerElement('text-wrapper')

class PartialTreeNode {
  /**
   *
   * @param name the partial name
   * @param {Comment} startComment the Comment node that starts the partial
   * @param root
   */
  constructor (name, startComment, root) {
    this.name = name
    this.children = []
    this.elements = []
    this.root = root
    this.startComment = startComment
    this.marker = new PartialMarker()
  }

  /**
   * Add and return a new child-node
   * @param {string} name the name of the child partial
   * @param {Comment} startComment the Comment node that starts this partial
   */
  addChild (name, startComment) {
    const newChild = new PartialTreeNode(name, startComment, false)
    this.children.push(newChild)
    return newChild
  }

  addDOMNode (node) {
    this.elements.push(node)
  }

  tree () {
    return {
      name: this.name,
      children: this.children.map(function (child) {
        return child.tree()
      })
    }
  }

  /**
   * Replace all text-nodes by wrapper-elements
   */
  finalize () {
    var _this = this
    if (this.elements.length === 0 && this.children.length === 0) {
      // Insert dummy-element to show position of the partial
      const dummyElement = $('<span>').attr('title', this.name).text(`(${this.name})`)[0]
      this.elements.push(dummyElement)
      // Insert dummy after startcomment
      this.startComment.parentNode.insertBefore(dummyElement, this.startComment.nextSibling)
    }
    for (var i = 0; i < this.elements.length; i++) {
      const el = this.elements[i]
      if (el instanceof window.Text) {
        let textWrapper = new TextWrapper()
        el.parentNode.insertBefore(textWrapper, el)
        textWrapper.appendChild(this.elements[i])
        this.elements[i] = textWrapper
      }
      // Highlight when hovering
      $(this.elements[i]).mouseenter(function (event) {
        _this.highlight(true)
      })
      $(this.marker).mouseleave(function (event) {
        _this.highlight(false)
      })
    }
  }

  highlight (enabled) {
    this.highlighted = enabled
    console.log(this.highlighted)
    if (enabled) {
      if (this.marker.parentNode) {
        return
      }
      var bounds
      if (this.elements.length === 1) {
        bounds = this.elements[0].getBoundingClientRect()
      } else if (this.elements.length > 1) {
        let range = document.createRange()
        range.setStart(this.elements[0], 0)
        range.setEnd(this.elements[this.elements.length - 1], 0)
        bounds = range.getBoundingClientRect()
      } else {
        throw new Error('Partial ' + this.name + ' has not elements')
      }
      this.marker.style.left = Math.round(bounds.left) + 'px'
      this.marker.style.top = Math.round(bounds.top + window.scrollY) + 'px'
      this.marker.style.height = Math.round(bounds.height) + 'px'
      this.marker.style.width = Math.round(bounds.width) + 'px'
      document.body.appendChild(this.marker)
    } else {
      if (!this.marker.parentNode) {
        return
      }
      document.body.removeChild(this.marker)
    }
  }

  scrollTo () {
    var top = this.elements[0].getBoundingClientRect().top
    $('html, body').clearQueue().animate({ scrollTop: top + window.scrollY })
  }
}

function createPartialTree () {
  var partialTree = new PartialTreeNode('root', null, true)
  var partialStack = [partialTree]

  var iterator = document.createNodeIterator(
    $('.markdown-body')[0],
    window.NodeFilter.SHOW_TEXT | window.NodeFilter.SHOW_ELEMENT | window.NodeFilter.SHOW_COMMENT,
    {
      acceptNode: function (node) {
        if (node instanceof window.Comment) {
          return window.NodeFilter.FILTER_ACCEPT
        } else if (node instanceof window.Text && node.textContent.trim() !== '') {
          return window.NodeFilter.FILTER_ACCEPT
        } else if (node instanceof window.HTMLElement && node.childElementCount === 0) {
          return window.NodeFilter.FILTER_ACCEPT
        } else {
          return window.NodeFilter.FILTER_REJECT
        }
      }
    }
  )

  var x
  while (true) {
    x = iterator.nextNode()
    if (!x) {
      break
    }
    if (x instanceof window.Comment) {
      var match = x.textContent.match(/^\s*partial\s+name='([^']+)'\s*/)
      if (match) {
        var newPartial = partialStack[partialStack.length - 1].addChild(match[1], x)
        partialStack.push(newPartial)
      } else if (x.textContent.match(/^\s*\/partial\s*/)) {
        partialStack.pop().finalize()
      }
    } else {
      partialStack[partialStack.length - 1].addDOMNode(x)
    }
  }
  return partialTree
}

// Render
function render (partialTree) {
  var ractive = new Ractive({
    el: '#partial-tree',
    template: '#navTemplate', //
    partials: {navTreeNode: $('#navTreeNode').html()},
    data: partialTree,
    magic: true
  })
  ractive.on('label-enter', function (event) {
    event.context.highlight(true)
  })
  ractive.on('label-click', function (event) {
    event.context.scrollTo()
  })
  ractive.on('label-leave', function (event) {
    event.context.highlight(false)
  })
}

$(function () {
  var partialTree = createPartialTree()
  render(partialTree)
})
