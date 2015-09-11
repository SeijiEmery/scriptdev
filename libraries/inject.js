//
// libraries/inject.js
//
// Created by Seiji Emery on 9/9/15
// Copyright 2015 High Fidelity, Inc
//
// Distributed under the Apache License, Version 2.0.
// See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//
// Implements an injection utility to create + add functionality to objects / classes.
//
// Examples:
// example -- extend an existing class:
//  inject(Array.prototype, function () {
//      // Implement the foo method. 
//      function foo(bar, baz) {
//          // Will be attached to the prototype, so we have access to 'this' ofc (an Array instance)
//          ...
//      }
//      
//      // register / export methods
//      return {
//          foo: foo
//      };
//  });
// equivalent:
//  if (typeof(Array.prototype.foo) !== 'function') {
//      Array.prototype.foo = function (bar, baz) {
//          ...
//      };
//  }
//
// example -- create a new class:
//  inject(this, function () {
//      function Foo(x, y, z) {
//          ...
//      }
//      function method1(...) {
//          ... 
//      }
//      function method2(...) {
//          ...
//      }
//      ...
//  
//      // Register methods
//      inject(Foo.prototype, {
//          method1: method1,
//          method2: method2,
//          ...
//      })      
//  
//      // export Foo   
//      return {
//          Foo: Foo
//      };
//  });
// equivalent:  (case 1)
//  function Foo (x, y, z) {
//      ...
//  }
//  Foo.prototype.method1 = function (...) {
//      ...
//  }
//  Foo.prototype.method2 = function (...) {
//      ... 
//  }
//  ...
// or:         (case 2)
//  function Foo(x, y, z) {
//      ... 
//  }
//  Foo.prototype = {
//      method1: function (...) {
//          ...
//      },
//      method2: function (...) {
//          ...
//      },
//      ...
//  }
//
// This is an odd pattern, but there are reasons we're doing this (instead of the simpler approaches):
//  - Methods are defined as 'function ____ () { ... }', not 'var ____ = function () { ... }'
//      This is subtle, but methods defined using the former are much easier to debug than the latter.
//      Stack traces, etc., usually depend on stringification of functions to determine function names
//      (kinda terrible, but this is js), and anonymous functions are quite simply unparseable (anonymous
//      function w/ some args vs named function that directly corresponds to a class / class method).
//  - Code folding 
//      For a large project, it's very helpful to have classes (and class extensions) as one block
//      that can be hidden. For new-class case 1, it cannot be folded at all (unless you wrap it in a
//      self-executing function, though you then have to assign to this.<class-name> to export it), and
//      for case 2, it's broken into two blocks (the constructor and the prototype)).
//  - Class extension (in the same way as you'd create a class)
//      case 1 supports this (with an if-defined guard); case 2 does not
//  - Encapsulation / hidden methods
//      Anything defined within the inject closure cannot be accessed from external scope
//  - Support for AMD / dependency injection
//      Not built-in, but code written in this style can be trivially modified to use it 
//      (just replace 'inject' with 'define' (require.js) and a list of dependencies)
//  - Very flexible
//      Can be used to create new classes, extend existing classes (both shimming and overriding the 
//      default impl), and (more generally) to inject methods and/or properties into aribitraty
//      objects + class instances.
//

(function () {  // hack

/// Injects new properties / methods into an existing object.
/// @param obj: Target object.
/// @param from: Object or function that wraps the properties / methods to be injected.
///     If a function, it should return an object and take no arguments.
/// @param overrideExisting: Overrides existing values if set to true. False by default.
///
function inject (obj, from, overrideExisting) {
    var dontOverride = (typeof(overrideExisting) === 'undefined') || !overrideExisting;

    var properties;
    switch (typeof(from)) {
        case 'function': properties = from.call(null); break;
        case 'object': properties = from; break;
        default: return null;
    }
    Object.keys(properties).forEach(dontOverride ? function (k) {
        if (typeof(obj[k]) !== typeof(properties[k])) {
            obj[k] = properties[k];
        }
    } : function (k) {
        obj[k] = properties[k];
    });
}

this.inject = inject;
})();
