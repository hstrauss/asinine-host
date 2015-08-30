"use strict";
// var debug = require('debug')('restify');
// var restify = require('restify');
// var pg = require('pg');
var debug = require('debug')('restify');
var await = require('await');
var pg = require('pg');
var dns = require('dns');
/* --- HELPERS --- */
Array.prototype.contains = function (v) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] === v) return true;
    }
    return false;
};
Array.prototype.unique = function () {
    var arr = [];
    for (var i = 0; i < this.length; i++) {
        if (!arr.contains(this[i])) {
            arr.push(this[i]);
        }
    }
    return arr;
};
//
function host_sanitize(_string, res) {
    // var valid = false;
    var hostname_regex = /[a-z0-9][a-z0-9.-]{0,62}[a-z0-9]/;
    if (_string.match(hostname_regex) || is_ipv4_literal(_string) || is_ipv6_literal(_string)) {
        // console.log(_string);
        return _string;
    } else {
        res.send(500, 'API Error');
    }
}

function is_ipv4_literal(_string) {
    var valid = false;
    if (_string.match(/^[0-9\.]{7,15}$/)) {
        // console.log('IPv4 =?= ' + _string + ' (' + _string.length + ')');
        var blocks = _string.split('.');
        // console.log(blocks);
        if (blocks.length == 4) {
            valid = true;
            for (var i = 0; i < blocks.length; ++i) {
                if ((isNaN(blocks[i])) || !((parseInt(blocks[i], 10) >= 0) && (parseInt(blocks[i], 10) < 256)))
                    return false;
            }
        } else {
            // console.log('IPv4 =!= ' + _string + ' (' + _string.length + ')');
            return false;
        }
    }
    return valid;
}

