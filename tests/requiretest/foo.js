
print("including requrie from foo")
Script.include('../../libraries/require.js')

print("done including requre")
define('FooService', ['Foo1', 'Foo2', 'Foo3'], function (Foo1, Foo2, Foo3) {
	print("Creating FooService")
	function Foo () {
		this.foo1 = new Foo1();
		this.foo2 = new Foo2();
		this.foo3 = new Foo3();
	}
	Foo.prototype.toString = function() { return "[object Foo]"};
	Foo.prototype.doFoo = Foo3.prototype.doFoo;
	Foo.prototype.applyFoos = function () {
		this.foo1.applyInternalFoos();
	}
	print("Created FooService");
	return Foo;
});

define('Foo1', ['Foo2', 'Foo3'], function(Foo2, Foo3) {
	print("Creating Foo1");
	function Foo1 () {
		this.otherFoos = [
			new Foo2(),
			new Foo3(),
			new Foo2(),
			new Foo2()
		];
	}
	Foo1.prototype.applyInternalFoos = function () {
		this.otherFoos.forEach(function(foo) {
			if (foo.doFoo) {
				foo.doFoo();
			}
		});
	}
	Foo1.prototype.toString = function() { return "[object Foo1]"; };
	print("Finished Foo1");
	return Foo1;
});

define('Foo2', ['Foo3'], function (Foo3) {
	print("Creating Foo2")
	function Foo2() {
		this.subFoo = new Foo3();
	}
	Foo2.prototype.doFoo = function () {
		print("Doing foo2");
	}
	Foo2.prototype.toString = function() { return "[object Foo2]"; };
	print("Created Foo2")
	return Foo2;
});

define('Foo3', [], function(Foo3) {
	print("Creating Foo3")
	function Foo3 () {

	}
	Foo3.prototype.doFoo = function () {
		print("Do foo (" + this + ")");
	}
	Foo3.prototype.toString = function() { return "[object Foo3]"; };
	print("Created Foo3")
	return Foo3;
});

print("Should be finished including foo")














