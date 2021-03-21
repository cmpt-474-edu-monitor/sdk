'use strict'

const IDENTIFIER_REGEX = /[a-zA-Z0-9_]+/

function validateRequest (request) {
  if (request.id !== undefined
    && typeof request.id !== 'string'
    && typeof request.id !== 'number'
    && request.id !== null) {
    return new Error('id is not a string, number, or null')
  }

  if (!request.method || typeof request.method !== 'string') {
    throw new Error('method is not a string')
  }

  const namespace = request.method.substring(0, request.method.indexOf('::'))
  if (!namespace || namespace.length === 0) {
    throw new Error('a namespace is required')
  }

  if (!IDENTIFIER_REGEX.test(namespace)) {
    throw new Error(`illegal namespace: ${namespace}`)
  }

  const method = request.method.replace(namespace + '::', '')
  if (!IDENTIFIER_REGEX.test(method)) {
    throw new Error(`illegal method: ${method}`)
  }

  if (request.params instanceof Array
    || typeof request.params === 'object'
    || typeof request.params === 'undefined') {
    // noop
  } else {
    throw new Error('params is not an object or array')
  }
}

function makeResponse (payload, status = 200) {
  return {
    statusCode: status,
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  }
}

function makeErrorResponse (id = null, code, message, error) {
  return makeResponse({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data: error ? {
        stack: error.stack
      } : undefined
    }
  })
}

module.exports = {
  makeResponse,
  makeErrorResponse,
  validateRequest
}