"use strict";
var debug = require('debug')('restify');
var restify = require('restify');
var pg = require('pg');
var gni = require('./api/gni');
/*function respond(req, res, next) {
    res.send('hello ' + req.params.name);
    next();
}*/
// restify.defaultResponseHeaders = false;
restify.defaultResponseHeaders = function (data) {
    this.header('Cache-Control', 'private; max-age=0');
};
var server = restify.createServer();
server.pre(restify.pre.userAgentConnection());
// server.get('/api/gni/:name', respond);
// server.head('/api/gni/:name', respond);
server.get('/api/gni/:name', function (req, res, next) {
    console.log('Connection from: ' + req.url);
    // console.log(req.client.parser.socket);
    req.body = null;
    gni.get_net_info(req, res, null);
});
server.head('/api/gni/:name', function (req, res, next) {
    req.body = null;
    gni.get_net_info(req, res, null);
});
server.listen(2000, '127.0.0.1', function () {
    console.log('%s listening at %s', server.name, server.url);
    console.log('GNI is:', gni);
});

