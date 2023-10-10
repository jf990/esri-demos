/**
 * This is a node app to generate ArcGIS Platform service traffic on a variety of different services. I did this
 * to generate usage on a given API key or OAuth app so we can determine if the usage and metering are accounting
 * properly. Other than just generating random requests, this app has no other useful purpose.
 * 
 * Configuration required:
 * Create/edit .env with your authentication:
 *   API_KEY is set to an api key you own that has the required scopes for the service tests you want to run.
 *     Make sure the key matches the stage you are testing on.
 *   CLIENT_ID/CLIENT_SECRET are set to an oauth app you own. This is used only if API_KEY is not set.
 *   FEATURE_SERVICE_URL if you want to run the feature service test then set this to a feature service you own
 *     and is scoped to the authentication you set. It should have the edit privilege turned on.
 */
import fetch from "node-fetch";
import { ApiKeyManager, ArcGISIdentityManager, Job,  JOB_STATUSES  } from "@esri/arcgis-rest-request";
import dotenv from "dotenv";
dotenv.config();

// Update these variables to the tests you want to conduct.
const testSwitches = {
    analysis: false,
    featureEdit: false,
    featureQuery: false,
    geocode: false,
    geoenrichment: false,
    places: false,
    routing: false,
    suggest: false,
    tiles: false,
    nonExistingTiles: false,
    useDev: true,
    useEnhancedServices: false,
    useOceansImageryTiles: false,
    iterations: 20,
    tileRequestDelay: 150,
    serviceRequestDelay: 350,
    startLOD: 5,
    endLOD: 6,
    tileService: ["vector"] // select any of "image", "vector", "hillshade", or "OSM"
};

const tileServices = {
    basemapId: "ArcGIS:Topographic",
    vectorTileId: "World_Basemap_v2/",
    OSMId: "OpenStreetMap_v2/",
    imageryOceanId: "Ocean/World_Ocean_Base/",
    imageryId: "World_Imagery/",
    hillShadeId: "Elevation/World_Hillshade_Dark/",
};

const tileServiceHosts = {
    dev: "https://basemapsdev-api.arcgis.com/arcgis/rest/services/",
    prod: "https://basemaps-api.arcgis.com/arcgis/rest/services/",
    enhancedDev: "https://basemapsdev.arcgis.com/arcgis/rest/services/",
    enhancedProd: "https://basemaps.arcgis.com/arcgis/rest/services/"
};
const imageryServiceHosts = {
    dev: "https://ibasemapsdev-api.arcgis.com/arcgis/rest/services/",
    prod: "https://ibasemaps-api.arcgis.com/arcgis/rest/services/",
    enhancedDev: "https://basemapsdev.arcgis.com/arcgis/rest/services/",
    enhancedProd: "https://server.arcgisonline.com/arcgis/rest/services/"
};
const geocodingServiceHosts = {
    dev: "https://geocodedev.arcgis.com",
    prod: "https://geocode-api.arcgis.com",
    enhancedDev: "https://geocodedev.arcgis.com",
    enhancedProd: "https://geocode.arcgis.com"
}
const placesServiceHosts = {
    dev: "https://placesdev-api.arcgis.com",
    prod: "https://places-api.arcgis.com",
    enhancedDev: "https://placesdev-api.arcgis.com",
    enhancedProd: "https://places-api.arcgis.com"
}

let token = null;
let authentication = null;
let isCanceled = false;
let requestCount = 0;
let errorCount = 0;
let startTime;
let endTime;
let reportedServiceURL = false;

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

/**
 * Build a GET request parameters object to send to the server by combining the
 * required parameters with any request-specific parameters.
 * @param {object} additionalParameters Additional parameters to add to the GET request.
 * @returns {object} Parameters to use in a GET request.
 */
function getFetchParameters(additionalParameters) {    
    return Object.assign(fetchParameters, {method: "GET"}, additionalParameters || {});
}

/**
 * Build a POST request parameters object to send to the server by combining the
 * required parameters with any request-specific parameters.
 * @param {object} additionalParameters Additional parameters to add to the POST request.
 * @returns {object} Parameters to use in a POST request.
 */
function postFetchParameters(additionalParameters) {    
    return Object.assign(fetchParameters, {method: "POST"}, additionalParameters || {});
}

/**
 * Log in a user with the credentials set in the credentials store.
 * @returns {ArcGISIdentityManager} An identity manager object for the logged in user.
 */
