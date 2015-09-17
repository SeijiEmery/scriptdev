//
// libraries/tryinclude.js
//
// Created by Seiji Emery on 9/9/15
// Copyright 2015 High Fidelity, Inc
//
// Distributed under the Apache License, Version 2.0.
// See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

(function () {
	this.tryInclude = tryInclude;
	this.exists = exists;

	// Tries including multiple files with fallbacks and multi-path support (handy for development when building
	// against code stored remotely and/or locally). Pretty limited; just a developer convenience really.
	// 
	// @param context: object
	// @param context.files: list of files (objects)
	// @param context.files.src: relative path to file (see @param context.paths)
	// @param context.files.check: function () -> boolean
	//		Check check if a file was loaded (after Script.include() was called on src)
	//		Should return true => file loaded, false => file not loaded (will try other options)
	// @param context.paths: list of prefix paths to check (in order)
	//		This could include '/path/to/your/hifi/repo/examples/' for local, <HIFI_PUBLIC_BUCKET>
	//		for release, etc., Requires that last char is '/'; no support for windows-style paths afaik
	// @param callback: Callback called at execution end. Should be function(err) { if (err) { ... } };
	//		err = null if success; multi-line error string otherwise.
	//		Default behavior should be to print the error and throw an exception to halt stop script
	//		execution if the occurs (b/c failing to load a library is generally a non-recoverable error).
	//
	function tryInclude (context, callback) {
        var loaded = {};
        if (!context.paths.length) {
            context.paths = ['']; 
        }
        var failures = [], details = [];
        context.files.forEach(function(file) {
            var loaded = false;
            context.paths.forEach(function(path) {
                if (!loaded) {
                    var absPath = path + file.src;
                    try {
                        Script.include(absPath)
                    } catch (e) {
                        throw new Error("While loading '" + absPath + "': " + e.message);
                    }
                    if (typeof(file.check) === 'function') {
                        if (!file.check()) {
                            details.push("include check failed for " + file.src + " (" + absPath + ")");
                            return;
                        }
                    }
                    loaded = true;
                    // print("Loaded " + file.src);
                }
            }, this);
            if (!loaded) {
                failures.push(file.src);
                if (!context.paths.length) {
                    details.push("No paths specified for " + file.src);
                }
            }
        }, this);
		if (failures.length > 0) {
			print("Failed to load " + failures.length + " file(s): " + failures.join(', '));
            details.forEach(function(detail) {
                print("    " + detail);
            });
            if (typeof(callback) !== 'function') {
            	throw new Error("Failed to load file(s)");
            } else {
            	callback(new Error("Failed to load file(s)"));
            }
		} else {
			callback(null);
		}
    }

    // Utility (to be used w/ try/include).
    // Returns true if x !== undefined, or (if x is an array / list), if no elements in x are undefined (and so on, recursively).
    // Used to quickly implement check(). on tryInclude
    function exists () {
    	if (typeof(x) === Array)
    		return x.reduce(function(x, v) { return x && tryInclude.exists(v); }, true);
    	return typeof(x) !== 'undefined' && x !== null;
    }
})();



