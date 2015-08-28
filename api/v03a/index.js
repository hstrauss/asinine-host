var sys = require('sys');
var debug = require('debug')('http');
var http = require('http');
var router = require('./router');
// Handle your routes here, put static pages in ./public and they will server
router.register('/', function (req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    res.write('Hello World');
    res.close();
});
router.register('/api/', function (req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    res.write('Hello World');
    res.close();
});
// We need a server which relies on our router
var server = http.createServer(function (req, res) {
    handler = router.route(req);
    handler.process(req, res);
});
// Start it up
server.listen(2000);
debug('Server running');

