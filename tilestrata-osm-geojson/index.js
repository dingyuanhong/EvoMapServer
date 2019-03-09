var _ = require('lodash');
var async = require("async")
var zlib = require('zlib')

const osm2geojson = require('osm2geojson-lite');

module.exports = function(options) {
    options = _.defaults(options,{
        name:'',
        layers:null,
    });
    
    return {
        name: 'tilestrata-osm-geojson',
        transform: function(server, tile, buffer, headers, callback) {
            let json = osm2geojson(buffer,{
                completeFeature :true,
                allFeatures:true,
                renderTagged:true,
                suppressWay :true
            });
            var name = options['name'];
            var result = {};
            if(name != ''){
                result[name] = json;
            }else{
                result = json;
            }
            if(_.keys(result).length == 0){
                result = '';
            }
            var data = new Buffer.from(JSON.stringify(result));
            delete headers['content-type'];
            delete headers['transfer-encoding'];
            delete headers['content-disposition'];
            delete headers['cache-control'];
            delete headers["Content-Encoding"];
            headers['Content-Length'] = data.length;
            headers['Content-Type'] = "application/geo+json";
            callback(null,data,headers)
        }
    };
};