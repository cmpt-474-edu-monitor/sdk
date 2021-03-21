const GateWayBuilder = require('./lib/gateway').builder
const ServiceBuilder = require('./lib/service').builder
const Client = require('./lib/client')

module.exports = {
  GateWayBuilder,
  ServiceBuilder,
  Client,

  // development: API gateway
  // handler: new GateWayBuilder().addNamespace('Tests').build()


  // development: service function
  // handler: new ServiceBuilder()
  //   .addInterface('echo', (ctx, ...args) => args)
  //   .addInterface('getAnswer', (ctx) => 42)
  //   .addInterface('add', (ctx, a, b) => a + b)
  //   .build()
}