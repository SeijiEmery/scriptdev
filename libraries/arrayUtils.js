//
// libraries/arrayUtils.js
//
// Created by Seiji Emery on 9/9/15
// Copyright 2015 High Fidelity, Inc
//
// Distributed under the Apache License, Version 2.0.
// See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//
// Adds methods to the Array class:
//	removeByIndex(i)
//	removeByValue(v)
//	removeIf(pred, optional_destructor)
//
// NEEDS TESTING!!
//

Script.include('inject.js');
if (typeof(inject) !== 'function') {	// fallback
	print("typeof(inject) === " + typeof(inject));
	print("No local 'inject.js' file found -- loading fallback");
	Script.include('https://dl.dropboxusercontent.com/u/4386006/hifi/js/libraries/inject.js');
	if (typeof(inject) !== 'function') {
		throw new Error("Could not load inject.js");
	}
}

// Add methods to Array.prototype.
inject(Array.prototype, function () {
	/// Removes an item by index from the array using a swap to back + pop operation.
	/// Does bounds checks against [0, array.length)
	function removeByIndex (index) {
		var last = this.length - 1;
		if (i >= 0 && i <= last) {
			this[index] = this[last];
			this.pop();
		}
	}
	/// Finds + removes an item by its value. Speed is similar to Array.indexOf().
	function removeByValue (value) {
		this.removeByIndex(this.indexOf(value));
	}
	/// Removes all items where f(item) === true.
	/// @param f: filter function. Should return true if the item is to be removed; false otherwise.
	/// @param destructor: optional -- if provided, this gets called on all items that get deleted from the array.
	function removeIf (f, destructor) {
		// Swap elements to be removed to the back
		var i = 0, j = this.length - 1, deleteCount = 0, tmp;
		while (i !== j) {
			while ((f(this[i]) === false) && (i !== j)) {
				++i;
			}
			while ((f(this[j]) === true) && (i !== j)) {
				--j, ++deleteCount;
			}
			if (i !== j) {
				tmp = this[i];
				this[i] = this[j];
				this[j] = tmp;
			}
		}
		// Delete elements
		if (destructor) {
			while (deleteCount --> 0) {
				destructor.call(this.pop());
			}
		} else {
			while (deleteCount --> 0) {
				this.pop();
			}
		}
	}

	// Export methods. inject has shimming enabled by default, so these will only get used if they're missing from Array.prototype.
	return {
		removeByIndex: removeByIndex,
		removeByValue: removeByValue,
		removeIf: removeIf
	};
});

