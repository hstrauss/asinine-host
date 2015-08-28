'use strict';
var debug = require('debug')('http')
var http = require('http');
var pg = require('pg');
var dns = require('dns');
var bunyan = require('bunyan');
var PORT = 2000;
var router = require('./routes/router');
var handler = require('./routes/handler');
//
var log = bunyan.createLogger({
    name: 'hstools.api',
    serializers: {
        req: bunyan.stdSerializers.req,
        res: bunyan.stdSerializers.res
    }
});
//
var server = http.createServer(handleRequest);
server.listen(PORT, server_log);
router.register('/', function (req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    res.write('Hello World');
    res.close();
});
//
function handleRequest(req, res) {
    // res.end('It Works!! Path Hit: ' + req.url);
    // debug('Connected from %s', req.url);
    handler = router.route(req);
    handler.process(req, res);
}

function server_log() {
    console.log("Server listening on: http://localhost:%s", PORT);
}

