exports.builder = class ServiceBuilder {
  constructor () {
    this.interfaces = {}
  }

  addInterface (name, implementation, thisArg) {
    this.interfaces[name] = {
      implementation, thisArg
    }

    return this
  }

  build () {
    const interfaces = Object.assign({}, this.interfaces)

    const handler = async (request, context) => {
      const { method, params, session, caller } = request
      if (Object.keys(interfaces).indexOf(method) === -1) {
        const err = new Error(`method ${method} does not exist`)
        err.code = -32601
        throw err
      }

      const { implementation, thisArg } = interfaces[method]
      context.session = session
      context.caller = caller
      return {
        result: await (thisArg ? implementation.bind(thisArg) : implementation)(context, ...params),
        session: context.session
      }
    }

    return (event, context) => handler(event, context)
      .catch(err => ({
        error: {
          code: typeof err.code !== 'string' && err.code || -1,
          message: err.message,
          data: {
            stack: err.stack,
            name: err.name
          }
        }
      }))
  }
}
