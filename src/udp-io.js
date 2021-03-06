'use strict';

const dgram = require('dgram');
const uuid = require('node-uuid');

module.exports = function() {
  const server = dgram.createSocket('udp4');
  const pongCbs = {};
  const pingCbs = {};
  var maxTimeout = 5000;

  server.on('message', function(response, rinfo) {
    const parsedRes = JSON.parse(response.toString('utf8'));

    if (parsedRes.type === 'pong' && !!pongCbs[parsedRes.uuid]) {
      pongCbs[parsedRes.uuid](parsedRes.msg);
      delete pongCbs[parsedRes.uuid];
    }

    if (parsedRes.type === 'ping') {
      if (!Array.isArray(pingCbs[parsedRes.eventType])) {
        return;
      }

      pingCbs[parsedRes.eventType].forEach(function (cb) {
        cb(parsedRes.msg, function (data) {
          const stringMessage = JSON.stringify({
            type: 'pong',
            msg: data,
            uuid: parsedRes.uuid,
          });

          server.send(
            stringMessage,
            rinfo.port,
            rinfo.address
          );
        });
      });
    }
  });

  return {
    bind: function(port, host) {
      server.bind(port, host);
    },

    setMaxTimeout: function(milliseconds) {
      maxTimeout = milliseconds;
    },

    send: function(eventType, msg, port, host) {
      host = host || '127.0.0.1';

      return new Promise(function (resolve, reject) {
        const id = uuid.v4();
        pongCbs[id] = resolve;

        const stringMessage = JSON.stringify({
          eventType: eventType,
          msg: msg,
          uuid: id,
          type: 'ping'
        });

        server.send(
          stringMessage,
          port,
          host,
          function(err) {
            if (err) {
              reject(err);
            }
          }
        );

        setTimeout(function () {
          delete pongCbs[id];
        }, maxTimeout);
      });
    },

    on: function(eventType, cb) {
      Array.isArray(pingCbs[eventType]) ?
      pingCbs[eventType].push(cb) :
      pingCbs[eventType] = [cb];
    }
  };
};
