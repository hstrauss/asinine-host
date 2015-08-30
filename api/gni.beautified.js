"use strict";

// var debug = require('debug')('restify');
// var restify = require('restify');
// var pg = require('pg');
var debug = require("debug")("restify");

var await = require("await");

var pg = require("pg");

var dns = require("dns");

/* --- HELPERS --- */
Array.prototype.contains = function(v) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] === v) return true;
    }
    return false;
};

Array.prototype.unique = function() {
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
        // debug(_string);
        return _string;
    } else {
        res.send(500, "API Error");
    }
}

function is_ipv4_literal(_string) {
    var valid = false;
    if (_string.match(/^[0-9\.]{7,15}$/)) {
        // debug('IPv4 =?= ' + _string + ' (' + _string.length + ')');
        var blocks = _string.split(".");
        // debug(blocks);
        if (blocks.length == 4) {
            valid = true;
            for (var i = 0; i < blocks.length; ++i) {
                if (isNaN(blocks[i]) || !(parseInt(blocks[i], 10) >= 0 && parseInt(blocks[i], 10) < 256)) return false;
            }
        } else {
            // debug('IPv4 =!= ' + _string + ' (' + _string.length + ')');
            return false;
        }
    }
    return valid;
}

function is_ipv6_literal(_string) {
    var valid = false;
    if (_string[0] + _string[_string.length - 1] === "[]") {
        return is_ipv6_literal(_string.substr(1, _string.length - 2));
    }
    if (_string.match(/[0-9a-f:]{2,31}/)) {
        var blocks = _string.split(":");
        if (blocks.length < 8) {
            //debug(_string + ' = ', blocks);
            var missing_blocks = 10 - blocks.length;
            var double_colon_index = _string.indexOf("::");
            if (double_colon_index < 0) {
                return false;
            }
            var expanded_address = _string.substr(0, double_colon_index);
            for (var i = 0; i < missing_blocks; ++i) {
                expanded_address += "0:";
            }
            expanded_address += _string.substr(double_colon_index + 2);
            blocks = expanded_address.split(":");
            //debug(expanded_address + ' = ', blocks);
            if (blocks.length != 8) {
                return false;
            }
        }
        for (var i = 0; i < 8; ++i) {
            if (blocks[i].length == 0 || blocks[i].length > 4) return false;
        }
        valid = true;
    }
    //debug('IPv6 Literal: ' + _string);
    return valid;
}

