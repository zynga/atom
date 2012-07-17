/*global global, module*/
(function () {

	// Make a module
	var atom = (function (name) {
		var root = typeof window !== 'undefined' ? window : global,
			had = Object.prototype.hasOwnProperty.call(root, name),
			prev = root[name], me = root[name] = {};
		if (typeof module !== 'undefined' && module.exports) {
			module.exports = me;
		}
		me.noConflict = function () {
			root[name] = had ? prev : undefined;
			if (!had) {
				try {
					delete root[name];
				} catch (ex) {
				}
			}
			return this;
		};
		return me;
	}('atom'));

	atom.VERSION = '0.3.1';


	// Convenience methods
	var slice = Array.prototype.slice;
	var isArray = Array.isArray || function (obj) {
		return Object.prototype.toString.call(obj) === '[object Array]';
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
			if (obj.hasOwnProperty(p)) {
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
			if (!props.hasOwnProperty(key)) {
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
		var keys, listener, listeners = nucleus.listeners, values, missing,
			listenersCopy = [].concat(listeners), i = listenersCopy.length,
			props = nucleus.props, oldValue = props[key],
			had = props.hasOwnProperty(key),
			isObj = value && typeof value === 'object';
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
					if (missing.hasOwnProperty(key)) {
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


	// Helper function for setting up providers.
	function provide(nucleus, key, provider) {
		provider(function (result) {
			set(nucleus, key, result);
		});
	}


	// Return an actual instance.
	atom.create = function () {
		var
			nucleus = { props: {}, needs: {}, providers: {}, listeners: [] },
			props = nucleus.props,
			needs = nucleus.needs,
			providers = nucleus.providers,
			listeners = nucleus.listeners,
			q = []
		;

		// Execute the next function in the async queue.
		function doNext() {
			if (q) {
				q.pending = q.next = (!q.next && q.length) ?
					q.shift() : q.next;
				q.args = slice.call(arguments, 0);
				if (q.pending) {
					q.next = null;
					q.pending.apply({}, [doNext].concat(q.args));
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
					q = q.pending = q.next = q.args = null;
			},

			// Call `func` on each of the specified keys.  The key is provided as
			// the first arg, and the value as the second.
			each: function (keyOrList, func) {
				var keys = toArray(keyOrList), i = -1, len = keys.length, key;
				while (++i < len) {
					key = keys[i];
					func(key, me.get(key));
				}
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
					isMap = !isList && typeof keyOrListOrMap === 'object',
					i, key,
					keys = isList ? keyOrListOrMap : isMap ? [] : [keyOrListOrMap],
					map = isMap ? keyOrListOrMap : {}
				;
				if (isMap) {
					for (key in map) {
						if (map.hasOwnProperty(key)) {
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
					me.bind(key, function (value) {
						otherAtom.set(otherKey, value);
					});
					otherAtom.bind(otherKey, function (value) {
						me.set(key, value);
					});
				});
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
					if (!props.hasOwnProperty(keys[i])) {
						return false;
					}
				}
				return true;
			},

			// Return a list of all keys.
			keys: function () {
				var keys = [];
				for (var key in props) {
					if (props.hasOwnProperty(key)) {
						keys.push(key);
					}
				}
				return keys;
			},

			// Add arbitrary properties to this atom's interface.
			mixin: function (obj) {
				for (var p in obj) {
					if (obj.hasOwnProperty(p)) {
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
				var key, keys = toArray(keyOrList), values, provider;
				for (var i = keys.length; --i >= 0;) {
					key = keys[i];
					provider = providers[key];
					if (!props.hasOwnProperty(key) && provider) {
						provide(nucleus, key, provider);
						delete providers[key];
					} else {
						needs[key] = true;
					}
				}
				me.once(keys, func);
			},

			// Call `func` whenever any of the specified keys is next changed.  The
			// values of all keys will be provided as args to the function.  The
			// function will automatically be unbound after being called the first
			// time, so it is guaranteed to be called no more than once.
			next: function (keyOrList, func) {
				listeners.unshift(
					{ keys: toArray(keyOrList), cb: func, calls: 1 });
			},

			// Unregister a listener `func` that was previously registered using
			// `on()`, `bind()`, `need()`, `next()` or `once()`.
			off: function (func) { // alias: `unbind`
				for (var i = listeners.length; --i >= 0;) {
					if (listeners[i].cb === func) {
						listeners.splice(i, 1);
					}
				}
			},

			// Call `func` whenever any of the specified keys change.  The values
			// of the keys will be provided as args to func.
			on: function (keyOrList, func) { // alias: `bind`
				listeners.unshift({ keys: toArray(keyOrList), cb: func,
					calls: Infinity });
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
			},

			// Set value for a key, or if `keyOrMap` is an object then set all the
			// keys' corresponding values.
			set: function (keyOrMap, value) {
				if (typeof keyOrMap === 'object') {
					for (var key in keyOrMap) {
						if (keyOrMap.hasOwnProperty(key)) {
							set(nucleus, key, keyOrMap[key]);
						}
					}
				} else {
					set(nucleus, keyOrMap, value);
				}
			}
		};
		me.bind = me.on;
		me.unbind = me.off;
		return me;
	};

}());
