/**
 * Generate usage reports of your ArcGIS Platform authentication (OAuth apps and API keys.)
 * Report generation requires a logged in user. Update .env with your credentials and make
 * sure to keep that file secure.
 */
import { createApiKey, updateApiKey, invalidateApiKey, getApiKey } from '@esri/arcgis-rest-developer-credentials';
import { ArcGISIdentityManager } from "@esri/arcgis-rest-request";
import { createServiceUsageReport } from "./usageReport.js";
import { ArcGISPrivileges, getAuthenticationItems, updatePortalItem, getPortalItem } from "./arcGISItemHelpers.js";
import fsExtra from "fs-extra";
import YAML from "yaml";
import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
const log = console.log;

/**
 * Pick up command line arguments and invoke the requested tasks
 * ✅ -a genkeys: generate new API keys using apiKeyOptions template -n numberOfKeys
 * ✅ -a inspect: show properties for a single api key -t token or -i itemId
 * -a report: generate API keys report as CSV file
 * ✅ -a revoke: revoke a token on an existing api key, -i ArcGIS itemID of the API key to revoke, -k 1/2/all for which token to revoke.
 * ✅ -a regen: generate new tokens for an existing api key. -i ArcGIS itemID of the API key to update, -k 1/2/all for which token to regenerate, -d1 date or daysUntilExpiration -d2 date or daysUntilExpiration.
 * -a update: update an API key meta data such as title, description, tags, privileges, referrers, or redirect URIs. -i ArcGIS itemID of the API key to update, -t title, -d description, -k tags comma separated string, -p privileges comma separated string, -r referrers comma separated string, -u redirect URIs comma separated string.
 * -a delete: delete an existing api key -i ArcGIS itemID of the API key to delete.
 */
function performRequestAction() {
    const args = getCommandLineParameters();
    const action = args.a ?? "report";

    switch(action) {
      case "genkeys":
        // create new API keys
        const numberOfKeys = args.n ?? 1;
        const optionsFile = args.o ?? "./api-key-attributes.yaml";
        const sessionApiKeyOptions = loadOptions(optionsFile);
        if (sessionApiKeyOptions) {
            log(chalk.blue(`generate ${numberOfKeys} keys with options ${optionsFile} that will expire on ${sessionApiKeyOptions.apiToken1ExpirationDate}`));
            createNewAPIKeys(sessionApiKeyOptions, numberOfKeys);
        }
        break;
      case "report":
        // generate a report of all developer credentials
        usageReport();
        break;
      case "inspect":
        // inspect properties of a single api key
        const token = args.t ?? "";
        if (token != "") {
            inspectAPIKeyToken(token);
        } else {
            const itemID = args.i ?? "";
            if (itemID != "") {
                inspectAPIKeyItem(itemID);
            }
        }
        break;
      case "update":
        // update properties of a single api key
        updateAPIKeyProperties(args);
        break;
      case "delete":
        // delete an api key given its item ID
        deleteAPIKey(args.i ?? "");
        break;
      case "revoke":
        // revoke both tokens of a single api key
        revokeAPIKey(args);
        break;
      case "regen":
        // generate new tokens for api key 1, 2 or both, given the item ID.
        regenerateAPIKey(args);
        break;
      default:
        log(chalk.red(`Unknown action ${action}. Action is required. Valid actions are genkeys, report, inspect, update, delete, revoke.`));
        break;
    }
}

/**
 * Return a Date object set at the date some number of days from today.
 * @param {integer} daysUntilExpiration Number of days from today.
 * @returns {Date} A date object set at the number of days from today.
 */
function getRelativeExpireDate(daysUntilExpiration) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysUntilExpiration);
    expirationDate.setHours(23, 59, 59, 999);
    return expirationDate;
}

/**
 * A basic wait function to pause things briefly so we don't overload the server.
 * @param {integer} milliseconds Time to wait.
 */
function sleeper (milliseconds) {
    new Promise(function(resolve) {
        setTimeout(resolve, milliseconds);
    });
}

