/**
 * Generate usage reports of your ArcGIS Platform authentication (OAuth apps and API keys.)
 * Report generation requires a logged in user. Update .env with your credentials and make
 * sure to keep that file secure.
 */
import { createApiKey, updateApiKey } from '@esri/arcgis-rest-developer-credentials';
import { ArcGISIdentityManager } from "@esri/arcgis-rest-request";
import { createServiceUsageReport } from "./usageReport.js";
import { ArcGISPrivileges, getAuthenticationItems } from "./arcGISItemHelpers.js";
import fsExtra from "fs-extra";
import YAML from "yaml";
import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
const log = console.log;

// Template for API key parameters that should be set from options.yaml file
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
            let localOptions = options.options ? options.options : options;
            apiKeyOptions.title = localOptions.title ?? "No title";
            apiKeyOptions.description = localOptions.description ?? "No description provided.";
            apiKeyOptions.tags = JSON.stringify(localOptions.tags ?? []);
            apiKeyOptions.privileges = JSON.stringify(localOptions.privileges ?? []);
            apiKeyOptions.httpReferrers = JSON.stringify(localOptions.referrers ?? []);
            apiKeyOptions.redirect_uris = JSON.stringify(localOptions.redirect_uris ?? []);
            apiKeyOptions.generateToken1 = localOptions.generateToken1 ?? true;
            apiKeyOptions.apiToken1ExpirationDate = dateFromOptions(localOptions.apiToken1ExpirationDate ?? "", localOptions.apiToken1ExpirationDays ?? 0);
            apiKeyOptions.generateToken2 = localOptions.generateToken2 ?? false;
            apiKeyOptions.apiToken1ExpirationDate = dateFromOptions(localOptions.apiToken2ExpirationDate ?? "", localOptions.apiToken2ExpirationDays ?? 0);
        } else {
            log(chalk.red(`Invalid or missing API key options in ${filePath}.`));
        }
        return apiKeyOptions;
    } catch (exception) {
        log(chalk.red(`Error parsing options file YAML: ${exception.message}`));
    }
    return null;
}

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

function localDateFormat(timestamp) {
    if (timestamp < 1000) {
        return "0";
    }
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

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
                    apiToken1ExpirationDate: getRelativeExpireDate(3),
                    authentication: authentication,
                };

                updateApiKey(apiKeyOptions).then(function(registeredAPIKey) {
                    const itemId = registeredAPIKey.itemId;
                    const accessToken = registeredAPIKey.accessToken1;
                    const expireTime = registeredAPIKey.item.apiToken1ExpirationDate;
                    log(`updateApiKey  updated item ${itemId} token ${accessToken} expires ${expireTime}`);
                }).catch(function(error) {
                    log(`updateAPIKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`);
                    process.exit(90);
                });
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
 * Testing reset an API key. @todo: where do we get clientID and itemID from?
 */
 async function resetExistingAPIKey(clientID, itemID) {
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                resetAPIKey(clientID, itemID, authentication)
                .then(function(serverResponse) {
                    log(`resetAPIKey says ` + JSON.stringify(serverResponse));
                })
                .catch(function(error) {
                    log("resetAPIKey error: " + error.toString());
                    process.exit(90);
                })
            } else {
                log("resetAPIKey Login error: invalid login.");
                process.exit(91);
            }
        })
        .catch(function(loginError) {
            log("resetAPIKey Login error: " + loginError.toString());
            process.exit(92);
        });
    } catch (loginError) {
        log("resetAPIKey Login error: " + loginError.toString());
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
 * Inspect an API key to determine its properties. This can be used to check the owner, privileges, and expiration date of an API key.
 * @param {string} token ArcGIS access token (API key or OAuth user token).
 * @returns {object|null} The app info details or null if there was an error.
 */
async function inspectAPIKey(token) {
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
                log(jsonResponse);
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
 * Read the command line for any processing options.
 * @returns {Object} Options are returned as an object of key/value pairs.
 */
function getCommandLineParameters() {
    const args = yargs(hideBin(process.argv)).parse();
    return args;
}

/**
 * Pick up command line arguments and invoke the requested tasks
 * -a genkeys: generate new API keys using apiKeyOptions template -n numberOfKeys
 * -a inspect: show properties for a single api key -t token
 * -a report: generate API keys report as CSV file
 * -a updatekey: change configuration properties of an existing key
 * -a delkey: delete an existing api key.
 * -a resetkey: revoke all tokens on an existing api key.
 */
function performRequestAction() {
    const args = getCommandLineParameters();
    const action = args.a ?? "report";

    switch(action) {
      case "genkeys":
        // create new API keys
        const numberOfKeys = args.n ?? 1;
        const optionsFile = args.o ?? "./mcp-api-key-attributes.yaml";
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
        inspectAPIKey(token);
        break;
      case "updatekey":
        // update properties of a single api key
        break;
      case "delkey":
        // delete an api key
        break;
      case "resetkey":
        // revoke both tokens of a single api key
        break;
      default:
        break;
    }
  }

  performRequestAction();
