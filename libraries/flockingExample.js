//
// example/flocking/flockingExample.js
//
// Created by Seiji Emery on 9/10/15
// Copyright 2015 High Fidelity, Inc
//
// Distributed under the Apache License, Version 2.0.
// See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//
// Basic demo for the flocking.js library.
//

// Includes (messy)
Script.include('require.js');
if (typeof(require) !== 'function' || typeof(define) !== 'function') {
    Script.include('https://dl.dropboxusercontent.com/u/4386006/hifi/scriptdev/libraries/require.js');
    if (typeof(require) !== 'function' || typeof(define) !== 'function') {
        throw new Error("Could not load 'require.js'")
    }
}
require.externals({
    modules: ['Flock', 'FlockingRule'],
    urls: [
        'flocking.js',
        // 'https://dl.dropboxusercontent.com/u/4386006/hifi/scriptdev/libraries/flocking.js' 
    ]
});

// Example
require(['Flock', 'FlockingRule'], function(Flock, Rule) {

    // Create flock
    var flock = new Flock();

    // Spawn + attach entities
    var NUM_ENTITIES = 20;
    var center = MyAvatar.position;
    for (var i = 0; i < NUM_ENTITIES; ++i) {
        flock.addEntity(
            Entities.addEntity({
                type: "Box",
                position: {
                    x: Math.random() * 10.0 + center.x - 5.0,
                    y: Math.random() * 10.0 + center.y - 5.0,
                    z: Math.random() * 10.0 + center.z - 5.0
                },
                dimensions: {
                    x: 0.1, y: 0.1, z: 0.1
                },
                color: {
                    red: Math.random() * 255,
                    green: Math.random() * 255,
                    blue: Math.random() * 255
                }
            }), true);
    }

    // addRule(name, Rule)
    // Rule API:
    //      .before(function(entities)) -> this
    //      .eachEntity(function(entities, i) -> Vector3) -> this
    //      .eachTwoEntities(function(entities, i, j) -> Vector3) -> this
    //      .eachTwoEntitiesInRange(dist, function(entities, i, j) -> Vector3) -> this
    //      .after(function(entities)) -> this
    // entities := Array<FlockingEntity>
    // FlockingEntity := class w/
    //      position: Vector3
    //      velocity: Vector3
    //      mass: Number,
    //      applyForce: function(force: Vector3)
    //
    // Attach rule:
    //      flock.addRule(name, Rule)
    // Enable / disable rule:
    //      flock.enableRule(name)
    //      flock.disableRule(name)
    // Edit rule:
    //      flock.editRule(name) -> Rule
    //          (can call methods on this to override original params. Pass null for no param change)
    //          eg. flock.editRule('foo')
    //              .eachEntity(new-function)
    //          or  flock.editRule('bar')
    //              .eachTwoEntitiesInRange(new-dist || null, new-func || null)
    // Delete rule:
    //     flock.deleteRule(name)
    flock.addRule('gravity', new Rule()
    	.eachEntity(function(){
    		// return new Vector3(0, -0.1, 0);
    	}));
    flock.addRule('attraction', new Rule()
    	.before(function(entities) {
    		this.center = new Vector3();
            entities.forEach(function(entity){
                this.center.add(entity.position);
            }, this);
            this.center.multiplyScalar(1 / (entities.length || 0));
            print("Center = " + center);
    	})
    	.eachEntity(function(entities, i) {
    		var dir = new Vector3().subVectors(this.center, entities[i].position);
            return dir.multiplyScalar(3);
    	}));

    // limit speed to some defined value
    flock.MAX_SPEED = 10.0;
    flock.SIMULATE_PHYSICS_ON_SCRIPT = true;

    // Run simulation + attach cleanup
    function update (dt) {
    	try { 
    		flock.simulate(dt);
    	} catch (e) {
    		print("Error in simulation: " + e);
    	}
    }

    Script.update.connect(update);
    Script.scriptEnding.connect(function () {
        try { 
            flock.destroy()
        } catch (e) {
            print("Error while calling from Script.scriptEnding: " + e);
        }
    });
})


