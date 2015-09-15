
(function () {
	function getType(x) {
		// Works for all types, unlike typeof()
		return x.__proto__.constructor;
	}
	
	/// Check types of args against provided types (object constructors)
	/// Invokes errCallback(actual, expected) if the check fails.
	/// Rules:
	///    Type := function t | array types
	///	   match :: Type, Value => Bool
	///	   match (function t) value = value.__proto__.constructor === t
	///    match (array types) value =
	///			reduce ((||) . (match _ value)) types true
	///
	function assertTypeEquals(type, value, errCallback) {
		if (typeof(type) === 'function') {
			if (value.__proto__.constructor !== type)
				return errCallback(value.__proto__.constructor, type), false;
			return true;
		} else if (type instanceof Array) {
			for (var i = 0, l = type.length; i < l; ++i) {
				if (value.__proto__.constructor === type[i]) {
					return true;
				}
			}
			return errCallback(value.__proto__.constructor, type), false;
		}
	}
	
	function checkTypeSignature(types, args, errCallback) {
		var _errCallback = errCallback || function () {
			throw new Error("")
		}
	}
	
	Function.prototype.expectArgTypes = function (types) {
		var fcn = this;
		return function () {
			if (arguments.length !== types.length) {
	
			}
		}
	}

	// Export stuff
	this.getType = getType;
	this.assertTypeEquals = assertTypeEquals;
	this.expectArgTypes = expectArgTypes;
	this.checkTypeSignature = checkTypeSignature;
})();








