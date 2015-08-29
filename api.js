var restify = require('restify');

function respond(req, res, next) {
    res.send('hello ' + req.params.name);
    next();
}
var server = restify.createServer();
server.get('/api/:name', respond);
server.head('/api/:name', respond);
server.listen(2000, function () {
    console.log('%s listening at %s', server.name, server.url);
});

