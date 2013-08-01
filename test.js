/*global atom:true, logger:true, process, require*/
atom = typeof atom === 'undefined' ? require('./atom') : atom;
logger = (typeof logger !== 'undefined' && logger) || console.log;

logger('atom ' + atom.VERSION);

var
	inBrowser = typeof document !== 'undefined',
	inNode = !inBrowser,
	argv = inNode && process.argv,
	arg2 = argv && argv.length > 2 && argv[2],
	verbose = inBrowser || arg2 === '-v',
	a = atom(),
	results = [],
	totals = { success: 0, fail: 0, total: 0 }
;

function assert(msg, success) {
	totals.total++;
	if (success) {
		totals.success++;
		if (verbose) {
			logger(msg + '... success.');
		}
	} else {
		totals.fail++;
		logger(msg + '... FAIL!');
	}
}

assert('constructor args treated as set(), single property',
	atom('a', 'b').get('a') === 'b');

assert('constructor args treated as set(), multiple properties',
	atom({ a: 'b', c: 'd' }).get(['a', 'c']) + '' === 'b,d');

a.set('a', 'A');
assert('get() returns a single value', a.get('a') === 'A');

a.set('b', 'B');
assert('get() returns a list of values', a.get(['a', 'b']) + '' === 'A,B');

a.get('a', function (a) {
	results.push(a);
});
assert('get() calls back with a single value', results + '' === 'A');

results = [];
a.get(['a', 'b'], function (a, b) {
	results = results.concat([a, b]);
});
assert('get() calls back with a list of values', results + '' === 'A,B');

a.set('c', 'C');
assert('set() sets a single value', a.get('c') === 'C');

a.set({ d: 'D', e: 'E' });
assert('set() sets a map of values', a.get('d') === 'D' && a.get('e') === 'E');

assert('has() works', a.has('a') && !a.has('f'));

assert('keys() works', a.keys() + '' === 'a,b,c,d,e');

results = [];
function aListener(a) {
	results.push(a);
}
a.on('a', aListener);
a.set('a', 'A1');
assert('on() works when called with a single key', results + '' === 'A1');

a.on(['b', 'c'], function (b, c) {
	results = results.concat([b, c]);
});
a.set('b', 'B1');
assert('on() works when called with a list', results + '' === 'A1,B1,C');

a.set('a', 'A2');
a.off(aListener);
a.set('a', 'A3');
assert('off() prevents the function from being called again',
	results + '' === 'A1,B1,C,A2');

results = [];
a.on('aa', aListener);
a.once('bb', aListener);
a.once(['cc', 'dd'], aListener);
a.off('aa', aListener);
a.off(['cc', 'dd'], aListener);
a.set({ aa: 'AA', bb: 'BB', cc: 'CC', dd: 'DD' });
assert('off() will be selective about unbinding a listener, if keyOrList provided',
	results + '' === 'BB');

results = [];
a.once('c', function (c) {
	results.push(c);
});
assert('once() works when called with one condition that is already complete',
	results + '' === 'C');

results = [];
a.once(['b', 'a'], function (b, a) {
	results = results.concat([b, a]);
});
assert('once() works when called with two conditions that are already ' +
	'complete', results + '' === 'B1,A3');

results = ['set'];
a.set('done');
a.once('done', function (val) {
	results = results.concat(['once', val]);
});
assert('once() works when the conditions are set with no value provided',
	results + '' === 'set,once,');

results = [];
a.once('f', function (f) {
	results.push('once');
	results.push(f);
});
results.push('set');
a.set('f', 'F');
assert('once() works when called with one condition that is not complete',
	results + '' === 'set,once,F');

results = [];
a.once(['g', 'h'], function (g, h) {
	results = results.concat(['once', g, h]);
});
results.push('set');
a.set({ g: 'G', h: 'H' });
assert('once() works when called with multiple conditions that are ' +
	'not complete', results + '' === 'set,once,G,H');

results = [];
a.once(['h', 'i'], function (h, i) {
	results = results.concat(['once', h, i]);
});
results.push('set');
a.set('i', 'I');
assert('once() works when called with a mix of complete and incomplete ' +
	'conditions', results + '' === 'set,once,H,I');

var aCalls = 0;
a.once('a', function () {
	aCalls++;
});
a.set('a', 'A3');
assert('once() gets called only once, even when conditions are completed ' +
	'multiple times', aCalls === 1);

results = [];
a.next('a', function (a) {
	results.push(a);
});
a.set('a', 'A4');
assert('next() works when called with a single condition',
	results + '' === 'A4');

results = [];
a.next(['b', 'c'], function (b, c) {
	results = results.concat(['next', b, c]);
});
results.push('set');
a.set('c', 'C1');
assert('next() works when called with multiple conditions',
	results + '' === 'set,B1,C1,next,B1,C1');

results = [];
a.next('x', function (y) {
	results.push('x=' + y);
	a.next('x1', function (y1) {
		results.push('x1=' + y1);
	});
});
results.push('setX');
a.set('x', 'y');
results.push('setX1');
a.set('x1', 'y1');
assert('set() takes it in stride when the listener list is synchronously ' +
	'modified by one of the listeners', results + '' === 'setX,x=y,setX1,x1=y1');

