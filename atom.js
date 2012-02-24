/*global module*/
(function () {

	// Establish the root object
	var
		root = this, // 'window' or 'global'
		atom = { VERSION: '0.0.5' },
		previous = root.atom
	;
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = atom;
	}
	root.atom = atom;

	atom.noConflict = function () {
		root.atom = previous;
		return this;
	};

	// Convenience methods
	var slice = Array.prototype.slice;
	function isObject(obj) {
		return typeof obj == 'object';
	}
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

	// Property getter
	function get(nucleus, keyOrList, func, requireAll) {
		var isList = isArray(keyOrList), keys = isList ? keyOrList : [keyOrList],
			key, values = [], props = nucleus.props;
		for (var i = keys.length; --i >= 0;) {
			key = keys[i];
			if (requireAll && !props.hasOwnProperty(key)) {
				return;
			}
			values.unshift(props[key]);
		}
		return func ? func.apply({}, values) : isList ? values : values[0];
	}

	function removeListener(listeners, listener) {
		for (var i = listeners.length; --i >= 0;) {
			if (!listeners[i].calls) {
				return listeners.splice(i, 1);
			}
		}
	}

	// Property setter
	function set(nucleus, key, value) {
		var keys, listener, listeners = nucleus.listeners,
			listenersCopy = [].concat(listeners), requireAll, values,
			props = nucleus.props, oldValue = props[key],
			had = props.hasOwnProperty(key);
		props[key] = value;
		if (!had || oldValue !== value || (value && typeof value == 'object')) {
			for (var i = listenersCopy.length; --i >= 0;) {
				listener = listenersCopy[i];
				keys = listener.keys;
				requireAll = listener.all;
				if (inArray(keys, key)) {
					values = get(nucleus, keys, null, requireAll);
					if (values || !requireAll) {
						listener.cb.apply({}, values);
						listener.calls--;
					}
					if (!listener.calls) {
						removeListener(listeners, listener);
					}
				}
			}
			delete nucleus.needs[key];
		}
	}

	function provide(nucleus, key, provider) {
		provider(function (result) {
			set(nucleus, key, result);
		});
	}

	atom.create = function () {
		var
			nucleus = { props: {}, needs: {}, providers: {}, listeners: [] },
			props = nucleus.props,
			needs = nucleus.needs,
			providers = nucleus.providers,
			listeners = nucleus.listeners,
			q = []
		;
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

			// Call `func` whenever any of the specified keys change.  The values
			// of the keys will be provided as args to func.
			bind: function (keyOrList, func) { // alias: `on`
				listeners.unshift({ keys: toArray(keyOrList), cb: func,
					all: false, calls: Infinity });
			},

			// Add a function or functions to the async queue.  Functions added
			// thusly must call their first arg as a callback when done.  Any args
			// provided to the callback will be passed in to the next function in
			// the queue.
			chain: function () {
				if (q) {
					for (var i = 0, len = arguments.length; i < len; i++) {
						q.push(arguments[i]);
						if (!q.pending) {
							doNext.apply({}, q.args);
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
			// on `otherAtom`.
			entangle: function (otherAtom, keyOrListOrMap) {
				var
					isList = isArray(keyOrListOrMap),
					isMap = !isList && isObject(keyOrListOrMap),
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
				return get(nucleus, keyOrList, func);
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
					{ keys: toArray(keyOrList), cb: func, all: false, calls: 1 });
			},

			// Call `func` as soon as all of the specified keys have been set.  If
			// they are already set, the function will be called immediately, with
			// all the values provided as args.  Guaranteed to be called no more
			// than once.
			once: function (keyOrList, func) {
				var keys = toArray(keyOrList),
					values = get(nucleus, keys, null, true);
				if (values) {
					func.apply({}, values);
				} else {
					listeners.unshift(
						{ keys: keys, cb: func, all: true, calls: 1 });
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
				if (isObject(keyOrMap)) {
					for (var key in keyOrMap) {
						if (keyOrMap.hasOwnProperty(key)) {
							set(nucleus, key, keyOrMap[key]);
						}
					}
				} else {
					set(nucleus, keyOrMap, value);
				}
			},

			// Unregister a listener `func` that was previously registered using
			// `bind()`, `need()`, `next()` or `once()`.
			unbind: function (func) { // alias: `off`
				for (var i = listeners.length; --i >= 0;) {
					if (listeners[i].cb === func) {
						listeners.splice(i, 1);
					}
				}
			}
		};
		me.on = me.bind;
		me.off = me.unbind;
		return me;
	};

}());
