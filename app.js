
var _ = require('lodash');
var nik = require("mapnik")
nik.register_system_fonts();
nik.register_default_input_plugins();

var mapnik = require('tilestrata-mapnik');
var disk = require('tilestrata-disk');
var tilestrataPostGISGeoJSON = require('tilestrata-postgis-geojson-tiles');
// var postgismvt = require('tilestrata-postgismvt');
var querystring = require('querystring');
// var headers = require('tilestrata-headers');
// var etag = require('tilestrata-etag');

var vtile = require('tilestrata-vtile');
var vtileraster = require('tilestrata-vtile-raster');

var proxy = require('tilestrata-proxy');
var dependency = require('tilestrata-dependency');

var vtjson = require("./tilestrata-vt-geojson");
var jsonvt = require("./tilestrata-geojson-vt");
var osmjson = require("./tilestrata-osm-geojson");
var geojsonlayer = require("./tilestrata-geojson-layer");
var BBox = require('./bbox');
var vtilecomposite = require('tilestrata-vtile-composite'); //合并PBF

var tilestrata = require('tilestrata');
var server = tilestrata();

var LayerPostgis = function(options) {
    options = _.defaults(options,{
        layer:'layer'
    });
    
    return {
        name: 'tilestrata-geojson-postgis',
        transform: function(server, tile, buffer, headers, callback) {
            if(!(headers['Content-Type'] === "application/json"
            )) {
                callback("LayerPostgis Content-Type error:" + headers["Content-Type"]);
                return;
            }
            let collection = JSON.parse(buffer);
            for(let i in collection["features"]){
                let feature = collection["features"][i];
                let properties = feature["properties"];
                for(let j in properties){
                    if(properties[j] == null){
                        delete properties[j];
                    }
                }
                if(properties['tags'] === ''){
                    delete properties['tags']
                } else{
                    delete properties['tags']
                }
                delete properties['way'];
                delete properties['BBOX'];
                delete properties['bbox'];
            }
            let collections = {}
            collections[options.layer] = collection;

            var data = new Buffer.from(JSON.stringify(collections));
            headers['Content-Length'] = data.length;
            headers['Content-Type'] = "application/geo+json";
            callback(null,data,headers)
        }
    };
};

var LayerMerge = function(options) {
    options = _.defaults(options,{
        layer:''
    });
    
    return {
        name: 'tilestrata-geojson-merge',
        transform: function(server, tile, buffer, headers, callback) {
            if(headers['Content-Type'] !== "application/geo+json") {
                callback("FeatureCollection Content-Type error:" + headers["Content-Type"]);
                return;
            }
            let features_result = [];
            let collections = JSON.parse(buffer);
            for(let i in collections){
                let collection = collections[i];
                let features = collection["features"];
                for(let j in features) {
                    if("properties" in features[j]){
                        features[j]["properties"]["layer"] = i;
                    }
                }
                features_result = features_result.concat(features)
            }
            collections = {}
            if(features_result.length > 0){
                if(options.layer.length > 0){
                    collections[options.layer] = {
                        "type":"FeatureCollection",
                        "features":features_result
                    };
                } else {
                    collections = {
                        "type":"FeatureCollection",
                        "features":features_result
                    };
                }
            } else {
                collections = '';
            }
            
            var data = new Buffer.from(JSON.stringify(collections));
            headers['Content-Length'] = data.length;
            headers['Content-Type'] = "application/geo+json";
            callback(null,data,headers)
        }
    };
}

var LayerFilter = function(options) {
    options = _.defaults(options,{
        layers:[],
        discard:0,
        filter:null,
    });
    
    function filter(name,collection){
        if(!collection) return;
        if(!options.filter) return;
        let features = [];
        for(let i in collection['features']) {
            let feature = collection['features'][i]
            if(options.filter(feature,name)){
                features.push(feature);
            }
        }
        collection['features'] = features;
    }

    return {
        name: 'tilestrata-geojson-layerfilter',
        transform: function(server, tile, buffer, headers, callback) {
            if(headers['Content-Type'] !== "application/geo+json") {
                callback("LayerFilter Content-Type error:" + headers["Content-Type"]);
                return;
            }
            let result = {};
            let layers = options.layers;
            let collections = JSON.parse(buffer);
            for(let i in collections){
                let index = _.indexOf(layers,i)
                if(index >= 0) {
                    if(options.discard <= 0){
                        result[i] = collections[i];
                        if(options.filter){
                            filter(i,result[i]);
                        }
                    }
                } else if(options.discard >= 0){
                    result[i] = collections[i];
                    if(options.filter){
                        filter(i,result[i]);
                    }
                }
            }

            if(_.keys(result).length == 0){
                result = '';
            }
            var data = new Buffer.from(JSON.stringify(result));
            headers['Content-Length'] = data.length;
            headers['Content-Type'] = "application/geo+json";
            callback(null,data,headers)
        }
    };
}