/**
 * Helper function to determine if a value is empty. We consider a value empty if it is null, undefined, an empty string,
 * an empty array, or an empty object.
 * @param {any} value A value to test for emptiness.
 * @returns {boolean} True if considered empty, false if not empty.
 */
function isEmpty(value) {
    return (
    value == null || value == "" // null or undefined or coerced to an empty string
      || (typeof value === 'string' && value.trim().length === 0) // empty string
      || (Array.isArray(value) && value.length === 0) // empty array
      || (typeof value === 'object' && Object.keys(value).length === 0) // empty object
    );
}

/**
 * Clean the tags array as it gets messy with extra quotes and brackets and flatten it into a single string.
 * @param {array|string} tags Tags returned from an item query.
 * @returns {string} Flattened and cleaned list of tags.
 */
function cleanTags(tags) {
    function tagReplace(tag) {
        return tag.replace(/\"/g, "").replace(/\[/g, "").replace(/\]/g, "").trim();
    }

    let listOfTags = "";
    if (Array.isArray(tags)) {
        tags.forEach(function(tag) {
            listOfTags += (listOfTags ? ", " : "") + tagReplace(tag);
        });
    } else {
        listOfTags = tagReplace(tags);
    }
    return listOfTags;
}

/**
 * Determine the api key expiration date by considering 2 values. The first is a real date,
 * hopefully in the future, in a form that is parsable by the Date object. If this is not
 * provided or invalid, then use the second parameter as the number of days from today.
 * @param {string} fullDate Date string. If null or empty will then look at numberOfDays.
 * @param {integer} numberOfDays Number of days from today. Looked at only if fullDate is not provided. Must be a positive integer. Example: 3 means 3 days from today.
 * @return {integer} Date timestamp to use as API key expiration date.
 */
function dateFromOptions(fullDate, numberOfDays) {
    let expirationDate;
    if (fullDate) {
        expirationDate = new Date(fullDate);
        if (expirationDate.valueOf() === NaN) {
            expirationDate = getRelativeExpireDate(numberOfDays ?? 3);
        }
    } else {
        expirationDate = getRelativeExpireDate(numberOfDays ?? 3);
    }
    return expirationDate.valueOf();
}

/**
 * Convert timestamps into a human readable date string.
 * @param {integer} timestamp A Unix timestamp.
 * @returns {String} A date string in the format of "Month day, year" in the local timezone. If timestamp is less than 1000, returns "0".
 */
function localDateFormat(timestamp) {
    if (timestamp < 1000) {
        return "0";
    }
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

/**
 * Read the options YAML file and validate and copy options into the options
 * template used to create or update API keys.
 * @param {string} filePath Path to a YAML file with API key option attributes.
 * @return {object|null} an object created from the YAML data, or null if error.
 */
function loadOptions(filePath) {
    let optionsFile;
    try {
        optionsFile = fsExtra.readFileSync(filePath, "utf8");
    } catch (exception) {
        log(chalk.red(`Error reading options file ${filePath}: ${exception.message}`));
    }
    try {
        const options = YAML.parse(optionsFile);
        if (options) {
            const apiKeyOptions = {
                title: "",
                description: "",
                tags: [],
                privileges: [],
                httpReferrers: [],
                redirect_uris: [],
                generateToken1: false,
                apiToken1ExpirationDate: "",
                apiToken1ExpirationDays: 0,
                generateToken2: false,
                apiToken2ExpirationDate: "",
                apiToken2ExpirationDays: 0,
                authentication: null,
            };
            let localOptions = options.options ?? options;
            apiKeyOptions.title = localOptions.title ?? "No title";
            apiKeyOptions.description = localOptions.description ?? "No description provided.";
            apiKeyOptions.tags = JSON.stringify(localOptions.tags ?? []);
            apiKeyOptions.privileges = JSON.stringify(localOptions.privileges ?? []);
            apiKeyOptions.httpReferrers = JSON.stringify(localOptions.referrers ?? []);
            apiKeyOptions.redirect_uris = JSON.stringify(localOptions.redirect_uris ?? []);
            apiKeyOptions.generateToken1 = localOptions.generateToken1 ?? true;
            apiKeyOptions.apiToken1ExpirationDate = dateFromOptions(localOptions.apiToken1ExpirationDate ?? "", localOptions.apiToken1ExpirationDays ?? 0);
            apiKeyOptions.generateToken2 = localOptions.generateToken2 ?? false;
            apiKeyOptions.apiToken2ExpirationDate = dateFromOptions(localOptions.apiToken2ExpirationDate ?? "", localOptions.apiToken2ExpirationDays ?? 0);
            return apiKeyOptions;
        } else {
            log(chalk.red(`Invalid or missing API key options in ${filePath}.`));
        }
    } catch (exception) {
        log(chalk.red(`Error parsing options file YAML: ${exception.message}`));
    }
    return null;
}

/**
 * Helper function to try to determine if a value is numeric. This is used to determine
 * whether or not to put quotes around values when saving CSV files, since putting quotes
 * around numbers can cause problems when trying to use those numbers in other applications.
 * @param {string|Number} val Some value to test to see if it is a number.
 * @returns {boolean} True if the value is numeric, false if not a number.
 */
function isNumeric(val) {
  return !isNaN(parseFloat(val)) && isFinite(val);
}

/**
 * Save an array as a CSV file. This assumes the array data of the first element
 * is the same construct as all the elements in the array. The keys of the first
 * element are used to create the CSV header row.
 * @param {array} fileData Array of objects to store as a CSV file.
 * @param {string} filename Where to save the file.
 */
async function saveCSVFile(fileData, filename) {
    const headers = Object.keys(fileData[0]).join(",");
    const rows = fileData.map(function(row) {
        const numColumns = Object.keys(row).length;
        let rowString = "";
        Object.values(row).forEach(function(value, index) {
            if ( ! isNumeric(value)) {
                value = `"${value}"`;
            }
            rowString += value + (index < numColumns - 1 ? "," : "");
        });
        return rowString;
    }).join("\n");
    fsExtra.writeFile(filename, `${headers}\n${rows}`, function(error) {
        if (error) {
            log(chalk.red(`Cannot save CSV file: ${error.message}.`));
        } else {
            log(chalk.green(`API key tokens saved as ${filename}.`));
        }
    });
}

/**
 * Log in a user with the credentials set in the credentials store.
 * @returns {Promise} A Promise that will resolve with an ArcGISIdentityManager object for the logged in user.
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
        subType: "serviceUsages",
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
                    typeKeywords: item.typeKeywords,
                    created: item.created,
                    modified: item.modified,
                    tags: item.tags,
                    apiToken1ExpirationDate: item.apiToken1ExpirationDate,
                    apiToken2ExpirationDate: item.apiToken2ExpirationDate
                });
            });
            resolve(filteredItems);
        })
        .catch(function(exception) {
            reject(exception);
        });
    });
}

/**
 * ArcGIS uses different methods to identify the type of item that holds an API key. This function
 * attempts to provide a consistent string to describe the type of item.
 * @param {string} type ArcGIS item type string.
 * @param {array} typeKeywords Array of ArcGIS item type keywords.
 * @returns {string} A string that describes the item type.
 */
function normalizeItemType(type, typeKeywords) {
    if (type == "API Key") {
        return type + " (legacy)";
    }
    if (typeKeywords.includes("APIToken")) {
        return "API key";
    }
    return type;
}

/**
 * Generate a usage report of all developer credentials for the logged in user.
 */
async function usageReport() {
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                getUserAuthenticationItems(authentication)
                .then(function(items) {
                    log(`${process.env.ARCGIS_USER_NAME} has ${items.length} developer credentials:`);
                    const reducedItems = [];
                    items.forEach(function(item) {
                        reducedItems.push({
                            itemId: item.id,
                            title: item.title,
                            type: normalizeItemType(item.type, item.typeKeywords),
                            created: localDateFormat(item.created),
                            modified: localDateFormat(item.modified),
                            apiToken1ExpirationDate: localDateFormat(item.apiToken1ExpirationDate),
                            apiToken2ExpirationDate: localDateFormat(item.apiToken2ExpirationDate)
                        });
                    });
                    saveCSVFile(reducedItems, "authentication-items.csv");
                    createUsageReport(authentication)
                    .then(function() {
                        log("done.");
                    })
                    .catch(function(exception) {
                        log("Report generation failed: " + exception.toString());
                    });
                });
            } else {
                log("Login error: invalid login.");
                process.exit(91);
            }
        })
        .catch(function(loginError) {
            log("Login error: " + loginError.toString());
            process.exit(92);
        });
    } catch (loginError) {
        log("Login error: " + loginError.toString());
        process.exit(93);
    }
}

