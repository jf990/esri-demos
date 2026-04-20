/**
 * Generate usage reports of your ArcGIS Platform authentication (OAuth apps and API keys.)
 * Report generation requires a logged in user. Update .env with your credentials and make
 * sure to keep that file secure.
 */
import { createApiKey, updateApiKey } from '@esri/arcgis-rest-developer-credentials';
import { ArcGISIdentityManager } from "@esri/arcgis-rest-request";
import { createServiceUsageReport } from "./usageReport.js";
import { ArcGISPrivileges, getAuthenticationItems } from "./arcGISItemHelpers.js";
import dotenv from "dotenv";

const threeDaysFromToday = new Date();
threeDaysFromToday.setDate(threeDaysFromToday.getDate() + 3);
threeDaysFromToday.setHours(23, 59, 59, 999);

/**
 * Log in a user with the credentials set in the credentials store.
 * @returns {ArcGISIdentityManager} An identity manager object for the logged in user.
 */
function signIn() {
    dotenv.config();
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
 * Generate a usage report for the logged in user.
 * @param {ArcGISIdentityManager} authentication The authentication object of the logged in user.
 * @returns {Promise} Resolves when the report is created and an item id is assigned.
 */
 function createUsageReport(authentication) {
    const reportOptions = {
        timeDuration: "monthly",
        timeOffset: 1,
        title: "Usage-last-month"
    };
    return createServiceUsageReport(reportOptions, authentication);
}

/**
 * Get a collection of the user's authentication items. These are content items that are API keys
 * and OAuth 2 apps belonging to the user's account.
 * @param {ArcGISIdentityManager} authentication The authentication object of the logged in user.
 * @returns {Promise} Resolves with the array of items.
 */
function getUserAuthenticationItems(authentication) {
    return new Promise(function(resolve, reject) {
        getAuthenticationItems(authentication)
        .then(function(items) {
            let filteredItems = [];
            items.forEach(function(item) {
                filteredItems.push({
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    snippet: item.snippet,
                    type: item.type,
                    created: item.created,
                    modified: item.modified,
                    tags: item.tags
                });
            });
            resolve(filteredItems);
        })
        .catch(function(exception) {
            reject(exception);
        });
    });
}

async function usageReport() {
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                getUserAuthenticationItems(authentication)
                .then(function(items) {
                    console.log(`getUserAuthenticationItems found ${items.length} items:`);
                    items.forEach(function(item) {
                        const createDate = new Date(item.created);
                        const formattedDate = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(createDate);
                        console.log(`id: ${item.id}, title: ${item.title}, type: ${item.type}, created: ${formattedDate}`);
                    });
                    createUsageReport(authentication)
                    .then(function() {
                        console.log("done.");
                    })
                    .catch(function(exception) {
                        console.log("Report generation failed: " + exception.toString());
                    });
                });
            } else {
                console.log("Login error: invalid login.");
                process.exit(91);
            }
        })
        .catch(function(loginError) {
            console.log("Login error: " + loginError.toString());
            process.exit(92);
        });
    } catch (loginError) {
        console.log("Login error: " + loginError.toString());
        process.exit(93);
    }
}

/**
 * Testing create an API key.
 * @todo: need to figure out what to do with the results. Save it? YML? CSV? JSON? or output JSON on the command line?
 */
async function createNewAPIKey(apiKeyOptions) {
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                apiKeyOptions.authentication = authentication;
                createApiKey(apiKeyOptions).then(function(registeredAPIKey) {
                    const itemId = registeredAPIKey.itemId;
                    const accessToken = registeredAPIKey.accessToken1;
                    const expireTime = registeredAPIKey.item.apiToken1ExpirationDate;
                    console.log(`createApiKey  new item ${itemId} token ${accessToken} expires ${expireTime}`);
                }).catch(function(error) {
                    console.log(`createAPIKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`);
                    process.exit(90);
                });
            } else {
                console.log("createAPIKey Login error: invalid login.");
                process.exit(91);
            }
        })
        .catch(function(loginError) {
            console.log("createAPIKey Login error: " + loginError.toString() + " Check your credentials.");
            process.exit(92);
        });
    } catch (loginError) {
        console.log("createAPIKey Login error: " + loginError.toString());
        process.exit(93);
    }
}