results = ['need'];
a.need('d0');
a.provide('d0', function (done) {
	results = results.concat(['provider']);
	done(1);
});
assert('need() can be called with no callback, to invoke the provider',
	results + '' === 'need,provider');

results = ['need'];
a.need('d', function (d) {
	results = results.concat(['satisfy', d]);
});
assert('need() calls back immediately when the (single) need is pre-satisfied',
	results + '' === 'need,satisfy,D');

results = ['need'];
a.need(['e', 'f'], function (e, f) {
	results = results.concat(['satisfy', e, f]);
});
assert('need() calls back immediately when the needs (plural) are pre-satisfied',
	results + '' === 'need,satisfy,E,F');

results = ['need'];
a.need('j', function (j) {
	results = results.concat(['satisfy', j]);
});
results.push('set');
a.set('j', 'J');
a.set('j', 'J1');
assert('need() callback gets triggered after the needed value is set()',
	results + '' === 'need,set,satisfy,J');

results = ['need'];
a.need('k', function (k) {
	results = results.concat(['satisfy', k]);
});
results.push('provide');
a.provide('k', function (done) {
	results.push('fulfill');
	done('K');
});
assert('need() registered before provide() works',
	results + '' === 'need,provide,fulfill,satisfy,K');

results = ['provide'];
a.provide('l', function (done) {
	results.push('fulfill');
	done('L');
});
results.push('need');
a.need('l', function (l) {
	results = results.concat(['satisfy', l]);
});
assert('need() registered after provide() works',
	results + '' === 'provide,need,fulfill,satisfy,L');

a.provide('count', function (done) {
	done(1);
	done(2);
});
a.need('count');
results = a.get('count');
assert("provide() providers can't provide more than once", results === 1);

results = [];
a.chain(function (nextLink) {
	results.push(1);
	nextLink(2);
});
a.chain(function (nextLink, lastArg) {
	results.push(lastArg);
	results.push(3);
	nextLink(4, 5);
});
a.chain(
	function (nextLink, lastArg1, lastArg2) {
		results.push(lastArg1);
		results.push(lastArg2);
		results.push(6);
		nextLink(7);
	},
	function (nextLink, lastArg) {
		results.push(lastArg);
		results.push(8);
		nextLink();
	}
);
assert('chain() works', results + '' === '1,2,3,4,5,6,7,8');

results = [];
a.chain(
	function (nextLink) {
		results.push(1);
		a.once('start-linking', function () {
			nextLink();
			nextLink(); // This should be ineffectual.
		});
	},
	function (nextLink) {
		results.push(2);
	},
	function (nextLink) {
		// We shouldn't get here, since the previous link doesn't finish.
		results.push(3);
	}
);
a.set('start-linking');
assert('chain() links can only get called once', results + '' === '1,2');

results = [];
a.each(['a', 'b', 'd', 'c'], function (name, val) {
	results.push(name + '=' + val);
});
assert('each() works', results + '' === 'a=A4,b=B1,d=D,c=C1');

results = [];
var otherAtom = atom();
a.entangle(otherAtom, 'e');
a.next('e', function (e) {
	results = results.concat(['next', e]);
});
results.push('set');
otherAtom.set('e', 'E1');
assert('entangle() works for a single key', results + '' === 'set,next,E1');

results = [];
a.entangle(otherAtom, ['f', 'g']);
otherAtom.once(['f', 'g'], function (f, g) {
	results = results.concat(['once', f, g]);
});
results.push('set');
a.set({ f: 'F1', g: 'G1' });
assert('entangle() works for a list of keys', results + '' === 'set,once,F1,G1');

results = [];
a.entangle(otherAtom, { m: 'oM', n: 'oN' });
otherAtom.once(['oM', 'oN'], function (oM, oN) {
	results = results.concat(['once', oM, oN]);
});
results.push('set');
a.set({ m: 'M1', n: 'N1' });
assert('entangle() works for maps passed to set()',
	results + '' === 'set,once,M1,N1');

results = [];
a.entangle(otherAtom, 'object');
otherAtom.once('object', function (object) {
	results.push(object.a);
	results.push(object.b);
});
a.set('object', { a: 'A', b: 'B' });
assert('entangle() works for object values', results + '' === 'A,B');

var mc = atom();
assert('method chaining works',
	mc.need('a', function (a) { mc.set('b', 'c'); })
	.next('b', function (b) { mc.set('c', 'd'); })
	.on('c', function (c) { mc.set('d', 'e'); })
	.once('d', function (d) { mc.set('e', 'f'); })
	.provide('a', function (done) { done('b'); })
	.chain(function () {
		mc.set('f', 'g');
	})
	.set('success', mc.get('a,b,c,d,e,f'.split(',')) + '' === 'b,c,d,e,f,g')
	.get('success') === true);


logger(totals);

setTimeout(function () {
	var
		num = 10000,
		i = num,
		arr = [],
		set = a.set,
		start = new Date()
	;
	while (--i >= 0) {
		arr.push('z' + i);
	}
	a.once(arr, function () {
		logger('Time to set ' + num + ' properties: ' +
			(new Date() - start) + 'ms');
	});
	while (++i < num) {
		set('z' + i);
	}
	logger('END');

	if (totals.fail && inNode) {
		process.exit(1);
	}
}, 100);