async function signIn() {
    if (process.env.ARCGIS_USER_NAME && process.env.ARCGIS_USER_PASSWORD) {
        return ArcGISIdentityManager.signIn({
            username: process.env.ARCGIS_USER_NAME,
            password: process.env.ARCGIS_USER_PASSWORD
        })
        .then(function(identityManager) {
            return identityManager;
        })
        .catch(function(exception) {
            throw exception;
        });
    } else {
        throw new Error("Missing credentials. Update .env with your ArcGIS credentials.");
    }
}

/**
 * Get this apps authentication token. It can be either an API key that was set in the .env
 * configuration or it can be a dynamically generated app token using an OAuth app client ID and
 * client secret.
 * @returns {string|null} An ArcGIS token to be used in authenticated requests. Null if an error
 *   occurs or a token could not be generated.
 */
async function getAuthentication() {
    if (process.env.API_KEY) {
        token = process.env.API_KEY;
    }
    if (process.env.CLIENT_ID && process.env.CLIENT_SECRET) {
        console.log(`Authentication for CLIENT_ID not supported (yet).\n`);
        // @todo: generate app token from user credentials
    }
    if (process.env.ARCGIS_USER_NAME && process.env.ARCGIS_USER_PASSWORD) {
        try {
            authentication = await signIn();
            console.log(`Authentication with user credentials.`);
        } catch (authenticationError) {
            console.log(`Authentication with user credentials FAILED. ` + authenticationError.toString());
        }
    }
    if (token == null && authentication == null) {
        console.log(`Authentication was not found. Check your .env and set either API_KEY or CLIENT_ID and CLIENT_SECRET.\n`);
    }
};

/**
 * Get a tile service URL given parameters to specify which type of tile service is required.
 * @param {string} service Indicate which tile service, either "image", "hillshade", "vector", or "OSM".
 * @returns {string} Base URL to query tiles from.
 */
