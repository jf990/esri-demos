/**
 * Utility functions to work with ArcGIS Online reports.
 */
import { ArcGISIdentityManager, request } from "@esri/arcgis-rest-request";
import fsExtra from "fs-extra";
import chalk from "chalk";

/**
 * Request the generation an ArcGIS Online service usage report. See doc: https://developers.arcgis.com/rest/users-groups-and-items/reports.htm
 * reportOptions.timeDuration is either "weekly" or "monthly".
 * reportOptions.timeOffset is the number of timeDurations in the past. 0 is not valid.
 * If the timeDuration is weekly, then the startTime must be a time on Sunday GMT. timeOffset is number of weeks in the past (e.g. 3 is 3 weeks ago.)
 * If the timeDuration is monthly, the startTime must be on the first day of the month. timeOffset is number of months in the past (e.g. 3 is 3 months ago.)
 * @param {object} reportOptions Report properties, from https://developers.arcgis.com/rest/users-groups-and-items/reports.htm
 * @param {ArcGISIdentityManager} authentication A valid logged in user identity.
 * @returns {Promise} Resolves when the report is created.
 */
async function createServiceUsageReport(reportOptions, authentication) {
    return new Promise(function(resolve, reject) {
        const portalURL = authentication.portal + "/community/users/" + authentication.username + "/report";
        const parameters = {
            f: "json",
            reportType: "org",
            reportSubType: "serviceUsages",
            timeDuration: reportOptions.timeDuration,
            startTime: determineStartTime(reportOptions).getTime(),
            title: reportOptions.title
        };
        try {
            request(portalURL, {
                httpMethod: "GET",
                authentication: authentication,
                params: parameters
            })
            .then(function(response) {
                console.log("Service usage report response:\n" + JSON.stringify(response));

                // wait for task status

                // download report CSV file

                resolve();
            })
            .catch(async function(exception) {
                // ArcGISRequestError: 400: The monthly report is already generated. Report item id: 70ebb99cef5d48738e507b930f3cbacf
                const message = exception.toString();
                if (message.indexOf("ArcGISRequestError: 400") >= 0 && message.indexOf("item id:") >= 0) {
                    const itemId = message.split("item id:")[1].trim();
                    const itemURL = authentication.portal + "/content/items/" + itemId + "/data";
                    console.log("Report already exists. Downloading existing report from: " + itemURL);

                    const response = await fetch(`${itemURL}?token=${authentication.token}`, {
                        method: "GET"
                    });

                    if (!response.ok) {
                        reject(new Error(`Failed to download report: ${response.status} ${response.statusText}`));
                        return;
                    }

                    const fileData = await response.text();
                    fsExtra.writeFile("api-key-usage-report.csv", fileData, function(error) {
                        if (error) {
                            console.log(chalk.red(`Cannot save CSV file: ${error.message}.`));
                            reject(error);
                        } else {
                            console.log(chalk.green("Usage report saved as api-key-usage-report.csv."));
                            resolve();
                        }
                    });
                } else {
                    reject(exception);
                }
            });
        } catch (exception) {
            reject(exception);
        }
    });
}

/**
 * Determine the start time, a unix timestamp, from the report options. We look at 2 properties to
 * determine the start time:
 *   timeDuration: can be either "monthly" or "weekly". "daily" is not support for usage reports.
 *   timeOffset: an integer indicating how far in the past of time duration to report.
 * @param {object} reportOptions Report options
 * @returns Date
 */
function determineStartTime(reportOptions) {
    const dateToday = new Date();
    let startDate;
    if (reportOptions.timeDuration == "monthly") {
        // last month (1), or (n) months ago
        startDate = new Date(dateToday.getFullYear(), dateToday.getMonth(), 1);
    } else if (reportOptions.timeDuration == "weekly") {
        // last week (1), or (n) weeks ago
        startDate = new Date(dateToday.getFullYear(), dateToday.getMonth(), 1);
    } else {
        startDate = new Date(dateToday.getFullYear(), dateToday.getMonth(), 1);
    }
    return startDate;
}

export { createServiceUsageReport };
