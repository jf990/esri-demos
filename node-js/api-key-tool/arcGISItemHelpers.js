/**
 * Utility functions to work with content items in an ArcGIS Organization.
 * getAuthenticationItems: get an array of the users authentication items (OAuth apps and API keys.)
 * createAPIKey: create a new API key.
 */

import { searchItems, SearchQueryBuilder, createItem } from "@esri/arcgis-rest-portal";
import { request } from "@esri/arcgis-rest-request";

const ArcGISPrivileges = {
    basemaps:               "portal:apikey:basemaps",
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
    analysisSpatial:        "premium:user:spatialanalysis",
    analysisRaster:         "premium:publisher:rasteranalysis",
    geoanalytics:           "premium:publisher:geoanalytics",
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

/**
 * Create a new API key with the item options provided. Required options are:
 *   title, description, tags, httpReferrers, Redirect_urls, privileges.
 * Creating a new API key requires 2 separate request: first to create a portal item
 * of type API Key, and then to register the app with the API key configuration.
 * @param {object} options Complete set of options required to define a new API key.
 * @param {ArcGISIdentityManager} authentication Logged in user session who will own the item.
 * @returns {Promise} Resolves with the API key item details.
 */
function createAPIKey(options, authentication) {

    return new Promise(function (resolve, reject) {
        options.type = "API Key";

        if ( ! verifyAPIKeyOptions(options)) {
            reject(new Error("Insufficient or incorrect options for API key."));
            return;
        }
        createPortalItem(options, authentication)
        .then(function(serverResponse) {
            if (serverResponse.success) {
                registerAPIKeyApp(serverResponse.id, options, authentication)
                .then(function (itemDetails) {
                    resolve(itemDetails);
                })
                .catch(function (registrationError) {
                    reject(registrationError);
                });
            } else {
                reject(new Error(serverResponse.error));
            }
        })
        .catch(function (serverError) {
            reject(serverError);
        });
    });
}

/**
 * Update an existing API key with the item options provided. Options are:
 *   title, description, tags, httpReferrers, Redirect_urls, privileges.
 * Options are optional, only the provided options are updated.
 * @param {object} options Registered app properties to update.
 * @param {string} clientId The client ID assigned to the registered app associated with the API key item.
 * @param {string} itemId The item id of a registered app owned by the authenticated user.
 * @param {ArcGISIdentityManager} authentication Logged in user session who will own the item.
 * @returns {Promise} Resolves with the API key item details.
 */
 function updateAPIKey(itemId, clientId, options, authentication) {

    if ( ! verifyAPIKeyOptions(options)) {
        throw(new Error("Insufficient or incorrect options for API key."));
    }
    const portalServiceUrl = `${authentication.portal}/oauth2/apps/${clientId}/update`;
    const apiKeyUpdateOptions = {
        httpMethod: "POST",
        params: options,
        authentication: authentication
    };
    return request(portalServiceUrl, apiKeyUpdateOptions);
}

/**
 * Reset an API key. Reset invalidates the old key and creates a new API key while maintaining
 * the same item ID.
 * @param {string} clientId The client ID assigned to the registered app associated with the API key item.
 * @param {string} itemId The item id of a registered app owned by the authenticated user.
 * @param {ArcGISIdentityManager} authentication Logged in user session who owns the app/item.
 * @returns {Promise} Resolves with the new API key.
 */
 function resetAPIKey(clientId, itemId, authentication) {

    const portalServiceUrl = `${authentication.portal}/oauth2/apps/${clientId}/resetApiKey`;
    const apiKeyResetOptions = {
        httpMethod: "POST",
        params: {
            itemId: itemId,
        },
        authentication: authentication
    };
    return request(portalServiceUrl, apiKeyResetOptions);


    return new Promise(function (resolve, reject) {
        createPortalItem(options, authentication)
        .then(function(serverResponse) {
            if (serverResponse.success) {
                registerAPIKeyApp(serverResponse.id, options, authentication)
                .then(function (itemDetails) {
                    resolve(itemDetails);
                })
                .catch(function (registrationError) {
                    reject(registrationError);
                });
            } else {
                reject(new Error(serverResponse.error));
            }
        })
        .catch(function (serverError) {
            reject(serverError);
        });
    });
}

/**
 * Delete an API key.
 * @param {string} itemId The item id the API key registered app owned by the authenticated user.
 * @param {ArcGISIdentityManager} authentication Logged in user session who owns the app/item.
 * @returns {Promise} Resolves with the response from the server.
 */
 function deleteAPIKey(itemId, authentication) {
    return deletePortalItem(itemId, authentication);
}

export {
    ArcGISPrivileges,
    createAPIKey,
    updateAPIKey,
    resetAPIKey,
    deleteAPIKey,
    getAuthenticationItems
};

// NOTES
//
// get apps/api keys
// https://www.arcgis.com/sharing/rest/search?
// f=json
// &q=owner:HermanMunster AND (type:"API Key") AND (typekeywords:"Registered App")
// &num=10
// &start=1
// &sortField=modified
// &sortOrder=desc
// &token=

// get registered app info
// https://www.arcgis.com/sharing/rest/content/users/HermanMunster/items/${item_id}/registeredAppInfo
// https://www.arcgis.com/sharing/rest/content/users/HermanMunster/items/84244de86e934e7582c68a38720f94d9/registeredAppInfo

// create new api key part 1
// https://www.arcgis.com/sharing/rest/content/users/HermanMunster/addItem
// f: json
// title: John Test 2
// snippet: John Test 2
// type: API Key
// token: 
//
// Response {"success":true,"id":"e39a530a9c554965ab5133513a67cb1f","folder":null}
//
// create new api key part 2
// https://www.arcgis.com/sharing/rest/oauth2/registerApp
// f: json
// appType: apikey
// httpReferrers: []
// redirect_uris: []
// privileges: ["premium:user:geocode:temporary","premium:user:networkanalysis:routing","premium:user:networkanalysis:servicearea","portal:apikey:basemaps"]
// itemId: e39a530a9c554965ab5133513a67cb1f
// token:
// Response
// {
//     "itemId": "e39a530a9c554965ab5133513a67cb1f",
//     "client_id": "zzGbcTFSuh5eNedh",
//     "client_secret": "f472129f3ba342578bf91ebbdc98a85c",
//     "appType": "apikey",
//     "redirect_uris": [],
//     "registered": 1662761411000,
//     "modified": 1662761411000,
//     "apnsProdCert": null,
//     "apnsSandboxCert": null,
//     "gcmApiKey": null,
//     "httpReferrers": [],
//     "privileges": [
//         "premium:user:networkanalysis:servicearea",
//         "premium:user:geocode:temporary",
//         "premium:user:networkanalysis:routing",
//         "portal:apikey:basemaps"
//     ],
//     "isBeta": false,
//     "apiKey": "AAPKf622467d022042debf1a8399a93b9671CcCXnqapmjfgkboRwxihipvdIzA-HNf2a3Kr58RFsQtH5vqW0pnXkmdHiV9s83tE"
// }
