(function (module, exports, fn) {
    if (typeof module === 'undefined') {
        module = {
            exports: {}
        };

        window.gitIndexedDB = module;
    }

    if (typeof exports === 'undefined') {
        exports = module.exports;
    }

    fn(
        module,
        exports,
        window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB
    );
})(module, exports,
function (module, exports, indexedDB) {
    var version = 1;
    var hashStoreName = 'hashs';
    var hashIndexKey = 'hash';
    var pathStoreName = 'paths';
    var pathIndexKey = 'path';
    var isHash = /^[a-z0-9]{40}$/;

    var deflate, inflate;
    module.exports = function (platform) {
        deflate = platform.deflate || fake;
        inflate = platform.inflate || fake;
        return db;
    };

    var fake = function fake(input, callback) {
        callback(null, input);
    };

    var db = function db(prefix) {
        var context = {};
        'use strict';

        return {
            init: init.bind(context, prefix),
            get: get.bind(context),
            keys: keys.bind(context),
            set: set.bind(context),
            has: has.bind(context)
        };
    };

    var init = function init(prefix, callback) {
        if (!callback) return init.bind(this, prefix);
        var request = indexedDB.open(prefix, version);
        var context = this;

        request.addEventListener('upgradeneeded', function (e) {
            var db = e.target.result;

            var hashStore = db.createObjectStore(hashStoreName, { keyPath: hashIndexKey });

            var pathStore = db.createObjectStore(pathStoreName, { keyPath: pathIndexKey });
        });
        request.addEventListener('success', function (e) {
            context.db = e.target.result;
            callback();
        });
        request.addEventListener('error', function (e) {
            callback(e);
        });
    };

    var get = function get(key, callback) {
        if (!callback) return get.bind(this, key);
        var context = this;
        if (!callback) {
            return get.bind(this, key);
        }
        if (isHash.test(key)) {
            var transaction = context.db.transaction(hashStoreName);
            var store = transaction.objectStore(hashStoreName);

            var request = store.get(key);

            request.addEventListener('success', function (e) {
                //pretty sure if it goes in as Uint8Array it comes out as such
                callback(null, e.target.result.value);
            });
            request.addEventListener('error', function (e) {
                callbcak(e);
            });
        } else {
            var transaction = context.db.transaction(pathStoreName);
            var store = transaction.objectStore(pathStoreName);

            var request = store.get(key);

            request.addEventListener('success', function (e) {
                callback(null, e.target.result ? e.target.result.ref : undefined);
            });
            request.addEventListener('error', function (e) {
                callbcak(e);
            });
        }
    };

    var keys = function keys(prefix, callback) {
        if (!callback) return keys.bind(this, prefix);
        var context = this;

        var transaction = context.db.transaction(pathStoreName);
        var store = transaction.objectStore(pathStoreName);

        if (prefix) {
            var request = store.get(prefix);

            request.addEventListener('success', function (e) {
                if (e.target.result) {
                    callback(null, e.target.result.keys);
                } else {
                    callback(null, []);
                }
            });
            request.addEventListener('error', function (e) {
                callbcak(e);
            });
        } else {
            var request = store.openCursor();
            var keys = [];
            request.addEventListener('success', function (e) {
                var cursor = e.target.result;

                if (cursor) {
                    keys.push(cursor.value);
                    cursor['continue']();
                }
            });
            request.addEventListener('error', function (e) {
                callbcak(e);
            });
            transaction.addEventListener('success', function (e) {
                callback(null, keys.reduce(function (arr, key) {
                    return arr.concat(key.keys);
                }, []));
            });
        }
    };

    var set = function set(key, value, callback) {
        if (!callback) return set.bind(this, key, value);
        var context = this;
        if (!callback) {
            return set.bind(context, key, value);
        }

        if (isHash.test(key)) {
            return deflate(value, function (err, deflated) {
                var raw = "";
                for (var i = 0, l = deflated.length; i < l; ++i) {
                  raw += String.fromCharCode(deflated[i]);
                }

                var transaction = context.db.transaction(hashStoreName, 'readwrite');
                var store = transaction.objectStore(hashStoreName);

                var record = {
                    value: value,
                    raw: raw
                };

                record[hashIndexKey] = key;

                var request = store.put(record);

                transaction.addEventListener('complete', function (e) {
                    callback();
                });
                transaction.addEventListener('error', function (e) {
                    callbcak(e);
                });
            });
        } else {
            var transaction = context.db.transaction(pathStoreName, 'readwrite');
            var store = transaction.objectStore(pathStoreName);
            var record = {
                ref: value
            };
            record[pathIndexKey] = key;

            var request = store.put(record);

            transaction.addEventListener('complete', function (e) {
                callback();
            });
            transaction.addEventListener('error', function (e) {
                callbcak(e);
            });
        }
    };

    var has = function has(key, callback) {
        if (!callback) return has.bind(this, key);
        var store = pathStoreName;
        var context = this;

        if (isHash.test(key)) {
            store = hashStoreName;
        }

        var transaction = context.db.transaction(store);
        var store = transaction.objectStore(store);

        var request = store.get(key);

        request.addEventListener('success', function (e) {
            callback(null, !!e.target.result);
        });
        request.addEventListener('error', function (e) {
            callbcak(e);
        });
    };
});