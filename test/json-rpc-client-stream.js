var expect = require('expect.js');
var jsonRpcClientStream = require('..');
var stream = require('stream');
var sinon = require('sinon');

describe('JSON RPC 2.0 client stream', function() {
  var duplex = null;
  var clock;

  beforeEach(function() {
    duplex = new stream.Duplex();
    clock = sinon.useFakeTimers();
    duplex._read = function(size) {};
  });

  afterEach(function() {
    duplex = null;
    clock.restore();
    clock = null;
  });

  describe('with default options', function() {
    var jsonRpcClient = null;

    beforeEach(function() {
      jsonRpcClient = jsonRpcClientStream();
      duplex.pipe(jsonRpcClient).pipe(duplex);
    });

    afterEach(function() {
      jsonRpcClient = null;
    });

    it('should stream notification without params', function(done) {
      duplex._write = function(chunk, encoding, callback) {
        expect(JSON.parse(chunk)).to.eql({
          jsonrpc: '2.0',
          method: 'foobar'
        });

        done();
      };

      jsonRpcClient.rpc.emit('foobar');
    });

    it('should stream notification with params', function(done) {
      duplex._write = function(chunk, encoding, callback) {
        expect(JSON.parse(chunk)).to.eql({
          jsonrpc: '2.0',
          method: 'update',
          params: [1, 2, 3, 4, 5]
        });

        done();
      };

      jsonRpcClient.rpc.emit('update', [1, 2, 3, 4, 5]);
    });

    it('should stream request without params', function(done) {
      duplex._write = function(chunk, encoding, callback) {
        expect(JSON.parse(chunk)).to.eql({
          jsonrpc: '2.0',
          method: 'foobar',
          id: 1
        });

        done();
      };

      jsonRpcClient.rpc.emit('foobar', function(err, result) {});
    });

    it('should stream concurrent requests as batch', function(done) {
      duplex._write = function(chunk, encoding, callback) {
        expect(JSON.parse(chunk)).to.eql([
          {
            jsonrpc: '2.0',
            method: 'foo',
            id: 1
          }, {
            jsonrpc: '2.0',
            method: 'bar',
            id: 2
          }
        ]);

        done();
      };

      jsonRpcClient.rpc.emit('foo', function(err, result) {});
      jsonRpcClient.rpc.emit('bar', function(err, result) {});
    });

    it('should invoke callback with result on valid request with params', function(done) {
      duplex._write = function(chunk, encoding, callback) {
        duplex.push('{"jsonrpc": "2.0", "result": 3, "id": 1}');
      };

      jsonRpcClient.rpc.emit('add', [1, 2], function(err, result) {
        expect(err).to.be(null);
        expect(result).to.be(3);
        done();
      });
    });

    it('should invoke callback with result on valid request without params', function(done) {
      duplex._write = function(chunk, encoding, callback) {
        duplex.push('{"jsonrpc": "2.0", "result": "pong", "id": 1}');
      };

      jsonRpcClient.rpc.emit('ping', function(err, result) {
        expect(err).to.be(null);
        expect(result).to.be('pong');
        done();
      });
    });

    it('should invoke callback with error on erroneous request', function(done) {
      duplex._write = function(chunk, encoding, callback) {
        duplex.push('{"jsonrpc": "2.0", "error": {"code": -32601, "message": "Method not found"}, "id": 1}');
      };

      jsonRpcClient.rpc.emit('foo', [1, 2], function(err, result) {
        expect(err).to.eql({
          code: -32601,
          message: 'Method not found'
        });
        done();
      });
    });

    it('should invoke correct callback when receiving batch response', function(done) {
      var addHandled, pingHandled, fooHandled;

      duplex._write = function(chunk, encoding, callback) {
        duplex.push('[{"jsonrpc": "2.0", "result": 3, "id": 1},{"jsonrpc": "2.0", "result": "pong", "id": 2},{"jsonrpc": "2.0", "error": {"code": -32601, "message": "Method not found"}, "id": 3}]');
      };

      jsonRpcClient.rpc.emit('add', [1, 2], function(err, result) {
        expect(err).to.be(null);
        expect(result).to.be(3);

        addHandled = true;
        if (addHandled && pingHandled && fooHandled) {
          done();
        }
      });

      jsonRpcClient.rpc.emit('ping', function(err, result) {
        expect(err).to.be(null);
        expect(result).to.be('pong');

        pingHandled = true;
        if (addHandled && pingHandled && fooHandled) {
          done();
        }
      });

      jsonRpcClient.rpc.emit('foo', [1, 2], function(err, result) {
        expect(err).to.eql({
          code: -32601,
          message: 'Method not found'
        });

        fooHandled = true;
        if (addHandled && pingHandled && fooHandled) {
          done();
        }
      });
    });

    it('should emit error when receiving malformed JSON', function(done) {
      duplex._write = function(chunk, encoding, callback) {
        duplex.push('{"jsonrpc": "2.0", "result": 3, "id": 1');
      };

      jsonRpcClient.on('error', function(err) {
        expect(err).to.be.an(Error);
        done();
      });

      jsonRpcClient.rpc.emit('add', [1, 2], function(err, result) {});
    });

    it('should timeout callback with error if server does not respond', function(done) {
      duplex._write = function(chunk, encoding, callback) {};

      jsonRpcClient.rpc.emit('add', [1, 2], function(err, result) {
        expect(err).to.be.an(Error);
        done();
      });

      clock.tick(30 * 1000);
    });
  });

  describe('with non-default options', function() {
    var jsonRpcClient = null;

    beforeEach(function() {
      jsonRpcClient = jsonRpcClientStream({
        nextId: function() { return 100; },
        timeout: 60 * 1000
      });
      duplex.pipe(jsonRpcClient).pipe(duplex);
    });

    afterEach(function() {
      jsonRpcClient = null;
    });

    it('should alter timeout', function(done) {
      duplex._write = function(chunk, encoding, callback) {};

      jsonRpcClient.rpc.emit('add', [1, 2], function(err, result) {
        expect(err).to.be.an(Error);
        done();
      });

      clock.tick(60 * 1000);
    });

    it('should alter id generation', function(done) {
      duplex._write = function(chunk, encoding, callback) {
        expect(JSON.parse(chunk)).to.eql({
          jsonrpc: '2.0',
          method: 'foobar',
          id: 100
        });

        done();
      };

      jsonRpcClient.rpc.emit('foobar', function(err, result) {});
    });
  });
});