var LayerName = function(options) {
    options = _.defaults(options,{
        layers:{},
        discard:0
    });
    
    return {
        name: 'tilestrata-geojson-layer',
        transform: function(server, tile, buffer, headers, callback) {
            if(!(headers['Content-Type'] === "application/json"
                || headers['Content-Type'] === "application/geo+json")
                ) {
                callback("LayerName Content-Type error:" + headers["Content-Type"]);
                return;
            }

            let result = {};
            let layers = _.keys(options.layers);
            let collections = JSON.parse(buffer);
            for(let i in collections){
                let index = _.indexOf(layers,i)
                if(index >= 0) {
                    if(options.discard <= 0){
                        result[options.layers[layers[index]]] = collections[i];
                    }
                } else if(options.discard >= 0){
                    result[i] = collections[i];
                }
            }

            if(_.keys(result).length == 0){
                result = '';
            }
            var data = new Buffer.from(JSON.stringify(result));
            headers['Content-Length'] = data.length;
            headers['Content-Type'] = "application/geo+json";
            callback(null,data,headers)
        }
    };
}

server
    .layer("base")
        .route('t.source')
            .use(vtile({
                xml: './mapnik.xml',
                tileSize: 256,
                metatile: 1,
                bufferSize: 128
            }))
            .use(disk.cache({dir: './.tilecache/pbf'}))
        .route('t.geojson')
            .use(dependency('base', 't.source'))
            .use(vtjson({forceGzip:true}))
            .use(LayerFilter({
                filter:function(feature,name){
                    if("properties" in feature){
                        feature["properties"]["layer"] = name;
                    }
                    return true;
                }
            }))
        .route('t.pbf')
            .use(dependency('base', 't.geojson'))
            .use(jsonvt({gzip:true}))
            .use(disk.cache({dir: './.tilecache/pbfa'}))
        .route('t.png')
            .use(vtileraster(
                {
                    xml: './mapnik.xml',
                    tileSize: 256,
                    metatile: 1,
                    bufferSize: 128
                }, 
                {
                tilesource: ['base', 't.source']
            }))
            .use(disk.cache({dir: './.tilecache/tpng'}))
        .route('tile.png')
            .use(mapnik({
                pathname: './mapnik.xml',
                scale: 1,
                tileSize: 256
            }))
            .use(disk.cache({dir: './.tilecache/png'}))

server.layer('discard')
        .route('t.geojson')
            .use(dependency('base', 't.geojson'))
            .use(LayerFilter({layers:[
                    "world",
                    //内陆水域
                    "water-lines-text",
                    "waterway-bridges",
                    "water-barriers-points",
                    "water-barriers-poly",
                    "water-barriers-line",
                    "water-lines",
                    "water-areas",
                    "water-lines-low-zoom",
                    "water-lines-casing",
                    //建筑
                    "building-text",
                    "buildings",
                    //设施点
                    "amenity-low-priority-poly",
                    "amenity-low-priority",
                    "amenity-points",
                    "amenity-line",
                    "amenity-points-poly",
                    //海岸线
                    "coast-poly",
                    //主权区域
                    "admin-high-zoom",
                    "admin-mid-zoom",
                    "admin-low-zoom",
                    //线路
                    "roads-low-zoom",

                    "admin-text",
                    "ferry-routes-text",
                    
                    "bridge-text",
                    "text",
                    "text-line",
                    "text-poly",
                    "text-poly-low-zoom",
                    "text-point",

                    "railways-text-name",
                    "paths-text-name",
                    "roads-text-name",
                    "roads-area-text-name",
                    
                    "state-names",
                    "capital-names",
                    "country-names",

                    "roads-text-ref",
                    "roads-text-ref-low-zoom",

                    "power-poles",
                    "power-towers",
                    "stations-poly",

                    "placenames-small",
                    "placenames-medium",

                    "national-park-boundaries",
                    "piers-line",
                    "piers-poly",
                    "power-line",
                    "power-minorline",
                    "turning-circle-fill",
                    "roads-fill",
                    "highway-area-fill",

                    "roads-casing",
                    "highway-area-casing",
                    "turning-circle-casing",
                    "area-barriers",
                    "line-barriers",
                    "landuse-overlay",
                    "marinas-area",
                    "ferry-routes",
                    "nature-reserve-boundaries",
                    "nature-reserve-text",
                    "tourism-boundary",

                    "guideways",
                    "aerialways",
                    "addresses",
                    "interpolation",
                    "junctions",
                    "stations",
                    "trees",
                    "aeroways",
                    "entrances",
                    "bridges",
                    "bridge",
                    "cliffs",
                    "tunnels",
                    "springs",
                    "features",

                    "landcover",
                    "landcover-area-symbols",
                    "landcover-line",
                    "landcover-low-zoom",
                ],
                discard:1,
            }))
        .route('t.pbf')
            .use(dependency('discard', 't.geojson'))
            .use(jsonvt({gzip:true}))