function getTileServiceURL(service) {
    let imageryServiceURL;
    let basemapServiceURL;

    if (testSwitches.useEnhancedServices) {
        imageryServiceURL = testSwitches.useDev ? imageryServiceHosts.enhancedDev : imageryServiceHosts.enhancedProd;
        basemapServiceURL = testSwitches.useDev ? tileServiceHosts.enhancedDev : tileServiceHosts.enhancedProd;
    } else {
        imageryServiceURL = testSwitches.useDev ? imageryServiceHosts.dev : imageryServiceHosts.prod;
        basemapServiceURL = testSwitches.useDev ? tileServiceHosts.dev : tileServiceHosts.prod;
    }
    if (service == "image") {
        const imageryTileURL  = imageryServiceURL + (testSwitches.useOceansImageryTiles ? tileServices.imageryOceanId : tileServices.imageryId) + "MapServer/tile/";
        return imageryTileURL;
    } else if (service == "hillshade") {
        return imageryServiceURL + tileServices.hillShadeId + "MapServer/tile/";
    } else if (service == "OSM") {
        const OSMTileURL = basemapServiceURL + tileServices.OSMId + "VectorTileServer/tile/";
        return OSMTileURL;
    } else {
        const basemapTileURL  = basemapServiceURL + tileServices.vectorTileId + "VectorTileServer/tile/";
        const basemapStyleURL = basemapServiceURL + "styles/" + tileServices.basemapId + "?type=style";
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
async function fetchVectorTile(tileServiceURL, lod, x, y) {
    if (isCanceled) {
        return;
    }
    let url = `${tileServiceURL}${lod}/${y}/${x}.pbf?token=${token}`;
    fetch(url, getFetchParameters())
    .then(function(response) {
        if (response.status != 200) {
            errorCount += 1;
            process.stderr.write(`Status ${response.status} for ${lod}/${y}/${x} on service ${tileServiceURL}${lod}/${y}/${x}`);
        } else {
            requestCount += 1;
            process.stdout.write(`Fetched tile ${lod}/${y}/${x}\r`);
        }
    });
}

/**
 * Fetch a single image tile for a given map tile service.
 * @param {string} tileServiceURL The base URL of the tile service.
 * @param {integer} lod Level of detail or zoom level.
 * @param {integer} x Longitude tile
 * @param {integer} y Latitude tile
 */
 async function fetchImageTile(tileServiceURL, lod, x, y) {
    if (isCanceled) {
        return;
    }
    let url = `${tileServiceURL}${lod}/${y}/${x}?token=${token}`;
    fetch(url, getFetchParameters())
    .then(function(response) {
        if (response.status != 200) {
            errorCount += 1;
            process.stderr.write(`Status ${response.status} for ${lod}/${y}/${x} on service ${tileServiceURL}${lod}/${y}/${x}`);
        } else {
            requestCount += 1;
            process.stdout.write(`Fetched tile ${lod}/${y}/${x}\r`);
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
    fetch(tileServiceURL + `&token=${token}`, getFetchParameters())
    .then(function(response) {
        if (response.status != 200) {
            errorCount += 1;
            process.stderr.write(`Status ${response.status} on service ${tileServiceURL}\n`);
        } else {
            requestCount += 1;
            process.stdout.write(`Fetched style ${tileServiceURL}\n`);
        }
    });
}

/**
 * Fetch all vector tiles at a given zoom level.
 * @param {string} tileServiceURL Indicate the URL of the tile service you wish to query.
 * @param {integer} lod The level of detail to query, an integer between 1 and 25.
 */
async function fetchVectorTiles(tileServiceURL, lod) {
    const n = Math.pow(2, lod);
    for (let x = 1; x < n; x += 1) {
        for (let y = 1; y < n; y += 1) {
            if (isCanceled) {
                return;
            }
            fetchVectorTile(tileServiceURL, lod, x, y);
            await new Promise(resolve => setTimeout(resolve, testSwitches.tileRequestDelay));
        }
    }
}

/**
 * Fetch all image tiles at a given zoom level.
 * @param {string} tileServiceURL Indicate the URL of the tile service you wish to query.
 * @param {integer} lod The level of detail to query, an integer between 1 and 25.
 */
 async function fetchImageTiles(tileServiceURL, lod) {
    const n = Math.pow(2, lod);
    for (let x = 1; x < n; x += 1) {
        for (let y = 1; y < n; y += 1) {
            if (isCanceled) {
                return;
            }
            fetchImageTile(tileServiceURL, lod, x, y);
            await new Promise(resolve => setTimeout(resolve, testSwitches.tileRequestDelay));
        }
    }
}

/**
 * Fetch a tile we know does not exist.
 * @param {string} tileServiceURL Indicate the URL of the tile service you wish to query.
 */
async function fetchNonExistingVectorTiles(tileServiceURL) {
    const lod = 63;
    const x = 0;
    const y = 0;
    fetchVectorTile(tileServiceURL, lod, x, y);
    await new Promise(resolve => setTimeout(resolve, testSwitches.tileRequestDelay));
}

/**
 * Fetch a tile we know does not exist.
 * @param {string} tileServiceURL Indicate the URL of the tile service you wish to query.
 */
async function fetchNonExistingImageTiles(tileServiceURL) {
    const lod = 63;
    const x = 0;
    const y = 0;
    fetchImageTile(tileServiceURL, lod, x, y);
    await new Promise(resolve => setTimeout(resolve, testSwitches.tileRequestDelay));
}

/**
 * Generate tile usage requests for the given service and in the level of detail range.
 * @param {string|Array} service Indicate which tile service you wish to query, either "vector", "image", "hillshade", or "OSM".
 * @param {integer} startLOD Lowest LOD to query.
 * @param {integer} endLOD Highest LOD to query.
 */
async function generateTileUsage(service, startLOD, endLOD) {
    if (Array.isArray(service)) {
        service.map(function(tileService) {
            generateTileUsage(tileService, startLOD, endLOD);
        })
        return;
    }
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
    const tileServiceURL = getTileServiceURL(service);
    process.stdout.write(`Generating tile usage on ${tileServiceURL} for tile range ${startLOD}-${endLOD}\n`);
    reportedServiceURL = true;

    for (let lod = startLOD; lod <= endLOD; lod += 1) {
        if (service == "image" || service == "hillshade") {
            fetchImageTiles(tileServiceURL, lod);
        } else {
            fetchVectorTiles(tileServiceURL, lod);
        }
    }
}

/**
 * Generate tile usage requests for the given service on tiles we know do not exist.
 * @param {string|Array} service Indicate which tile service you wish to query, either "vector", "image", "hillshade", or "OSM".
 * @param {integer} interval Number of milliseconds between requests to be nice to the servers.
 * @param {integer} count Total number of requests to make.
 */
async function generateNonExistingTileUsage(service, interval, count) {
    if (Array.isArray(service)) {
        service.map(function(tileService) {
            generateNonExistingTileUsage(tileService, interval, count);
        })
        return;
    }
    const tileServiceURL = getTileServiceURL(service);
    let hitsRemaining = count;
    process.stdout.write(`Generating ${count} tile requests on ${tileServiceURL} for tiles we expect do not exist.\n`);
    reportedServiceURL = true;

    async function requestNonExistingTileUsage() {
        if (service == "image" || service == "hillshade") {
            await fetchNonExistingImageTiles(tileServiceURL);
        } else {
            await fetchNonExistingVectorTiles(tileServiceURL);
        }
        hitsRemaining -= 1;
        if (hitsRemaining > 0) {
            setTimeout(requestNonExistingTileUsage, interval);
        }
    }

    requestNonExistingTileUsage();
}

/**
 * Send a single geocode request.
 * @returns {Promise} Requests take a while, resolves with the server response.
 */
 function geocodeRequest() {
    const geocodeService = testSwitches.useDev ? geocodingServiceHosts.dev : geocodingServiceHosts.prod;
    const geocodeURL = geocodeService + "/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
    const geocodeParameters = {
        f: "json",
        singleLine: "Grocery Store redlands CA",
        outFields: "phone",
        forStorage: false,
        token: token
    };

    return new Promise(function (resolve, reject) {
        if (isCanceled) {
            resolve(null);
        }
        const url = new URL(geocodeURL);
        url.search = new URLSearchParams(geocodeParameters);
        if ( ! reportedServiceURL) {
            process.stdout.write(`Geocode request to ${url}\n`);
            reportedServiceURL = true;
        }
        fetch(url, getFetchParameters())
        .then(async function(response) {
            if (response.status != 200) {
                errorCount += 1;
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
 * @param {integer} interval Number of milliseconds between requests to be nice to the servers.
 * @param {integer} count Total number of requests to make.
 */
 async function geocodeUsageGenerator(interval, count) {
    let hitsRemaining = count;

    async function processGeocodeRequest() {
        const result = await geocodeRequest();
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
 * Send a single geocode suggestion request.
 * @param {string} text to search for.
 * @returns {Promise} Requests take a while, resolves with the server response.
 */
 function geocodeSuggestRequest(text) {
    const geocodeService = testSwitches.useDev ? geocodingServiceHosts.dev : geocodingServiceHosts.prod;
    const geocodeURL = geocodeService + "/arcgis/rest/services/World/GeocodeServer/suggest";
    const geocodeParameters = {
        f: "json",
        text: text,
        category: "Address,POI",
        location: "{\"x\":-94.583874,\"y\":39.104531,\"spatialReference\": {\"wkid\": 3857}}",
        countryCode: "US",
        preferredLabelValues: "localCity",
        maxSuggestions: 3,
        outFields: "phone",
        forStorage: false,
        token: token
    };

    return new Promise(function (resolve, reject) {
        if (isCanceled) {
            resolve(null);
        }
        const url = new URL(geocodeURL);
        if ( ! reportedServiceURL) {
            process.stdout.write(`Geocode suggest request to ${url}\n`);
            reportedServiceURL = true;
        }
        url.search = new URLSearchParams(geocodeParameters);
        fetch(url, getFetchParameters())
        .then(async function(response) {
            if (response.status != 200) {
                errorCount += 1;
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
 * Generate geocoding address suggestion usage.
 * @param {integer} interval Number of milliseconds between requests to be nice to the servers.
 * @param {integer} count Total number of requests to make.
 */
 async function geocodeSuggestUsageGenerator(interval, count) {
    let hitsRemaining = count;
    let typingIndex = 0;
    let suggestText = ["gas St", "a", "t", "i"];

    async function processGeocodeSuggestRequest() {
        let text = "";
        typingIndex += 1;
        for (let i = 0; i < Math.min(typingIndex, suggestText.length); i += 1) {
            text += suggestText[i];
        }
        const result = await geocodeSuggestRequest(text);
        const geocode = JSON.stringify(result);
        requestCount += 1;
        hitsRemaining -= 1;
        process.stdout.write(`Fetched ${(count - hitsRemaining)} ${geocode}\n\n\n`);
        if (hitsRemaining > 0) {
            setTimeout(processGeocodeSuggestRequest, interval);
        }
    }

    processGeocodeSuggestRequest();
}


/**
 * Send a single places request.
 * @returns {Promise} Requests take a while, resolves with the server response.
 */
function placesRequest() {
    const placesService = testSwitches.useDev ? placesServiceHosts.dev : placesServiceHosts.prod;
    const placesURL = placesService + "/arcgis/rest/services/places-service/v1/places/near-point";
    const placesParameters = {
        f: "json",
        x: -74.006792,
        y: 40.71164,
        radius: 650,
        categoryIds: "13000",
        pageSize: 20,
        searchText: "bar",
        forStorage: false,
        token: token
    };

    return new Promise(function (resolve, reject) {
        if (isCanceled) {
            resolve(null);
        }
        const url = new URL(placesURL);
        url.search = new URLSearchParams(placesParameters);
        if ( ! reportedServiceURL) {
            process.stdout.write(`Places request to ${url}\n`);
            reportedServiceURL = true;
        }
        fetch(url, getFetchParameters())
        .then(async function(response) {
            if (response.status != 200) {
                errorCount += 1;
                process.stderr.write(`Status ${response.status} on service ${placesURL}\n`);
                resolve(null);
            } else {
                const result = await response.json();
                resolve(result);
            }
        });    
    });
}

/**
 * Generate places usage.
 * @param {integer} interval Number of milliseconds between requests to be nice to the servers.
 * @param {integer} count Total number of requests to make.
 */
async function placesUsageGenerator(interval, count) {
    let hitsRemaining = count;

    async function processPlacesRequest() {
        const result = await placesRequest();
        const placesResponse = JSON.stringify(result);
        requestCount += 1;
        hitsRemaining -= 1;
        process.stdout.write(`Fetched ${(count - hitsRemaining)} ${placesResponse}\n\n\n`);
        if (hitsRemaining > 0) {
            setTimeout(processPlacesRequest, interval);
        }
    }

    processPlacesRequest();
}

/**
 * Generate GeoEnrichment usage.
 * @param {integer} interval Number of milliseconds between requests to be nice to the servers.
 * @param {integer} count Total number of requests to make.
 */
 async function geoEnrichmentUsageGenerator(interval, count) {
    let hitsRemaining = count;

    async function processGeoEnrichmentRequest() {
        const result = await geoEnrichmentRequest();
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
 * @returns {Promise} Requests take a while, resolves with the server response.
 */
async function geoEnrichmentRequest() {
    // Create report:   let url = "https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/createReport?report=acs_housing&format=pdf&f=pjson&studyAreas=[{"address":{"text":"380 New York St. Redlands, CA 92373"}},{"address":{"text":"3722 Crenshaw Blvd, Los Angeles, CA 90016"}},{"address":{"text":"2103 N Hall St, Dallas, TX 75204"}},{"address":{"text":"2807 N. Campbell Road, Tucson, AZ 85719"}},{"address":{"text":"30 W Erie St, Chicago, IL 60654"}}]&token=""

    const geoEnrichService = testSwitches.useDev ? "https://geoenrichdev.arcgis.com" : "https://geoenrich.arcgis.com";
    const geoEnrichURL = geoEnrichService + "/arcgis/rest/services/World/geoenrichmentserver/GeoEnrichment/enrich";
    const geoEnrichParameters = {
        studyAreas: '[{"geometry":{"x":-117.1956,"y":34.0572}}]',
        analysisVariables: '["KeyGlobalFacts.TOTPOP"]',
        f: "json",
        token: token
    };

    return new Promise(function (resolve, reject) {
        if (isCanceled) {
            resolve(null);
        }
        const url = new URL(geoEnrichURL);
        url.search = new URLSearchParams(geoEnrichParameters);
        if ( ! reportedServiceURL) {
            process.stdout.write(`GeoEnrich request to ${url}\n`);
            reportedServiceURL = true;
        }
        fetch(url, getFetchParameters())
        .then(async function(response) {
            if (response.status != 200) {
                errorCount += 1;
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
 * @param {integer} interval Number of milliseconds between requests to be nice to the servers.
 * @param {integer} count Total number of requests to make.
 */
async function routingUsageGenerator(interval, count) {

}

/**
 * Generate feature service query usage. In order for this test to work:
 *   1. Set up a hosted feature service with edit capability in your developer account.
 *   2. Scope an API key to that item.
 *   3. Set .env entries API_KEY and FEATURE_SERVICE_URL
 * @param {integer} interval Number of milliseconds between requests to be nice to the servers.
 * @param {integer} count Total number of requests to make.
 */
async function featureQueryUsageGenerator(interval, count) {

    function featureQueryRequest() {
        const featureServiceURL = new URL(process.env.FEATURE_SERVICE_URL);
        const parameters = new URLSearchParams({
            where: "1=1",
            outFields: "*",
            f: "json",
            token: token
        });
        return new Promise(function (resolve, reject) {
            if (isCanceled) {
                resolve(null);
            }
            featureServiceURL.search = parameters;
            if ( ! reportedServiceURL) {
                process.stdout.write(`Feature service query request to ${featureServiceURL.toString()}\n`);
                reportedServiceURL = true;
            }
            fetch(featureServiceURL, getFetchParameters())
            .then(async function(response) {
                if (response.status != 200) {
                    errorCount += 1;
                    process.stderr.write(`Status ${response.status} on service ${featureServiceURL}\n`);
                    resolve(null);
                } else {
                    const result = await response.json();
                    resolve(result);
                }
            });    
        });
    }

    let hitsRemaining = count;

    async function processFeatureQueryRequest() {
        const result = await featureQueryRequest();
        const query = JSON.stringify(result);
        requestCount += 1;
        hitsRemaining -= 1;
        process.stdout.write(`Queried ${(count - hitsRemaining)}\r`);
        if (hitsRemaining > 0) {
            setTimeout(processFeatureQueryRequest, interval);
        }
    }

    processFeatureQueryRequest();
}

async function spatialAnalysisUsageGenerator(interval, count) {
    const mySpatialAnalysisServiceURL = process.env.ANALYSIS_SERVICE_URL;
    const operation = "FindHotSpots";
    const operationURL = mySpatialAnalysisServiceURL + "/" + operation;

    process.stdout.write(`generating analysis usage on ${operationURL}\n`);

    if (authentication == null && token != null) {
        authentication = ApiKeyManager.fromKey(token);
    }
    // I'm sorting out what the parameters should be
    const parameters = {
        analysisLayer: '{"url":"https://services8.arcgis.com/LLNIdHmmdjO2qQ5q/arcgis/rest/services/ufo_sightings/FeatureServer/0","name":"UFO Sightings"}',
        returnProcessInfo: true,
        shapeType: "fishnet",
        context: '{"extent":{"xmin":-18328487.18419819,"ymin":2384143.907125093,"xmax":-5149520.515384748,"ymax":10543949.55062206,"spatialReference":{"wkid":102100,"latestWkid":3857}}}',
        // f: "json",
        // token: authentication.token
    };
    requestCount += 1;

    /* Using REST API
    const submitJob = operationURL + "/submitJob";
    const url = new URL(submitJob);
    url.search = new URLSearchParams(parameters);
    fetch(url, getFetchParameters())
    .then(async function(response) {
        if (response.status != 200) {
            errorCount += 1;
            console.log(`Status ${response.status} on service ${operationURL}\n`);
            resolve(null);
        } else {
            console.log(`Status ${response.status} on service ${operationURL}\n`);
            const result = await response.json();
            console.log(JSON.stringify(result));
            // {"jobId":"j331605330636454195de663b8580c32b","jobStatus":"esriJobSubmitted","results":{},"inputs":{},"messages":[]}
        }
    });

    analysisLayer: {"url":"https://services8.arcgis.com/LLNIdHmmdjO2qQ5q/arcgis/rest/services/ufo_sightings/FeatureServer/0","name":"UFO Sightings"}
    shapeType: fishnet
    returnProcessInfo: true
    context: {"extent":{"xmin":-18328487.18419819,"ymin":2384143.907125093,"xmax":-5149520.515384748,"ymax":10543949.55062206,"spatialReference":{"wkid":102100,"latestWkid":3857}}}
    */

    // Using ArcGIS REST JS
    Job.submitJob({
        authentication: authentication,
        url: operationURL,
        params: parameters
      }).then(async function(job) {
        // listen to the status event to get an update every time the job status is checked.
        console.log("Job submitted");
        job.on(JOB_STATUSES.Status, function(jobInfo) {
            console.log("Job status update " + JSON.stringify(jobInfo));
        });
        job.on(JOB_STATUSES.Success, function(jobInfo) {
            console.log("Job success " + JSON.stringify(jobInfo));
        });
        job.on(JOB_STATUSES.Failed, function(jobInfo) {
            console.log("Job failed " + JSON.stringify(jobInfo));
        });
  
        // get all the results, this will start monitoring and trigger events
        return job.getAllResults();
      }).then(function(results) {
          console.log("Job RESULTS:", JSON.stringify(results));
      })
      .catch(function(exception) {
          console.log("Job Error " + exception.toString());
      })

    /*
1. POST job

https://analysis8.arcgis.com/arcgis/rest/services/tasks/GPServer/FindHotSpots/submitJob
Content-Type: application/x-www-form-urlencoded

&f=json
&token=<ACCESS_TOKEN>
&analysisLayer={"url":"https://services8.arcgis.com/PxLlS7hS3gd7MX6c/arcgis/rest/services/ufoscrubbedgeocodedtimestandardized/FeatureServer/0","filter":"DURATION > 0","serviceToken":"","name":"Observation"}
&analysisField=DURATION
&returnProcessInfo=true
&context={"extent":{"xmin":-13701588.357587751,"ymin":5636873.660541155,"xmax":-13554599.952195555,"ymax":5730585.457218655,"spatialReference":{"wkid":102100,"latestWkid":3857}}}

2. Job status

POST <ANALYSIS_SERVICE>/arcgis/rest/services/tasks/GPServer/FindHotSpots/jobs/<JOB_ID> HTTP/1.1
Content-Type: application/x-www-form-urlencoded

&f=json
&token=<ACCESS_TOKEN>

3. Get results

POST <ANALYSIS_SERVICE>/arcgis/rest/services/tasks/GPServer/FindHotSpots/jobs/<JOB_ID>/results/hotSpotsResultLayer HTTP/1.1
Content-Type: application/x-www-form-urlencoded

&f=json
&returnType=data
&token=<ACCESS_TOKEN>

*/

}

function exitHandler() {
    isCanceled = true;
    endTime = Date.now();
    const elapsedTime = (endTime - startTime) / 1000;
    process.stdout.write(`\n\nProcessed ${requestCount} requests in ${elapsedTime} seconds. There were ${errorCount} errors.\n\n`);
    process.exit(0);
}

process.on('exit', exitHandler);
process.on('SIGINT', exitHandler);
process.on('SIGUSR1', exitHandler);
process.on('SIGUSR2', exitHandler);
// process.on('uncaughtException', exitHandler);

async function runUsageTest() {
    startTime = Date.now();
    await getAuthentication();
    if (token != null || authentication != null) {
        reportedServiceURL = false;
        if (testSwitches.tiles) {
            generateTileUsage(testSwitches.tileService, testSwitches.startLOD, testSwitches.endLOD);
            reportedServiceURL = false;
        }
        if (testSwitches.nonExistingTiles) {
            generateNonExistingTileUsage(testSwitches.tileService, testSwitches.serviceRequestDelay, testSwitches.iterations);
            reportedServiceURL = false;
        }
        if (testSwitches.places) {
            placesUsageGenerator(testSwitches.serviceRequestDelay, testSwitches.iterations);
            reportedServiceURL = false;
        }
        if (testSwitches.geocode) {
            geocodeUsageGenerator(testSwitches.serviceRequestDelay, testSwitches.iterations);
            reportedServiceURL = false;
        }
        if (testSwitches.suggest) {
            geocodeSuggestUsageGenerator(testSwitches.serviceRequestDelay, testSwitches.iterations);
            reportedServiceURL = false;
        }
        if (testSwitches.geoenrichment) {
            geoEnrichmentUsageGenerator(testSwitches.serviceRequestDelay, testSwitches.iterations);
            reportedServiceURL = false;
        }
        if (testSwitches.routing) {
            routingUsageGenerator(testSwitches.serviceRequestDelay, testSwitches.iterations);    
            reportedServiceURL = false;
        }
        if (testSwitches.featureQuery) {
            featureQueryUsageGenerator(testSwitches.serviceRequestDelay, testSwitches.iterations);    
            reportedServiceURL = false;
        }
        if (testSwitches.analysis) {
            reportedServiceURL = false;
            spatialAnalysisUsageGenerator(testSwitches.serviceRequestDelay, testSwitches.iterations);    
        }
    } else {
        process.stderr.write(`Cannot authenticate. Verify your authentication configuration.\n`);
    }
}

runUsageTest();
