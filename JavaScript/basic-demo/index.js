/**
 * A very basic ArcGIS API for JavaScript demo, mostly taken from tutorial
 * code found on https://developers.arcgis.com/javascript/latest/.
 * 
 * You can run index.html in a browser, but it may work better if loaded from a webserver.
 * See the accompanying `npm start` script that runs a local development server with express.js.
 */
require([
    "esri/config",
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/FeatureLayer"
], function(esriConfig, Map, MapView, FeatureLayer) {
    esriConfig.apiKey = YOUR_API_KEY; // this is loaded from secret.js so my API key is not public :)

    // Choose the basemap, see https://developers.arcgis.com/javascript/latest/api-reference/esri-Map.html#basemap
    const map = new Map({
        basemap: "arcgis-navigation"
    });

    // set the MapView to a <div id="viewDiv"> on the page
    const view = new MapView({
        container: "viewDiv",
        map: map,
        center: [-118.80543,34.02700],
        zoom: 13
    });

    // Show data on the map by loading various layers and configure the layers based on what we want in the app.

    // observations layer
    const popupObservations = {
        "title": "{Observation}",
        "content": "<b>Date:</b>{Date}"
    };
    const observationMarker = {
        type: "simple",
        symbol: {
            type: "picture-marker",
            url: "https://arcgis.github.io/arcgis-samples-javascript/sample-data/cat3.png",
            width: 32,
            height: 32
        }
    }
    const observationsLayer = new FeatureLayer({
        url: "https://services8.arcgis.com/PxLlS7hS3gd7MX6c/arcgis/rest/services/malibuobservations/FeatureServer/0",
        outFields: ["Observation","Date"],
        popupTemplate: popupObservations,
        renderer: observationMarker
    });
    map.add(observationsLayer, 0);

    // Trailheads feature layer (points) and pop-up template (see https://developers.arcgis.com/javascript/latest/api-reference/esri-PopupTemplate.html)
    const popupTrailheads = {
        "title": "{TRL_NAME}",
        "content": "<b>City:</b> {CITY_JUR}<br><b>Cross Street:</b> {X_STREET}<br><b>Parking:</b> {PARKING}<br><b>Elevation:</b> {ELEV_FT} ft"
    }
    const trailheadsLayer = new FeatureLayer({
        url: "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Trailheads_Styled/FeatureServer/0",
        outFields: ["TRL_NAME","CITY_JUR","X_STREET","PARKING","ELEV_FT"],
        popupTemplate: popupTrailheads
    });
    map.add(trailheadsLayer);

    // Trails feature layer (lines)
    const trailsLayer = new FeatureLayer({
        url: "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Trails_Styled/FeatureServer/0"
    });
    map.add(trailsLayer, 0);

    // Parks and open spaces (polygons)
    const parksLayer = new FeatureLayer({
        url: "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Parks_and_Open_Space_Styled/FeatureServer/0"
    });
    map.add(parksLayer, 0);

    // climate layer
    var climateExpressions = [
        {
          name: "exprmeantemp",
          title: "Mean annual temperature (F)",
          expression: "Floor(Mean($feature.Mean_T_f_01_Jan, $feature.Mean_T_f_02_Feb,$feature.Mean_T_f_03_Mar, $feature.Mean_T_f_04_Apr,$feature.Mean_T_f_05_May, $feature.Mean_T_f_06_Jun,$feature.Mean_T_f_07_Jul, $feature.Mean_T_f_08_Aug,$feature.Mean_T_f_09_Sep, $feature.Mean_T_f_10_Oct,$feature.Mean_T_f_11_Nov, $feature.Mean_T_f_12_Dec), 2)"
        },
        {
            name: "exprwarmest",
            title: "Warmest 1-month average",
            expression: "Floor(Max($feature.Max_T_f_01_Jan, $feature.Max_T_f_02_Feb,$feature.Max_T_f_03_Mar, $feature.Max_T_f_04_Apr,$feature.Max_T_f_05_May, $feature.Max_T_f_06_Jun,$feature.Max_T_f_07_Jul, $feature.Max_T_f_08_Aug,$feature.Max_T_f_09_Sep, $feature.Max_T_f_10_Oct,$feature.Max_T_f_11_Nov, $feature.Max_T_f_12_Dec), 2)"
        },
        {
            name: "exprcoolest",
            title: "Coolest 1-month average",
            expression: "Floor(Min($feature.Min_T_f_01_Jan, $feature.Min_T_f_02_Feb,$feature.Min_T_f_03_Mar, $feature.Min_T_f_04_Apr,$feature.Min_T_f_05_May, $feature.Min_T_f_06_Jun,$feature.Min_T_f_07_Jul, $feature.Min_T_f_08_Aug,$feature.Min_T_f_09_Sep, $feature.Min_T_f_10_Oct,$feature.Min_T_f_11_Nov, $feature.Min_T_f_12_Dec), 2)"
        },
        {
            name: "exprmeanprecip",
            title: "Mean annual precipitation (cm)",
            expression: "Sum($feature.Mean_mmPr_01_Jan, $feature.Mean_mmPr_02_Feb,$feature.Mean_mmPr_03_Mar, $feature.Mean_mmPr_04_Apr,$feature.Mean_mmPr_05_May, $feature.Mean_mmPr_06_Jun,$feature.Mean_mmPr_07_Jul, $feature.Mean_mmPr_08_Aug,$feature.Mean_mmPr_09_Sep, $feature.Mean_mmPr_10_Oct,$feature.Mean_mmPr_11_Nov, $feature.Mean_mmPr_12_Dec)"
        },
        {
            name: "exprhighprecip",
            title: "Highest monthly precipitation (cm)",
            expression: "Max($feature.High_mmPr_01_Jan, $feature.High_mmPr_02_Feb,$feature.High_mmPr_03_Mar, $feature.High_mmPr_04_Apr,$feature.High_mmPr_05_May, $feature.High_mmPr_06_Jun,$feature.High_mmPr_07_Jul, $feature.High_mmPr_08_Aug,$feature.High_mmPr_09_Sep, $feature.High_mmPr_10_Oct,$feature.High_mmPr_11_Nov, $feature.High_mmPr_12_Dec)"
        },
    ];
    const popupClimate = {
        "title": "{StnName} 1986-2010 Climate",
        "content": "Mean Annual Temperature: {expression/exprmeantemp} F<br>Coolest 1-Month Avg. Low Temp: {expression/exprcoolest} F<br>Warmest 1-Month Avg. High Temp: {expression/exprwarmest} F<br>Mean Annual Precipitation: {expression/exprmeanprecip} cm.*<br>Highest 1-Month Precip. 1981-2010: {expression/exprhighprecip} in.*<br>Elevation: {Elev_Gnd_m} m<br>GHCND ID: {GHCND_ID}<br>* 0.00 May also indicate no data available.",
        "expressionInfos": climateExpressions
    }
    const colorTemperatureVariable = {
        type: "color",
        valueExpression: "Floor(Max($feature.Max_T_f_01_Jan, $feature.Max_T_f_02_Feb,$feature.Max_T_f_03_Mar, $feature.Max_T_f_04_Apr,$feature.Max_T_f_05_May, $feature.Max_T_f_06_Jun,$feature.Max_T_f_07_Jul, $feature.Max_T_f_08_Aug,$feature.Max_T_f_09_Sep, $feature.Max_T_f_10_Oct,$feature.Max_T_f_11_Nov, $feature.Max_T_f_12_Dec), 0)",
        valueExpressionTitle: "Warmest month",
        stops: [
            { value: 60, color: "#4357e2" },
            { value: 70, color: "#45e243" },
            { value: 75, color: "#e2db43" },
            { value: 80, color: "#e26943" }
        ]
    };
    const climateRenderer = {
        type: "simple",
        visualVariables: [colorTemperatureVariable],
        symbol: {
          type: "simple-marker",
          size: 36,
          color: "green",
          outline: {
            width: 4,
            color: "white"
          }
        }
    };
    const climateLayer = new FeatureLayer({
        url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_GHCND_ACIS_Monthly/FeatureServer/0",
        opacity: 0.5,
        outFields: ["StnName","Elev_Gnd_m","GHCND_ID"],
        popupTemplate: popupClimate,
        renderer: climateRenderer
    });
    map.add(climateLayer, 0);
});
