/**
 * This is a node app to generate ArcGIS Platform service traffic. I did this to generate usage on a given
 * API key or OAuth app so we can determine if the usage and metering are accounting properly.
 */
const fetch = require('node-fetch');
require("dotenv").config();

// Update these variables to the tests you want to conduct.
// @todo use args/config for these
const useDev = false;
const tileService = "vector"; // "image", "vector", or "OSM"
const startLOD = 2;
const endLOD = 3;
const testTiles = false;
const testGeocode = false;
const testRouting = false;
const testGeoEnrichment = false;

const apiKey = process.env.API_KEY;
let isCanceled = false;
let requestCount = 0;
let startTime;
let endTime;

const fetchParameters = {
    "headers": {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "sec-ch-ua": "\" Not;A Brand\";v=\"99\", \"Google Chrome\";v=\"91\", \"Chromium\";v=\"91\"",
        "sec-ch-ua-mobile": "?0",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site"
    },
    "referrer": "https://master.sites.afd.arcgis.com/",
    "referrerPolicy": "strict-origin-when-cross-origin",
    "body": null,
    "mode": "cors"
};

function getFetchParameters(additionalParameters) {    
    return Object.assign(fetchParameters, {method: "GET"}, additionalParameters || {});
}

function postFetchParameters(additionalParameters) {    
    return Object.assign(fetchParameters, {method: "POST"}, additionalParameters || {});
}

/**
 * Get a tile service URL given parameters.
 * @param {string} service Indicate which tile service, either "image", "vector", or "OSM".
 * @param {boolean} isDev Use the dev (true) or prod (false) server.
 * @returns {string} Base URL to query tiles from.
 */
function getTileServiceURL(service, isDev) {
    const basemapId = "ArcGIS:Streets";
    const vectorTileId = "World_Basemap_v2/";
    const OSMId = "OpenStreetMap_v2/";
    const imageryOceanId = "Ocean/World_Ocean_Base/";
    const imageryId = "World_Imagery/";
    const hillShadeId = "Elevation/World_Hillshade/";
    
    const imageryServiceURL = isDev ? "https://ibasemapsdev-api.arcgis.com/arcgis/rest/services/" : "https://ibasemaps-api.arcgis.com/arcgis/rest/services/";
    const basemapServiceURL = isDev ? "https://basemapsdev-api.arcgis.com/arcgis/rest/services/" : "https://basemaps-api.arcgis.com/arcgis/rest/services/";
    
    const basemapStyleURL = basemapServiceURL + "styles/" + basemapId + "?type=style";
    const basemapTileURL  = basemapServiceURL + vectorTileId + "VectorTileServer/tile/";
    const imageryTileURL  = imageryServiceURL + imageryId + "MapServer/tile/";
    const OSMTileURL = basemapServiceURL + OSMId + "VectorTileServer/tile/";
    
    if (service == "image") {
        return imageryTileURL;
    } else if (service == "OSM") {
        return OSMTileURL;
    } else {
        fetchStyle(basemapStyleURL);
        return basemapTileURL;
    }
}

/**
 * Fetch a single tile for a given map tile service.
 * @param {string} tileServiceURL The base URL of the tile service.
 * @param {integer} lod Level of detail or zoom level.
 * @param {integer} x Longitude tile
 * @param {integer} y Latitude tile
 */
async function fetchTile(tileServiceURL, lod, x, y) {
    if (isCanceled) {
        return;
    }
    let url = `${tileServiceURL}${lod}/${x}/${y}.pbf?token=${apiKey}`;
    fetch(url, getFetchParameters())
    .then(function(response) {
        if (response.status != 200) {
            process.stderr.write(`Status ${response.status} for ${lod}/${x}/${y} on service ${tileServiceURL}`);
        } else {
            requestCount += 1;
            process.stdout.write(`Fetched tile ${lod}/${x}/${y}\r`);
        }
    });
}