/* --- LOGIC --- */
function get_host_info(_host, res) {
    var p_address = await("v4_dns", "v6_dns");
    var p_asns = await("v4_asns", "v6_asns");
    var p_networks = await("v4_networks", "v6_networks");
    var p_alldone = await("result_json");
    // 'use strict';
    var r_status = "";
    var r_addressesv4 = [];
    var r_addressesv6 = [];
    var r_asnsv4 = [ {} ];
    var r_asnsv6 = [ {} ];
    var r_networksv4 = [];
    var r_networksv6 = [];
    var results = {};
    var connectionString = process.env.DATABASE_URL || "postgres://hsserver:hsserver@127.0.0.1:5432/hsserver";
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
    // debug(_host);
    if (is_ipv4_literal(_host)) {
        // debug('IPv4 Literal');
        p_asns.keep("v6_asns", []);
        p_networks.keep("v6_networks", []);
        p_address.keep("v6_dns", []);
        r_addressesv4 = _host;
        p_address.keep("v4_dns", [ _host ]);
    } else if (is_ipv6_literal(_host)) {
        // debug('IPv6 Literal');
        p_asns.keep("v4_asns", []);
        p_networks.keep("v4_networks", []);
        p_address.keep("v4_dns", []);
        r_addressesv6 = _host;
        p_address.keep("v6_dns", [ _host ]);
    } else {
        dns.resolve(_host, "A", function(err, data) {
            r_addressesv4 = data;
            if (!err) {
                p_address.keep("v4_dns", data);
            } else {
                p_address.keep("v4_dns", []);
            }
        });
        dns.resolve(_host, "AAAA", function(err, data) {
            r_addressesv6 = data;
            if (!err) {
                p_address.keep("v6_dns", data);
            } else {
                p_address.keep("v6_dns", []);
            }
        });
    }
    var client = new pg.Client(connectionString);
    client.connect();
    p_address.then(function(data) {
        var _row, t_asnsv4 = [], t_asnsv6 = [];
        // var r_asnsv4 = [];
        // var r_asnsv6 = [];
        r_addressesv4 = data.v4_dns;
        r_addressesv6 = data.v6_dns;
        // debug(r_addressesv4);
        // debug(r_addressesv6);
        if (r_addressesv4.length == 0) {
            //debug('No addressesv4');
            p_asns.keep("v4_asns", []);
        } else {}
        for (var i = 0; i < r_addressesv4.length; ++i) {
            var _get_asn_query = "SELECT t2.asn AS asn,t2.description AS description FROM route_asn t1,asn_info t2 WHERE '" + r_addressesv4[i] + "' <<= t1.address and t1.asn=t2.asn LIMIT 1;";
            // debug(_get_asn_query);
            var query = client.query(_get_asn_query);
            query.on("row", function(row) {
                // _row = row
                //debug('v4ASN:');
                debug({
                    n: row["asn"],
                    d: row["description"]
                });
                t_asnsv4.push({
                    n: row["asn"],
                    d: row["description"]
                });
            });
            query.on("end", function(result) {
                // debug('Before asn_v4_query kept, _asns:');
                // debug(_asns);
                if (t_asnsv4 == null) {
                    t_asnsv4 = [];
                }
                p_asns.keep("v4_asns", t_asnsv4);
            });
        }
        if (r_addressesv6.length == 0) {
            //debug('No addressesv6');
            p_asns.keep("v6_asns", []);
        } else {}
        for (var j = 0; j < r_addressesv6.length; ++j) {
            // var _get_asn_query = "SELECT asn FROM route_asn WHERE '" + r_addressesv6[i] + "' <<= address LIMIT 1;";
            var _get_asn_query2 = "SELECT t2.asn AS asn,t2.description AS description FROM route_asn t1,asn_info t2 WHERE '" + r_addressesv6[j] + "' <<= t1.address and t1.asn=t2.asn LIMIT 1;";
            //debug(_get_asn_query2);
            var query2 = client.query(_get_asn_query2);
            query2.on("row", function(row) {
                // _row = row;
                t_asnsv6.push({
                    n: row["asn"],
                    d: row["description"]
                });
            });
            query2.on("end", function(result) {
                // debug('Before asn_v6_query kept, _asns:');
                // debug(_asns);
                if (t_asnsv6 == null) {
                    t_asnsv6 = [];
                }
                p_asns.keep("v6_asns", t_asnsv6);
            });
        }
    }, function(err) {});
    // debug(p_asns._success);
    p_asns.then(function(data) {
        // 'use strict';
        // debug(p_asns._success);
        //debug('r_asnsv4 =?= ', data.v4_asns.unique());
        //debug('r_asnsv6 =?= ', data.v6_asns);
        var t_asnsv4 = data.v4_asns.unique();
        var t_asnsv6 = data.v6_asns.unique();
        var _prefixesv4 = [];
        var _prefixesv6 = [];
        var t_asn_networksv4 = [];
        var t_asn_networksv6 = [];
        var this_asnv4;
        var this_asnv6;
        if (t_asnsv4.length == 0) {
            //debug('Kept v4_networks');
            p_networks.keep("v4_networks", []);
        } else {
            // debug('entering v4 asn->network loop');
            for (var j = 0; j < t_asnsv4.length; ++j) {
                t_asn_networksv4 = [];
                // debug('loop index:' + j);
                this_asnv4 = t_asnsv4[j]["n"];
                // debug('this_asn:' + this_asn);
                var _get_prefixes_query = "SELECT address,asn FROM route_asn WHERE family(address)=4 AND asn = " + this_asnv4 + " ORDER BY asn ASC;";
                //debug(_get_prefixes_query);
                var query2 = client.query(_get_prefixes_query);
                query2.on("row", function(row) {
                    t_asn_networksv4.push(row["address"]);
                });
                query2.on("end", function(results) {
                    // if (_prefixesv4 == null) {
                    // _prefixesv4 = ['::/128'];
                    // }
                    // p_networks.keep('v6_networks', ['::/1']);
                    _prefixesv4.push({
                        asn: this_asnv4,
                        prefixes: t_asn_networksv4
                    });
                    p_networks.keep("v4_networks", _prefixesv4);
                });
            }
        }
        if (t_asnsv6.length == 0) {
            //debug('Kept v6_networks');
            p_networks.keep("v6_networks", []);
        } else {
            //debug('entering v6 asn->network loop');
            for (var j = 0; j < t_asnsv6.length; ++j) {
                t_asn_networksv6 = [];
                this_asnv6 = t_asnsv6[j]["n"];
                var _get_prefixes_query2 = "SELECT address,asn FROM route_asn WHERE family(address)=6 AND asn = " + this_asnv6 + " ORDER BY asn ASC;";
                //debug(_get_prefixes_query2);
                var query2 = client.query(_get_prefixes_query2);
                query2.on("row", function(row) {
                    t_asn_networksv6.push(row["address"]);
                });
                query2.on("end", function(results) {
                    // if (_prefixesv4 == null) {
                    // _prefixesv4 = ['::/128'];
                    // }
                    // p_networks.keep('v6_networks', ['::/1']);
                    _prefixesv6.push({
                        asn: this_asnv6,
                        prefixes: t_asn_networksv6
                    });
                    p_networks.keep("v6_networks", _prefixesv6);
                });
            }
        }
    }, function(err) {});
    p_networks.then(function(data) {
        // 'use strict';
        // debug('yup!');
        r_networksv4 = data.v4_networks;
        r_networksv6 = data.v6_networks;
        if (r_addressesv4.length == 0 && r_addressesv6.length == 0) {
            r_status = "NXDOMAIN";
        } else {
            r_status = "OK";
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
        p_alldone.keep("result_json", temp_results);
    }, function(err) {});
    p_alldone.then(function(data) {
        // results = data.result_json;
        // debug(results);
        res.send(200, data.result_json);
        res.close();
        client.close();
    }, function(err) {});
}

/* --- EXPORTS --- */
function get_net_info(req, res, next) {
    // debug(req.params.name);
    var unsan_host = req.params.name;
    // var result_json = {};
    var host = host_sanitize(unsan_host.toLowerCase(), res);
    // result_json = 
    get_host_info(host, res);
    // debug(result_json);
    // p_alldone.then(function (data) {
    // result_json = data.result_json;
    // debug(data.result_json);
    // await.all();
    // });
    // debug(result_json);
    if (!(next == null || next == "undefined")) {
        next();
    }
}

exports.get_net_info = get_net_info;