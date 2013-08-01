Overview
========

Atom.js is a small, easy to use JavaScript class that provides asynchronous
control flow, event/property listeners, barriers, and more.


Features
========

 - Small: 3.4kB minified, 1.5kB gzipped.
 - No dependencies: works in a browser, or in node.
 - Enables programming patterns that reduce the need for deeply nested
   callbacks and conditionals.


Install
=======

	npm install atom-js


Unit Tests
==========

To run from command line using node.js:

	node test.js      // brief
	node test.js -v   // verbose

To run in a browser, open `test.html`, or go 
[here](http://zynga.github.io/atom/test.html).


Tutorial
========

This is `a`.

```javascript
	var a
```

`a` is an atom.

```javascript
	var a = atom();
```


### Properties

An atom has properties.  The `.get()` and `.set()` methods may be employed to
read and write values of any type.

```javascript
	a.set('key', 'value');
	console.log('Value of key: ' + a.get('key'));

	a.set({
		pi: 3.141592653,
		r: 5,
		circumference: function () {
			return 2 * a.get('pi') * a.get('r');
		}
	});
	console.log('Circumference: ' + a.get('circumference')());
```

Parameters to the constructor will also be set as properties.

```javascript
	a = atom('key', 'value');

	a = atom({ pi: 3.141592653, r: 5 });
```

Use `.has()` to query for existence of a property, and `.keys()` to get a list
of all properties that have been set.

```javascript
	if (a.has('game')) {
		console.log('What "a" brings to the table: ' + a.keys());
	}
```

The `.each()` method lets you execute a function on a series of properties.

```javascript
	a.set({ r: 0xBA, g: 0xDA, b: 0x55 });
	a.each(['r', 'g', 'b'], function (key, value) {
		console.log(key + ': ' + value);
	});
```


### Listeners

Listeners may be attached to atoms in a variety of ways.

To be notified as soon as a property is set, use the `.once()` method.  The
callback will be called immediately if the property is already set.

```javascript
	a.once('userInfo', function (userInfo) {
		alert('Welcome, ' + userInfo.name + '!');
	});
```

Many atom methods can work with more than one property at a time.

```javascript
	a.once(['userInfo', 'appInfo'], function (user, app) {
		alert('Welcome to ' + app.name + ', ' + user.name + '!');
	});
```

When you just want to know about the next change, even if the property is
already set, use `.next()`.

```javascript
	a.next('click', function (click) {
		alert('Are you done clicking on ' + click.button + ' yet?');
	});
```

To watch for any future changes to a property, use the `.on()` (alias `.bind()`)
method.

```javascript
	function myErrorHandler(error) {
		console.log('There was a grevious calamity of code in ' + a.get('module'));
		console.log(error);
	}
	a.on('error', myErrorHandler);
```

Note that setting a property with a primitive (string/number/boolean) value will
only trigger listeners if the value is *different*.  On the other hand, setting
an array or object value will *always* trigger listeners.

You can unregister any listener using `.off()` (alias `.unbind()`).

```javascript
	a.off(myErrorHandler);
```

If you only want to remove the listener associated with a particular key or
keys, you can specify those too:

```javascript
	a.off(['a', b'], myErrorHandler);
```


### Needs and Providers

You can register a provider for a property.

```javascript
	a.provide('privacyPolicy', function (done) {
		httpRequest(baseUrl + '/privacy.txt', function (content) {
			done(content);
		});
	});
```

Providers only get invoked if there is a need, and if the property is not
already set.  Use the `.need()` method to declare a need for a particular
property.  If a corresponding provider is registered, it will be invoked.
Otherwise, `.need()` behaves just like `.once()`.

```javascript
	a.on('clickPrivacy', function () {
		a.need('privacyPolicy', function (text) {
			element.innerText = text;
		});
	});
```


### Entanglement

Properties of two or more atoms can be entangled, using the `.entangle()`
method.  When an entangled property gets set on one atom, the value will
instantly propagate to the other.

```javascript
	var b = atom();
	a.entangle(b, 'email');
	a.set('email', 'someone@example.com');
	console.log('Entangled email: ' + b.get('email'));
```

`.entangle()` also works when called with a list of properties.

```javascript
	a.entangle(b, ['firstname', 'lastname']);
```

If called with a map of property names, then property 'X' on one atom can be
entangled with property 'Y' on the other atom.

```javascript
	a.entangle(b, { firstname: 'first', lastname: 'last' });
	a.set('firstname', 'Joe');
	console.log('Welcome, ' + b.get('first'));
```

Note that entangled properties are not actually synchronized until the first
change *after* entanglement.


### Asynchronous Queueing

String together a series of asynchronous functions using the `.chain()` method.

```javascript
	a.chain(
		function (nextLink) {
			callAjaxMethod('callThisFirst', function (firstResult) {
				nextLink(firstResult);
			});
		},
		function (nextLink, firstResult) {
			callAjaxMethod('callThisSecond', function (secondResult) {
				nextLink(secondResult);
			});
		}
	);
```


### Method Chaining

Not to be confused with the `.chain()` method specifically, "method chaining"
actually refers to the practice of stringing together multiple method calls in
a single expression.

```javascript
	a = atom('start', new Date())
		.once('loaded', function () {
			console.log('Finished loading.');
		})
		.once('shutdown', function () {
			console.log('Shutting down.');
		})
		.set('loaded', true);
```

The `.chain()`, `.each()`, `.entangle()`, `.mixin()`, `.need()`, `.next()`,
`.off()`, `.on()`, `.once()`, `.provide()` and `.set()` methods are all
chainable.


### Cleanup

Release references to all data and callback functions with the `.destroy()`
method.

```javascript
	a.destroy();
```


Additional Resources
====================

 - [Blog post: Barriers with Atom](http://christophercampbell.wordpress.com/2013/01/01/barriers-with-atom/)
 - [Blog post: Serial and Parallel Tasks with Atom](http://christophercampbell.wordpress.com/2013/01/01/serial-and-parallel-tasks-with-atom/)
 - [Blog post: Providers with Atom](http://christophercampbell.wordpress.com/2013/01/01/providers-with-atom/)
