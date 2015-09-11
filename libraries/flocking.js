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

// var global;
// (function(){ global = this; })();

// Flocking class
inject(this, function () {
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

    // Flock class
    define('Flock', ['Rule'], function(Rule) {
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


        return {
            Flock: Flock
        };
    });

    // Rule class
    define('Rule', [], function() {
        function Rule () {

        }

        return {
            Rule: Rule
        };
    });

    var SUPPORTED_RULE_PROPERTIES = {
        before: 'function',
        eachEntity: 'function',
        eachTwoEntities: 'function',
        after: 'function',
        enabled: 'bool'
    };
    function checkRuleTypes(rule) {
        Object.keys(rule).forEach(function(k) {
            var type = typeof(rule[k]) === 'function' ? 'function' : 'value';
            if (!SUPPORTED_RULE_PROPERTIES[k]) {
                print("Warning: unused " + type + " '" + k + "' in call to Flock.addRule");
            } else if (typeof(rule[k]) !== SUPPORTED_RULE_PROPERTIES[k]) {
                print("Warning: " + type + " '" + k + "' in flocking rule has wrong type: " +
                    "expected '" + SUPPORTED_RULE_PROPERTIES[k] + "', got '" + typeof(rule[k]) + "' (Flock.addRule)");
            }
        });
    }
    function applyForce(entity, force) {
        if (force) {
            entity.velocity.add(force.multiplyScalar(1 / entity.mass));
        }
    }
    var RULE_STAGES = [
        {
            before: function(f, entities) {
                f.call(this, entities);
            }
        }, {
            eachEntity: function(f, entities) {
                for (var i = 0, l = entities.length; i < l; ++i) {
                    applyForce(entities[i], f.call(this, entities, i));
                }
            },
            eachTwoEntities: function(f, entities) {
                for (var i = 0, l = entities.length; i < l; ++i) {
                    for (var j = i + 1; j < l; ++j) {
                        applyForce(entities[j], f.call(this, entities, i, j));
                        applyForce(entities[j], f.call(this, entities, j, i));
                    }
                }
            }
        }, {
            after: function(f, entities) {
                f.call(this, entities);
            }
        }
    ]

    // Attach a flocking rule.
    // @param name: unique identifier for the rule (rules can be added and deleted)
    // @param rule: object containing a list of rule properties. These include:
    //      enabled: bool (defaults to true)
    //      before: function (all_entities)
    //          Gets called once before all other rules
    //      after: function (all_entities)
    //          Gets called once after all other rules
    //      eachEntity: function(all_entities, i)
    //          Gets called once for each entity. i is a unique entity index.
    //          Should return a force (Vector3) applied to that entity, or null/undefined (no force)
    //      eachTwoEntities: function(all_entities, i, j)
    //          Gets called for each entity i, j where i != j.
    //          Should return a force applied to entity[i]. (will also be called for entity j, so don't worry about that)
    // Each rule function has access to (optional) shared state in 'this' (which is guaranteed to be the same object across
    // all invocations for that rule), and full access to all entities in the simulation (technically read/write access, but
    // please be nice + don't change anything!).
    //
    // Each entity has position, velocity, and mass properties. You can ignore the last one unless you want to apply mass-independent
    // acceleration forces (in which case F = ma). Setting position and/or velocity _may_ have an effect, though mass is readonly 
    // (might make changes on your client, but no one else would see them).
    // Other properties like color + dimensions are not available, though if you _really_ want to do some crazy stuff you can
    // get the entity id directly from entities[i].entityId.
    //
    function addRule(name, rule) {
        // Check values
        rule.name = name;
        rule.enabled = typeof(rule.enabled) === 'undefined' ? true : rule.enabled;
        checkRuleTypes(rule);
        this.rules[name] = rule;
    }

    // Remove a rule (by name).
    function removeRule(name) {
        delete this.rules[name];
    }

    // Enable a rule.
    // Returns true iff rule exists.
    function enableRule(name) {
        return this.rules[name] &&
            (this.rules[name].enabled = true, true);
        // if (this.rules[name]) {
        //     this.rules[name].enabled = true;
        //     return true;
        // } else {
        //     return false;
        // }
    }

    // Disable / temporarily suspend a rule.
    // Returns true iff rule exists.
    function disableRule(name) {
        return this.rules[name] &&
            (this.rules[name].enabled = false, true);
    }

    // Add an entity to the simulation.
    // @param entityId: the entity
    // @param hasOwnership (optional): signifies if we're allowed to delete this entity or
    //      not (true => yes, false => no). Defaults to false.
    function attachEntity(entityId, hasOwnership) {
        var properties = Entities.getEntityProperties(entityId);
        this.simulatedEntities.push({
            entityId: entityId,
            position: toVector3(properties.position),
            velocity: toVector3(properties.velocity),
            mass: getEntityMass(properties),
            owned: !!hasOwnership
        });
    }
    // Remove an entity from the simulation (by id).
    // Calls Entities.deleteEntity iff its ownership flag is set (from the attachEntity call)
    function removeEntity(entityId, deleteEntity) {
        // Find and remove entity
        for (var i = 0; i < this.simulatedEntities.length; ++i) {
            if (this.simulatedEntities[i].entityId === entityId) {
                if (this.simulatedEntities[i].owned) {
                    Entities.deleteEntity(this.simulatedEntities[i]);
                }
                this.simulatedEntities.removeAtIndex(i);    // added by arrayUtils.js
                return;
            }
        }
        // else -- entity doesn't exist. do we care?
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

        // // Calculate flock center (averaged positions)
        // var center = new Vector3();
        // entities.forEach(function(entity) {
        //     center.add(entity.position);
        // })
        // center.multiplyScalar(1 / N);

        // Get position + velocity arrays
        // var positions  = entities.map(function(entity) { return entity.position.clone(); });
        // var velocities = entities.map(function(entity) { return entity.velocity; });

        // Apply flocking rules
        function applyRule(rule) {
            var lastStageExeced = null;
            try {
                var ctx = {};
                RULE_STAGES.forEach(function(stage) {
                    for (var fcn in stage) {
                        if (rule[fcn]) {
                            lastStageExeced = fcn;
                            stage[fcn].call(ctx, rule[fcn], entities);
                        }
                    }
                    if (lastStageExeced === null) {
                        print("Warning (flocking.js): Rule '" + rule.name + "' has no execution stages. Disabling.");
                        rule.enabled = false;
                    }
                })
            } catch (err) {
                print("Error (flocking.js): Execution of rule '" + rule.name + "' failed during '" + lastStageExeced + "'. " + err);
                print("Rule '" + rule.name + "' has been disabled");
                rule.enabled = false;
            }
        }
        rules.forEach(applyRule);

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
    function toString () {
        return "[Flock numEntities=" + this.simulatedEntities.length + ", numRules=" + Object.keys(this.rules).length + "]";
    }

    print("Loaded flocking.js");

    // Attach methods
    // inject(Flock.prototype, function () { return {   // inject.js
    //     toString: toString,
    //     attachEntity: attachEntity,
    //     removeEntity: removeEntity,
    //     addRule: addRule,
    //     removeRule: removeRule,
    //     enableRule: enableRule,
    //     disableRule: disableRule,
    //     simulate: simulate,
    //     destroy: destroy,
    //     MAX_SPEED: DEFAULT_MAX_SPEED,
    // }; });

    // Export to global scope.
    // Could be done async (AMD, etc)
    // return {
        // Flock: Flock
    // };

    // AMD define (just used interally)
    var exports = {};
    function define (name, dependencies, closure) {
        var modules = exports;
        function tryLoad(closure, deps) {
            var canLoad = true;
            var rdeps = deps.map(function(dep) {
                switch (typeof(modules[dep])) {
                    case 'object': return modules[dep];
                    case 'function': var o = modules[dep]();
                        return o ? (modules[dep] = o) : (canLoad = false), null;
                    default: canLoad = false;
                        return null;
                }
            });
            return canLoad ? closure.apply(null, rdeps) : null;
        }
        if (!(exports[name] = tryLoad(closure, deps))) {
            exports[name] = function () {
                return tryLoad(closure, deps);
            }
        }
    }
    // Load all unloaded modules
    (function () {
        Object.keys(exports).forEach(function(k) {
            if (typeof(exports[k]) === 'function') {
                if (!(exports[k] = exports[k]())) {
                    throw new TypeError("flocking.js internal error -- missing dependencies for '"+k+"'");
                } else {
                    print("Loaded unloaded module '"+k+"'");
                }
            }
        }
    })();
});

// hack
if (typeof(Flock) === 'undefined') {
    Flock = this.Flock;
    Rule = this.Rule;
}



