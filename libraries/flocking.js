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

var RELATIVE_INCLUDES_WORKING = false;  // this really needs to be implemented at some point...

if (typeof(console) === 'undefined') {
    console = {
        log: function () {
            print(Array.prototype.join.call(arguments, " "));
        }
    }
}

if (RELATIVE_INCLUDES_WORKING) {
    Script.include([
        // 'three/Three.js',
        'three/math/Vector3.min.js',
        'inject.js',
        'arrayUtils.js',
    ]);
} else {
    Script.include([
        'https://dl.dropboxusercontent.com/u/4386006/hifi/js/libraries/three/Three.js',
        'https://dl.dropboxusercontent.com/u/4386006/hifi/js/libraries/three/math/src/Vector3.js',
        'https://dl.dropboxusercontent.com/u/4386006/hifi/js/libraries/inject.js',
        'https://dl.dropboxusercontent.com/u/4386006/hifi/js/libraries/arrayUtils.js',
    ]);
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

var exports = {};

// Flocking class
inject(exports, function () {
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

    // AMD define (just used interally)
    // var loadedModules = {};
    // var pendingModules = {};
    // function define(name, dependencies, closure) {
    //     var canLoad = true;
    //     var rdeps = dependencies.map(function(dep) {
    //         if (loadedModules[dep]) {
    //             return loadedModules[dep];
    //         } else {
    //             return canLoad = false, null;
    //         }
    //     });
    //     if (canLoad) {
    //         loadedModules[name] = closure.call(null, rdeps);
    //         if (pendingDeps[name]) {
    //             pendingDeps[name].forEach(function(dep) {
    //                 if (--dep.count <= 0) {
    //                     loadedModules[dep.name] = dep.closure.call()
    //                 }
    //             });
    //         }
    //     } else {

    //     }
    // }
    // function PendingModule (name, dependencyList, missingDependencies, load) {
    //     this.name = name;
    //     this.dependencies = dependencyList;
    //     this.missingDependencyCount = missingDependencyCount
    //     this.missingDependencies = missingDependencies;
    //     this.load = load;
    // }
    // PendingModule.prototype.resolvedDependency(dependency) {
    //     if (this.missingDependencies[dependency]) {
    //         delete this.missingDependencies[dependency]
    //         this.dependencyList[this.missingDependencies[dependency]] 
    //     }
    // }

    var exports = {};
    function define 

    function define (name, dependencies, closure) {
        function tryLoad(modules, closure, deps) {
            var canLoad = true;
            var rdeps = deps.map(function(dep) {
                switch (typeof(modules[dep])) {
                    case 'object': return modules[dep];
                    case 'function': 
                        print("Loading '" + dep + "'");
                        var o = modules[dep]();
                        if (o) {
                            print("Loaded '" + dep + '"');
                            return (modules[dep] = o);
                        } else {
                            print("Can't load '" + dep + "' yet");
                            return null;
                        }
                    default: canLoad = false;
                        print("Dep '" + dep + "' doesn't exist yet");
                        return null;
                }
            });
            return canLoad ? closure.apply(null, rdeps) : null;
        }
        print("Defining '" + name + "'");
        if (!(exports[name] = tryLoad(exports, closure, dependencies))) {
            exports[name] = function () {
                return tryLoad(exports, closure, dependencies);
            }
        } else {
            print("Loaded '" + name + "'");
        }
    }
    // Load all unloaded modules
    function loadAll() {
        Object.keys(exports).forEach(function(k) {
            if (typeof(exports[k]) === 'function') {
                exports[k] = exports[k]();
                if (!exports[k]) {
                    throw new TypeError("flocking.js internal error -- missing dependencies for '"+k+"'");
                } else {
                    print("Loaded '"+k+"'");
                }
            }
        });
    }

    // Entity class (just for flocking -- not exported)
    define('FlockingEntity', [], function() {
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

    // Flock class
    define('Flock', ['Rule', 'FlockingEntity'], function(Rule, FlockingEntity) {
        // Simple flocking simulation.
        // Not tested (yet), and can be optimized as needed.
        function Flock () {
            // List of entities we're simulating. For simplicity, we do not care about their current
            // state (Entity.getProperties), and only send updates (Entity.editEntity). Furthermore, 
            // it's left up to the caller to ensure that our simulation instance is only called by one
            // thread.
            this.simulatedEntities = [];
            
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
        inject(Flock.prototype, {
            addEntity: addEntity,
            removeEntity: removeEntity,
            simulate: simulate,
            addRule: addRule,
            editRule: editRule,
            deleteRule: deleteRule,
            enableRule: enableRule,
            disableRule: disableRule,
            logWarning: logWarning,
            logStatus: logStatus
        })
        function logWarning(warning) {
            print("Warning (flocking.js) -- " + warning);
        }
        function logStatus(status) {
            print("" + status);
        }
        function addRule(name, rule) {
            if (typeof(name) !== 'string' || !(rule instanceof Rule)) {
                throw new TypeError("Flock.addRule expected arguments of type (string, Rule), not (" +
                    Array.prototype.map.call(arguments, function (arg) { return typeof(arg); }).join(', ') +
                    ")");
            }
            this.logStatus("Adding flocking rule '" + name + "'");
            this.rules[name] = rule;
        }
        function editRule(name) {
            if (this.rules[name]) {
                return this.rules[name];  // Rule is just a declarative interface for setting its own properties, so this works
            } else {
                this.logWarning("Flock.editRule has no rule '" + name + "'");
                return null;
            }
        }
        function deleteRule(name) {
            if (this.rules[name]) {
                delete this.rules[name];
                this.logStatus("deleting flocking rule '" + name + "'");
            } else {
                this.logWarning("Flock.deleteRule has no effect: missing rule '" + name + "' to delete");
            }
        }
        function enableRule(name) {
            if (!this.rules[name]) {
                this.logWarning("Flock.enableRule has no effect: missing rule '" + name + "'");
            } else if (!this.rules[name].enabled) {
                this.logStatus("Flocking rule '" + name + "' has been enabled");
                this.rules[name].enabled = true;
            }
            print("rule '" + name + "' has been enabled");
        }
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
        function destroy () {
            try {
                print("Teardown this.simulatedEntities.length = " + this.simulatedEntities.length);
                this.simulatedEntities.forEach(function (entity) {
                    if (entity.owned) {
                        print("Deleting entity " + entity.entityId);
                        Entities.deleteEntity(entity.entityId);
                    } else {
                        print("Not deleting entity " + entity.entityId);
                    }
                });
                this.simulatedEntities = [];
            } catch(err) {
                print("teardown failed with error: " + err);
            }
        }
        // Run the simulation.
        // Should be called every frame update / as fast as possible.
        function simulate (dt) {
            var entities = this.simulatedEntities, N = this.simulatedEntities.length;
            var _this = this;
    
            var rules = [];
            Object.keys(this.rules).forEach(function(k) {
                if (_this.rules[k].enabled) {
                    rules.push(_this.rules[k]);
                }
            });
            if (rules.length <= 0) {
                print("flocking.js: No rules to execute -- skipping simulation");
                return;
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
            rules.forEach(Rule.__execRule);
    
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
        function addEntity(entityId, hasOwnership) {
            this.simulatedEntities.push(new FlockingEntity(entityId, hasOwnership));
        }
        // Remove an entity from the simulation (by id).
        // Calls Entities.deleteEntity iff its ownership flag is set (from the attachEntity call)
        function removeEntity(entityId, deleteEntity) {
            // Find and remove entity
            for (var i = 0; i < this.simulatedEntities.length; ++i) {
                if (this.simulatedEntities[i].entityId === entityId) {
                    if (this.simulatedEntities[i].__hasOwnership) {
                        Entities.deleteEntity(this.simulatedEntities[i]);
                    }
                    this.simulatedEntities.removeAtIndex(i);    // added by arrayUtils.js
                    return;
                }
            }
            // else -- entity doesn't exist. do we care?
        }
        
        function toString () {
            return "[Flock numEntities=" + this.simulatedEntities.length + ", numRules=" + Object.keys(this.rules).length + "]";
        }
        return Flock;
    });

    // Flocking rules class and internals
    define('Rule', [], function() {
        function Rule () {
            this.enabled = true;
            this.__stages = {};
        }
        Rule.prototype.setEnabled = function (enabled) {
            this.enabled = enabled !== undefined ? enabled : true;
            return this;
        };

        // Define the rules api.
        // There are N stages (run in sequence), which each have a number of methods run at that point.
        // Each of these methods _basically_ maps 1-1 w/ the corresponding methods on the rule api, and gets
        // called with the arguments passed into it, `this` pointing to the current Flock instance, and they
        // get magically invoked once every frame update (when you call flock.simulate).
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
                        });
                    }
                }
            })
        });

        var orderedStages = [];
        RULE_STAGES.forEach(function(stage) {
            Object.keys(stage).forEach(function(key) {
                orderedStages.push({ key: key, fcn: RULE_STAGES[key] });
            })
        })
        function executeRule(rule) {
            orderedStages.forEach(function(v) {
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
            });
        }
        Rule.__execRule = executeRule;
        return Rule;
    });

    loadAll();
    print("Loaded flocking.js");
    return exports;
});

// hack
if (typeof(Flock) === 'undefined') {
    Flock = exports.Flock;
    Rule = exports.Rule;
}