/**
 * Fetch style for a given vector tile service.
 * @param {string} tileServiceURL The base URL of the tile service.
 */
 async function fetchStyle(tileServiceURL) {
    if (isCanceled) {
        return;
    }
    fetch(tileServiceURL + `&token=${apiKey}`, getFetchParameters())
    .then(function(response) {
        if (response.status != 200) {
            process.stderr.write(`Status ${response.status} on service ${tileServiceURL}\n`);
        } else {
            process.stdout.write(`Fetched style ${tileServiceURL}\n`);
        }
    });
}

/**
 * Fetch all tiles at a given zoom level.
 * @param {string} tileServiceURL Indicate the URL of the tile service you wish to query.
 * @param {integer} lod The level of detail to query, an integer between 1 and 25.
 */
async function fetchTiles(tileServiceURL, lod) {
    const n = Math.pow(2, lod);
    for (let x = 1; x < n; x += 1) {
        for (let y = 1; y < n; y += 1) {
            if (isCanceled) {
                return;
            }
            fetchTile(tileServiceURL, lod, x, y);
            await new Promise(resolve => setTimeout(resolve, 150));
        }
    }
}

/**
 * Generate tile usage requests for the given service and in the level of detail range.
 * @param {string} service Indicate which tile service you wish to query, either "vector", "image", or "OSM".
 * @param {boolean} isDev Use the dev (true) or prod (false) server.
 * @param {integer} startLOD Lowest LOD to query.
 * @param {integer} endLOD Highest LOD to query.
 */
async function generateTileUsage(service, isDev, startLOD, endLOD) {
    const tileServiceURL = getTileServiceURL(service, isDev);
    process.stdout.write(`Generating tile usage on ${tileServiceURL}\n`);
    if (endLOD > 25) {
        endLOD = 25;
    } else if (endLOD < 1) {
        endLOD = 1;
    }
    if (startLOD < 1) {
        startLOD = 1;
    } else if (startLOD > endLOD) {
        startLOD = endLOD;
    }
    for (let lod = startLOD; lod <= endLOD; lod += 1) {
        fetchTiles(tileServiceURL, lod);
    }
}

/**
 * Send a single geocode request.
 * @param {boolean} isDev True when using DEV servers, false uses production servers.
 * @returns {Promise} Requests take a while, resolves with the server response.
 */
 function geocodeRequest(isDev) {
    const geocodeService = isDev ? "https://geocodedev.arcgis.com" : "https://geocode-api.arcgis.com";
    const geocodeURL = geocodeService + "/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
    const geocodeParameters = {
        f: "json",
        singleLine: "Grocery Store redlands CA",
        outFields: "phone",
        forStorage: false,
        token: apiKey
    };

    return new Promise(function (resolve, reject) {
        if (isCanceled) {
            resolve(null);
        }
        const url = new URL(geocodeURL);
        url.search = new URLSearchParams(geocodeParameters);
        fetch(url, getFetchParameters())
        .then(async function(response) {
            if (response.status != 200) {
                process.stderr.write(`Status ${response.status} on service ${geocodeURL}\n`);
                resolve(null);
            } else {
                const result = await response.json();
                resolve(result);
            }
        });    
    });
}

/**
 * Generate geocoding usage.
 * @param {boolean} isDev True when using DEV servers, false uses production servers.
 * @param {integer} interval Number of milliseconds between requests to be nice to the servers.
 * @param {integer} count Total number of requests to make.
 */
 async function geocodeUsageGenerator(isDev, interval, count) {
    let hitsRemaining = count;

    async function processGeocodeRequest() {
        const result = await geocodeRequest(isDev);
        const geocode = JSON.stringify(result);
        requestCount += 1;
        hitsRemaining -= 1;
        process.stdout.write(`Fetched ${(count - hitsRemaining)} ${geocode}\n\n\n`);
        if (hitsRemaining > 0) {
            setTimeout(processGeocodeRequest, interval);
        }
    }

    processGeocodeRequest();
}

