"use strict";
// var debug = require('debug')('restify');
// var restify = require('restify');
// var pg = require('pg');
var debug = require('debug')('restify');
var await = require('await');
var pg = require('pg');
var dns = require('dns');
var p_address = await ('v4_dns', 'v6_dns');
var p_asns = await ('v4_asns', 'v6_asns');
var p_networks = await ('v4_networks', 'v6_networks');
var p_alldone = await ('result_json');
/* --- HELPERS --- */
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
    if (_string.match(/[0-9.]{7,15}/)) {
        var blocks = _string.split('.');
        if (blocks.length == 4) {
            valid = true;
            for (var i = 0; i < 4; ++i) {
                if (!isNaN(blocks[i]) || ((parseInt(blocks[i], 10) >= 0) && (parseInt(blocks[i], 10) < 256)))
                    return false;
            }
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
            debug(_string + ' = ', blocks);
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
            debug(expanded_address + ' = ', blocks);
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
    debug('IPv6 Literal: ' + _string);
    return valid;
}
/* --- LOGIC --- */
function get_host_info(_host, res) {
    // 'use strict';
    var r_addressesv4 = [];
    var r_addressesv6 = [];
    var r_asnsv4 = [{}];
    var r_asnsv6 = [{}];
    var r_networksv4 = [];
    var r_networksv6 = [];
    var results = {};
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
    var t_addressesv4 = ['0.0.0.0'];
    p_address.keep('v4_dns', t_addressesv4);
    var t_addressesv6 = ['::'];
    p_address.keep('v6_dns', t_addressesv6);
    p_address.then(function (data) {
        r_addressesv4 = data.v4_dns;
        r_addressesv6 = data.v6_dns;
        var t_asnsv4 = [{
            n: 65520,
            d: '(none)'
        }];
        var t_asnsv6 = [{
            n: 65520,
            d: '(none)'
        }];
        p_asns.keep('v4_asns', t_asnsv4);
        p_asns.keep('v6_asns', t_asnsv6);
    }, function (err) {});
    // console.log(p_asns._success);
    p_asns.then(function (data) {
        // 'use strict';
        // console.log(p_asns._success);
        // console.log('r_asnsv4 =?= ', data.v4_asns);
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
        var temp_results = {
            host: _host,
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
        // res.send(200, "data.result_json");
        // return data.result_json;
    }, function (err) {});
    results = {
        host: _host,
        addressesv4: r_addressesv4,
        addressesv6: r_addressesv6,
        asnsv4: r_asnsv4,
        asnsv6: r_asnsv6,
        networksv4: r_networksv4,
        networksv6: r_networksv6
    };
    // console.log(results);
    // return results;
}
/* --- EXPORTS --- */
function get_net_info(req, res, next) {
    debug(req.params.name);
    var unsan_host = req.params.name;
    var result_json = {};
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
    // next();
}
exports.get_net_info = get_net_info;
// res.status = ;

