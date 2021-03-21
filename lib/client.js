const CLIENT_INSTANTIATION_TOKEN = Symbol('ClientInstantiationToken')

class Client {
  constructor (token) {
    if (token !== CLIENT_INSTANTIATION_TOKEN) {
      throw new Error('create client via Client.create() static method')
    }

    this.gatewayUrl = null
  }

  async submitRpc (namespace, method, ...params) {
    const payload = {
      id: 1, // FIXME: better id generation
      method: namespace + '::' + method,
      params
    }

    if (window && window.fetch) {
      const resp = await (await fetch(this.gatewayUrl, {
        method: 'POST',
        body: JSON.stringify(payload)
      })).json()

      if (resp.error) {
        const error = new Error(resp.error.message)
        error.code = resp.error.code

        resp.error.data = resp.error.data || {}
        error.stack = resp.error.data.stack || error.stack

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