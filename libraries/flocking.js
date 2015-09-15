//
// libraries/flocking.js
//
// Created by Seiji Emery on 9/9/15
// Copyright 2015 High Fidelity, Inc
//
// Distributed under the Apache License, Version 2.0.
// See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//
// Implements generic flocking behavior via the Flock class.
//

// Load libraries
(function () {
    include({
        files: [
            { src: 'three/Three.js',            check: function () { return exists(THREE) }},
            { src: 'three/math/src/Vector3.js', check: function () { return exists(THREE.Vector3) }},
            { src: 'require.js',                check: function () { return exists(require, define) }},
            { src: 'inject.js',                 check: function () { return exists(inject) }},
            { src: 'typecheck.js',              check: function () { return exists(getType) }},
            { src: 'arrayUtils.js' }
        ],
        paths: ['', 'https://dl.dropboxusercontent.com/u/4386006/hifi/js/libraries/']
    })
    function exists(value) {
        if (value instanceof Array) {
            return value.reduce(function(x, v) { return x && exists(v); }, true);
        }
        return typeof(value) !== 'undefined';
    }
    function include(context) {
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
            throw new Error("Could not load flocking.js libraries");
        }
    }
})();

// Add console.log (if not defined)
if (typeof(console) === 'undefined') {
    console = {
        log: function () {
            print(Array.prototype.join.call(arguments, " "));
        }
    }
}

// Uses three.js for vector calculations. This is ~50x faster (benchmarked), and does not waste as much memory as the wrapped 
// glm equivalents (which create new objects every call). Note: the two use different calling semantics and are not compatible.
// If you make calls w/ hifi's Vec3 and/or try to replace the calls in this library with them, it will break and cause subtle bugs.
if (typeof(THREE) === 'undefined') {
    throw new Error("flocking.js -- could not load the three.js math library");
} else {
    // Alias, b/c writing new THREE.Vector3() is annoying. We also do not have access to the rest of THREE, so aliasing the math types makes sense.
    Vector3 = THREE.Vector3;

    // THREE.Vector3 objects wijll work with the hifi Vec3 api, but the reverse is not true. 
    // Use toVector3 to convert an object w/ x/y/z values to a THREE.Vector3 type.
    toVector3 = function(vec3Obj) { return Vector3.prototype.clone.apply(vec3Obj); }
}

