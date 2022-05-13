/**
 * ArcGIS REST JS node.js demo.
 * There are 4 demos here, designed to demonstrate some of the features of the ArcGIS REST JS library.
 * 1. geocodeFromCommandLine() to geocode address(es) entered on the command line.
 * 2. geocodeAddress(address) to convert a string to locations using the World Geocoder Service.
 * 3. findPlaces(placeType, location) to locate places of a given type lear a location using the World Geocoder Service.
 * 4. applicationSession demonstrates how to set up application authentication in order to use a service that requires a token.
 * 5. getDirections(stops) demonstrates how to get directions between multiple locations using the routing service.
 */

require('dotenv').config();
require("isomorphic-form-data");
const fetch = require("cross-fetch");
const { setDefaultRequestOptions } = require("@esri/arcgis-rest-request");
const { geocode } = require("@esri/arcgis-rest-geocoding");
const { solveRoute } = require("@esri/arcgis-rest-routing");

// When using ArcGIS REST JS in a node application there needs to be a fetch polyfill.
// (This is not required if running in a web browser.)
setDefaultRequestOptions({ fetch });

/**
 * Geocode what was provided.
 * Logs the result to the console.
 * https://esri.github.io/arcgis-rest-js/api/geocoding/geocode/
 * 
 * @param {string} singleLine A string of text to search for with the geocoder.
 * @returns {Promise} A promise that will resolve with the candidate address.
 */
function geocodeAddress(singleLine) {
  return new Promise(function(resolve, reject) {
    if (!singleLine && singleLine.length > 0) {
      reject(new Error("Nothing to search for - done!"));
    } else {
      geocode({
        f: "json",
        singleLine: singleLine,
        category: "POI",
        outFields: "PlaceName,Place_addr,Phone,URL,Type",
        forStorage: "false",
        maxLocations: "1",
      })
      .then(function(response) {
        if (response.candidates.length > 0) {
          resolve(response.candidates[0]);
        } else {
          reject(new Error("Nothing found for " + singleLine));
        }
      }, function(error) {
        reject(new Error("Geocoding error " + error.toString()));
      });
    }
  });
}

/**
 * Find places of a given category at or near a given location.
 * Logs the result to the console.
 * 
 * @param {string} placeType Category of places to search for.
 * @param {object} location {x,y} key value to define the x and y coordinates around where to perform the search.
 * @returns doesn't return anything, but logs the result to the console.
 */
function findPlaces(placeType, location) {
  const maxLocations = 10;
  if (placeType === null || placeType === "") {
    placeType = "Landmark,Historical Monument,Museum";
  }
  if (location == null) {
    location = {
      x: -77.023439974464736,
      y: 38.902970048906099
    }
  }
  geocode({
    singleLine: "",
    outFields: "PlaceName,Place_addr,Phone,URL,Type",
    params: {
      category: placeType,
      maxLocations: maxLocations,
      location: `${location.x},${location.y}`
    }
  })
  .then(function(response) {
    const places = response.candidates;
    if (places.length > 0) {
      console.log(`Found ${places.length} places near ${location.x},${location.y}\n\n`);
      for (let i = 0; i < places.length; i ++) {
        let place = places[i].attributes;
        if (place.PlaceName) {
          console.log(`${place.PlaceName} (${place.Type})\n${place.Place_addr}\n${place.Phone} ${place.URL}\n\n`);
        }
      }
    } else {
      console.log(`Nothing found near ${JSON.stringify(location)} matching ${placeType}`);
    }
  }, function(error) {
    console.log("Find places error " + error.toString());
  })
  .catch(function(exception) {
    console.log("Find places exception " + exception.toString());
  })
}

/**
 * Setup application authentication from registered application.
 * Put your app's ClientID and ClientSecret in a .env file.
 * https://esri.github.io/arcgis-rest-js/api/auth/ApplicationSession/
 * https://developers.arcgis.com/applications
 */
const { ApplicationSession } = require("@esri/arcgis-rest-auth");
const applicationSession = new ApplicationSession({
  clientId: process.env.CLIENTID,
  clientSecret: process.env.CLIENTSECRET
});

/**
 * Get directions between two points.
 * Routing requires an authentication token.
 * https://esri.github.io/arcgis-rest-js/api/routing/solveRoute/
 * Logs the result to the console.
 * 
 * @param {array} stops is an array of point arrays representing each stop. Each entry is [x, y].
 * @returns doesn't return anything, but logs the result to the console.
 */
function getDirections(stops) {
  if (stops == null || stops.length < 2) {
    stops = [
      [-77.023439974464736, 38.902970048906099],
      [-77.036430054965564, 38.897929948352669]
    ];
  }
  solveRoute({
    stops: stops,
    authentication: applicationSession
  })
  .then(function(response) {
    const summary = response.directions[0].summary;
    const features = response.directions[0].features;
    console.log(features.length + " direction steps");
    for (let i = 0; i < features.length; i ++) {
      let step = features[i];
      if (step.attributes && step.attributes.text) {
        console.log(features[i].attributes.text);
      }
    }
  }, function(error) {
    console.log("Routing error " + error.toString());
  });
};

/**
 * Perform a geocode if given something to search for on the command line.
 * With a single command line parameter, take it as and address and find
 * nearby places.
 * With two command line parameters, get directions between the two addresses.
 */
function geocodeFromCommandLine() {
  if (process.argv.length === 3) {
    // if one address is requested, geocode it then find nearby places.
    const commandLineAddress = process.argv[2];
    geocodeAddress(commandLineAddress)
    .then(function(candidate) {
      findPlaces("Landmark,Historical Monument,Museum", candidate.location);
    })
    .catch(function(exception) {
      console.log("geocodeAddress exception " + exception.toString());
    });
  } else if (process.argv.length === 4) {
    // if 2 addresses, geocode them both then get directions.
    const commandLineAddressStart = process.argv[2];
    const commandLineAddressEnd = process.argv[3];
    geocodeAddress(commandLineAddressStart)
    .then(function(candidate1) {
      geocodeAddress(commandLineAddressEnd)
      .then(function(candidate2) {
        const stops = [
          [candidate1.location.x, candidate1.location.y],
          [candidate2.location.x, candidate2.location.y]
        ];    
        getDirections(stops);
      })
      .catch(function(exception) {
        console.log("geocodeAddress exception " + exception.toString());
      })
    })
    .catch(function(exception) {
      console.log("geocodeAddress exception " + exception.toString());
    });
  }
}

geocodeFromCommandLine();
