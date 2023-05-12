/**
 * Demonstration using ArcGIS API for JavaScript to load several different layers to exercise the API
 * and monitor what usage looks like for these layer services.
 */
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

  // Trail heads is a public hosted feature layer of points.
  // For trail heads, create the feature symbol renderer, feature labels, and feature layer

  const trailheadsRenderer = {
    "type": "simple",
    "symbol": {
      "type": "picture-marker",
      "url": "http://static.arcgis.com/images/Symbols/NPS/npsPictograph_0231b.png",
      "width": "18px",
      "height": "18px"
    }
  }

  const trailheadsLabels = {
    symbol: {
      type: "text",
      color: "#FFFFFF",
      haloColor: "#5E8D74",
      haloSize: "2px",
      font: {
        size: "12px",
        family: "Noto Sans",
        style: "italic",
        weight: "normal"
      }
    },

    labelPlacement: "above-center",
    labelExpressionInfo: {
      expression: "$feature.TRL_NAME"
    }
  };

  const trailheads = new FeatureLayer({
    url: "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Trailheads/FeatureServer/0",
    renderer: trailheadsRenderer,
    labelingInfo: [trailheadsLabels]
  });

  map.layers.add(trailheads);

  // Trails is a public hosted feature layer of polylines.
  // For the trails, define a unique value renderer and symbols to show polylines

  const trailsRenderer = {
    type: "simple",
    symbol: {
      color: "#BA55D3",
      type: "simple-line",
      style: "solid"
    },

    visualVariables: [
      {
        type: "size",
        field: "ELEV_GAIN",
        minDataValue: 0,
        maxDataValue: 2300,
        minSize: "3px",
        maxSize: "7px"
      }
    ]
  };

  const trails = new FeatureLayer({
    url: "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Trails/FeatureServer/0",
    renderer: trailsRenderer,
    opacity: .75
  });

  map.layers.add(trails, 0);

  // Add bikes only trails

  const bikeTrailsRenderer = {
    type: "simple",
    symbol: {
      type: "simple-line",
      style: "short-dot",
      color: "#FF91FF",
      width: "1px"
    }
  };

  const bikeTrails = new FeatureLayer({
    url: "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Trails/FeatureServer/0",
    renderer: bikeTrailsRenderer,
    definitionExpression: "USE_BIKE = 'YES'"
  });

  map.add(bikeTrails, 1);

  // Parks and Open Space is a public hosted feature layer of polygons.
  // Add parks with a class breaks renderer and unique symbols

  function createFillSymbol(value, color) {
    return {
      "value": value,
      "symbol": {
        "color": color,
        "type": "simple-fill",
        "style": "solid",
        "outline": {
          "style": "none"
        }
      },
      "label": value
    };
  }

  const openSpacesRenderer = {
    type: "unique-value",
    field: "TYPE",
    uniqueValueInfos: [
      createFillSymbol("Natural Areas", "#9E559C"),
      createFillSymbol("Regional Open Space", "#A7C636"),
      createFillSymbol("Local Park", "#149ECE"),
      createFillSymbol("Regional Recreation Park", "#ED5151")
    ]
  };

  const openspaces = new FeatureLayer({
    url: "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Parks_and_Open_Space/FeatureServer/0",
    renderer: openSpacesRenderer,
    opacity: 0.2
  });

  map.layers.add(openspaces, 0);

  // Transportation is a premium hosted tile layer that requires authentication.
  // Transportation layer uses Tile layer

  const transportationLayer = new TileLayer({
    url: "https://server.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer",
    id: "transportation",
    opacity: 0.9
  });
  map.layers.add(transportationLayer);

  // Traffic layer uses Map image tile layer, requires valid authentication

  const trafficLayerURL = "https://traffic.arcgis.com/arcgis/rest/services/World/Traffic/MapServer";
  const trafficLayer = new MapImageLayer({
    url: trafficLayerURL,
    id: "traffic",
    opacity: 1
  });
  map.layers.add(trafficLayer);

});