server.layer('sql', {minZoom: 8, maxZoom: 24})
        .route('t.geojson')
            .use(tilestrataPostGISGeoJSON({
                geometryField: 'way',
                sql: function(server, req) {
                    // var qs = querystring.parse(req.qs);
                    // var id = qs && qs.id ? parseInt(qs.id, 10) : null;
                    // var type = qs && qs.type ? type : "nodes";
                    // return 'SELECT  *, {geojson} FROM planet_osm_line WHERE ST_Intersects(way, {bbox}) AND  highway IS NOT NULL';
                    return "SELECT  *, ST_AsGeoJSON(ST_Transform(way,4326)) as geojson " + 
                    "FROM planet_osm_line WHERE " + 
                    "ST_Intersects(way, {bbox}) AND  " + 
                    // "highway IS NOT NULL"
                    "highway IN ('secondary','primary','tertiary')"
                    ;
                },
                pgConfig: {
                    username: 'postgres',
                    // password: '',
                    host: '10.30.200.73',
                    port: '5432',
                    database: 'gis'
                }
            }))
            .use(LayerPostgis({
                layer:"RoadNet",
            }))
        .route('t.pbf')
            .use(dependency('sql', 't.geojson'))
            .use(jsonvt({
                gzip:true,
                types:['application/geo+json','application/x-geojson']
                })
            )

server
    .layer("osm")
        .route('t.osm')
            .use(proxy({uri: tile => {
                    return "http://10.30.200.73:3000/api/0.6/map?bbox=" + BBox(tile);
                }
            }))
        .route('t.geojson')
            .use(dependency('osm', 't.osm'))
            .use(osmjson({name:'Standard'}))
            .use(geojsonlayer({layer:function(feature){
                if("properties" in feature) {
                    if("layer" in feature["properties"]) {
                        return feature["properties"]["layer"];
                    }
                }
                return null;
            }}))
        .route('t.pbf')
            .use(dependency('osm', 't.geojson'))
            .use(jsonvt({gzip:true}))

server
    .layer("roadnet")
        .route('t.sql')
            .use(tilestrataPostGISGeoJSON({
                geometryField: 'way',
                buffer:4096,
                sql: function(server, req) {
                    let tile = req;
                    return "SELECT  *, ST_AsGeoJSON(ST_Transform(way,4326)) as geojson " + 
                    "FROM planet_osm_line " +
                    ",ST_Transform({bbox},900913) AS BBOX " + 
                    "WHERE (" + 
                    "ST_Intersects(way, BBOX) or " + 
                    "ST_Contains(BBOX,way) or " +
                    "ST_Crosses(BBOX,way) " +
                    ") and " + 
                    // "ST_Intersects(way,tilebbox(" + tile.z + "," + tile.x + "," + tile.y + "," + 900913 +")) and "+ 
                    // "highway IS NOT NULL"
                    "highway IN ('secondary','primary','tertiary')"
                    ;
                },
                pgConfig: {
                    username: 'postgres',
                    database: 'gis'
                }
            }))
            .use(LayerPostgis({
                layer:"RoadNet",
            }))
            .use(disk.cache({dir: './.tilecache/roadnet'}))
        .route("t.geojson")
            .use(dependency('osm', 't.geojson'))
            .use(LayerName({
                layers:{
                    "roadnet":"BaoAnRoadNetV1.04"
                },
                discard:-1,
            }))
        .route('t.pbf')
            .use(dependency('roadnet', 't.sql'))
            .use(jsonvt({
                gzip:true,
                types:['application/geo+json','application/x-sql']
                })
            )

server
    .layer("landbase")
        .route("t.geojson")
            .use(dependency('osm', 't.geojson'))
            .use(LayerName({
                layers:{
                    "landbase":"BaoAnBaseLandLayerV1.0"
                },
                discard:-1,
            }))
        .route('t.pbf')
            .use(dependency('landbase', 't.geojson'))
            .use(jsonvt({gzip:true}))

server
    .layer("tree")
        .route("t.geojson")
            .use(dependency('osm', 't.geojson'))
            .use(LayerName({
                layers:{
                    "accessories":"BaoAnAccesoriesLayerV1.0"
                },
                discard:-1,
            }))
        .route('t.pbf')
            .use(dependency('tree', 't.geojson'))
            .use(jsonvt({gzip:true}))

