var _ = require('lodash');
var zlib = require('zlib')

var vtpbf = require('vt-pbf')
var geojsonVt = require('geojson-vt')

module.exports = function(options) {
    options = _.defaults(options,{
        strict:false,
        layers:null,
        gzip:false,
        types:['application/geo+json'],
    });
    
    return {
        name: 'tilestrata-geojson-vt',
        transform: function(server, tile, buffer, headers, callback) {
            if(_.findIndex(options.types,(o)=>{
                return headers["Content-Type"] === o;
            }) == -1){

                callback("tilestrata-geojson-vt Content-Type error:" + headers["Content-Type"]);
                return;
            }

            var x = tile["x"],
            y = tile["y"],
            z = tile["z"];

            var orig = JSON.parse(buffer)
            var vectorLayers = {};
            for(var i in orig){
                var data = orig[i];
                var tileindex = geojsonVt(data,{maxZoom:24,indexMaxZoom:24,extent:4096})
                var tile = tileindex.getTile(z, x, y)
                if(tile == null){
                    tile = tileindex.getTile(1, 0, 0);
                }
                if(tile == null){
                    continue;
                }
                vectorLayers[i] = tile;
            }
            // pass in an object mapping layername -> tile object
            var buff = new Buffer(vtpbf.fromGeojsonVt(vectorLayers,{"version":2}))
            if(options.gzip){
                zlib.gzip(buff,function(err,result){
                    if(err){
                        callback(err);
                        return;
                    }
                    buff = new Buffer(result);
                    headers["Content-Encoding"] = 'gzip';
                    headers['Content-Length'] = buff.length;
                    headers["Content-Type"] = 'application/x-protobuf';
                    callback(null,buff,headers);
                })
            }else{
                headers['Content-Length'] = buff.length;
                headers["Content-Type"] = 'application/x-protobuf';
                callback(null,buff,headers);
            }
        }
    };
};