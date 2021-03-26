const CLIENT_INSTANTIATION_TOKEN = Symbol('ClientInstantiationToken')

const SESSION_KEY = 'EduMonitor_Session'

class Client {
  constructor (token) {
    if (token !== CLIENT_INSTANTIATION_TOKEN) {
      throw new Error('create client via Client.create() static method')
    }

    this.gatewayUrl = null
    this.session = null // string or null, only used when session storage is not available
  }

  async submitRpc (namespace, method, ...params) {
    const session = window.sessionStorage ? window.sessionStorage.getItem(SESSION_KEY) : this.session

    const payload = {
      id: 1, // FIXME: better id generation
      method: namespace + '::' + method,
      params,
      session // session field is NOT defined in JSON RPC. We're adding this field ourself
    }

    if (window && window.fetch) {
      const resp = await (await fetch(this.gatewayUrl, {
        method: 'POST',
        body: JSON.stringify(payload)
      })).json()

      window.sessionStorage && window.sessionStorage.setItem(SESSION_KEY, this.session || '')
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
    } else if (typeof require !== 'undefined') {
      throw new Error('using client SDK in node.js environment is not yet supported')
    } else {
      throw new Error('no supported XHR transport found. consider upgrade your browser')
    }
  }

  static create (gatewayUrl) {
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
