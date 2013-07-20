//
// atom.js
// https://github.com/zynga/atom
// Author: Chris Campbell (@quaelin)
// License: BSD
//
(function (undef) {
	'use strict';

	var
		atom,
		name = 'atom',
		VERSION = '0.5.6',

		ObjProto = Object.prototype,
		hasOwn = ObjProto.hasOwnProperty,

		typeObj = 'object',
		typeUndef = 'undefined',

		root = typeof window !== typeUndef ? window : global,
		had = hasOwn.call(root, name),
		prev = root[name]
	;


	// Convenience methods
	var slice = Array.prototype.slice;
	var isArray = Array.isArray || function (obj) {
		return ObjProto.toString.call(obj) === '[object Array]';
	};
	function inArray(arr, value) {
		for (var i = arr.length; --i >= 0;) {
			if (arr[i] === value) {
				return true;
			}
		}
	}
	function toArray(obj) {
		return isArray(obj) ? obj : [obj];
	}
	function isEmpty(obj) {
		for (var p in obj) {
			if (hasOwn.call(obj, p)) {
				return false;
			}
		}
		return true;
	}


	// Property getter
	function get(nucleus, keyOrList, func) {
		var isList = isArray(keyOrList), keys = isList ? keyOrList : [keyOrList],
			key, values = [], props = nucleus.props, missing = {},
			result = { values: values };
		for (var i = keys.length; --i >= 0;) {
			key = keys[i];
			if (!hasOwn.call(props, key)) {
				result.missing = missing;
				missing[key] = true;
			}
			values.unshift(props[key]);
		}
		return func ? func.apply({}, values) : result;
	}


	// Helper to remove an exausted listener from the listeners array
	function removeListener(listeners) {
		for (var i = listeners.length; --i >= 0;) {
			// There should only be ONE exhausted listener.
			if (!listeners[i].calls) {
				return listeners.splice(i, 1);
			}
		}
	}


	// Used to detect listener recursion; a given object may only appear once.
	var objStack = [];

	// Property setter
	function set(nucleus, key, value) {
		var keys, listener, listeners = nucleus.listeners, missing,
			listenersCopy = [].concat(listeners), i = listenersCopy.length,
			props = nucleus.props, oldValue = props[key],
			had = hasOwn.call(props, key),
			isObj = value && typeof value === typeObj;
		props[key] = value;
		if (!had || oldValue !== value || (isObj && !inArray(objStack, value))) {
			if (isObj) {
				objStack.push(value);
			}
			while (--i >= 0) {
				listener = listenersCopy[i];
				keys = listener.keys;
				missing = listener.missing;
				if (missing) {
					if (hasOwn.call(missing, key)) {
						delete missing[key];
						if (isEmpty(missing)) {
							listener.cb.apply({}, get(nucleus, keys).values);
							listener.calls--;
						}
					}
				} else if (inArray(keys, key)) {
					listener.cb.apply({}, get(nucleus, keys).values);
					listener.calls--;
				}
				if (!listener.calls) {
					removeListener(listeners);
				}
			}
			delete nucleus.needs[key];
			if (isObj) {
				objStack.pop();
			}
		}
	}


	// Wrapper to prevent a callback from getting invoked more than once.
	function preventMultiCall(callback) {
		var ran;
		return function () {
			if (!ran) {
				ran = 1;
				callback.apply(this, arguments);
			}
		};
	}


	// Helper function for setting up providers.
	function provide(nucleus, key, provider) {
		provider(preventMultiCall(function (result) {
			set(nucleus, key, result);
		}));
	}


	// Determine whether two keys (or sets of keys) are equivalent.
	function keysMatch(keyOrListA, keyOrListB) {
		var a, b;
		if (keyOrListA === keyOrListB) {
			return true;
		}
		a = [].concat(toArray(keyOrListA)).sort();
		b = [].concat(toArray(keyOrListB)).sort();
		return a + '' === b + '';
	}


	// Return an instance.
	atom = root[name] = function () {
		var
			args = slice.call(arguments, 0),
			nucleus = {},
			props = nucleus.props = {},
			needs = nucleus.needs = {},
			providers = nucleus.providers = {},
			listeners = nucleus.listeners = [],
			q = []
		;

		// Execute the next function in the async queue.
		function doNext() {
			if (q) {
				q.pending = q.next = (!q.next && q.length) ?
					q.shift() : q.next;
				q.args = slice.call(arguments, 0);
				if (q.pending) {
					q.next = 0;
					q.pending.apply({}, [preventMultiCall(doNext)].concat(q.args));
				}
			}
		}

		var me = {

			// Add a function or functions to the async queue.  Functions added
			// thusly must call their first arg as a callback when done.  Any args
			// provided to the callback will be passed in to the next function in
			// the queue.
			chain: function () {
				if (q) {
					for (var i = 0, len = arguments.length; i < len; i++) {
						q.push(arguments[i]);
						if (!q.pending) {
							doNext.apply({}, q.args || []);
						}
					}
				}
				return me;
			},

			// Remove references to all properties and listeners.  This releases
			// memory, and effective stops the atom from working.
			destroy: function () {
				delete nucleus.props;
				delete nucleus.needs;
				delete nucleus.providers;
				delete nucleus.listeners;
				while (q.length) {
					q.pop();
				}
				nucleus = props = needs = providers = listeners =
					q = q.pending = q.next = q.args = 0;
			},

			// Call `func` on each of the specified keys.  The key is provided as
			// the first arg, and the value as the second.
			each: function (keyOrList, func) {
				var keys = toArray(keyOrList), i = -1, len = keys.length, key;
				while (++i < len) {
					key = keys[i];
					func(key, me.get(key));
				}
				return me;
			},

			// Establish two-way binding between a key or list of keys for two
			// different atoms, so that changing a property on either atom will
			// propagate to the other.  If a map is provided for `keyOrListOrMap`,
			// properties on this atom may be bound to differently named properties
			// on `otherAtom`.  Note that entangled properties will not actually be
			// synchronized until the first change *after* entanglement.
			entangle: function (otherAtom, keyOrListOrMap) {
				var
					isList = isArray(keyOrListOrMap),
					isMap = !isList && typeof keyOrListOrMap === typeObj,
					i, key,
					keys = isList ? keyOrListOrMap : isMap ? [] : [keyOrListOrMap],
					map = isMap ? keyOrListOrMap : {}
				;
				if (isMap) {
					for (key in map) {
						if (hasOwn.call(map, key)) {
							keys.push(key);
						}
					}
				} else {
					for (i = keys.length; --i >= 0;) {
						key = keys[i];
						map[key] = key;
					}
				}
				me.each(keys, function (key) {
					var otherKey = map[key];
					me.on(key, function (value) {
						otherAtom.set(otherKey, value);
					});
					otherAtom.on(otherKey, function (value) {
						me.set(key, value);
					});
				});
				return me;
			},

			// Get current values for the specified keys.  If `func` is provided,
			// it will be called with the values as args.
			get: function (keyOrList, func) {
				var result = get(nucleus, keyOrList, func);
				return func ? result : typeof keyOrList === 'string' ?
					result.values[0] : result.values;
			},

			// Returns true iff all of the specified keys exist (regardless of
			// value).
			has: function (keyOrList) {
				var keys = toArray(keyOrList);
				for (var i = keys.length; --i >= 0;) {
					if (!hasOwn.call(props, keys[i])) {
						return false;
					}
				}
				return true;
			},

			// Return a list of all keys.
			keys: function () {
				var keys = [];
				for (var key in props) {
					if (hasOwn.call(props, key)) {
						keys.push(key);
					}
				}
				return keys;
			},

			// Add arbitrary properties to this atom's interface.
			mixin: function (obj) {
				for (var p in obj) {
					if (hasOwn.call(obj, p)) {
						me[p] = obj[p];
					}
				}
				return me;
			},

			// Call `func` as soon as all of the specified keys have been set.  If
			// they are already set, the function will be called immediately, with
			// all the values provided as args.  In this, it is identical to
			// `once()`.  However, calling `need()` will additionally invoke
			// providers when possible, in order to try and create the required
			// values.
			need: function (keyOrList, func) {
				var key, keys = toArray(keyOrList), provider;
				for (var i = keys.length; --i >= 0;) {
					key = keys[i];
					provider = providers[key];
					if (!hasOwn.call(props, key) && provider) {
						provide(nucleus, key, provider);
						delete providers[key];
					} else {
						needs[key] = true;
					}
				}
				if (func) {
					me.once(keys, func);
				}
				return me;
			},

			// Call `func` whenever any of the specified keys is next changed.  The
			// values of all keys will be provided as args to the function.  The
			// function will automatically be unbound after being called the first
			// time, so it is guaranteed to be called no more than once.
			next: function (keyOrList, func) {
				listeners.unshift(
					{ keys: toArray(keyOrList), cb: func, calls: 1 });
				return me;
			},

			// Unregister a listener `func` that was previously registered using
			// `on()`, `bind()`, `need()`, `next()` or `once()`.  `keyOrList` is
			// optional; if provided, it will selectively remove the listener only
			// for the specified combination of properties.
			off: function (keyOrList, func) { // alias: `unbind`
				var i = listeners.length, listener;
				if (arguments.length === 1) {
					func = keyOrList;
					keyOrList = 0;
				}
				while (--i >= 0) {
					listener = listeners[i];
					if (listener.cb === func &&
						(!keyOrList || keysMatch(listener.keys, keyOrList)))
					{
						listeners.splice(i, 1);
					}
				}
				return me;
			},

			// Call `func` whenever any of the specified keys change.  The values
			// of the keys will be provided as args to func.
			on: function (keyOrList, func) { // alias: `bind`
				listeners.unshift({ keys: toArray(keyOrList), cb: func,
					calls: Infinity });
				return me;
			},

			// Call `func` as soon as all of the specified keys have been set.  If
			// they are already set, the function will be called immediately, with
			// all the values provided as args.  Guaranteed to be called no more
			// than once.
			once: function (keyOrList, func) {
				var keys = toArray(keyOrList),
					results = get(nucleus, keys),
					values = results.values,
					missing = results.missing;
				if (!missing) {
					func.apply({}, values);
				} else {
					listeners.unshift(
						{ keys: keys, cb: func, missing: missing, calls: 1 });
				}
				return me;
			},

			// Register a provider for a particular key.  The provider `func` is a
			// function that will be called if there is a need to create the key.
			// It must call its first arg as a callback, with the value.  Provider
			// functions will be called at most once.
			provide: function (key, func) {
				if (needs[key]) {
					provide(nucleus, key, func);
				} else if (!providers[key]) {
					providers[key] = func;
				}
				return me;
			},

			// Set value for a key, or if `keyOrMap` is an object then set all the
			// keys' corresponding values.
			set: function (keyOrMap, value) {
				if (typeof keyOrMap === typeObj) {
					for (var key in keyOrMap) {
						if (hasOwn.call(keyOrMap, key)) {
							set(nucleus, key, keyOrMap[key]);
						}
					}
				} else {
					set(nucleus, keyOrMap, value);
				}
				return me;
			}
		};
		me.bind = me.on;
		me.unbind = me.off;

		if (args.length) {
			me.set.apply(me, args);
		}

		return me;
	};

	atom.VERSION = VERSION;

	// For backwards compatibility with < 0.4.0
	atom.create = atom;

	atom.noConflict = function () {
		if (root[name] === atom) {
			root[name] = had ? prev : undef;
			if (!had) {
				try {
					delete root[name];
				} catch (ex) {
				}
			}
		}
		return atom;
	};

	if (typeof module !== typeUndef && module.exports) {
		module.exports = atom;
	}
}());
