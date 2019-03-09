var _ = require('lodash');
var async = require("async")
var zlib = require('zlib')
var Pbf = require('pbf')
var VectorTile = require('vector-tile').VectorTile

module.exports = function(options) {
    options = _.defaults(options,{
        strict:false,
        layers:null,
        discard:0,
        forceGzip:false,
        filter:null,
    });
    
    return {
        name: 'tilestrata-vt-geojson',
        transform: function(server, tile, buffer, headers, callback) {
            if(!(headers["Content-Type"] === 'application/x-protobuf'
                || headers["Content-Type"] === 'application/octet-stream'
                )){
                callback("tilestrata-vt-geojson Content-Type error:" + headers["Content-Type"]);
                return;
            }
            var gzip = (headers["Content-Encoding"] === 'gzip');
            if(!gzip) gzip = options.forceGzip;
            delete headers["Content-Encoding"];
            
            var x = tile["x"],
            y = tile["y"],
            z = tile["z"];

            (function(callback){
                if(gzip){
                    zlib.gunzip(buffer,function(err,result){
                        if(err){
                            callback(err)
                            return;
                        }
                        processTile(result,callback)
                    });
                }else{
                    processTile(buffer,callback)
                }
            }(function(err,json){
                if(err){
                    callback(err)
                    return;
                }
                var data = new Buffer.from(JSON.stringify(json));
                headers['Content-Length'] = data.length;
                headers['Content-Type'] = "application/geo+json";
                callback(null,data,headers)
            }))
            

            function processTile(tiledata,callback){
                var vt = new VectorTile(new Pbf(tiledata))

                var geojson = {};
                var layers = _.keys(vt.layers)
                for (var j = 0; j < layers.length; j++) {
                    var ln = layers[j]
                    if (options.layers) {
                        if(options.layers.length > 0){
                            if(_.indexOf(options.layers,ln) >= 0){
                                if(options.discard == 1){
                                    continue;
                                }
                            }else if(options.discard == -1){
                                continue;
                            }
                        }
                    }
                    
                    var layer = vt.layers[ln]
                    var features = [];
                    for (var i = 0; i < layer.length; i++) {
                        try {
                            var feat = layer.feature(i).toGeoJSON(x, y, z)
                            if(options.filter){
                                if(options.filter(feat)){
                                    features.push(feat);
                                }
                            } else{
                                features.push(feat);
                            }
                        } catch (e) {
                            var error = new Error(
                            'Error reading feature ' + i + ' from layer ' + ln + ':' + e.toString()
                            )
                            if (options.strict) {
                                callback(error)
                                return;
                            }
                            console.log(error);
                        }
                    }
                    if(features.length > 0){
                        geojson[ln] = {
                            "type": "FeatureCollection",
                            "features":features,
                        };
                    }
                }
                if(_.keys(geojson).length == 0){
                    geojson = '';
                }
                callback(null,geojson)
            }
        }
    };
};