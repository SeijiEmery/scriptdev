//
// require.js
//
// Simple AMD system for highfidelity.
//

(function () {
	function __load__ () {
		var modules = {};
		var loadedModules = {};
		var loadedFiles = {};

		var TYPECHECKING_ENABLED = true;

		// Util -- get type of an object, class, or value in a useful-ish manner
		function getType(thing) {
			return typeof(thing) === 'object' ?
				(thing.prototype && thing.prototype.constructor ?
					thing.prototype.constructor.name || 'anonymous-class' : 'object') :
				typeof(thing);
		}
		var checkTypes = !TYPECHECKING_ENABLED ?
			function () {} :
			function (fcn, args, expectedTypes) {
				if (args.length !== expectedTypes.length) {
					throwTypeError();
				}
				expectedTypes.forEach(function(t, i) {
					switch(typeof(t)) {
						case 'string': if (typeof(args[i]) !== t) throwTypeError(); break;
						default: if (typeof(args[i]) !== 'object' || !(args[i] instanceof t))
							throwTypeError();
					}
				});
				function throwTypeError() {
					var fcnName = typeof(fcn) === 'function' ? fcn.name : fcn;
					throw new TypeError("" + fcn + " expected (" + expectedTypes.join(', ') + "), not (" +
						Array.prototype.map.call(args, getType).join(', ') + ')');
				}
			}

		// Define a module -- exported
		function define(name, deps, defn) {
			if (typeof(name) !== 'string' || !(typeof(deps) === 'object' && deps instanceof Array) || typeof(defn) !== 'function') {
				throw new TypeError("define() expected (string, Array, function), not (" +
					Array.prototype.map.call(arguments, getType).join(', ') + ')');
			}

			print("defining " + name);

			if (!modules[name]) {
				modules[name] = {
					deps: deps,
					defn: defn
				};
			} else {
				print("Overriding define() for '" + name + "'");
			}
		}

		// Run a block of code with a module -- exported
		function require(deps, block) {
			if (typeof(deps) !== 'object' || !(deps instanceof Array) || typeof(block) !== 'function') {
				throw new TypeError("require() expected (Array, function), not (" +
					Array.prototype.map.call(arguments, getType).join(', ') + ')');
			}
			var missingModules = [];
			var args = deps.map(function(dep) {
				if (loadedModules[dep]) {
					return loadedModules[dep];
				} else if (modules[dep]) {
					return tryLoad(dep, missingModules);
				} else {
					print("Missing " + dep);
					missingModules.push(dep);
					return null;
				}
			});
			if (missingModules.length > 0) {
				throw new Error("Missing dependencies for require(): " + missingModules.join(', '));
			} else {
				block.apply(this, args);
			}
		}
		

		// Helper function -- not exported
		function tryLoad(name, missingDependencyList) {
			checkTypes(tryLoad, arguments, ['string', Array]);

			if (loadedModules[name]) {
				return loadedModules[name];
			} else if (modules[name] && !loadedModules[name]) {
				var args = [], lastLoad;
				var loadedAll = true;
				modules[name].deps.forEach(function(dep){
					args.push(lastLoad = tryLoad(dep, missingDependencyList));
					print("Last load (" + name + ") = " + lastLoad);
					loadedAll = (loadedAll && lastLoad);
				});
				if (loadedAll) {
					print("Loading " + name + " args: " + args.join(', '));
					return (loadedModules[name] = modules[name].defn.apply(this, args));
				}
			}
			print("MIssing dependencies! " + name);
			missingDependencyList.push(name);
			return null;
		}
		
		// Default impl -- checks if a unit of code has been loaded yet or not
		require.isLoaded = function (module) {
			return typeof(module) === 'function' || typeof(module) === 'object';
		}

		// Load an external library. Uses Script.include().
		require.externals = function() {
			var externals = Array.prototype.slice.call(arguments);
			externals.modules = externals.modules || (externals.module ? [ externals.module ] : []);
			externals.urls = externals.urls || (externals.url ? [ externals.url ] : []);

			print("Adding externals");
			print(JSON.stringify(externals));
			externals.forEach(load);
		}

		var extModules = modules;
		function load(externals) {
			var fileAlreadyIncluded = externals.urls.reduce(function(x, url) {
				return x || !!loadedFiles[url];
			}, false);
			var missingModules = externals.modules.filter(function(name) {
				return !modules[name];
			});
			print("externals.modules = " + externals.modules.join(', '));
			print("missingModules = " + missingModules.join(', '));

			if (!fileAlreadyIncluded) {
				if (missingModules.length > 0) {
					includeUntilLoaded.call(this, externals.urls, externals.isLoaded || require.isLoaded, missingModules);
				} else {
					print("No modules to include (" + externals.urls.join(', ') + ")");
				}
			} else if (missingModules.length > 0) {
				print("WARNING (require.js): Already loaded file(s) (" + externals.urls.filter(function(url) { return !!loadedFiles[url]; }).join(', ') +
						"), but missing modules " + missingModules.join(', '));
			}

			function includeUntilLoaded(urls, checkLoaded, modules) {
				// Limit to modules we haven't included already
				function filterModules() {
					var oldModules = modules;
					modules = modules.filter(function(name) {
						return !extModules[name];
					})
					print("Old modules = " + oldModules.join(', '));
					print("new modules = " + modules.join(', '));
				}
				filterModules();
				var loadSatisified = function () {
					return modules.reduce(function(x, name) {
						return x && checkLoaded(this[name]);
					}, true);
				}
				// Try Script.include() on all urls until we find one that works
				var lastUrl = "No Files!";
				for (var i = 0, l = urls.length; i < l; ++i) {
					print("Try loading url: " + urls[i]);
					print("modules: " + Object.keys(extModules).join(', '));
					Script.include(urls[i]);
					print("modules: " + Object.keys(extModules).join(', '));

					if (filterModules(), modules.length === 0) {
						print("success!");
						return true;
					}
					print("Failed");
					lastUrl = urls[i];
				}
				var missingModules = modules.filter(function(name) {
					return !checkLoaded(this[name]);
				});
				if (missingModules.length > 0) {
					throw new Error("require.addExternals: tried to load '" + lastUrl + "'; missing modules: " + missingModules.join(', '));
				}
			}
		}
		this.require = require;
		this.define = define;
	}
	var that = {};
	if (typeof(this.require) === 'function') {
		print("require() already included (...?)")
		print("this.require = " + this.require);

		__load__.call(that);
		if (this.require && ("" + that.require) !== ("" + that.require)) {
			print("require already defined as " + that.require);
			print("replacing with " + this.require);
			this.require = that.require;
			this.define = that.define;
		}
	} else {
		print("Including require()");
		__load__.call(this);

	}
})();

