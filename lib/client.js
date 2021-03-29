const CLIENT_INSTANTIATION_TOKEN = Symbol('ClientInstantiationToken')

const SESSION_KEY = 'EduMonitor_Session'

function hasAwsSdk () {
  try {
    require('aws-sdk')
    return true
  } catch (err) {
    return false
  }
}

class Client {
  constructor (token) {
    if (token !== CLIENT_INSTANTIATION_TOKEN) {
      throw new Error('create client via Client.create() static method')
    }

    this.gatewayUrl = null
    this.session = null // string or null, only used when session storage is not available
  }

  async submitRpc (namespace, method, ...params) {
    // from browser (user)
    if (typeof window !== 'undefined' && window.fetch) {
      const session = window.sessionStorage ? window.sessionStorage.getItem(SESSION_KEY) : this.session

      const payload = {
        id: 1, // FIXME: better id generation
        method: namespace + '::' + method,
        params,
        session // session field is NOT defined in JSON RPC. We're adding this field ourself
      }

      const resp = await (await window.fetch(this.gatewayUrl, {
        method: 'POST',
        body: JSON.stringify(payload)
      })).json()

      window.sessionStorage && window.sessionStorage.setItem(SESSION_KEY, resp.session || '')
      this.session = resp.session

      if (resp.error) {
        const error = new Error(resp.error.message)
        error.code = resp.error.code

        resp.error.data = resp.error.data || {}
        error.stack = resp.error.data.stack || error.stack
        error.name = resp.error.data.name || 'BackendError'

        throw error
      }

      return resp.result
    }

    // for aws lambda call between services
    if (hasAwsSdk()) {
      const AWS = require('aws-sdk')
      const { promisify } = require('util')
      const LAMBDA_PREFIX = process.env['LAMBDA_PREFIX'] || 'EduMonitor_'

      const lambda = new AWS.Lambda()
      const { result, error } = JSON.parse((await promisify(lambda.invoke).bind(lambda)({
        FunctionName: LAMBDA_PREFIX + namespace,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({
          method,
          params,
          session: null, // don't use session for calls between services: so no cross-request state pollution possible
          caller: {
            env: process.env, // probably not safe... but whatever
            isUser: false,
            isSystem: true
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

      return result
    }

    throw new Error('no supported RPC transport found.')
  }

  static create (gatewayUrl = null) {
    const client = new Client(CLIENT_INSTANTIATION_TOKEN)
    client.gatewayUrl = gatewayUrl

    return new Proxy(() => undefined, {
      get (target, property, receiver) {
        const namespace = property
        return new Proxy(() => undefined, {
          get (target, property, receiver) {
            const method = property
            return async (...params) => client.submitRpc(namespace, method, ...params)
          }
        })
      }
    })
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Client
}

if (typeof window !== 'undefined') {
  window.EduMonitor = Client
}
