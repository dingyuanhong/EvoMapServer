##1.下载pbf数据(相对下载数据量小)

https://planet.openstreetmap.org/
https://download.geofabrik.de/


##2.创建数据库
psql:
CREATE DATABASE gis;
CREATE EXTENSION postgis;
CREATE EXTENSION hstore;

##3.导入数据语句说明
###普通导入
```
osm2pgsql -s -U postgres -P 5432 -d gis /data/wwwroot/tile/osm/import/antarctica-latest.osm.pbf
```
###加入样式导入
```
osm2pgsql -s -U postgres -P 5432 -d gis /data/wwwroot/tile/osm/import/antarctica-latest.osm.pbf --style /data/wwwroot/tile/tile/openstreetmap-carto/openstreetmap-carto.style
```
###加入tags及样式导入
```
osm2pgsql -G --hstore -d gis /data/wwwroot/tile/osm/import/antarctica-latest.osm.pbf --style /data/wwwroot/tile/tile/openstreetmap-carto/openstreetmap-carto.style --tag-transform-script /data/wwwroot/tile/tile/openstreetmap-carto/scripts/lua/openstreetmap-carto.lua
```
####导入地图说明
####https://blog.csdn.net/cao812755156/article/details/80919521

##4.下载样式
#https://github.com/giggls/openstreetmap-carto-de/blob/master/INSTALL.md
###
按照步骤生成数据库

```
#!/bin/sh

#/data/wwwroot/tile/tileserver/vector-datasource/data
cd $(pwd)/shapefile_schema

for files in `find  $1 -name "*.sql"`
do
    echo $files
    psql --set ON_ERROR_STOP=on -X -q  -f $files -h $HOST -p $PORT -U postgres -d postgres 
done
```

###安装数据及字体
cd /data/wwwroot/tile/tile/openstreetmap-carto/

carto project.mml > mapnik.xml

cd ..

#https://www.cnblogs.com/think8848/p/6241836.html
##5.安装数据导入工具

sudo apt install osm2pgsql

##6.导入亚洲地图
```
osm2pgsql -G --hstore -d gis /data/wwwroot/tile/osm/import/asia-latest.osm.pbf \
--style /data/wwwroot/tile/tile/openstreetmap-carto/openstreetmap-carto.style \
--tag-transform-script /data/wwwroot/tile/tile/openstreetmap-carto/scripts/lua/openstreetmap-carto.lua
```
##完整导入数据命令
```
osm2pgsql --slim  -G --hstore -d gis /data/wwwroot/tile/osm/import/asia-latest.osm.pbf \
--style /data/wwwroot/tile/tile/openstreetmap-carto/openstreetmap-carto.style \
--tag-transform-script /data/wwwroot/tile/tile/openstreetmap-carto/scripts/lua/openstreetmap-carto.lua -C 10000
```

##7.生成索引，导入后生成索引避免导入速度过慢，ps:普通机器导入数据耗时7天
psql -d gis -f /data/wwwroot/tile/tile/openstreetmap-carto/indexes.sql


