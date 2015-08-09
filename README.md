# JSON RPC Client Stream

JSON RPC 2.0 client implementation with streaming I/O and event driven API for
endpoint implementers. For corresponding server implementation see
[json-rpc-server-stream](https://github.com/claudijo/json-rpc-server-stream).

## JSON RPC 2.0 Architecture

The [JSON RPC 2.0 protocol](http://www.jsonrpc.org/specification) uses a
client-server-architecture, in contrast to the peer-to-peer oriented 1.0
version, where peers act as both clients and server. However, it is still
possible to use JSON RPC 2.0 in a peer-to-peer fashion.

### Using JSON RPC 2.0 in a Peer-to-peer Fashion

A server and client pair must be installed on each node in order to use JSON RPC
2.0 in a peer-to-peer fashion. Additionally, full-duplex communication between
node endpoint is required, for instance using
[WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API).
The question then becomes: How to separate incoming requests from incoming
responses?

This problem could be handled by the protocol implementation, since it is quite
straight forward to separate well-formed requests from well-formed responses.
Consequently, messages could be inspected by the implementation and either be
handled as requests or as responses. However, such an approach is not optimal –
It violates the idea of _separation of concerns_. Furthermore, there are
malformed JSON RPC 2.0 messages, such as an empty array `"[]"`, that cannot be
distinguished as a malformed request that requires an error response or a
malformed response that should be left unanswered.

A better approach when a JSON RPC 2.0 server and client on the same node share a
common bidirectional channel is to multiplex and demultiplex (mux/demux) the
transmission, so that each message only hits the intended endpoint
implementation. The module
[mux-demux-stream](https://github.com/claudijo/mux-demux-stream) can be used to
achieve this.

## Installation

```js
npm install json-rpc-client-stream
```

## Usage

Create a JSON RPC client stream and emit requests or notifications.

Do some stream plumbing, such as: Readable connection stream -> RPC client ->
Writable connection stream.

As mentioned above, it is recommended to pipe the streaming JSON RPC 2.0 server
and client through a mux/demux before piping it to a channel stream if using
JSON RPC 2.0 in a peer-to-peer fashion.

### jsonRpcClientStream()

The module exports a factory function that returns a JSON RPC client stream
instance, which is a
[duplex stream](https://nodejs.org/api/stream.html#stream_class_stream_duplex).

### jsonRpcClientStreamInstance.rpc.emit(method[, parameters][, callback])

Emit an RPC `method` with an optional `parameters` argument. If the RPC expects a
response (i.e a request) pass in a response `callback`. The callback will be called
with an `error` argument and a `result` argument. If the response callback is
omitted, the RPC does not expect an response (i.e a notification).

### Batch RPC call
Emitting several RPC request within the same event loop will result in a batch
request, where all the requests are sent at the same time.

## Basic Example

The following example shows the basic use cases for a JSON RPC 2.0 Client.

```js
var jsonRpcClientStream = require('json-rpc-client-stream');

// A request
jsonRpcClientStream.rpc.emit('divide', { denominator: 2, numerator: 4 },
    function(err, result) {
  if (err) return console.error(err);

  console.log(result);
});

// A notification
jsonRpcClientStream.rpc.emit('log', 'All is good');
```

## Advanced Example
The following example shows how to implement a JSON RPC 2.0 client and server
in the browser where websockets are used as a shared bi-directional channel, with
multiplexed and demultiplexed transmission. Additional modules
[json-rpc-server-stream](https://github.com/claudijo/json-rpc-server-stream),
[websocket-connection-stream](https://github.com/claudijo/websocket-connection-stream),
and [mux-demux-stream](https://github.com/claudijo/mux-demux-stream) are used.

```js
var ws = new WebSocket('ws://localhost:8080');
var connectionStream = require('websocket-connection-stream')().attach(ws);

var jsonRpcServerStream = require('json-rpc-server-stream')();
var jsonRpcClientStream = require('json-rpc-client-stream')();

// Multiplex outgoing client requests and outgoing server responses.
mux([jsonRpcServerStream, jsonRpcClientStream], websocketConnectionStream);

// Demultiplex incoming server requests and incoming client responses
demux(websocketConnectionStream, [jsonRpcServerStream, jsonRpcClientStream]);

jsonRpcClientStream.rpc.emit('join', { roomId: 'roomA'}, function(err, result) {
  if (err) return console.error(err)

  jsonRpcClientStream.rpc.emit('chat', {
    to: 'roomA',
    from: 'Alice',
    message: 'Hi there'
  });
})

jsonRpcServerStream.rpc.on('chat', function(params) {
  console.log(params.from + ' says: ' + params.message);
});
```

## Related packages

* [json-rpc-server-stream](https://github.com/claudijo/json-rpc-server-stream)
* [websocket-connection-stream](https://github.com/claudijo/websocket-connection-stream)
* [mux-demux-stream](https://github.com/claudijo/mux-demux-stream)

## Test

Run unit tests;

`$ npm test`

Create test coverage report:

`$ npm run-script test-cov`

# License

[MIT](LICENSE)
