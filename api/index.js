'use strict';
var http = require('http');
var pg = require('pg');
var dns = require('dns');
var PORT = 2000;
var server = http.createServer(handleRequest);
server.listen(PORT, server_log);

function handleRequest(request, response) {
    response.end('It Works!! Path Hit: ' + request.url);
}

function server_log() {
    console.log("Server listening on: http://localhost:%s", PORT);
}

