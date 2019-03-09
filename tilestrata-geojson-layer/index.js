var _ = require('lodash');
var async = require("async")
var zlib = require('zlib')

module.exports = function(options) {
    options = _.defaults(options,{
        layer:null
    });
    
    return {
        name: 'tilestrata-geojson-layer',
        transform: function(server, tile, buffer, headers, callback) {
            if(headers['Content-Type'] !== "application/geo+json") {
                callback("tilestrata-geojson-layer Content-Type error:" + headers["Content-Type"]);
                return;
                
            }
            function getLayerName(feature){
                if(!feature) {
                    return null;
                }
                if(options.layer){
                    return options.layer(feature)
                }
                return null;
            }
            let result = {};
            let collections = JSON.parse(buffer);
            for(let name in collections){
                let collection = collections[name];
                if(collection && collection["type"] === 'FeatureCollection') {
                    let features = collection["features"];
                    for(let index in features){
                        let feature = features[index];
                        if(feature){
                            let layerName = getLayerName(feature);
                            if(!layerName){
                                layerName = name;
                            }
                            if(!(layerName in result)){
                                result[layerName] = {
                                    'type':'FeatureCollection',
                                    'features':[]
                                }
                            }
                            result[layerName]['features'].push(feature);
                            
                        }
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
};