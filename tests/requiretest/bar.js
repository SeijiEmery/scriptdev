
Script.include('../../libraries/require.js');

require.externals({
	modules: ['BazService'],
	urls: ['baz.js']
});

define('BarService', ['BazService'], function(BazService) {
	function Bar () {
		// ...
	}
	Bar.prototype.toString = function () { return "[object Bar]"; }
	Bar.prototype.doStuff = function () {
		print("Bar method (bar.js)")
		BazService.doBazThings.apply(this);
		print("Leaving bar.js");
	}
	return Bar;
});





