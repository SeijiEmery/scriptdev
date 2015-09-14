


Script.include('https://raw.githubusercontent.com/highfidelity/hifi/master/examples/utilities/tests/perfTest.js');

function packString(s) {
	var a = [], x = "";
	Array.prototype.map.call(s, function(c, i) {
		x += (s.charCodeAt(i)).toString(16);
		if (i % 4 === 3) {
			a.push(x);
		}
	});
	if (x) {
		a.push(x);
	}
	return a;
}




function getNOf(values, n) {
	var xs = [];
	for (var i = 0, l = values.length; i < n; ++i) {
		xs.push(values[i % l]);
	}
	return xs;
}
(function () {
	var tests = new TestRunner();

	function Foo(){};
	function Bar(){};
	function Baz(){};

	var primitiveTypes = [
		'number', 'string', 'object', 'undefined', 'boolean'
	];
	var primitiveValues = [
		29309, 19084091, "flkasjdf", 904, undefined, true, '290', [1, 2, 3], 019, { x: 10, y: 20 },
		false, null, 0921, /asdljfk/
	];
	var constructorTypes = [
		Number, String, Object, Array, RegExp, Foo, Bar, Baz 
	]
	var nonNullPrimitives = [
		29309, 19084091, "flkasjdf", 904, new Bar(), true, '290', [1, 2, 3], 019, { x: 10, y: 20 },
		false, new Foo(), 0921, /asdljfk/
	]
	var TYPE_COUNT = 11;
	var VALUE_COUNT = 29;	// both primes...
	var ITERATIONS = 100;

	tests.addTestCase('typeof(a) === string b')
		.before(function(){
			this.types = getNOf(primitiveTypes, TYPE_COUNT);
			this.values = getNOf(primitiveValues, VALUE_COUNT);
		})
		.run(function(){
			var result = true;
			for (var i = 0; i < ITERATIONS; ++i) {
				result = result && (typeof(this.values[i % VALUE_COUNT]) === this.types[i % TYPE_COUNT]);
			}
		})
	tests.addTestCase('typeof(a) === typeof(b)')
		.before(function(){
			this.t1 = getNOf(primitiveTypes, TYPE_COUNT);
			this.t2 = getNOf(primitiveTypes, VALUE_COUNT);
		})
		.run(function(){
			var result = true;
			for (var i = 0; i < ITERATIONS; ++i) {
				result = result && (typeof(this.t1[i%TYPE_COUNT]) === typeof(this.t2[i%VALUE_COUNT]));
			}
		})

	tests.addTestCase('a.__proto__.constructor === b')
		.before(function(){
			this.types = getNOf(constructorTypes, TYPE_COUNT);
			this.values = getNOf(nonNullPrimitives, VALUE_COUNT);
		})
		.run(function(){
			var result = true;
			for (var i = 0; i < ITERATIONS; ++i) {
				result = result && (this.values[i%VALUE_COUNT].__proto__.constructor === this.types[i%TYPE_COUNT])
			}
		})
	tests.addTestCase('a instanceof b')
		.before(function(){
			this.types = getNOf(constructorTypes, TYPE_COUNT);
			this.values = getNOf(nonNullPrimitives, VALUE_COUNT);
		})
		.run(function(){
			var result = true;
			for (var i = 0; i < ITERATIONS; ++i) {
				result = result && (this.values[i%VALUE_COUNT] instanceof this.types[i%TYPE_COUNT])
			}
		})
	tests.addTestCase('a && a.__proto__.constructor === b')
		.before(function(){
			this.types = getNOf(constructorTypes, TYPE_COUNT);
			this.values = getNOf(nonNullPrimitives, VALUE_COUNT);
		})
		.run(function(){
			var result = true;
			for (var i = 0; i < ITERATIONS; ++i) {
				result = result && (this.values[i%VALUE_COUNT] && this.values[i%VALUE_COUNT].__proto__.constructor === this.types[i%TYPE_COUNT])
			}
		})



	tests.runAllTestsWithIterations([1e3, 1e4, 1e5], 1e4, 10);
})();






