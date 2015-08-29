"use strict";
var debug = require('debug')('restify');
var restify = require('restify');
var pg = require('pg');
var gni = require('./api/gni');
/*function respond(req, res, next) {
    res.send('hello ' + req.params.name);
    next();
}*/
var server = restify.createServer();
// server.get('/api/gni/:name', respond);
// server.head('/api/gni/:name', respond);
server.get('/api/gni/:name', function (req, res, next) {
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