function is_ipv6_literal(_string) {
    var valid = false;
    if (_string[0] + _string[_string.length - 1] === '[]') {
        return is_ipv6_literal(_string.substr(1, _string.length - 2))
    }
    if (_string.match(/[0-9a-f:]{2,31}/)) {
        var blocks = _string.split(':');
        if (blocks.length < 8) {
            //debug(_string + ' = ', blocks);
            var missing_blocks = (10 - blocks.length);
            var double_colon_index = _string.indexOf('::');
            if (double_colon_index < 0) {
                return false;
            }
            var expanded_address = _string.substr(0, double_colon_index);
            for (var i = 0; i < missing_blocks; ++i) {
                expanded_address += '0:';
            }
            expanded_address += _string.substr(double_colon_index + 2);
            blocks = expanded_address.split(':');
            //debug(expanded_address + ' = ', blocks);
            if (blocks.length != 8) {
                return false;
            }
        }
        for (var i = 0; i < 8; ++i) {
            if ((blocks[i].length == 0) || (blocks[i].length > 4))
                return false;
        }
        valid = true;
    }
    //debug('IPv6 Literal: ' + _string);
    return valid;
}
/* --- LOGIC --- */
function get_host_info(_host, res) {
    var p_address = await ('v4_dns', 'v6_dns');
    var p_asns = await ('v4_asns', 'v6_asns');
    var p_networks = await ('v4_networks', 'v6_networks');
    var p_alldone = await ('result_json');
    // 'use strict';
    var r_status = '';
    var r_addressesv4 = [];
    var r_addressesv6 = [];
    var r_asnsv4 = [{}];
    var r_asnsv6 = [{}];
    var r_networksv4 = [];
    var r_networksv6 = [];
    var results = {};
    var connectionString = process.env.DATABASE_URL || 'postgres://hsserver:hsserver@127.0.0.1:5432/hsserver';
    /*{
        one: 1,
        two: 2
    };
    */
    //
    /*
    r_addressesv4 = ['0.0.0.0'];
    r_addressesv6 = ['::'];
    r_asnsv4 = [{
        n: 65520,
        d: '(none)'
    }];
    r_asnsv6 = [{
        n: 65520,
        d: '(none)'
    }];
    r_networksv4 = ['192.168.0.0/16', '172.16.0.0/12', '10.0.0.0/8', '192.0.2.0/24'];
    r_networksv6 = ['fc00::/8', '2001:db8::/32'];
    */
    // console.log(_host);
    if (is_ipv4_literal(_host)) {
        // console.log('IPv4 Literal');
        p_asns.keep('v6_asns', []);
        p_networks.keep('v6_networks', []);
        p_address.keep('v6_dns', []);
        r_addressesv4 = _host;
        p_address.keep('v4_dns', [_host]);
    } else
    if (is_ipv6_literal(_host)) {
        // console.log('IPv6 Literal');
        p_asns.keep('v4_asns', []);
        p_networks.keep('v4_networks', []);
        p_address.keep('v4_dns', []);
        r_addressesv6 = _host;
        p_address.keep('v6_dns', [_host]);
    } else {
        dns.resolve(_host, 'A', function (err, data) {
            r_addressesv4 = data;
            if (!err) {
                p_address.keep('v4_dns', data);
            } else {
                p_address.keep('v4_dns', []);
            }
        });
        dns.resolve(_host, 'AAAA', function (err, data) {
            r_addressesv6 = data;
            if (!err) {
                p_address.keep('v6_dns', data);
            } else {
                p_address.keep('v6_dns', []);
            }
        });
    }
    var client = new pg.Client(connectionString);
    client.connect();
    p_address.then(function (data) {
            var _row;
            // var r_asnsv4 = [];
            // var r_asnsv6 = [];
            r_addressesv4 = data.v4_dns;
            r_addressesv6 = data.v6_dns;
            // console.log(r_addressesv4);
            // console.log(r_addressesv6);
            if (r_addressesv4.length == 0) {
                console.log('No addressesv4');
                p_asns.keep('v4_asns', []);
            } else {
                console.log(r_addressesv4.length + ' addressesv4');
            }
            for (var i = 0; i < r_addressesv4.length; ++i) {
                var _get_asn_query = "SELECT t2.asn AS asn,t2.description AS description FROM route_asn t1,asn_info t2 WHERE '" + r_addressesv4[i] + "' <<= t1.address and t1.asn=t2.asn LIMIT 1;";
                // console.log(_get_asn_query);
                var query = client.query(_get_asn_query);
                query.on('row', function (row) {
                    // _row = row
                    r_asnsv4.push({
                        n: row['asn'],
                        d: row['description']
                    });
                });
                query.on('end', function (result) {
                    // console.log('Before asn_v4_query kept, _asns:');
                    // console.log(_asns);
                    if (r_asnsv4 == null) {
                        r_asnsv4 = [];
                    }
                    p_asns.keep('v4_asns', r_asnsv4);
                    // console.log('Promise asn_v4_query kept!');
                });
            }
            if (r_addressesv6.length == 0) {
                console.log('No addressesv6');
                p_asns.keep('v6_asns', []);
            } else {
                console.log(r_addressesv6.length + ' addressesv6');
            }
            for (var i = 0; i < r_addressesv6.length; ++i) {
                // var _get_asn_query = "SELECT asn FROM route_asn WHERE '" + r_addressesv6[i] + "' <<= address LIMIT 1;";
                var _get_asn_query2 = "SELECT t2.asn AS asn,t2.description AS description FROM route_asn t1,asn_info t2 WHERE '" + r_addressesv6[i] + "' <<= t1.address and t1.asn=t2.asn LIMIT 1;";
                // console.log(_get_asn_query);
                var query2 = client.query(_get_asn_query2);
                query2.on('row', function (row) {
                    // _row = row;
                    r_asnsv6.push({
                        n: row['asn'],
                        d: row['description']
                    });
                });
                query2.on('end', function (result) {
                    // console.log('Before asn_v6_query kept, _asns:');
                    // console.log(_asns);
                    if (r_asnsv6 == null) {
                        r_asnsv6 = [];
                    }
                    p_asns.keep('v6_asns', r_asnsv6);
                    // console.log('Promise asn_v6_query kept!');
                });
            }
        },
        function (err) {});
    // console.log(p_asns._success);
    p_asns.then(function (data) {
        // 'use strict';
        // console.log(p_asns._success);
        console.log('r_asnsv4 =?= ', data.v4_asns);
        console.log('r_asnsv6 =?= ', data.v6_asns);
        r_asnsv4 = data.v4_asns;
        r_asnsv6 = data.v6_asns;
        var t_networksv4 = ['192.168.0.0/16', '172.16.0.0/12', '10.0.0.0/8', '192.0.2.0/24'];
        p_networks.keep('v4_networks', t_networksv4);
        var t_networksv6 = ['fc00::/8', '2001:db8::/32'];
        p_networks.keep('v6_networks', t_networksv6);
    }, function (err) {});
    p_networks.then(function (data) {
        // 'use strict';
        // console.log('yup!');
        r_networksv4 = data.v4_networks;
        r_networksv6 = data.v6_networks;
        if ((r_addressesv4.length == 0) && (r_addressesv6.length == 0)) {
            r_status = 'NXDOMAIN';
        } else {
            r_status = 'OK';
        }
        var temp_results = {
            host: _host,
            status: r_status,
            addressesv4: r_addressesv4,
            addressesv6: r_addressesv6,
            asnsv4: r_asnsv4,
            asnsv6: r_asnsv6,
            networksv4: r_networksv4,
            networksv6: r_networksv6
        };
        p_alldone.keep('result_json', temp_results);
        // results = temp_results;
    }, function (err) {});
    p_alldone.then(function (data) {
        // results = data.result_json;
        // console.log(results);
        res.send(200, data.result_json);
        res.close();
        client.close();
        // res.send(200, "data.result_json");
        // return data.result_json;
    }, function (err) {});
    /*
    results = {
        host: _host,
        addressesv4: r_addressesv4,
        addressesv6: r_addressesv6,
        asnsv4: r_asnsv4,
        asnsv6: r_asnsv6,
        networksv4: r_networksv4,
        networksv6: r_networksv6
    };
    */
    // console.log(results);
    // return results;
    // var t_addressesv4 = ['0.0.0.0'];
    // p_address.keep('v4_dns', t_addressesv4);
    // var t_addressesv6 = ['::'];
    // p_address.keep('v6_dns', t_addressesv6);
    var t_asnsv4 = [{
        n: 65520,
        d: '(none)'
    }];
    var t_asnsv6 = [{
        n: 65520,
        d: '(none)'
    }];
    // p_asns.keep('v4_asns', t_asnsv4);
    // p_asns.keep('v6_asns', t_asnsv6);
    // var t_networksv4 = ['192.168.0.0/16', '172.16.0.0/12', '10.0.0.0/8', '192.0.2.0/24'];
    // p_networks.keep('v4_networks', t_networksv4);
    // var t_networksv6 = ['fc00::/8', '2001:db8::/32'];
    // p_networks.keep('v6_networks', t_networksv6);
}
/* --- EXPORTS --- */
function get_net_info(req, res, next) {
    // debug(req.params.name);
    var unsan_host = req.params.name;
    // var result_json = {};
    var host = host_sanitize(unsan_host.toLowerCase(), res);
    // result_json = 
    get_host_info(host, res);
    // console.log(result_json);
    // p_alldone.then(function (data) {
    // result_json = data.result_json;
    // console.log(data.result_json);
    // await.all();
    // });
    // console.log(result_json);
    if (!((next == null) || (next == 'undefined'))) {
        next();
    }
    // res.close();
}
exports.get_net_info = get_net_info;
// res.status = ;

