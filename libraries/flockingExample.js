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

Script.include('require.js');
require.externals({
	modules: ['Flock'],
	urls: ['flocking.js']
});

// Example
// (function () {
require(['Flock', 'FlockingRule'], function(Flock, Rule) {
    var flock = new Flock();
    var NUM_ENTITIES = 20;

    // Create entities
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


