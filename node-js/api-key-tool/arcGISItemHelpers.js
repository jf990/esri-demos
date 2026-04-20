/**
 * Utility functions to work with content items in an ArcGIS Organization.
 * getAuthenticationItems: get an array of the users authentication items (OAuth apps and API keys.)
 * createAPIKey: create a new API key.
 */
import { searchItems, SearchQueryBuilder, createItem } from "@esri/arcgis-rest-portal";
import { request } from "@esri/arcgis-rest-request";

const ArcGISPrivileges = {
    basemaps:               "premium:user:basemaps",
    basemapsStatic:         "premium:user:staticbasemaptiles",
    places:                 "premium:user:places",
    geocodeStored:          "premium:user:geocode:stored",
    geocode:                "premium:user:geocode:temporary",
    elevation:              "premium:user:elevation",
    geoEnrichment:          "premium:user:geoenrichment",
    demographics:           "premium:user:demographics",
    featureReport:          "premium:user:featurereport",
    route:                  "premium:user:networkanalysis:routing",
    routeOptimized:         "premium:user:networkanalysis:optimizedrouting",
    routeServiceArea:       "premium:user:networkanalysis:servicearea",
    routeOriginDestination: "premium:user:networkanalysis:origindestinationcostmatrix",
    routeAllocation:        "premium:user:networkanalysis:locationallocation",
    routeVRP:               "premium:user:networkanalysis:vehiclerouting",
    routeClosestFacility:   "premium:user:networkanalysis:closestfacility",
    routeSnapToRoads:       "premium:user:networkanalysis:snaptoroads",
    routeLastMileDelivery:  "premium:user:networkanalysis:lastmiledelivery",
    analysisSpatial:        "premium:user:spatialanalysis",
    analysisRaster:         "premium:publisher:rasteranalysis",
    geoanalytics:           "premium:publisher:geoanalytics",
    beta:                   "portal:user:allowBetaAccess",
    item:                   "portal:app:access:item:"
};

/**
 * Take a pass over all the provided options and try to verify they are acceptable and an attempt to create
 * an API key will succeed. Any errors detected are output to the console.
 * @param {object} options Expected API key options to verify.
 * @returns {boolean} True if all options seem to be OK to proceed, false if we detected something isn't correct.
 */
function verifyAPIKeyOptions(options) {
    let isValid = true; // we will prove otherwise
    let errorList = [];
    const apiKeyOptions = {
        title: "string:required",
        description: "string:optional",
        snippet: "string:optional",
        tags: "string:optional",
        privileges: "array:required",
        httpReferrers: "array:optional",
        redirect_uris: "array:optional"
    };
    for (const [property, value] of Object.entries(apiKeyOptions)) {
        const requiredDataType = value.substring(0, value.indexOf(":"));
        const isRequired = value.substring(value.indexOf(":") + 1) == "required";
        const providedValue = options[property];
        const wasProvided = providedValue !== undefined && providedValue !== null;
        let providedDataType;

        if (requiredDataType == "array" && Array.isArray(providedValue)) {
            providedDataType = "array";
        } else {
            providedDataType = typeof providedValue;
        }
        if (isRequired && ! wasProvided) {
            isValid = false;
            errorList.push(`Missing required option ${property}.`);
        }
        if (wasProvided && requiredDataType != providedDataType) {
            isValid = false;
            errorList.push(`Option ${property} is expected to be ${requiredDataType} but you provided ${providedDataType}.`);
        }
        if (property == "privileges" && providedDataType == "array") {
            let matched;
            let verifiedPrivs = [];
            let privString;
            for (const privilege of providedValue) {
                matched = false;
                for (const privName in ArcGISPrivileges) {
                    privString = ArcGISPrivileges[privName];
                    if (privilege == privName || privilege == privString) {
                        matched = true;
                        break;
                    }
                }
                if ( ! matched) {
                    isValid = false;
                    errorList.push(`Privilege ${privilege} is not a valid ArcGIS privilege.`);
                } else {
                    verifiedPrivs.push(privString);
                }
            }
        }
        if (errorList.length > 0) {
            console.error(errorList);
        }
    }
    return isValid;
}

