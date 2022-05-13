const apiKey = YOUR_API_KEY;

const map = L.map("map", {
maxZoom: 18 //The clustering plugin needs to understand the map's maxZoom
}).setView([0, 0], 2);

L.esri.Vector.vectorBasemapLayer("ArcGIS:Community", {
apikey: apiKey
}).addTo(map);

L.esri.Cluster.featureLayer({
url: "https://sampleserver6.arcgisonline.com/arcgis/rest/services/Earthquakes_Since1970/MapServer/0"
}).addTo(map);
