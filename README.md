# EduMonitor SDK

## 1 Create the API Gateway

### 1.1 Implement Custom Gateway with AWS Lambda

The Custom JSON RPC gateway itself is actually powered by a AWS Lambda function. The gateway acts as
an aggregator for all other microservices and maintain stateful data (eg. current user) through 
session data.

#### 1.1.1 Create Execution Policy

The API gateway will call other Lambda function (ie. microservices). Thus, it needs permission to 
invoke other lambda functions.

In your AWS console, goto **IAM** service. Select **Policies** under **Access Management** menu on
the left sidebar. Click **Create Policy** button. Switch to **JSON** tab, input the following 
exactly:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "lambda:ListFunctions",
                "lambda:InvokeFunction",
                "lambda:InvokeAsync"
            ],
            "Resource": "*"
        }
    ]
}
```

Click **Next** button. Skip tagging. Name the policy **AWSLambdaInvokeAccess**.


#### 1.1.2 Create Execution Role

In your AWS console, goto **IAM** service. Select **Policies** under **Access Management** menu on 
the left sidebar. Click **Create Role** button. 

Choose **AWS Service** as your trust entity. Choose **Lambda** as your use case. Click **next**. 

From the list of policies, select the following two policies:

  - AWSLambdaBasicExecutionRole (AWS managed policy)
  - LambdaInvokeAccess (the one your just created)

Skip tagging. Name the role **InvokeAnyLambdaRole**.


#### 1.1.3 Create API Gateway Function

In your AWS console, goto **Lambda** service. **Create** a new function with following settings:

  - Function name: **EduMonitor_ApiGateway**
  - Runtime: **Node.js 14.x**
  - Execution Role: **InvokeAnyLambdaRole**

Leave everything else as in default.

On your local computer create an empty NPM project:

```
$ mkdir edu-monitor-gateway 
$ cd edu-monitor-gateway 
$ npm init
```

Add the sdk as your dependency:

```
$ npm install -S git+ssh://git@github.com:cmpt-474-edu-monitor/sdk.git
```

If installation fails, check your have your [local SSH public added to your GitHub account profile](https://docs.github.com/en/github/authenticating-to-github/connecting-to-github-with-ssh).


Create a new file named `index.js` with the following context exactly:

```js
const { GateWayBuilder } = require('edu-monitor-sdk')

exports.handler = new GateWayBuilder()
    .addNamespace('Users')
    .addNamespace('Tasks')
    .addNamespace('Grades')
    .build()
```

You can chain as many `.addNamespace()` calls as you like, but for iteration 1, we only need these 
three.

Zip all file under project root (where your `index.js` resides). It is important that you includes 
the `node_modules` directory (which can be large).

```
$ zip edu-monitor-gateway.zip * -r
```

In the browser editor for your `EduMonitor_ApiGateway` function, select **Upload from ...** > 
**.zip file**. Upload the tarball created.

#### 1.2 Connect to HTTP Service

In your AWS console, goto **API Gateway** service. Click **Create API** can create a **HTTP API** 
(not REST API!). 

Add **EduMonitor_ApiGateway** lambda function as a integration. Name the API 
**EduMonitor_ApiGateway**. Leave everything else as in default. Click **Next**

During configuring routes, use the following route:

  - Method: **ANY**
  - Resource Path: **/jsonrpc** (important!)
  - Integration target: **EduMonitor_ApiGateway**

Leave everything else as in default and create the gateway.

Click into your newly created gateway. Select **CORS** under **Develop** from the left sidebar. Add 
the following configuration:
  
  - Access-Control-Allow-Origin: `*`
  - Access-Control-Allow-Methods: `*`

Save configuration.

Lookup your **Invoke URL** for this gateway. Append `/jsonrpc` to its end. For example: [`https://f605182gg9.execute-api.us-east-1.amazonaws.com/jsonrpc`](https://f605182gg9.execute-api.us-east-1.amazonaws.com/jsonrpc).

Open this url in your browser, you should see something like:

```json
{
    "jsonrpc": "2.0",
    "id": null,
    "error": {
        "code": -32600,
        "message": "must use HTTP POST"
    }
}
```

## 2 Connect a Serverless Microservice


Iteration 1 will require creating three microservices (`Users`, `Tasks`, `Grades`). You will need to 
create a separate serverless functions for each (thus, "microservice"). 

**Note: it is important to prefix your serverless function name with `EduMonitor_`. For example: 
`EduMonitor_Users`.**

Create you serverless function almost the same as in **1.1.3**. Key differences are:

## 2.1 No Special Execution Role

You don't need **InvokeAnyLambdaRole**. Leaving execution role to default.

## 2.2 Use `ServiceBuilder` instead of `GateWayBuilder`

In your `index.js` file:

```js
const { ServiceBuilder } = require('edu-monitor-sdk')

async function signup(ctx, userInfo, password) {
    // implementation omitted...
}

async function login(ctx, email, password) {
    // implementation omitted...
}

// more user functions...

exports.handler = new ServiceBuilder()
    .addInterface('signup', signup)
    .addInterface('login', login)
    // register more interfaces...
    .build()
```

**Note: it is important to assume the first argument to your implementation is always a `context` 
object** (not used in iteration 1)

If your implementation used `this` keyword, you might need to explicitly bind it to its proper 
enclosing lexical context:

```js
const { ServiceBuilder } = require('edu-monitor-sdk')

class UserService {
    async signup(ctx, userInfo, password) {
        // implementation omitted...
    }

    async login(ctx, email, password) {
        // implementation omitted...
    }

    // more user functions...
}

const service = new UserService()

exports.handler = new ServiceBuilder()
    .addInterface('signup', service.signup, service) // notice the third argument
    .addInterface('login', service.login.bind(service)) // or bind it yourself
    // register more interfaces...
    .build()

```

## 2.3 Async function should return a `Promise` (rather than accepting a callback)

For example:
```js
function readFile(ctx, path) {
    return new Promise((resolve, reject) => {
        require('fs').readFile(path, 'utf-8', (err, data) => {
            if (err) return reject(err)
            resolve(data)
        })
    })
}

exports.handler = new ServiceBuilder()
    .addInterface('readFile', readFile)
    .build()
```

Functions mark with `async` automatically returns a promise. Read more about `Promise` on [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise).

## 3 Use the SDK

The `client.js` file could be used as normal browser js source without a bundler. In the `<head>` of
your frontend html page, include it as a JavaScript source. For example:

```html
<head>
    <title>foobar</title>

    <!-- Your should copy this file somewhere and upload to AWS Amplify with all your other static resources -->
    <script src="./node_modules/edu-monitor-sdk/lib/client.js"></script>
</head>
```

Instantiate a client. Call remote functions as `client.<Namespace>.<method>`. Pay attention to letter cases:

```html
<input id="email" type="email" />
<input id="password" type="password" />
<input type="button" value="Login" onclick="login()"/>

<script>
// TODO: update this to your JSON RPC url
const client = Client.create('https://f605182gg9.execute-api.us-east-1.amazonaws.com/jsonrpc')

async function login() {
    // remember to `await`!
    const profile = await client.Users.login(email, password) // you don't worry about `context` object there
    alert('Welcome back, ' + profile.name)
}
</script>
```

Any error throw from the serverless function will propagate into your front end function call. Catch
it as you usually do:

```js
try {
    await client.Users.thisFunctionWillThrowAnError()
} catch (err) {
    alert('Oops... ' + err.message)
}
```