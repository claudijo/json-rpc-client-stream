var Duplex = require('stream').Duplex;
var Notification = require('json-rpc-notification');
var Request = require('json-rpc-request');
var JsonRpcError = require('json-rpc-error');
var incrementer = require('dead-simple-incrementer');

module.exports = function(opts) {
  opts = opts || {};

  var nextId = opts.nextId || incrementer().next;
  var timeout = opts.timeout || 30 * 1000;

  var stream = new Duplex();
  var outgoingRequestQueue = [];
  var responseListeners = {};
  var timeouts = {};

  var flushOutgoingRequestQueue = function() {
    var json;

    if (!outgoingRequestQueue.length) return;

    if (outgoingRequestQueue.length === 1) {
      json = JSON.stringify(outgoingRequestQueue[0]);
    } else {
      json = JSON.stringify(outgoingRequestQueue);
    }

    outgoingRequestQueue = [];
    stream.push(json + '\n');
  };

  var createRequest = function(method, params, fn) {
    if (typeof params === 'function') {
      fn = params;
      params = undefined;
    }

    if (typeof fn === 'function') {
      return new Request(nextId(), method, params);
    }

    return new Notification(method, params);
  };

  var handleResponse = function(response) {
    if (responseListeners[response.id]) {
      responseListeners[response.id].call(null, response.error || null, response.result);
      delete responseListeners[response.id];
      cancelTimeout(response.id);
    }
  };

  var startTimeout = function(request) {
    timeouts[request.id] = setTimeout(function() {
      handleResponse({
        id: request.id,
        error: new JsonRpcError('Response timeout', -3199, request)
      });
    }, timeout);
  };

  var cancelTimeout = function(responseId) {
    clearTimeout(timeouts[responseId]);
    delete timeouts[responseId];
  };

  stream.rpc = {
    emit: function(method, params, fn) {
      var request = createRequest.apply(null, arguments);
      var callback;

      if (request.id) {
        callback = fn || params;
        responseListeners[request.id] = callback;

        startTimeout(request);
      }

      outgoingRequestQueue.push(request);
      process.nextTick(flushOutgoingRequestQueue);
    }
  };

  stream._write = function(chunk, encoding, callback) {
    var data;
    var chunkParts = chunk.toString().split('\n');

    for (var i = 0; i < chunkParts.length; i++) {
      try {
        data = JSON.parse(chunkParts[i]);
      } catch (err) {
        stream.emit('error', err);
      }

      if (Array.isArray(data)) {
        data.forEach(handleResponse);
      } else {
        handleResponse(data);
      }
    }

    callback();
  };

  stream._read = function(size) {};

  return stream;
};