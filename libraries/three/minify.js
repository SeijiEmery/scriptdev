
var compressor = require('node-minify');

var src_files = [
	'Box2.js',
	'Box3.js',
	'Color.js',
	'Euler.js',
	'Frustrum.js',
	'Line3.js',
	'Math.js',
	'Matrix3.js',
	'Matrix4.js',
	'Plane.js',
	'Quaternion.js',
	'Ray.js',
	'Sphere.js',
	'Spline.js',
	'Triangle.js',
	'Vector2.js',
	'Vector3.js',
	'Vector4.js'
]
var three_src = 'Three.js'

// Generate minified standalone files
src_files.forEach(function(standalone) {
	new compressor.minify({
		type: 'gcc',
		fileIn: [three_src, 'math/src/' + standalone],
		fileOut: 'math/' + standalone.replace('.js', '.min.js'),
		callback: function(err, min) {
			console.log(err)
		}
	});
});

// Generate minified library
var lib_files = ['Three.js']
src_files.forEach(function(src) {
	lib_files.push('math/src/' + src);
});
new compressor.minify({
	type: 'gcc',
	fileIn: lib_files,
	fileOut: 'math.min.js',
	callback: function(err, min) {
		console.log(err)
	}
})