// Flocking class
(function() {
    print("included flocking.js (setup)");

    var SIMULATE_PHYSICS_ON_SCRIPT = true; // enabled => script does physics calculations + sets entity positions; 
                                           // disabled => forces calculated by physics engine; script just sets velocity and queries current position + velocity each frame
    var DEFAULT_MAX_SPEED = 1.0;  // speed clamped to +/- MAX_SPEED. Can be set on each Flock instance.

    function getEntityMass(entity) {
        switch (entity.type) {
            case "Box": return entity.dimensions.x * entity.dimensions.y * entity.dimensions.z * entity.density;
            default: return entity.dimensions.x * entity.dimensions.y * entity.dimensions.z * entity.density;   // apparently this is what the physics engine does atm :/
            // default: return 0.0001 * entity.density; // really shitty, but this is equivalent to a 0.1 x 0.1 x 0.1 cube...
        }
    }
    // Entity class (just for flocking -- not exported)
    define('FlockingEntity', [], function() {
        print("Included 'FlockingEntity'")

        function FlockingEntity (entityId, hasOwnership) {
            // Only includes flocking-specific properties
            var properties = Entities.getEntityProperties(entityId);
            this.entityId = entityId;
            this.position = toVector3(properties.position);
            this.velocity = toVector3(properties.velocity);
            this.mass = getEntityMass(properties);
            this.__hasOwnership = !!hasOwnership;
        }
        // Has _some_ methods for convenience, etc., 
        // (Note: all of these are available to the user of flocking.js -- as such this does NOT include methods
        //  for getting / setting properties, etc -- or, well, destructors :/)
        inject(FlockingEntity.prototype, {
            applyForce: applyForce,
            toString: toString
        });
        function toString () {
            return "[Entity " + this.entityId + "]";
        }
        function applyForce(entity, force) {
            if (force) {
                entity.velocity.add(force.multiplyScalar(1 / entity.mass));
            }
        }
        return FlockingEntity;
    });

    // Flocking class
    define('Flock', ['FlockingRule', 'FlockingEntity', 'TypeAnnotations'], function(Rule, FlockingEntity, TypeAnnotations) {
        print("Included 'Flock'");

        // Simple flocking simulation.
        // Not tested (yet), and can be optimized as needed.
        function Flock () {
            // List of entities we're simulating. For simplicity, we do not care about their current
            // state (Entity.getProperties), and only send updates (Entity.editEntity). Furthermore, 
            // it's left up to the caller to ensure that our simulation instance is only called by one
            // thread.
            this.entities = [];
            
            // List of flocking rules, which implement the actual flocking behavior
            this.rules = {};
    
            // Limit speed of entities. Disabled if set below zero (-1).
            this.MAX_SPEED = DEFAULT_MAX_SPEED;
    
            // Enable / disable on-script physics calculations
            this.SIMULATE_PHYSICS_ON_SCRIPT = SIMULATE_PHYSICS_ON_SCRIPT;
            this._lastSimWasOnScript = this.SIMULATE_PHYSICS_ON_SCRIPT;
            this.POSITION_SYNC_THRESHOLD = 0.001;
            this.VELOCITY_SYNC_THRESHOLD = 0.001;
        }

        var declType = function () {};

        var injectMethods = TypeAnnotations.injectMethods;
        var annotate      = TypeAnnotations.annotateMethod;
        var EntityHandle = String;

        injectMethods(Flock, [
            annotate( addEntity,    { argtype: [ EntityHandle, [ Boolean ]  ] }),
            annotate( removeEntity, { argtype: [ EntityHandle, [ Function ] ] }),
            annotate( simulate,     { argtype: [ Number ] }),
            annotate( addRule,      { argtype: [ String, Rule ] }),
            annotate( editRule,     { argtype: [ String ] }),
            annotate( deleteRule,   { argtype: [ String ] }),
            annotate( enableRule,   { argtype: [ String ] }),
            annotate( destroy,      { argtype: [] }),
            annotate( logWarning,   { hidden: true }),
            annotate( logStatus,    { hidden: true }),
        ]);

        // inject(Flock.prototype, {
        //     addEntity:    addEntity    .withType(EntityHandle, ),
        //     removeEntity: removeEntity .withType(EntityHandle,
        //     simulate:     simulate     .withType(,
        //     addRule:      addRule,
        //     editRule:     editRule,
        //     deleteRule:   deleteRule,
        //     enableRule:   enableRule,
        //     disableRule:  disableRule,
        //     logWarning:   logWarning,
        //     logStatus:    logStatus
        // })

        declType(logWarning,[String]);
        function logWarning(warning) {
            print("Warning (flocking.js) -- " + warning);
        }

        declType(logStatus,[String]);
        function logStatus(status) {
            print("" + status);
        }
        declType(addRule,[String, Rule], Rule);
        function addRule(name, rule) {
            if (typeof(name) !== 'string' || !(rule instanceof Rule)) {
                var context = "";
                if (typeof(name) === 'string')
                    context += "name = '" + name + "'";
                throw new TypeError("Flock.addRule("+context+") expected arguments of type (string, Rule), not (" +
                    Array.prototype.map.call(arguments, function (arg) { return typeof(arg); }).join(', '));
            }
            this.logStatus("Adding flocking rule '" + name + "'");
            this.rules[name] = rule;
            rule.name = name;
        }

        declType(editRule,[String], Rule);
        function editRule(name) {
            if (this.rules[name]) {
                return this.rules[name];  // Rule is just a declarative interface for setting its own properties, so this works
            } else {
                this.logWarning("Flock.editRule has no rule '" + name + "'");
                return null;
            }
        }

        declType(deleteRule,[String]);
        function deleteRule(name) {
            if (this.rules[name]) {
                delete this.rules[name];
                this.logStatus("deleting flocking rule '" + name + "'");
            } else {
                this.logWarning("Flock.deleteRule has no effect: missing rule '" + name + "' to delete");
            }
        }
        declType(enableRule,[String]);
        function enableRule(name) {
            if (!this.rules[name]) {
                this.logWarning("Flock.enableRule has no effect: missing rule '" + name + "'");
            } else if (!this.rules[name].enabled) {
                this.logStatus("Flocking rule '" + name + "' has been enabled");
                this.rules[name].enabled = true;
            }
            print("rule '" + name + "' has been enabled");
        }
        declType(disableRule,[String]);
        function disableRule(name) {
            if (!this.rules[name]) {
                this.logWarning("Flock.disableRule has no effect: missing rule '" + name + "'")
            } else if (this.rules[name].enabled) {
                this.logStatus("Flocking rule '" + name + "' has been disabled");
                this.rules[name].enabled = false;
            }
        }

        // Destroys the simulation.
        // Kills all entities we have ownership over.
        declType(destroy,[]);
        function destroy () {
            try {
                print("Teardown this.entities.length = " + this.entities.length);
                this.entities.forEach(function (entity) {
                    if (entity.owned) {
                        print("Deleting entity " + entity.entityId);
                        Entities.deleteEntity(entity.entityId);
                    } else {
                        print("Not deleting entity " + entity.entityId);
                    }
                });
                this.entities = [];
            } catch(err) {
                print("teardown failed with error: " + err);
            }
        }
        // Run the simulation.
        // Should be called every frame update / as fast as possible.
        declType(simulate,[Number]);
        function simulate(dt) {
            var entities = this.entities, N = this.entities.length;
            var _this = this;
    
            var rules = [];
            Object.keys(this.rules).forEach(function(k) {
                if (_this.rules[k].enabled) {
                    rules.push(_this.rules[k]);
                }
            });
            if (rules.length <= 0) {
                if (!this.noSimRulesToExecute) { // Warn user just once (would flood logs otherwise)
                    print("flocking.js: No rules to execute -- skipping simulation");
                    this.noSimRulesToExecute = true;
                }
                return;
            } else {
                // Reset when/if we start running the simulation again 
                this.noSimRulesToExecute = false;
            }

            if (!(this.SIMULATE_PHYSICS_ON_SCRIPT || this._lastSimWasOnScript)) {
                // Fetch current values for entities
                entities.forEach(function(entity) {
                    var properties = Entities.getEntityProperties(entity.entityId);
                    entity.position.copy(properties.position);
                    entity.velocity.copy(properties.velocity);
                    entity.initialPosition = properties.position;
                    entity.initialVelocity = properties.velocity;
                    entity.mass = getEntityMass(properties);
                });
            }

            // Apply flocking rules (real work done in the Rule class)
            rules.forEach(Rule.__execRule, this);
    
            // Apply updates
            if (this.SIMULATE_PHYSICS_ON_SCRIPT) {
                // print("Running sim on script");
                // Integrate + apply positions + velocities
                entities.forEach(function(entity) {
                    // Clamp velocity to max speed
                    var currentSpeed = entity.velocity.length();
                    if (currentSpeed > this.MAX_SPEED && this.MAX_SPEED >= 0) {
                        entity.velocity.multiplyScalar(this.MAX_SPEED / currentSpeed);
                    }
        
                    // Update position w/ velocity
                    // entity.position.add(v.copy(entity.velocity).multiplyScalar(dt));
                    entity.position.x += entity.velocity.x * dt;
                    entity.position.y += entity.velocity.y * dt;
                    entity.position.z += entity.velocity.z * dt;
        
                    Entities.editEntity(entity.entityId, {
                        position: entity.position
                    });
                }, this);
            } else {
                print("Running sim on physics engine");
                var properties = {};    // tmp object
                entities.forEach(function(entity) {
                    var currentSpeed = entity.velocity.length();
                    if (currentSpeed > this.MAX_SPEED && this.MAX_SPEED >= 0) {
                        entity.velocity.multiplyScalar(this.MAX_SPEED / currentSpeed);
                    }
                    // properties.position = entity.position;
                    properties.velocity = entity.velocity;
    
                    if (properties.position || properties.velocity) {
                        Entities.editEntity(entity.entityId, properties);
                    }
                });
            }
            this._lastSimWasOnScript = this.SIMULATE_PHYSICS_ON_SCRIPT;
        }

        // Add an entity to the simulation.
        // @param entityId: the entity
        // @param hasOwnership (optional): signifies if we're allowed to delete this entity or
        //      not (true => yes, false => no). Defaults to false.
        declType(addEntity,[EntityHandle, [ Boolean ]]);
        function addEntity(entityId, hasOwnership) {
            this.entities.push(new FlockingEntity(entityId, hasOwnership));
        }
        // Remove an entity from the simulation (by id).
        // Calls Entities.deleteEntity iff its ownership flag is set (from the attachEntity call)
        declType(removeEntity,[EntityHandle, [ Function ]]);
        function removeEntity(entityId, deleteEntity) {
            // Find and remove entity
            for (var i = 0; i < this.entities.length; ++i) {
                if (this.entities[i].entityId === entityId) {
                    if (this.entities[i].__hasOwnership) {
                        Entities.deleteEntity(this.entities[i]);
                    }
                    this.entities.removeAtIndex(i);    // added by arrayUtils.js
                    return;
                }
            }
            // else -- entity doesn't exist. do we care?
        }
        
        declType(toString,[]);
        function toString () {
            return "[Flock numEntities=" + this.entities.length + ", numRules=" + Object.keys(this.rules).length + "]";
        }
        return Flock;
    });

    // Flocking rules class and internals. Uses metaprogramming extensively to construct an API that a) uses named functions
    // to inject functionality, b) runs the injected functions within specific contexts (RULE_STAGES), and c) does so at specific
    // intervals w/ externally defined state (this is tightly bound to the Flock class, but only interfaces via one function call).
    //
    // The backend is somewhat complicated, but to add new functionality (rule stages), just add stuff to RULE_STAGES and everything
    // will automagically work.
    //
    define('FlockingRule', [], function() {
        function Rule () {
            this.enabled = true;
            this.__stages = {};
        }
        Rule.prototype.setEnabled = function (enabled) {
            this.enabled = enabled !== undefined ? enabled : true;
            return this;
        };

        // Define the rules api.
        // There are N stages (run in sequence), which each have a number of methods run at that point (this
        // is done so we can have before/after method calls, and somewhat control the order of execution).
        // Each of these methods _basically_ maps 1-1 w/ the corresponding methods on the rule api.
        // When called, 
        //      arguments  :=  args bound with new Rule().<method>(...), where <method> is the name defined here (before, eachEntity, etc)
        //      this       :=  Flock instance bound to with <flock>.addRule(<rule-name>, new Rule().<...>)
        //                     Any instance properties (this.entities, _technically_ this.rules, etc.,) are fully available here.
        //                     Do NOT expose this to functions / arguments passed in (this.entities should be sufficient)
        var RULE_STAGES = [
            {
                // Add behavior that gets executed before everything else
                before: function(f) {
                    f.call(this.ctx, this.entities);
                }
            }, {
                // Add behavior (a function) that gets executed on every entity (entities, index i) in the simulation.
                eachEntity: function(f) {
                    for (var i = 0, n = this.entities.length; i < n; ++i) {
                        this.entities[i].applyForce(f.call(this.ctx, this.entities, i));
                    }
                },
                // Add behavior that gets executed on every two entities in the simulation (called on each)
                eachTwoEntities: function(f) {
                    for (var i = 0, n = this.entities.length; i < n; ++i) {
                        for (var j = i + 1; j < n; ++j) {
                            this.entities[i].applyForce(f.call(this.ctx, this.entities, i, j));
                            this.entities[j].applyForce(f.call(this.ctx, this.entities, j, i));
                        }
                    }
                },
                // Add behavior that gets executed on every two entities within range of each other.
                eachTwoEntitiesInRange: function(range, f) {
                    for (var i = 0, n = this.entities.length; i < n; ++i) {
                        for (var j = i + 1; j < n; ++j) {
                            if (this.entities[i].position.distanceTo(this.entities[j].position) <= range) {
                                this.entities[i].applyForce(f.call(this.ctx, this.entities, i, j));
                                this.entities[j].applyForce(f.call(this.ctx, this.entities, j, i));
                            }
                        }
                    }
                }
            }, {
                // Behavior executed after all other calls have finished
                after: function(f) {
                    f.call(this.ctx, this.entities);
                }
            }
        ]

        // Attach methods (each call stores / binds the parameters passed to it, and these get invoked later
        // when executeRule (called by Flock.simulate()) gets called).
        RULE_STAGES.forEach(function(stage) {
            Object.keys(stage).forEach(function(k) {
                Rule.prototype[k] = function () {
                    // if (!(this instanceof Rule)) {
                    //     throw new Error("Expected this in Rule."+k+" to be instance of Rule, not "+(this.prototype && this.prototype.constructor ? (this.prototype.constructor.name || "undefined-function") : this));
                    // }
                    var args = Array.prototype.slice.call(arguments); // save args
                    if (!this.__stages[k]) {
                        this.__stages[k] = args;
                    } else {
                        // When rule stage has already been set, allows mutating specific properties after the fact.
                        // (changed values: non-null, unchanged values: null). A side effect of this is that stage args
                        // are not allowed to be null.
                        args.forEach(function(v, i) {
                            if (v !== null) {
                                this.__stages[k][i] = v;
                            }
                        }, this);
                    }
                    return this;
                }
                Rule.prototype[k].name = k;
            })
        });

        var orderedStages = [];
        RULE_STAGES.forEach(function(stage) {
            Object.keys(stage).forEach(function(key) {
                orderedStages.push({ key: key, fcn: stage[key] });
            })
        });

        /// Executes a rule from an external Flock / simulation instance (this === Flock instance)
        function executeRule(rule) {
            // print("Executing rule " + rule.name)
            // print("this is instance of " + (this.__proto__ && this.__proto__.constructor ? this.__proto__.constructor.name : "<none>"));
            // print("this = " + this)
            // print("json(this) = " + JSON.stringify(this));

            orderedStages.forEach(function(v) {
                // print("orderedStages: v type: " + typeof(v) + ", v keys: " + Object.keys(v).join(', '))
                try {
                    var stageArgs = rule.__stages[v.key];
                    if (stageArgs) {
                        v.fcn.apply(this, stageArgs);
                    }
                } catch (err) {
                    print("Error (flocking.js): Execution of rule '" + rule.name + "' failed during '" + v.key + "'. " + err);
                    print("Rule '" + rule.name + "' has been disabled.");
                    rule.enabled = false;
                }
            }, this);
        }

        print("Constructed Rule");
        var methods = Rule.prototype;
        print("Rule methods: " + Object.keys(Rule.prototype).map(function(method) {
            // if (typeof(method) === 'function') {
                return ""+Rule.name+"."+method+" = "+Rule.prototype[method];
            // } else {
                // return "";
            // }
        }).join(', '));
        Rule.__execRule = executeRule;
        return Rule;
    });

    define('TypeAnnotations', [], function() {
        print("Included 'TypeAnnotations'");

        var PRIMITIVE_SINGLE_TYPE = 1,
            PRIMITIVE_MULTIPLE_TYPE = 2,
            PRIMITIVE_OPTIONAL_TYPE = 3,
            CTOR_SINGLE_TYPE = 4,
            CTOR_MULTIPLE_TYPE = 5,
            CTOR_OPTIONAL_TYPE = 6,
            ANY_TYPE = 7,
            SPLAT_TYPE = 8;

        var OPTIONS = {
            USE_TYPE_CHECKS: true
        }

        function checkPrimitiveType(t) {
            switch(t) {
                case 'string': case 'number': case 'boolean': case 'object': case 'function': case 'undefined':
                    return t;
            }
            throw new TypeError("Invalid type passed to annotate: '" + t + "'. Expected primitive type (typeof), or constructor type.");
        }
        function checkCtorType(t) {
            switch(typeof(t)) {
                case 'function': 
                    if (!t.name)
                        print("WARNING: Type passed to annotate() has no name: " + t);
                    return t;
            }
            throw new TypeError("Invalid type passed to annotate: '" + (t.name || t) + "'. Expected primitive (typeof) or constructor type.");
        }
        var cp = checkPrimitiveType, ct = checkCtorType;

        function annotate (method, properties) {
            // if (!method.__annotations__) {
            //     method.__annotations__ = {};
            // }
            if (properties.hidden) {
                method.__dontMakePublic = true;     // ignored atm
            }
            if (properties.argtypes) {
                method.__argtypes = properties.argtypes.map(function(t) {
                    if (t instanceof Array) {
                        switch (t.length) {
                            case 0: // Polymorphic type
                                return { 'kind': ANY_TYPE };
                            case 1: // Optional type
                                switch(typeof(t)) {
                                    case 'string':   return { 'kind': PRIMITIVE_OPTIONAL_TYPE, 'type': cp(t) };
                                    case 'function': return { 'kind': CTOR_OPTIONAL_TYPE, 'type': cc(t) };
                                }
                                break;
                            default: // Multiple types
                                switch(typeof(t)) {
                                    case 'string': return { 'kind': PRIMITIVE_MULTIPLE_TYPE, 'type': cp(t) };
                                    case 'function': return { 'kind': CTOR_MULTIPLE_TYPE, 'type': cc(t) };
                                }
                        }
                    } else if (typeof(t) === 'string') {
                        return { 'kind': PRIMITIVE_SINGLE_TYPE, 'type': cp(t) };
                    } else if (typeof(t) === 'function') {
                        return { 'kind': CTOR_SINGLE_TYPE, 'type': cc(t) };
                    } else if (typeof(t) === 'object' && t.constructor) {
                        return { 'kind': CTOR_SINGLE_TYPE, 'type': cc(t.constructor) };
                    }
                    throw new TypeError("Invalid type passed to annotate: '" + (t.name || t) + "'. Expected primitive type (typeof) or constructor type (function).");
                });
            }
            return method;
        }

        function constructTypeCheckedMethod(method, typeArgs) {
            // Crawl + validate args
            var numOptional = 0;
            var splat = false;

            var optional = false;
            for (var i = 0; i < typeArgs.length; ++i) {
                switch (typeArgs[i]) {
                    case PRIMITIVE_SINGLE_TYPE: case PRIMITIVE_MULTIPLE_TYPE: case CTOR_SINGLE_TYPE: case CTOR_MULTIPLE_TYPE:

                    case PRIMITIVE_OPTIONAL_TYPE: case CTOR_OPTIONAL_TYPE:

                    case SPLAT_TYPE:

                    default:
                        throw new Error("TypeAnnotations -- Internal Error: unhandled case type flag '" + typeArgs[i] + "''. Context: arg i = " + i + "; called on method: " + method);
                }
            }

            if (minArgs) {
                s += 'if (arguments.length > '
            }

            switch(typeArgs[i].kind) {
                case PRIMITIVE_SINGLE_TYPE: return ' && typeof(arguments['+i+']) === "'+typeArgs[i].type+'"';
                case CTOR_SINGLE_TYPE:      return ' && (arguments['+i+'] instanceof "'+typeArgs[i].type+'")';
            }
        }

        function injectMethods(cls, methods) {
            // print("injecting methods into " + cls);

            // Check types
            if (!(cls instanceof Function) || !(methods instanceof Array)) {
                throw new TypeError("injectMethods(cls, methods) expected types (Function, Array), not " +
                    "(" + Array.prototype.map.call(arguments, getType) + ")");
            }

            // Class (constructor function) must have a name
            if (!cls.name) {
                throw new TypeError("injectMethods(cls, ...) class function must be named");
            }

            // Check for methods w/ missing name fields (each method must be a named function)
            var unnamedMethods = methods.filter(function(method) { return !method.name; });
            if (unnamedMethods.length) {
                throw new TypeError("injectMethods(cls, methods) -- " + unnamedMethods.length + " method(s) missing name field: " + unnamedMethods.join(', '));
            }

            // Check types + inject methods into class prototype
            methods.forEach(function(method) {
                if (cls.prototype[method.name]) {
                    var fieldType = typeof(cls.prototype[method].name) === 'function' ? 'method' : 'field';
                    if (fieldType === 'function' && (""+cls.prototype[method]) === (""+method)) {
                        print("WARNING -- duplicate argument to injectMethods (already exists): " + method);
                    } else {
                        print("WARNING -- injectMethods overriding "+fieldType+" "+cls.name+"."+method.name+"(previous value: ");
                    }
                } else {
                    // Inject method
                    cls.prototype[method.name] = method;
                }
            });
        }

        return {
            annotateMethod: annotate,
            injectMethods: injectMethods,
            options: OPTIONS
        }
    });
})();