/**
 * Create API key(s) given object of apiKeyOptions and numberOfKeys.
 * @param {object} apiKeyOptions API attributes.
 * @param {integer} numberOfKeys Number of keys to create.
 */
async function createNewAPIKeys(apiKeyOptions, numberOfKeys) {
    if (numberOfKeys < 1) {
        numberOfKeys = 1;
    }
    try {
        signIn()
        .then(async function(authentication) {
            if (authentication && authentication.username) {
                const newKeys = [];
                apiKeyOptions.authentication = authentication;
                const title = apiKeyOptions.title;
                for (let i = 1; i <= numberOfKeys; i ++) {
                    apiKeyOptions.title = title + (numberOfKeys > 1 ? ` - (${i})` : "");
                    createApiKey(apiKeyOptions)
                    .then(function(registeredAPIKey) {
                        const itemId = registeredAPIKey.itemId;
                        const accessToken = registeredAPIKey.accessToken1;
                        const expireTime = registeredAPIKey.item.apiToken1ExpirationDate;
                        log(chalk.yellow(`New API key ${itemId} expires ${expireTime} token ${accessToken}`));
                        newKeys.push({
                            itemID: itemId,
                            title: registeredAPIKey.item.title,
                            expires: expireTime,
                            token: accessToken,
                            privileges: apiKeyOptions.privileges
                        });
                        if (newKeys.length >= numberOfKeys) {
                            saveCSVFile(newKeys, "api-keys.csv");
                        }
                    }).catch(function(error) {
                        log(chalk.red(`createAPIKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`));
                        process.exit(90);
                    });
                    if (i > 1) {
                        await sleeper(1000);
                    }
                }
            } else {
                log(chalk.red("createAPIKey Login error: invalid login."));
                process.exit(91);
            }
        })
        .catch(function(loginError) {
            log("createAPIKey Login error: " + loginError.toString() + " Check your credentials.");
            process.exit(92);
        });
    } catch (loginError) {
        log("createAPIKey Login error: " + loginError.toString());
        process.exit(93);
    }
}

