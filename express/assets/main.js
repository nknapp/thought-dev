'use strict'

/* global $ */
/* global hljs */

var PartialMarker = document.registerElement('partial-marker')
var TextWrapper = document.registerElement('text-wrapper')

class PartialTreeNode {
  /**
   *
   * @param name the partial name
   * @param {Comment} startComment the Comment node that starts the partial
   * @param parent
   */
  constructor (name, startComment, parent) {
    // z-index of the partial marker
    this.zIndex = parent ? parent.zIndex + 1 : 1000
    this.name = name
    this.children = []
    this.elements = []
    this.parent = parent
    this.startComment = startComment
    this.marker = new PartialMarker()
    this.sourceHeader = $('#parts [data-part-name="' + name + '.hbs"]')
    this.accordionIndex = this.sourceHeader.prevAll('.title').length
    document.body.appendChild(this.marker)
  }

  fullPath () {
    if (this.parent) {
      const container = this.parent.fullPath()
      $('<span/>').text(this.name).appendTo(container)
      return container
    } else {
      return $('<div>')
    }
  }

  /**
   * Add and return a new child-node
   * @param {string} name the name of the child partial
   * @param {Comment} startComment the Comment node that starts this partial
   */
  addChild (name, startComment) {
    const newChild = new PartialTreeNode(name, startComment, this)
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
      this.start = dummyElement
      this.end = dummyElement
    }
    setTimeout(function () {
      _this.adjustMarker()
    }, 1000)
  }

  highlight (enabled) {
    this.highlighted = enabled
    if (this.highlighted) {
      $(this.marker).css('opacity', 1)
      this.sourceHeader.addClass('highlighted')
    } else {
      $(this.marker).css('opacity', 0.1)
      this.sourceHeader.removeClass('highlighted')
    }
  }

  adjustMarker () {
    var _this = this
    var bounds
    if (!this.start && !this.end) {
      // no elements (this should not happen)
      throw new Error('Partial ' + this.name + ' has no elements')
    } else if (this.start === this.end) {
      // single element
      bounds = this.start.getBoundingClientRect()
    } else {
      // multiple elements
      let range = document.createRange()
      range.setStart(this.start, 0)
      range.setEnd(this.end, 0)
      bounds = range.getBoundingClientRect()
    }
    this.marker.style.left = Math.round(bounds.left - 5) + 'px'
    this.marker.style.top = Math.round(bounds.top + window.scrollY - 5) + 'px'
    this.marker.style.height = Math.round(bounds.height + 10) + 'px'
    this.marker.style.width = Math.round(bounds.width + 10) + 'px'
    this.marker.style['z-index'] = this.zIndex
    this.marker.style.opacity = 0.1
    $(this.marker).attr('data-partial-name', this.name)
    $(this.marker).mouseover(function (event) {
      _this.highlight(true)
    })
    $(this.marker).mouseout(function (event) {
      _this.highlight(false)
    })
    $(this.sourceHeader).mouseover(function (event) {
      _this.highlight(true)
    })
    $(this.sourceHeader).mouseout(function (event) {
      _this.highlight(false)
    })

    $(this.marker).click(function (event) {
      $('#parts').accordion('open', _this.accordionIndex)
    })
  }

  scrollTo () {
    var top = this.elements[0].getBoundingClientRect().top
    $('html, body').clearQueue().animate({scrollTop: top + window.scrollY})
  }
}

function createPartialTree () {
  var partialTree = new PartialTreeNode('root', null, null)
  var partialStack = [partialTree]

  var iterator = document.createNodeIterator(
    $('#markdown-body')[0],
    window.NodeFilter.SHOW_ELEMENT | window.NodeFilter.SHOW_COMMENT,
    function (node) {
      if (node instanceof window.Comment) {
        return window.NodeFilter.FILTER_ACCEPT
      } else if (node instanceof window.HTMLElement && node.childElementCount === 0) {
        return window.NodeFilter.FILTER_ACCEPT
      } else {
        return window.NodeFilter.FILTER_REJECT
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
      var match = x.textContent.match(/^\s*part\s+name='([^']+)'\s*/)
      if (match) {
        var newPartial = partialStack[partialStack.length - 1].addChild(match[1], x)
        partialStack.push(newPartial)
      } else if (x.textContent.match(/^\s*\/part\s*/)) {
        partialStack.pop().finalize()
      }
    } else {
      partialStack.forEach(function (partial) {
        // Take element if non exists (i.e. first element)
        partial.start = partial.start || x
        // Take last element (overwerite previous)
        partial.end = x
      })
      $(x).attr('data-content', partialStack.map(function (partial) {
        return partial.name
      }).join(' > '))
      partialStack[partialStack.length - 1].addDOMNode(x)
    }
  }
  return partialTree
}

function prepareTextNodes (rootElement) {
  var iterator = document.createNodeIterator(rootElement, window.NodeFilter.SHOW_TEXT,
    function (node) {
      if (node.textContent.match(/^\s*$/) || node.parentNode.tagName === 'TEXT-WRAPPER') {
        return window.NodeFilter.FILTER_REJECT
      } else {
        return window.NodeFilter.FILTER_ACCEPT
      }
    })
  while (true) {
    var x = iterator.nextNode()
    if (!x) {
      break
    }
    var wrapper = new TextWrapper()
    x.parentNode.insertBefore(wrapper, x)
    wrapper.appendChild(x)
  }
}

$(function () {
  $('pre code').each(function (i, block) {
    hljs.highlightBlock(block)
  })
  prepareTextNodes($('#markdown-body')[0])
  window.partialTree = createPartialTree()
  //  render(partialTree)

  $('#parts').accordion()
  $('.tabular.menu .item').tab()
  /* One required, one optional variable */
  $.fn.api.settings.api = {
    'edit part': '/open-editor',
    'revert part': '/revert'
  }
  $('button').api({
    method: 'POST',
    serializeForm: true
  })
})
