/**
 * This is a node app to generate ArcGIS Platform service traffic on a variety of different services. I did this
 * to generate usage on a given API key or OAuth app so we can determine if the usage and metering are accounting
 * properly. Other than just generating random requests, this app has no other useful purpose.
 * 
 * Configuration required:
 * Create/edit .env with your authentication (see .env.sample):
 *   API_KEY is set to an api key you own that has the required scopes for the service tests you want to run.
 *     Make sure the key matches the stage you are testing on.
 *   CLIENT_ID/CLIENT_SECRET are set to an oauth app you own. This is used only if API_KEY is not set.
 *   ARCGIS_USER_NAME/ARCGIS_USER_PASSWORD are used to generate a user OAuth token if needed.
 *   FEATURE_SERVICE_URL if you want to run the feature service test then set this to a feature service you own
 *     and is scoped to the authentication you set. It should have the edit privilege turned on.
 *   ANALYSIS_SERVICE_URL to your analysis service if you request the spatial analysis test.
 */
import fetch from "node-fetch";
import { ApiKeyManager, ArcGISIdentityManager, Job,  JOB_STATUSES  } from "@esri/arcgis-rest-request";
import { geocode, suggest } from "@esri/arcgis-rest-geocoding";
import { solveRoute, closestFacility, serviceArea, originDestinationMatrix } from '@esri/arcgis-rest-routing';
import dotenv from "dotenv";
dotenv.config();

// Update these variables to the tests you want to conduct.
const testSwitches = {
    // Services
    analysis: false,
    featureEdit: false,
    featureQuery: false,
    geocode: false,
    suggest: true,
    geocodeForStorage: false,
    geocodeClientTest: false,
    geoenrichment: false,
    geoenrichmentReport: false,
    places: false,
    routing: false,
    tiles: false,
    // Parameters to tile requests
    tileService: ["vector"], // select any of "image", "vector", "hillshade", or "OSM"
    startLOD: 3,
    endLOD: 5,
    useOceansImageryTiles: false,
    nonExistingTiles: false,
    tileRequestDelay: 100,
    // Test flags
    useDev: false,
    useEnhancedServices: false,
    iterations: 20,
    serviceRequestDelay: 350
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
    "referrer": "https://main.sites.afd.arcgis.com/",
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
 * @param {object} formParameters Parameters to send as the POST request body URL form encoded.
 * @returns {object} Parameters to use in a POST request.
 */
function postFetchParameters(formParameters) {
    const formBody = [];
    for (let property in formParameters) {
        let value = formParameters[property];
        if (typeof value == "object") {
            formBody.push(encodeURIComponent(property) + "=" + JSON.stringify(value));
        } else {
            formBody.push(encodeURIComponent(property) + "=" + encodeURIComponent(formParameters[property]));
        }
    }
    const postParameters = Object.assign(fetchParameters, {method: "POST"});
    postParameters.headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
    postParameters.body = formBody.join("&");
    return postParameters;
}

/**
 * Log in a user with the credentials set in the credentials store.
 * @returns {ArcGISIdentityManager} An identity manager object for the logged in user.
 */
async function signIn() {
    if (process.env.ARCGIS_USER_NAME && process.env.ARCGIS_USER_PASSWORD) {
        const portalOptions = {
          username: process.env.ARCGIS_USER_NAME,
          password: process.env.ARCGIS_USER_PASSWORD
        }
        if (testSwitches.useDev) {
          portalOptions.portal = "https://devext.arcgis.com/sharing/rest"
        }
        return ArcGISIdentityManager.signIn(portalOptions)
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
            console.log(`Authenticated with user credentials.`);
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
    })
    .catch(function(exception) {
      process.stderr.write(`Exception ${exception.toString()} for ${lod}/${y}/${x} on service ${tileServiceURL}${lod}/${y}/${x}\n`);
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
    })
    .catch(function(exception) {
      process.stderr.write(`Exception ${exception.toString()} for ${lod}/${y}/${x} on service ${tileServiceURL}${lod}/${y}/${x}\n`);
    });
}

