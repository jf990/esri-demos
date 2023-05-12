/**
 * Generate usage reports of your ArcGIS Platform authentication (OAuth apps and API keys.)
 * Report generation requires a logged in user. Update secret.js with your credentials and make
 * sure to keep that file secure.
 */
import { ArcGISIdentityManager } from "@esri/arcgis-rest-request";
import { createServiceUsageReport } from "./usageReport.js";
import { ArcGISPrivileges, createAPIKey, resetAPIKey, deleteAPIKey, getAuthenticationItems } from "./arcGISItemHelpers.js";
import dotenv from "dotenv";

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
                        console.log(`id: ${item.id}, title: ${item.title}, type: ${item.type}, created: ${item.created}`);
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
 * Testing create an API key. @todo: need to figure out what to do with the results. Save it? YML? CSV? JSON? or output JSON on the command line?
 */
async function createNewAPIKey() {
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {

                const apiKeyOptions = {
                    title: "John test API key 1",
                    description: "API key created by automation",
                    tags: "key, auth, data, map",
                    privileges: [ArcGISPrivileges.basemaps, ArcGISPrivileges.geocode, ArcGISPrivileges.route, ArcGISPrivileges.analysisSpatial],
                    httpReferrers: [],
                    redirect_uris: []
                };

                createAPIKey(apiKeyOptions, authentication)
                .then(function(apiKeyDetails) {
                    console.log(`createAPIKey says ` + JSON.stringify(apiKeyDetails));
                })
                .catch(function(error) {
                    console.log("createAPIKey error: " + error.toString());
                    process.exit(90);
                })
            } else {
                console.log("createAPIKey Login error: invalid login.");
                process.exit(91);
            }
        })
        .catch(function(loginError) {
            console.log("createAPIKey Login error: " + loginError.toString());
            process.exit(92);
        });
    } catch (loginError) {
        console.log("createAPIKey Login error: " + loginError.toString());
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

// usageReport();
createNewAPIKey();

/*
HermanMunseter key
createAPIKey says {"itemId":"37d58e4210004e1597feb35db7be91ba","client_id":"dXbgXt4symAfULs1","client_secret":"bae9ee44434f400f9f933117a9dea4b0","appType":"apikey","redirect_uris":[],"registered":1666306403000,"modified":1666306403000,"apnsProdCert":null,"apnsSandboxCert":null,"gcmApiKey":null,"httpReferrers":[],"privileges":["premium:user:geocode:temporary","premium:user:spatialanalysis","premium:user:networkanalysis:routing","portal:apikey:basemaps"],"isBeta":false,"apiKey":"AAPK2eecd45fb0e149c58c0e8b38d75b6f98sNma3hWT28H_SMOR7NYoEY3Sc-gID-6O2hqmRgjfRjKoR6850qqe9lzUXXJEN6vj"}

POTesting key
createAPIKey says {"itemId":"c53ff30861da4b0a885cda50021b2816","client_id":"Avj7JHYMB3kDM2TI","client_secret":"ef46918798324d268793fe6e14405d56","appType":"apikey","redirect_uris":[],"registered":1666309055000,"modified":1666309055000,"apnsProdCert":null,"apnsSandboxCert":null,"gcmApiKey":null,"httpReferrers":[],"privileges":["premium:user:geocode:temporary","premium:user:spatialanalysis","premium:user:networkanalysis:routing","portal:apikey:basemaps"],"isBeta":false,"apiKey":"AAPK1678e42cdc2a4a6ea32092fd48782197hqRNXXisSdCripFSqjvmPB_3umRCoep0s8U0iMfV5UJXRkiNosuFZnw1fvERmEzY"}
*/

// HermanMunseter key
// const clientId = "dXbgXt4symAfULs1";
// const itemId = "37d58e4210004e1597feb35db7be91ba";
// POTesting key
// const clientId = "Avj7JHYMB3kDM2TI";
// const itemId = "c53ff30861da4b0a885cda50021b2816";
// const apiKey = "AAPK1678e42cdc2a4a6ea32092fd48782197hqRNXXisSdCripFSqjvmPB_3umRCoep0s8U0iMfV5UJXRkiNosuFZnw1fvERmEzY";

// resetExistingAPIKey(clientId, itemId);

// deleteExistingAPIKey(itemId);

