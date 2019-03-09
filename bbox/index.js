var d3geo = require("d3-geo")

var TAU = 2 * Math.PI;
var TILESIZE = 256;

function geoExtent(min, max) {
 	if (min && min.length === 2 && min[0].length === 2 && min[1].length === 2) {
        this[0] = min[0];
        this[1] = min[1];
    } else {
        this[0] = min        || [ Infinity,  Infinity];
        this[1] = max || min || [-Infinity, -Infinity];
    }

    this.rectangle = function() {
        return [this[0][0], this[0][1], this[1][0], this[1][1]];
    }
    this.toParam = function() {
        return this.rectangle().join(',');
    }
}

function geoZoomToScale(z, tileSize) {
    tileSize = tileSize || 256;
    return tileSize * Math.pow(2, z) / TAU;
}

var kMin = geoZoomToScale(2, TILESIZE);
var kMax = geoZoomToScale(24, TILESIZE);

function getExtents(X,Y,Z){
	var _tileSize = 256;
	var log2ts = Math.log(_tileSize) * Math.LOG2E;
    var ts = Math.pow(2, log2ts);

	var projection = {}
	projection.k = Math.max(kMin, Math.min(kMax, geoZoomToScale(Z, TILESIZE)));
	projection.x = projection.k / 2 - X * ts
	projection.y = projection.k / 2 - Y * ts

	var origin = [
        projection.k * Math.PI - projection.x,
        projection.k * Math.PI - projection.y
    ];

	var x = X * ts - origin[0];
    var y = Y * ts - origin[1];

	function invert(point) {
        point = d3geo.geoMercatorRaw.invert((point[0] - projection.x) / projection.k, (projection.y - point[1]) / projection.k);
        return point && [point[0] * 180 / Math.PI, point[1] * 180 / Math.PI];
    };

    return new geoExtent(invert([x,y+ts]),invert([x+ts,y]))
}

var SphericalMercator = require('@mapbox/sphericalmercator');
var sm = new SphericalMercator({ size: 256 });

module.exports = function(options) {
	var X = parseInt(options["x"]),
	Y = parseInt(options["y"]),
	Z = parseInt(options["z"]);

    var bbox = sm.bbox(X, Y, Z);
    // return bbox.join(",");
	return getExtents(X,Y,Z).toParam();
	// return "113.8897705078125,22.527779798694564,113.89526367187499,22.53285370752713";
}