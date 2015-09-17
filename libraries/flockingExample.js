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

// Script.include('../../libraries/flocking.js')
// if (typeof(Flock) !== 'function') {
// 	print("Local include failed -- using global include");
// 	Script.include('https://dl.dropboxusercontent.com/u/4386006/hifi/js/libraries/flocking.js');
// 	if (typeof(Flock) !== 'function') {
// 		throw new Error("Could not load the flocking library (flocking.js)")
// 	}
// }

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


    // flock.addRule('localizedAttraction', new Rule()
    // 	.before(function() { this.center = new Vector3(); })
    // 	.eachTwoEntitiesInRange(10.0, function (entities, i, j) {
    // 		this.center.set(0, 0, 0);
    // 	}));
    // flock.addRule('test', new Rule()
    //     .before(function() { 
    //         print("before" +
    //             ", this = " + this + 
    //             ", this.__type__ = " + (this.__proto__.constructor.name || 'anonymous-function')); 
    //     })
    //     .after(function() { 
    //         print("after" + 
    //             ", this = " + this + 
    //             ", this.__type__ = " + (this.__proto__.constructor.name || "anonymous-function"));

    //         // throw new Error("Stopping...");
    //     })
    // );

    // Edit rule: change range while preserving fcn
    // flock.editRule('localizedAttraction')
    // 	.eachTwoEntitiesInRange(20.0, null);

    // flock.deleteRule('localizedAttraction');

    // Attach rules
    // flock.addRule('gravity', {
    // 	eachEntity: function () {
    // 		return new Vector3(0, -0.1, 0);
    // 	}
    // });
    // flock.addRule('attraction', {
    // 	before: function (entities) {
    // 		// Calculate average center of all entities
    // 		this.center = new Vector3();
    // 		entities.forEach(function (entity) {
    // 			this.center.add(entity.position);
    // 		}, this);
    // 		this.center.multiplyScalar(1 / entities.length);
    // 	},
    // 	eachEntity: function (entities, i) {
    // 		var dir = new Vector3().subVectors(this.center, entities[i].position);
    // 		return dir.multiplyScalar(3);
    // 	}
    // });
    // flock.addRule('separation', {
    // 	eachTwoEntities: function (entities, i, j) {
    // 		var dir = new Vector3().subVectors(entities[i].position, entities[j].position);
    // 		if (dir.length < 1.0) {
    // 			return dir.multiplyScalar(5);
    // 		}
    // 	}
    // });
    // flock.addRule('pullTowardsMe', {
    // 	eachEntity: function (entities, i) {
    // 		var dir = new Vector3.subVectors(MyAvatar.position, entities[i].position);
    // 		if (dir.length >= 2.0) {
    // 			return dir.multiplyScalar(50);
    // 		} else {
    // 			return dir.multiplyScalar(10.0);
    // 		}
    // 	}
    // });

    // print("Setting up rules");
    // flock.addRule('alignment', {
    // 	before: function(entities) {
    // 		// print("Alignment called");
    // 	}
    // });

    // flock.removeRule('gravity');
    // flock.enableRule('gravity');
    // flock.disableRule('gravity');
    

    // (function () {
    //     function AttractorManager () {
    //         this.attractorList = [];
    //     }
    //     function addAttractor(attractor) {
    //         this.attractorList.push(attractor);
    //     }
    //     function update(dt) {
    //         var deleteList = [];
    //         this.attractorList.forEach(function (attractor, i) {
    //             attractor.update(dt);
    //             if (!attractor.isAlive()) {
    //                 attractor.destroy();
    //                 deleteList.push(i);
    //             }
    //         });
    //         attractorList.removeIndices(deleteList);
    //     }
    //     var attractorMgr = null;

    //     function Attractor(flock, position, strength, falloffFunc) {
    //         if (!attractorMgr) {
    //             attractorMgr = new AttractorManager();
    //         }
    //         attractorMgr.add(this);

    //         this.flock = flock;
    //         this.position = position;
    //         this.strength = strength;
    //         this.falloffFunc = falloffFunc;
    //     }
    // })();



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


