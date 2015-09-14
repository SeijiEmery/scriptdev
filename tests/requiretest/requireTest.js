// Demo (sort-of) for hifi's require.js


// Include require. After this we can forget about using it for stuff written using require / define.
Script.include('../../libraries/require.js')

// Externals are included using this wonky declaration.
// require.externals() takes a list of objects (varargs), each of which corresponds to a file w/ one or
// more modules.
//	@param modules: list of modules contained within the file
//	@param urls: url(s) / paths to the script files. Multiple urls can be specified (which should all point
// 		to the same library / script) for redundancy in case one or more of the urls is unavailable
//		(use case would be local / relative file paths w/ fallbacks to the hifi server, or vice versa).
//		These are always tried in sequence, and follow the same order that they are written in here.
//	@param isLoaded: [optional] function that should take a (loaded) module and return whether the load
// 		was successful or not -- and it should _basically_ just check for defined symbols in the global
//		scope -- though it can do more complex behavior if so desired.
//	Note: you can set a global default for this load-checker by assigning to require.isLoaded (though doing
//	so can potentially break other scripts that depend on its default behavior)
require.externals({
	modules: ['FooService'],
	urls: ['foo.js']
}, {
	modules: ['BarService', 'BazService'],
	urls: ['bar.js']
});

// We write new modules using the define function. These do not get loaded immediately, but await for
// when / if they are actually used. Note: circular dependencies are illegal and will result in a thrown exception.
// Parameters:
//	function name, dependency list, function callback (w/ args corresponding to the dependency list)
define('MyModule', [], function () {
	// Define stuff...
	function MyModule () {
		this.name = "blarg";
	}
	MyModule.prototype.sayHi = function () {
		print("hi thar, my name is " + this.name);
	}

	// Modules must return an object (though this could be a class, object instance, or static namespace)
	return MyModule;
});

define('MyModule2', ['MyModule'], function(MyModule) () {
	// We can do stuff w/ MyModule here, as well as defining our own things.

	// ...
});

// Require dependencies, and they will be automatically created + injected for us.
// Script execution occurs within an asynchronously called function -- which is kinda wierd -- but hey, it's javascript.
require(['FooService', 'BarService'], function(Foo, Bar) {
	// Use our dependencies, etc
	var foo = new Foo();
	foo.doFoo();
	foo.applyFoos();

	foo.fooinator = new Bar();
	foo.fooinator.doStuff();
});




