/**
 * Update an existing API key. @todo: untested!
 * @param {string} itemId of the portal item that holds the api key.
 */
async function updateAPIKeyProperties(args) {
    // Add places priv, remove referrers, update expire time
    // Command line options
    // -i: item ID (required)
    // -t: title
    // -d: description
    // -k: tags, comma separated string, e.g. "tag1,tag2"
    // -p: privileges to add, comma separated string, e.g. "basemaps,places"
    // -r: referrers to add, comma separated string, e.g. "https://myapp.com/*"
    // -u: redirect URIs to add, comma separated string, e.g. "https://myapp.com/callback"

    // based on the command line options determine if the item needs to be updated, or if the API key properties need to be updated,
    // as they are two different API calls.
    let hasAPIKeyUpdateOptions = false;
    let hasItemUpdateOptions = false;
    const itemId = args.i ?? "";
    if (isEmpty(itemId)) {
        log(chalk.red("updateAPIKey error: item ID is required."));
        process.exit(94);
    }
    let apiKeyOptions = {
        itemId: itemId,
        generateToken1: false,
        generateToken2: false,
        authentication: null,
    };
    const privileges = args.p ?? [];
    if (!isEmpty(privileges)) {
        apiKeyOptions.privileges = privileges;
        hasAPIKeyUpdateOptions = true;
    }
    const referrers = args.r ?? [];
    if (!isEmpty(referrers)) {
        apiKeyOptions.referrers = referrers;
        hasAPIKeyUpdateOptions = true;
    }
    const redirectURIs = args.u ?? [];
    if (!isEmpty(redirectURIs)) {
        apiKeyOptions.redirectURIs = redirectURIs;
        hasAPIKeyUpdateOptions = true;
    }
    let itemUpdateOptions = {};
    const title = args.t ?? "";
    if (!isEmpty(title)) {
        itemUpdateOptions.title = title;
        hasItemUpdateOptions = true;
    }
    const description = args.d ?? "";
    if (!isEmpty(description)) {
        itemUpdateOptions.description = description;
        hasItemUpdateOptions = true;
    }
    const tags = args.k ?? "";
    if (!isEmpty(tags)) {
        itemUpdateOptions.tags = tags.split(",");
        hasItemUpdateOptions = true;
    }
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                if (hasAPIKeyUpdateOptions) {
                    apiKeyOptions.authentication = authentication;
                    updateApiKey(apiKeyOptions).then(function(registeredAPIKey) {
                        const itemId = registeredAPIKey.itemId;
                        const accessToken = registeredAPIKey.accessToken1;
                        const expireTime = registeredAPIKey.item.apiToken1ExpirationDate;
                        log(`updateApiKey  updated item ${itemId} token ${accessToken} expires ${expireTime}`);
                    }).catch(function(error) {
                        log(`updateAPIKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`);
                        process.exit(90);
                    });
                } else if (hasItemUpdateOptions) {
                    // update the Item title, description, or tags
                    itemUpdateOptions.id = itemId;
                    updatePortalItem(itemId, itemUpdateOptions, authentication)
                    .then(function(updatedItem) {
                        log(`updatePortalItem updated item ${itemId}`);
                    })
                    .catch(function(error) {
                        log(`updatePortalItem error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`);
                        process.exit(90);
                    });
                }
            } else {
                log("updateAPIKey Login error: invalid login.");
                process.exit(91);
            }
        })
        .catch(function(loginError) {
            log("updateAPIKey Login error: " + loginError.toString() + " Check your credentials.");
            process.exit(92);
        });
    } catch (loginError) {
        log("updateAPIKey Login error: " + loginError.toString());
        process.exit(93);
    }
}