/**
 * Get a list of the logged in user's API keys and OAuth apps as an array of items. This is
 * done using the portal search API https://developers.arcgis.com/rest/users-groups-and-items/search.htm.
 * @param {ArcGISIdentityManager} authentication Identity of the logged in user.
 * @returns {Promise} Resolves with the array of items.
 */
async function getAuthenticationItems(authentication) {
    const pageSize = 100;

    function getPageOfAuthenticationItems(page) {
        if (page < 1) {
            page = 1;
        } if (page > 1) {
            page = ((page - 1) * pageSize) + 1;
        }
        return new Promise(function (resolve, reject) {
            const query = new SearchQueryBuilder()
            .match(authentication.username)
            .in("owner")
            .and()
            .startGroup()
              .match("API Key")
              .in("type")
              .or()
              .match("Registered App")
              .in("typekeywords")
            .endGroup();
            query.start = page;
            query.num = pageSize;
    
            const options = {
                authentication: authentication,
                q: query,
                sortField: "created",
                sortOrder: "desc"
            };
            searchItems(options)
            .then(function(response) {
                resolve(response.results);
            })
            .catch(function(exception) {
                reject(exception);
            });    
        });
    }
    return new Promise(async function(resolve, reject) {
        let nextPage = 0;
        let allItems = [];

        // Query for items until we get less than a full page of items.
        while (true) {
            nextPage += 1;
            try {
                let items = await getPageOfAuthenticationItems(nextPage);
                allItems = allItems.concat(items);
                if (items.length < pageSize) {
                    break;
                }
            } catch (exception) {
                reject(exception);
                return;
            }
        }
        resolve(allItems);
    });
}

/**
 * Create a new portal item.
 * @param {object} itemOptions Options used to define the new portal item. Expects title, description, tags, and the item type.
 * @param {ArcGISIdentityManager} authentication A user session is required to create items.
 * @returns {Promise} Promise that resolves with the server response from the item creation service.
 */
function createPortalItem(itemOptions, authentication) {
    return createItem({
        item: {
            title: itemOptions.title,
            description: itemOptions.description,
            tags: itemOptions.tags,
            type: itemOptions.type
        },
        authentication: authentication
    });
}

/**
 * Delete a portal item.
 * @param {string} itemId An item ID to delete. This should be the item ID of the API key item that was returned from `createAPIKey`.
 * @param {ArcGISIdentityManager} authentication A user session is required to delete items.
 * @returns {Promise} Promise that resolves with the server response from the item creation service.
 */
 function deletePortalItem(itemId, authentication) {
    // POST https://arcgis.com/sharing/rest/content/users/${your-user-name}/items/${item-id}/delete

    const portalServiceUrl = `${authentication.portal}/content/users/${authentication.username}/items/${itemId}/delete`;
    const itemDeleteOptions = {
        httpMethod: "POST",
        authentication: authentication
    };
    return request(portalServiceUrl, itemDeleteOptions);
}

/**
 * Update an existing registered app with the API key information.
 * @param {string} itemId The item id of a registered app owned by the authenticated user.
 * @param {object} itemOptions Parameters required to create an API key, includes privileges (scopes), referrers, redirect URL.
 * @param {ArcGISIdentityManager} authentication Logged in user session.
 * @returns 
 */
function registerAPIKeyApp(itemId, itemOptions, authentication) {
    const portalServiceUrl = authentication.portal + "/oauth2/registerApp";
    const apiKeyRequestOptions = {
        httpMethod: "POST",
        params: {
            itemId: itemId,
            appType: "apikey",
            httpReferrers: JSON.stringify(itemOptions.httpReferrers),
            redirect_uris: JSON.stringify(itemOptions.redirect_uris),
            privileges: JSON.stringify(itemOptions.privileges)
        },
        authentication: authentication
    };
    return request(portalServiceUrl, apiKeyRequestOptions);
}

export {
    ArcGISPrivileges,
    getAuthenticationItems
};