/**
 * Fetch style for a given vector tile service.
 * @param {string} styleServiceURL The base URL of the style service.
 */
 async function fetchStyle(styleServiceURL) {
    if (isCanceled) {
        return;
    }
    fetch(styleServiceURL + `&token=${token}`, getFetchParameters())
    .then(function(response) {
        if (response.status != 200) {
            errorCount += 1;
            process.stderr.write(`Status ${response.status} on service ${styleServiceURL}\n`);
        } else {
            requestCount += 1;
            process.stdout.write(`Fetched style ${styleServiceURL}\n`);
        }
    })
    .catch(function(exception) {
      process.stderr.write(`Exception ${exception.toString()} on service ${styleServiceURL}\n`);
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
 * Fetch a vector tile we know does not exist.
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
 * Fetch an image tile we know does not exist.
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
        singleLine: "Grocery Store Dumont NJ",
        outFields: "phone",
        forStorage: testSwitches.geocodeForStorage,
        endpoint: geocodeURL,
        authentication: ApiKeyManager.fromKey(token)
    };

    return new Promise(function (resolve) {
      if (isCanceled) {
        resolve(null);
      }
      if ( ! reportedServiceURL) {
        process.stdout.write(`Geocode request to ${geocodeURL}\n`);
        reportedServiceURL = true;
      }
      geocode(geocodeParameters)
      .then(function(response) {
        resolve(response);
      })
      .catch(function(exception) {
        errorCount += 1;
        process.stderr.write(`Error ${exception.toString()} on service ${geocodeURL}\n`);
        resolve(null);
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
 * One-off test to verify the geocode service returns the expected number of results
 * and correctly handles spatial reference and extent.
 */
async function geocodeClientTest() {
  const geocodeURL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
  const extent = '{"spatialReference":{"wkid":102100},"xmin":-13195373.795894774,"ymin":3984244.7919120155,"xmax":-13109365.106328506,"ymax":4043552.767686528}';
  const businessNames = [
    'alo_yoga',
    'anthropologie',
    'athleta',
    'bluemercury',
    'equinox fitness clubs',
    'free_people',
    'hm__hennes__mauritz',
    'mac_cosmetics',
    'madewell',
    'peloton',
    'pure_barre',
    'sephora',
    'urban_outfitters',
    'barre3',
    'lululemon',
    'lush',
    'on',
    "barry's bootcamp",
    'aritzia',
    'everlane',
    'sephora',
    'corepower'
  ];
  const geocodeParameters = {
    searchExtent: extent,
    address: businessNames[0],
    outFields: "address, type",
    f: "pjson",
    token: token
  };
  const url = new URL(geocodeURL);
  let requests = 0;
  let responses = 0;
  let resultCount = 0;
  errorCount = 0;

  businessNames.forEach(async function(addressName) {
    if (isCanceled) {
      return;
    }
    geocodeParameters.address = addressName;
    url.search = new URLSearchParams(geocodeParameters);
    requests += 1;
    const response = await fetch(url, getFetchParameters());
    if (response.status != 200) {
      errorCount += 1;
      process.stderr.write(`Status ${response.status} on service ${geocodeURL}\n`);
    } else {
      responses += 1;
      const result = await response.json();
      if (result.error && result.error.code) {
        process.stderr.write(`Status ${result.error.code} ${result.error.message} on service ${geocodeURL}\n`);
      } else {
        resultCount += result.candidates.length;
        process.stdout.write(`Geocode findAddressCandidates for ${addressName} returned ${result.candidates.length}\n`);
      }
    }
    if (requests >= businessNames.length) {
      process.stdout.write(`Geocode findAddressCandidates complete with ${resultCount}\n`);
    }

    // .then(async function(response) {
    //     if (response.status != 200) {
    //       errorCount += 1;
    //       process.stderr.write(`Status ${response.status} on service ${geocodeURL}\n`);
    //     } else {
    //       responses += 1;
    //       const result = await response.json();
    //       if (result.error && result.error.code) {
    //         process.stderr.write(`Status ${result.error.code} ${result.error.message} on service ${geocodeURL}\n`);
    //       } else {
    //         resultCount += result.candidates.length;
    //         process.stdout.write(`Geocode findAddressCandidates for ${addressName} returned ${result.candidates.length}\n`);
    //       }
    //     }
    // });    
  });
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
        endpoint: geocodeURL,
        authentication: ApiKeyManager.fromKey(token)
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
        suggest(text, geocodeParameters)
        .then(function(result) {
          resolve(result);
        })
        .catch(function(exception) {
          errorCount += 1;
          process.stderr.write(`Error ${exception.toString()} on service ${geocodeURL}\n`);
          resolve(null);
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
 * Send a single place details request.
 * @param {string} placeId The id of the place to look up.
 * @returns {Promise} Requests take a while, resolves with the server response.
 */
function placeDetailsRequest(placeId) {
  const placesService = testSwitches.useDev ? placesServiceHosts.dev : placesServiceHosts.prod;
  const placesURL = placesService + "/arcgis/rest/services/places-service/v1/places/";
  const placesParameters = {
      f: "json",
      requestedFields: ["hours"],
      token: token
  };

  return new Promise(function (resolve, reject) {
      if (isCanceled) {
          resolve(null);
      }
      const url = new URL(placesURL + placeId);
      url.search = new URLSearchParams(placesParameters);
      if ( ! reportedServiceURL) {
          process.stdout.write(`Place details request to ${url}\n`);
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
    const placeId = "02388b81d501252b6097afa57ebdc4d4";

    async function processPlacesRequest() {
        const result = await placesRequest();
        const placesResponse = JSON.stringify(result);
        const details = await placeDetailsRequest(placeId);
        const detailsInfo = JSON.stringify(details);
        requestCount += 1;
        hitsRemaining -= 1;
        process.stdout.write(`Fetched ${(count - hitsRemaining)} ${placesResponse}\n\n${detailsInfo}\n\n`);
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
    const geoEnrichService = testSwitches.useDev ? "https://geoenrichdev.arcgis.com" : "https://geoenrich.arcgis.com";
    const servicePath = "/arcgis/rest/services/World/geoenrichmentserver/GeoEnrichment/";
    const geoEnrichURL = geoEnrichService + servicePath + "enrich";
    const geoEnrichParameters = {
        studyAreas: '[{"geometry":{"x":-117.1956,"y":34.0572}}]',
        analysisVariables: '["KeyGlobalFacts.TOTPOP"]',
        // forStorage: false, // adding forStorage=false sends the usage to 172135, otherwise it goes to 172134
        f: "json",
        token: token
    };

    return new Promise(function (resolve) {
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
                process.stdout.write(`GeoEnrich response ${response.status}\n`);
                resolve(result);
            }
        })
        .catch(function(exception) {
            process.stderr.write(`Error ${exception.toString()} on service ${geoEnrichURL}\n`);
            resolve(null);
        })
    });
}

/**
 * Generate a GeoEnrichment report. We only allow one of these at a time.
 */
async function geoEnrichmentReportUsageGenerator() {
    const result = await geoEnrichmentReport();
    const geoEnrichResult = JSON.stringify(result);
    requestCount += 1;
    process.stdout.write(`Fetched report ${geoEnrichResult}\n\n\n`);
}

/**
 * Send a single GeoEnrichment report request.
 * @returns {Promise} Requests take a while, resolves with the server response.
 */
async function geoEnrichmentReport() {
    const geoEnrichService = testSwitches.useDev ? "https://geoenrichdev.arcgis.com" : "https://geoenrich.arcgis.com";
    const servicePath = "/arcgis/rest/services/World/geoenrichmentserver/GeoEnrichment/";
    const createReportURL = geoEnrichService + servicePath + "createReport";
    const reportParameters = {
      studyAreas: '[{"address":{"text":"10685 NW Dumar Ln. Portland, OR 97229"}},{"address":{"text":"380 New York St. Redlands, CA 92373"}},{"address":{"text":"3722 Crenshaw Blvd, Los Angeles, CA 90016"}}]',
      studyAreasOptions: '{"areaType":"RingBuffer","bufferUnits":"esriMiles","bufferRadii":[3,5,10]}',
      report: 'dandi',
      reportFields: '{"title": "Location Platform Report","subtitle": "Produced by Location Platform usage generator"}',
      useData: '{"sourceCountry":"US"}',
      forStorage: false,
      format: "xml", // xml|pdf
      f: "bin",
      token: token
    };

    return new Promise(function (resolve) {
      if (isCanceled) {
          resolve(null);
      }
      const url = new URL(createReportURL);
      url.search = new URLSearchParams(reportParameters);
      if ( ! reportedServiceURL) {
          process.stdout.write(`GeoEnrich request to ${url}\n`);
          reportedServiceURL = true;
      }
      fetch(url, getFetchParameters())
      .then(async function(response) {
          if (response.status != 200) {
              errorCount += 1;
              process.stderr.write(`Status ${response.status} on service ${createReportURL}\n`);
              resolve(null);
          } else {
              // const result = await response.json(); // response may not be JSON based on the f parameter
              resolve(result);
          }
      })
      .catch(function(exception) {
          process.stderr.write(`Error ${exception.toString()} on service ${geoEnrichURL}\n`);
          resolve(null);
      })
    });
}

/**
 * Send a single Routing request.
 * @returns {Promise} Requests take a while, resolves with the server response.
 */
async function routingRequest() {
  const routingService = testSwitches.useDev ? "https://routedev.arcgis.com" : "https://route-api.arcgis.com";
  const servicePath = "/arcgis/rest/services/World/Route/NAServer/Route_World/";
  const routingURL = routingService + servicePath + "solve";
  const routingParameters = {
      stops: "-122.68782,45.51238;-122.690176,45.522054;-122.614995,45.526201",
      startTime: "now",
      returnDirections: true,
      findBestSequence: true,
      f: "json",
      token: token
  };

  return new Promise(function (resolve) {
      if (isCanceled) {
          resolve(null);
      }
      const url = new URL(routingURL);
      url.search = new URLSearchParams(routingParameters);

      if ( ! reportedServiceURL) {
          process.stdout.write(`Routing request to ${url}\n`);
          reportedServiceURL = true;
      }
      fetch(url, getFetchParameters())
      .then(async function(response) {
          if (response.status != 200) {
              errorCount += 1;
              process.stderr.write(`Status ${response.status} on service ${routingURL}\n`);
              resolve(null);
          } else {
              const result = await response.json();
              process.stdout.write(`Routing response ${response.status}\n`);
              resolve(result);
          }
      })
      .catch(function(exception) {
          process.stderr.write(`Error ${exception.toString()} on service ${routingURL}\n`);
          resolve(null);
      })
  });
}

/**
 * Send a single Fleet Routing request.
 * @returns {Promise} Requests take a while, resolves with the server response.
 */
async function fleetRoutingRequest() {
  const logisticsService = testSwitches.useDev ? "https://logisticsdev.arcgis.com" : "https://logistics.arcgis.com";
  const fleetPath = "/arcgis/rest/services/World/VehicleRoutingProblemSync/GPServer/EditVehicleRoutingProblem/";
  const fleetURL = logisticsService + fleetPath + "execute";
  const fleetOrders = {
    "type": "features",
    "features": [{
        "attributes": {
            "Name": "Father's Office",
            "ServiceTime": 10
        },
        "geometry": {
            "x": -118.498406,
            "y": 34.029445
        }
      },
      {
        "attributes": {
            "Name": "R+D Kitchen",
            "ServiceTime": 10
        },
        "geometry": {
            "x": -118.495788,
            "y": 34.032339
        }
      },
      {
        "attributes": {
            "Name": "Pono Burger",
            "ServiceTime": 10
        },
          "geometry": {
          "x": -118.489469,
          "y": 34.019000
        }
      },
      {
        "attributes": {
            "Name": "Il Ristorante di Giorgio Baldi",
            "ServiceTime": 10
        },
          "geometry": {
          "x": -118.518787,
          "y": 34.028508
        }
      },
      {
        "attributes": {
            "Name": "Milo + Olive",
            "ServiceTime": 10
        },
          "geometry": {
          "x": -118.476026,
          "y": 34.037572
        }
      },
      {
        "attributes": {
            "Name": "Dialogue",
            "ServiceTime": 10
        },
          "geometry": {
          "x": -118.495814,
          "y": 34.017042
        }
      }]
  };
  const fleetDepots = {
    "type":"features",
    "features" : [{
      "attributes" : {
          "Name" : "Bay Cities Kitchens and Appliances"
      },
      "geometry" : {
          "x" : -118.469630,
          "y" : 34.037555
      }
    }]
  };
  const fleetRoutes = {
    "features": [{
      "attributes": {
          "Name": "Route 1",
          "Description": "vehicle 1",
          "StartDepotName": "Bay Cities Kitchens and Appliances",
          "EndDepotName": "Bay Cities Kitchens and Appliances",
          "Capacities": "4",
          "MaxOrderCount": 3,
          "MaxTotalTime": 60,
        }
      },
      {
    "attributes": {
          "Name": "Route 2",
          "Description": "vehicle 2",
          "StartDepotName": "Bay Cities Kitchens and Appliances",
          "EndDepotName": "Bay Cities Kitchens and Appliances",
          "Capacities": "4",
          "MaxOrderCount": 3,
          "MaxTotalTime": 60,
        }
      }
  ]
  };
  const fleetParameters = {
      populate_directions: true,
      orders: JSON.stringify(fleetOrders),
      depots: JSON.stringify(fleetDepots),
      routes: JSON.stringify(fleetRoutes),
      f: "json",
      token: token
  };

  return new Promise(function (resolve) {
      if (isCanceled) {
          resolve(null);
      }
      const url = new URL(fleetURL);
      url.search = new URLSearchParams(fleetParameters);

      if ( ! reportedServiceURL) {
          process.stdout.write(`Fleet Routing request to ${url}\n`);
          reportedServiceURL = true;
      }
      fetch(url, getFetchParameters())
      .then(async function(response) {
          if (response.status != 200) {
              errorCount += 1;
              process.stderr.write(`Status ${response.status} on service ${fleetURL}\n`);
              resolve(null);
          } else {
              const result = await response.json();
              process.stdout.write(`Fleet Routing response ${response.status}\n`);
              resolve(result);
          }
      })
      .catch(function(exception) {
          process.stderr.write(`Error ${exception.toString()} on service ${fleetURL}\n`);
          resolve(null);
      })
  });
}

async function routingJobUsageGenerator(interval, count) {
  // New function to test asyn Job submit for routing
// https://logisticsdev.arcgis.com/arcgis/rest/services/World/Route/GPServer/FindRoutes/submitJob
// f:json
// token:{{API Key}}
// stops:-122.68782,45.51238;-122.690176,45.522054;-122.614995,45.526201
// startTime:now
// returnDirections:true
}

/**
 * Generate routing usage.
 * @param {integer} interval Number of milliseconds between requests to be nice to the servers.
 * @param {integer} count Total number of requests to make.
 */
async function routingUsageGenerator(interval, count) {
  let hitsRemaining = count;

  async function processRoutingRequest() {
      const result = await routingRequest();
      const routingResult = JSON.stringify(result);
      requestCount += 1;
      hitsRemaining -= 1;
      process.stdout.write(`Fetched ${(count - hitsRemaining)} ${routingResult}\n\n\n`);
      if (hitsRemaining > 0) {
          setTimeout(processRoutingRequest, interval);
      }
  }

  processRoutingRequest();
}

/**
 * Generate fleet routing usage.
 * @param {integer} interval Number of milliseconds between requests to be nice to the servers.
 * @param {integer} count Total number of requests to make.
 */
async function fleetRoutingUsageGenerator(interval, count) {
  let hitsRemaining = count;

  async function processFleetRoutingRequest() {
      const result = await fleetRoutingRequest();
      const routingResult = JSON.stringify(result);
      requestCount += 1;
      hitsRemaining -= 1;
      process.stdout.write(`Fetched ${(count - hitsRemaining)} ${routingResult}\n\n\n`);
      if (hitsRemaining > 0) {
          setTimeout(processFleetRoutingRequest, interval);
      }
  }

  processFleetRoutingRequest();
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

async function spatialAnalysisTestUsage(interval, count) {
  const mySpatialAnalysisServiceURL = process.env.ANALYSIS_SERVICE_URL;
  const myFeatureServiceURL = process.env.FEATURE_SERVICE_URL;
  const statesLayer = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Boundaries_2022/FeatureServer"
  const accessToken = ApiKeyManager.fromKey(token); // testing SA with an API key, use authentication to test with OAuth token
  const operationURL = `${mySpatialAnalysisServiceURL}SummarizeWithin/submitJob`;
  const parameters = {
    summaryLayer: '{"url":"' + myFeatureServiceURL + '","name":"Breweries"}',
    sumWithinLayer: '{"url":"' + statesLayer + '","name":"State boundaries"}',
    sumShape: true,
    shapeUnits: "Miles",
    groupByField: "STATE",
    minorityMajority: false,
    returnProcessInfo: true,
    outputName: '{"serviceProperties":{"name":"Summarize within results"}}',
    f: "json"
  };

  process.stdout.write(`generating analysis usage on ${operationURL} with REST JS\n`);

  // Using ArcGIS REST JS to monitor job status
  Job.submitJob({
    authentication: accessToken, // authentication,
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
  });
}

async function spatialAnalysisTestUsageWithFetch(interval, count) {
  const mySpatialAnalysisServiceURL = process.env.ANALYSIS_SERVICE_URL;
  const myFeatureServiceURL = process.env.FEATURE_SERVICE_URL;
  const statesLayer = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Boundaries_2022/FeatureServer"
  const myHeaders = new Headers();
  const accessToken = token; // authentication.token; // token;
  myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

  const urlencoded = new URLSearchParams();
  urlencoded.append("summaryLayer", "{\"url\":\"" + myFeatureServiceURL + "\",\"name\":\"Breweries\"}");
  urlencoded.append("sumWithinLayer", "{\"url\":\"" + statesLayer + "\",\"name\":\"State boundaries\"}");
  urlencoded.append("sumShape", "true");
  urlencoded.append("shapeUnits", "Miles");
  urlencoded.append("groupByField", "ROUTE");
  urlencoded.append("minorityMajority", "false");
  urlencoded.append("outputName", "{\"serviceProperties\":{\"name\":\"Summarize within results\"}}");
  urlencoded.append("f", "json");
  urlencoded.append("token", accessToken);

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: urlencoded,
    redirect: "follow"
  };
  const operationURL = `${mySpatialAnalysisServiceURL}SummarizeWithin/submitJob`;
  process.stdout.write(`generating analysis usage on ${operationURL} with fetch:\n`);
  process.stdout.write(`using token ${accessToken}\n`);
  
  fetch(operationURL, requestOptions)
    .then(function(response) {
      response.text()
      .then(function(result) {
        // {"jobId":"jd76560c0aedc4ada9f46284452cbc532","jobStatus":"esriJobSubmitted","results":{},"inputs":{},"messages":[]}
        const serverResponse = JSON.parse(result);
        if (serverResponse.error) {
          console.error(`Error ${serverResponse.error.code}: ${serverResponse.error.message}`);
        } else {
          const jobId = serverResponse.jobId;
          console.log(`Server job ${serverResponse.jobId} status ${serverResponse.jobStatus}`);

          // poll the job until status complete
        }
      });
    })
    .catch(function(error) {
      console.error("Exception from SA service: " + error.toString());
    });
}

async function spatialAnalysisUsageGenerator(interval, count) {
    const mySpatialAnalysisServiceURL = process.env.ANALYSIS_SERVICE_URL;
    const myFeatureServiceURL = process.env.FEATURE_SERVICE_URL;
    const operation = "FindHotSpots";
    const operationURL = mySpatialAnalysisServiceURL + operation;
    const accessToken = ApiKeyManager.fromKey(token); // testing SA with an API key

    // Spatial analysis requires a logged in user access token
    // if ( ! authentication) {
    //   process.stdout.write(`Must have signIn to process spatial analysis\n`);
    //   process.exit(7);
    // }
    // API key must be scoped to Spatial Analysis PLUS "create, update and delete content privilege"
    process.stdout.write(`generating analysis usage on ${operationURL}\n`);

    const parameters = {
      analysisLayer: '{"url":"' + myFeatureServiceURL + '"}',
      returnProcessInfo: true,
      shapeType: "fishnet",
      context: '{}',
      f: "json"
    };
    requestCount += 1;
    // Using ArcGIS REST JS to monitor job status
    Job.submitJob({
      authentication: accessToken, // authentication,
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
}

function exitHandler() {
    isCanceled = true;
    endTime = Date.now();
    const elapsedTime = (endTime - startTime) / 1000;
    process.stdout.write(`\n\nProcessed ${requestCount} requests in ${elapsedTime} seconds. There were ${errorCount} errors.\n\n`);
    process.exit(0);
}

// process.on('exit', exitHandler);
// process.on('SIGINT', exitHandler);
// process.on('SIGUSR1', exitHandler);
// process.on('SIGUSR2', exitHandler);
// process.on('uncaughtException', exitHandler);

async function runUsageTest() {
    startTime = Date.now();
    const dateReport = new Date(startTime);
    process.stdout.write(`ArcGIS Service Usage Generator started at ${dateReport.toLocaleString()} for ${testSwitches.iterations} iterations.\n\n`);
    await getAuthentication();
    if (token != null || authentication != null) {
        reportedServiceURL = false;
        if (testSwitches.geocodeClientTest) {
            geocodeClientTest();
        }
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
        if (testSwitches.geoenrichmentReport) {
            geoEnrichmentReportUsageGenerator();
            reportedServiceURL = false;
        }
        if (testSwitches.routing) {
            routingUsageGenerator(testSwitches.serviceRequestDelay, testSwitches.iterations);    
            fleetRoutingUsageGenerator(testSwitches.serviceRequestDelay, testSwitches.iterations);    
            reportedServiceURL = false;
        }
        if (testSwitches.featureQuery) {
            featureQueryUsageGenerator(testSwitches.serviceRequestDelay, testSwitches.iterations);    
            reportedServiceURL = false;
        }
        if (testSwitches.analysis) {
            reportedServiceURL = false;
            spatialAnalysisUsageGenerator(testSwitches.serviceRequestDelay, testSwitches.iterations);    
            // spatialAnalysisTestUsageWithFetch(testSwitches.serviceRequestDelay, testSwitches.iterations);    
        }
    } else {
        process.stderr.write(`Cannot authenticate. Verify your authentication configuration.\n`);
    }
}

runUsageTest();
