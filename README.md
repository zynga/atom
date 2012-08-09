OVERVIEW
========

Atom.js is a small, easy to use JavaScript class that provides asynchronous
control flow, event/property listeners, barriers, and more.


FEATURES
========

 - Small: ~10K (~3K minified).
 - No dependencies: works in a browser, or in node.
 - Enables programming patterns that reduce the need for deeply nested
   callbacks and conditionals.


UNIT TESTS
==========

To run from command line using node.js:

	node test.js      // brief
	node test.js -v   // verbose

To run in a browser, open `test.html`.


TUTORIAL
========

This is `a`.

	var a

`a` is an atom.

	var a = atom.create();


### Properties

An atom has properties.  The `.get()` and `.set()` methods may be employed to
read and write values of any type.

	a.set({
		pi: 3.141592653,
		r: 5,
		circ: function () {
			return 2 * a.get('pi') * a.get('r');
		}
	});
	console.log('Circumference: ' + a.get('circ')());

Use `.has()` to query for existence of a property, and `.keys()` to get a list
of all properties that have been set.

	if (a.has('game')) {
		console.log('What "a" brings to the table: ' + a.keys());
	}

The `.each()` method lets you execute a function on a series of properties.

	a.set({ r: 0xBA, g: 0xDA, b: 0x55 });
	a.each(['r', 'g', 'b'], function (key, value) {
		console.log(key + ': ' + value);
	});


### Listeners

Listeners may be attached to atoms in a variety of ways.

To be notified as soon as a property is set, use the `.once()` method.

	a.once('userInfo', function (userInfo) {
		alert('Welcome, ' + userInfo.name + '!');
	});

Many atom methods can work with more than one property at a time.

	a.once(['userInfo', 'appInfo'], function (user, app) {
		alert('Welcome to ' + app.name + ', ' + user.name + '!');
	});

When you just want to know about the next change, even if the property is
already set, use `.next()`.

	a.next('click', function (click) {
		alert('Are you done clicking on ' + click.button + ' yet?');
	});

To watch for any future changes to a property, use the `.on()` (alias `.bind()`)
method.

	function myErrorHandler(error) {
		console.log('There was a grevious calamity of code in ' + a.get('module'));
		console.log(error);
	}
	a.on('error', myErrorHandler);

You can unregister any listener using `.off()` (alias `.unbind()`).

	a.off('error', myErrorHandler);


### Needs and Providers

You can register a provider for a property.

	a.provide('privacyPolicy', function (done) {
		httpRequest(baseUrl + '/privacy.txt', function (content) {
			done(content);
		});
	});

Providers only get invoked if there is a need, and if the property is not
already set.  Use the `.need()` method to declare a need for a particular
property.  If a corresponding provider is registered, it will be invoked.
Otherwise, `.need()` behaves just like `.once()`.

	a.on('clickPrivacy', function () {
		a.need('privacyPolicy', function (text) {
			element.innerText = text;
		});
	});


### Entanglement

Properties of two or more atoms can be entangled, using the `.entangle()`
method.  When an entangled property gets set on one atom, the value will
instantly propagate to the other.

	var b = atom.create();
	a.entangle(b, 'email');
	a.set('email', 'someone@example.com');
	console.log('Entangled email: ' + b.get('email'));

`.entangle()` also works when called with a list of properties.

	a.entangle(b, ['firstname', 'lastname']);

If called with a map of property names, then property 'X' on one atom can be
entangled with property 'Y' on the other atom.

	a.entangle(b, { firstname: 'first', lastname: 'last' });
	a.set('firstname', 'Joe');
	console.log('Welcome, ' + b.get('first'));

Note that entangled properties are not actually synchronized until the first
change *after* entanglement.


### Asynchronous Queueing

String together a series of asynchronous functions using the `.chain()` method.

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


### Cleanup

Release references to all data and callback functions with the `.destroy()`
method.

	a.destroy();