/**
 * update an existing API key.
 * @param {string} itemId of the portal item that holds the api key.
 */
async function updateAPIKey(itemId) {
    // Add places priv, remove referrers, update expire time
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                const apiKeyOptions = {
                    itemId: itemId,
                    privileges: [ArcGISPrivileges.basemaps, ArcGISPrivileges.geocode, ArcGISPrivileges.elevation, ArcGISPrivileges.places, ArcGISPrivileges.beta],
                    httpReferrers: [],
                    generateToken1: true,
                    apiToken1ExpirationDate: threeDaysFromToday,
                    authentication: authentication,
                };

                updateApiKey(apiKeyOptions).then(function(registeredAPIKey) {
                    const itemId = registeredAPIKey.itemId;
                    const accessToken = registeredAPIKey.accessToken1;
                    const expireTime = registeredAPIKey.item.apiToken1ExpirationDate;
                    console.log(`updateApiKey  updated item ${itemId} token ${accessToken} expires ${expireTime}`);
                }).catch(function(error) {
                    console.log(`updateAPIKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`);
                    process.exit(90);
                });
            } else {
                console.log("updateAPIKey Login error: invalid login.");
                process.exit(91);
            }
        })
        .catch(function(loginError) {
            console.log("updateAPIKey Login error: " + loginError.toString() + " Check your credentials.");
            process.exit(92);
        });
    } catch (loginError) {
        console.log("updateAPIKey Login error: " + loginError.toString());
        process.exit(93);
    }
}

/**
 * Testing reset an API key. @todo: where do we get clientID and itemID from?
 */
 async function resetExistingAPIKey(clientID, itemID) {
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                resetAPIKey(clientID, itemID, authentication)
                .then(function(serverResponse) {
                    console.log(`resetAPIKey says ` + JSON.stringify(serverResponse));
                })
                .catch(function(error) {
                    console.log("resetAPIKey error: " + error.toString());
                    process.exit(90);
                })
            } else {
                console.log("resetAPIKey Login error: invalid login.");
                process.exit(91);
            }
        })
        .catch(function(loginError) {
            console.log("resetAPIKey Login error: " + loginError.toString());
            process.exit(92);
        });
    } catch (loginError) {
        console.log("resetAPIKey Login error: " + loginError.toString());
        process.exit(93);
    }
}

/**
 * Testing delete an API key. @todo: where do we get clientID and itemID from?
 */
 async function deleteExistingAPIKey(itemID) {
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                deleteAPIKey(itemID, authentication)
                .then(function(serverResponse) {
                    console.log(`deleteAPIKey says ` + JSON.stringify(serverResponse));
                })
                .catch(function(error) {
                    console.log("deleteAPIKey error: " + error.toString());
                    process.exit(90);
                })
            } else {
                console.log("deleteAPIKey Login error: invalid login.");
                process.exit(91);
            }
        })
        .catch(function(loginError) {
            console.log("deleteAPIKey Login error: " + loginError.toString());
            process.exit(92);
        });
    } catch (loginError) {
        console.log("deleteAPIKey Login error: " + loginError.toString());
        process.exit(93);
    }
}

const apiKeyOptions = {
    title: "John test API key 1",
    description: "API key created by automation",
    tags: ["api-key", "auth", "demo"],
    privileges: [ArcGISPrivileges.basemaps, ArcGISPrivileges.geocode, ArcGISPrivileges.elevation, ArcGISPrivileges.beta],
    httpReferrers: ["http://localhost:8000", "https://localhost:8000"],
    redirect_uris: [],
    generateToken1: true,
    apiToken1ExpirationDate: threeDaysFromToday,
    authentication: null,
};
// createNewAPIKey();

const apiKeyItemId = "c12bdcf80bac4f698ba08636edcbd02e";
// updateAPIKey(apiKeyItemId);

// usageReport();
