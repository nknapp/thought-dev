/*!
 * thought-dev <https://github.com/nknapp/thought-dev>
 *
 * Copyright (c) 2017 Nils Knappmeier.
 * Released under the MIT license.
 */

/* eslint-env mocha */

const thoughtDev = require('../')
const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect

describe('thought-dev:', function () {
  it("should be executed", function () {
    expect(thoughtDev()).to.equal('thoughtDev')
  })
})