/**
 * Generate GeoEnrichment usage.
 * @param {boolean} isDev True when using DEV servers, false uses production servers.
 * @param {integer} interval Number of milliseconds between requests to be nice to the servers.
 * @param {integer} count Total number of requests to make.
 */
 async function geoEnrichmentUsageGenerator(isDev, interval, count) {
    let hitsRemaining = count;

    async function processGeoEnrichmentRequest() {
        const result = await geoEnrichmentRequest(isDev);
        const geoEnrichResult = JSON.stringify(result);
        requestCount += 1;
        hitsRemaining -= 1;
        process.stdout.write(`Fetched ${(count - hitsRemaining)} ${geoEnrichResult}\n\n\n`);
        if (hitsRemaining > 0) {
            setTimeout(processGeoEnrichmentRequest, interval);
        }
    }

    processGeoEnrichmentRequest();
}

/**
 * Send a single GeoEnrichment request.
 * @param {boolean} isDev True when using DEV servers, false uses production servers.
 * @returns {Promise} Requests take a while, resolves with the server response.
 */
async function geoEnrichmentRequest(isDev) {
    // Create report:   let url = "https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/createReport?report=acs_housing&format=pdf&f=pjson&studyAreas=[{"address":{"text":"380 New York St. Redlands, CA 92373"}},{"address":{"text":"3722 Crenshaw Blvd, Los Angeles, CA 90016"}},{"address":{"text":"2103 N Hall St, Dallas, TX 75204"}},{"address":{"text":"2807 N. Campbell Road, Tucson, AZ 85719"}},{"address":{"text":"30 W Erie St, Chicago, IL 60654"}}]&token=""

    const geoEnrichService = isDev ? "https://geoenrichdev.arcgis.com" : "https://geoenrich.arcgis.com";
    const geoEnrichURL = geoEnrichService + "/arcgis/rest/services/World/geoenrichmentserver/GeoEnrichment/enrich";
    const geoEnrichParameters = {
        studyAreas: '[{"geometry":{"x":-117.1956,"y":34.0572}}]',
        analysisVariables: '["KeyGlobalFacts.TOTPOP"]',
        f: "json",
        token: apiKey
    };

    return new Promise(function (resolve, reject) {
        if (isCanceled) {
            resolve(null);
        }
        const url = new URL(geoEnrichURL);
        url.search = new URLSearchParams(geoEnrichParameters);
        fetch(url, getFetchParameters())
        .then(async function(response) {
            if (response.status != 200) {
                process.stderr.write(`Status ${response.status} on service ${geoEnrichURL}\n`);
                resolve(null);
            } else {
                const result = await response.json();
                resolve(result);
            }
        });    
    });
}

/**
 * Generate routing usage.
 * @param {boolean} isDev True when using DEV servers, false uses production servers.
 * @param {integer} interval Number of milliseconds between requests to be nice to the servers.
 * @param {integer} count Total number of requests to make.
 */
 async function routingUsageGenerator(isDev, interval, count) {

}

/**
 * Generate feature service query and edit usage.
 * @param {boolean} isDev True when using DEV servers, false uses production servers.
 * @param {integer} interval Number of milliseconds between requests to be nice to the servers.
 * @param {integer} count Total number of requests to make.
 */
async function itemUsageGenerator(isDev, interval, count) {
    const itemID = "";

}

function exitHandler() {
    isCanceled = true;
    endTime = Date.now();
    const elapsedTime = (endTime - startTime) / 1000;
    process.stdout.write(`\n\nFetched ${requestCount} requests in ${elapsedTime} seconds.\n\n`);
    process.exit(0);
}

process.on('exit', exitHandler);
process.on('SIGINT', exitHandler);
process.on('SIGUSR1', exitHandler);
process.on('SIGUSR2', exitHandler);
// process.on('uncaughtException', exitHandler);

startTime = Date.now();
if (testTiles) {
    generateTileUsage(tileService, useDev, startLOD, endLOD);
}
if (testGeocode) {
    geocodeUsageGenerator(useDev, 2000, 4);
}
if (testGeoEnrichment) {
    geoEnrichmentUsageGenerator(useDev, 2000, 4);
}
if (testRouting) {
    routingUsageGenerator(useDev, 2000, 4);    
}
