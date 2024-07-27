/**
 * Demonstration using ArcGIS API for JavaScript to load several different layers to exercise the API
 * and monitor what usage looks like for these layer services.
 */
const transportationServiceURL = "https://server.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer";
const trafficLayerURL = "https://traffic.arcgis.com/arcgis/rest/services/World/Traffic/MapServer";

require([
    "esri/config",
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/FeatureLayer",
    "esri/layers/MapImageLayer",
    "esri/layers/TileLayer",
], function(esriConfig, Map, MapView, FeatureLayer, MapImageLayer, TileLayer ) {

  esriConfig.apiKey = YOUR_API_KEY;

  const map = new Map({
    basemap: "arcgis-navigation"
  });

  const view = new MapView({
    container: "viewDiv",
    map: map,
    center: [-118.80543, 34.02700],
    zoom: 13
  });

  // Transportation is a premium hosted tile layer that requires authentication.
  // Transportation layer uses Tile layer

  const transportationLayer = new TileLayer({
    url: transportationServiceURL,
    id: "transportation",
    opacity: 0.9
  });
  map.layers.add(transportationLayer);

  // Traffic layer uses Map image tile layer, requires valid authentication

  const trafficLayer = new MapImageLayer({
    url: trafficLayerURL,
    id: "traffic",
    opacity: 1
  });
  map.layers.add(trafficLayer);

});
