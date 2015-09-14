
Script.include('../../libraries/require.js');

define('BazService', [], function() {
	function doBazThings () {
		print("Baz method (baz.js)")
	}
	function doBarThings () {
		print("Bar method (baz.js)")
	}
	function doFooThings () {
		print("Foo method (foo.js)")
	}
	return {
		doBarThings: doBarThings,
		doBazThings: doBazThings,
		doFooThings: doFooThings
	};
});