server
    .layer("water")
        .route('t.geojson')
            .use(dependency('base', 't.geojson'))
            .use(LayerFilter({layers:[
                //内陆水域
                "water-lines-text",
                "waterway-bridges",
                "water-barriers-points",
                "water-barriers-poly",
                "water-barriers-line",
                "water-lines",
                "water-areas",
                "water-lines-low-zoom",
                "water-lines-casing",
                ],
                discard:-1,
            }))
            .use(LayerMerge({"layer":"water"}))
            .use(disk.cache({dir: './.tilecache/water'}))
        .route('t.pbf')
            .use(dependency('water', 't.geojson'))
            .use(jsonvt({gzip:true}))

server
    .layer("building")
        .route('t.sql')
            .use(tilestrataPostGISGeoJSON({
                geometryField: 'way',
                buffer:256,
                sql: function(server, req) {
                    return "SELECT  name,building,amenity,aeroway,aerialway,tags->'building:levels' as floor,tags->'public_transport' as public_transport," + 
                    " ST_AsGeoJSON(ST_Transform(way,4326)) as geojson " + 
                    "FROM planet_osm_polygon" + 
                    ",ST_Transform({bbox},900913) AS BBOX " + 
                    "WHERE (" + 
                    "ST_Intersects(way, BBOX)" + 
                    " or " +
                    "ST_Contains(BBOX,way) " +
                    " or " +
                    "ST_Crosses(BBOX,way) " +
                    ") and " + 
                    "building IS NOT NULL AND building != 'no'"
                    ;
                },
                pgConfig: {
                    username: 'postgres',
                    database: 'gis'
                }
            }))
            .use(LayerPostgis({
                layer:"building",
            }))
            .use(LayerFilter({
                layers:["building"],
                discard:-1,
                filter:function(feature){
                    function random(min,max){
                        return parseInt(Math.random()*(max-min+1)+min,10);
                    }
                    let properties = feature['properties'];
                    properties['layer'] = 'building';
                    if(!('floor' in properties)) {
                        properties['floor'] = random(1,30);
                    }
                    return true;
                }
            }))
            .use(LayerName({
                layers:{
                    // "building":"EvoGisDemoV1.50"
                    // "building":"EvoGisDemoV1.52"
                    "building":"BaoAnRefinedBuildingV1.3"
                },
                discard:0
            }))
            //.use(disk.cache({dir: './.tilecache/building'}))
        .route('t.source')
            .use(vtile({
                xml: './building.xml',
                tileSize: 256,
                metatile: 1,
                bufferSize: 128
            }))
        .route('t.geojson')
            .use(dependency('building', 't.source'))
            .use(vtjson({forceGzip:true}))
            .use(LayerFilter({
                layers:["building"],
                discard:-1,
                filter:function(feature){
                    function random(min,max){
                        return parseInt(Math.random()*(max-min+1)+min,10);
                    }
                    let properties = feature['properties'];
                    properties['layer'] = 'building';
                    if(!('floor' in properties)) {
                        properties['floor'] = random(1,30);
                    }
                    return true;
                }
            }))
            .use(LayerName({
                layers:{
                    // "building":"EvoGisDemoV1.50"
                    // "building":"EvoGisDemoV1.52"
                    "building":"BaoAnRefinedBuildingV1.3"
                },
                discard:0
            }))
        .route('t.pbf')
            .use(dependency('building', 't.sql'))
            .use(jsonvt({
                gzip:true,
                types:['application/geo+json','application/x-sql']
                })
            )

server
    .layer("m",{minZoom: 14, maxZoom: 24})
    .route('t.pbf')
            .use(vtilecomposite([
                // ['base', 't.pbf'],
                // ['discard', 't.pbf'],
                // ['osm', 't.pbf'],
                // ['sql', 't.pbf'],
                // ['roadnet', 't.pbf'],
                // ['tree','t.pbf'],
                // ['landbase','t.pbf'],
                // ['water','t.pbf'],
                ['building','t.pbf'],
            ]))
    .route('t.geojson')
            .use(dependency('m', 't.pbf'))
            .use(vtjson({forceGzip:true}))
    .route('t.mvt')
            .use(dependency('m', 't.pbf'))
    .route('t.geo')
            .use(dependency('m', 't.pbf'))
            .use(jsonvt({gzip:true}))
            .use(vtjson({}))

server.listen(8080, function(err) {
	console.log('Listening on 8080...');
    if(err){
        console.log(err);
        process.exit(0);
    }
});

process.on('SIGTERM', function() {
	server.close(function() {
		process.exit(0);
	});
});
