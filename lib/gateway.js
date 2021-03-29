'use strict'

const AWS = require('aws-sdk')
const { promisify } = require('util')
const { makeResponse, makeErrorResponse, validateRequest } = require('./jsonrpc')
const crypto = require('./crypto')

const LAMBDA_PREFIX = process.env['LAMBDA_PREFIX'] || 'EduMonitor_'
const lambda = new AWS.Lambda()

exports.builder = class GatewayBuilder {
  constructor () {
    this.namespaces = []
  }

  addNamespace (namespace) {
    if (!/[a-zA-Z0-9_]+/.test(namespace)) {
      throw new Error(`illegal namespace: ${namespace}`)
    }
    this.namespaces.push(namespace)

    return this
  }

  build () {
    const namespaces = this.namespaces.slice()

    const handler = async (event, context) => {
      if (event.requestContext.http.method.toUpperCase() !== 'POST') {
        return makeErrorResponse(null, -32600, 'must use HTTP POST') // -32600: Parse error
      }

      let request
      try {
        request = JSON.parse(event.isBase64Encoded ? atob(event.body) : event.body)
      } catch (err) {
        return makeErrorResponse(null, -32700, err.message, err) // -32700: Invalid request
      }

      try {
        validateRequest(request)
      } catch (err) {
        return makeErrorResponse(null, -32600, err.message, err)
      }

      const namespace = request.method.substring(0, request.method.indexOf('::'))
      if (namespaces.indexOf(namespace) === -1) {
        return makeErrorResponse(null, -32601, `namespace ${namespace} does not exist`)
      }

      const method = request.method.replace(namespace + '::', '')

      let params = []
      if (request.params instanceof Array) {
        params = request.params
      } else if (typeof request.params === 'object') {
        params.push(request.params)
      }

      let decryptedSession = {}
      if (request.session) {
        try {
          decryptedSession = await crypto.decrypt(request.session)
        } catch (e) {
          console.error(e) // fallback to empty session
        }
      }

      try {
        const { result, error, session } = JSON.parse((await promisify(lambda.invoke).bind(lambda)({
          FunctionName: LAMBDA_PREFIX + namespace,
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            method,
            params,
            session: decryptedSession,
            caller: {
              env: process.env, // probably not safe... but whatever
              isUser: true,
              isSystem: false
            }
          })
        })).Payload)

        // noinspection DuplicatedCode
        if (error) {
          const err = new Error(error.message)
          err.data = error.data || {}
          err.stack = error.data.stack || err.stack
          err.name = error.data.name || 'BackendError'

          // noinspection ExceptionCaughtLocallyJS
          throw error
        }

        if (request.id) {
          return makeResponse({
            jsonrpc: '2.0',
            id: request.id,
            result,
            session: await crypto.encrypt(session || {})
          })
        }
        return makeResponse(undefined)
      } catch (err) {
        return makeErrorResponse(request.id, typeof err.code === 'number' && err.code || -1, err.message, err)
      }
    }

    return (event, context) => handler(event, context)
      .catch(err => makeErrorResponse(null, typeof err.code === 'number' && err.code || -1, err.message, err))
  }
}