/**
 * Delete an API key given its item identifier. This will delete the item and revoke any tokens generated from that item.
 * @todo: untested!
 * @param {string} itemID ArcGIS item identifier of the API key to delete.
 */
 async function deleteExistingAPIKey(itemID) {
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                deleteAPIKey(itemID, authentication)
                .then(function(serverResponse) {
                    log(`deleteAPIKey says ` + JSON.stringify(serverResponse));
                })
                .catch(function(error) {
                    log("deleteAPIKey error: " + error.toString());
                    process.exit(90);
                })
            } else {
                log("deleteAPIKey Login error: invalid login.");
                process.exit(91);
            }
        })
        .catch(function(loginError) {
            log("deleteAPIKey Login error: " + loginError.toString());
            process.exit(92);
        });
    } catch (loginError) {
        log("deleteAPIKey Login error: " + loginError.toString());
        process.exit(93);
    }
}

/**
 * Inspect an API key, given its access token, to determine its properties. This can be used to check the owner,
 * privileges, and expiration date of an API key.
 * @param {string} token ArcGIS access token (API key or OAuth user token).
 * @returns {object|null} The app info details or null if there was an error.
 */
async function inspectAPIKeyToken(token) {
    const serviceURL = "https://www.arcgis.com/sharing/rest/portals/self?f=json&token=";

    if (token !== "") {
        try {
            const response = await fetch(`${serviceURL}${encodeURIComponent(token)}`, {
                method: "GET",
                headers: {
                    Accept: "application/json"
                }
            });
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status} ${response.statusText}`);
            }
            const jsonResponse = await response.json();
            if (jsonResponse.error) {
                // { error: { code: 498, message: 'Invalid token.', details: [] } }
                log(chalk.red(`Error ${jsonResponse.error.code}: ${jsonResponse.error.message}`));
            } else {
                const reducedResponse = {
                    owner: jsonResponse.name,
                    subscriptionId: jsonResponse.subscriptionInfo.id,
                    subscriptionType: jsonResponse.subscriptionInfo.type,
                    appId: jsonResponse.appInfo.appId,
                    appTitle: jsonResponse.appInfo.appTitle,
                    itemId: jsonResponse.appInfo.itemId,
                    expirationDate: jsonResponse.appInfo.expirationDate,
                    privileges: jsonResponse.appInfo.privileges
                };
                log(chalk.blue(`API key info:`));
                log(chalk.yellow(JSON.stringify(reducedResponse, null, 2)));
            }
            return jsonResponse;
        } catch (exception) {
            log(chalk.red(`inspectAPIKey request failed: ${exception.message}`));
        }
    } else {
        log(chalk.red("inspectAPIKey requires a non-empty token."));
    }
    return null;
}

/**
 * Inspect an API key, given its ArcGIS item identifier, to determine its properties. This can be used
 * to check the owner, privileges, and expiration date of an API key.
 * @param {string} itemID ArcGIS item identifier.
 * @returns {object|null} The app info details or null if there was an error.
 */
async function inspectAPIKeyItem(itemID) {
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                getApiKey({
                    itemId: itemID,
                    authentication: authentication
                })
                .then(function(apiKeyResponse) {
                    const apiKeyInfo = {
                        itemId: apiKeyResponse.itemId,
                        clientId: apiKeyResponse.clientId,
                        title: apiKeyResponse.item.title,
                        description: apiKeyResponse.item.description,
                        owner: apiKeyResponse.item.owner,
                        created: apiKeyResponse.item.created > 0 ? localDateFormat(apiKeyResponse.item.created) : "",
                        tags: cleanTags(apiKeyResponse.item.tags),
                        privileges: apiKeyResponse.privileges,
                        referrers: apiKeyResponse.httpReferrers,
                        redirectURIs: apiKeyResponse.redirectURIs,
                        apiToken1Active: apiKeyResponse.apiToken1Active,
                        apiToken1ExpirationDate: apiKeyResponse.item.apiToken1ExpirationDate > 0 ? localDateFormat(apiKeyResponse.item.apiToken1ExpirationDate) : "",
                        apiToken2Active: apiKeyResponse.apiToken2Active,
                        apiToken2ExpirationDate: apiKeyResponse.item.apiToken2ExpirationDate > 0 ? localDateFormat(apiKeyResponse.item.apiToken2ExpirationDate) : "",
                        isPersonalAPIToken: apiKeyResponse.isPersonalAPIToken,
                    };
                    log(chalk.blue(`API key info:`));
                    log(chalk.yellow(JSON.stringify(apiKeyInfo, null, 2)));
                })
                .catch(function(error) {
                    log(chalk.red(`getApiKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`));
                    process.exit(90);
                });
            } else {
                log("inspectAPIKeyItem Login error: invalid login.");
                process.exit(91);
            }
        })
        .catch(function(loginError) {
            log("inspectAPIKeyItem Login error: " + loginError.toString());
            process.exit(92);
        });
    } catch (loginError) {
        log("inspectAPIKeyItem Login error: " + loginError.toString());
        process.exit(93);
    }
}

/**
 * Revoke API key access tokens. Pass -i itemId for which API key item, and pass -k 1, 2, or all for which token to revoke.
 * @param {object} args CLI arguments. We are looking for -i and -k.
 */
async function revokeAPIKey(args) {
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                const itemId = args.i ?? "";
                const whichToken = args.k ?? "all";
                if (whichToken == "1" || whichToken == "all") {
                    invalidateApiKey({
                        itemId: itemId,
                        apiKey: 1,
                        authentication: authentication
                    })
                    .then(function(apiKeyResponse) {
                        if (apiKeyResponse.success) {
                            log(chalk.green(`Token 1 revoked for item ${itemId}.`));
                        } else {
                            log(chalk.red(`Failed to revoke token 1 for item ${itemId}. Response: ${JSON.stringify(apiKeyResponse)}`));
                        }
                    })
                    .catch(function(error) {
                        log(chalk.red(`revokeAPIKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`));
                        process.exit(90);
                    });
                }
                if (whichToken == "2" || whichToken == "all") {
                    invalidateApiKey({
                        itemId: itemId,
                        apiKey: 2,
                        authentication: authentication
                    })
                    .then(function(apiKeyResponse) {
                        if (apiKeyResponse.success) {
                            log(chalk.green(`Token 2 revoked for item ${itemId}.`));
                        } else {
                            log(chalk.red(`Failed to revoke token 2 for item ${itemId}. Response: ${JSON.stringify(apiKeyResponse)}`));
                        }
                    })
                    .catch(function(error) {
                        log(chalk.red(`revokeAPIKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`));
                        process.exit(90);
                    });
                }
            } else {
                log("revokeAPIKey Login error: invalid login.");
                process.exit(91);
            }
        })
        .catch(function(loginError) {
            log("revokeAPIKey Login error: " + loginError.toString());
            process.exit(92);
        });
    } catch (loginError) {
        log("revokeAPIKey Login error: " + loginError.toString());
        process.exit(93);
    }
}

async function regenerateAPIKey(args) {
    // generate new tokens for api key 1, 2 or both, given the item ID.
    // command line options: -i itemID of the API key to update, -k 1/2/* for which token to regenerate, -d date or daysUntilExpiration for token 1, -e date or daysUntilExpiration for token 2.
    log(`regenerateAPIKey with options ${JSON.stringify(args)}...`);
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                const itemId = args.i ?? "";
                const whichToken = args.k ?? "all";
                const token1Expiration = args.d ?? "";
                const token2Expiration = args.e ?? "";
                let updateOptions = {
                    itemId: itemId,
                    authentication: authentication
                }
                if (whichToken == "1" || whichToken == "all") {
                    updateOptions.generateToken1 = true;
                    updateOptions.apiToken1ExpirationDate = dateFromOptions( ! isNumeric(token1Expiration) ? token1Expiration : "", isNumeric(token1Expiration) ? parseInt(token1Expiration) : 7);
                }
                if (whichToken == "2" || whichToken == "all") {
                    updateOptions.generateToken2 = true;
                    updateOptions.apiToken2ExpirationDate = dateFromOptions( ! isNumeric(token2Expiration) ? token2Expiration : "", isNumeric(token2Expiration) ? parseInt(token2Expiration) : 7);
                }
                updateApiKey(updateOptions).then(function(registeredAPIKey) {
                    const apiKeyResponse = {};
                    if (whichToken == "1" || whichToken == "all") {
                        apiKeyResponse.token1 = {
                            accessToken: registeredAPIKey.accessToken1,
                            expires: localDateFormat(registeredAPIKey.item.apiToken1ExpirationDate)
                        };
                    }
                    if (whichToken == "2" || whichToken == "all") {
                        apiKeyResponse.token2 = {
                            accessToken: registeredAPIKey.accessToken2,
                            expires: localDateFormat(registeredAPIKey.item.apiToken2ExpirationDate)
                        };
                    }
                    log(chalk.green(`Regenerated API key tokens for item ${itemId}: ${JSON.stringify(apiKeyResponse)}`));
                }).catch(function(error) {
                    log(chalk.red(`regenerateAPIKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`));
                    process.exit(90);
                });
            } else {
                log("revokeAPIKey Login error: invalid login.");
                process.exit(91);
            }
        })
        .catch(function(loginError) {
            log("revokeAPIKey Login error: " + loginError.toString());
            process.exit(92);
        });
    } catch (loginError) {
        log("revokeAPIKey Login error: " + loginError.toString());
        process.exit(93);
    }
}

/**
 * Read the command line for any processing options.
 * @returns {Object} Options are returned as an object of key/value pairs.
 */
function getCommandLineParameters() {
    const args = yargs(hideBin(process.argv)).parse();
    return args;
}

performRequestAction();
