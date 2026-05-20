/**
 * Utility functions to work with ArcGIS Online reports.
 */
import { ArcGISIdentityManager, request } from "@esri/arcgis-rest-request";
import fsExtra from "fs-extra";
import chalk from "chalk";

async function downloadReportFile(itemId, authentication) {
    return new Promise(async function(resolve, reject) {
        const itemURL = authentication.portal + "/content/items/" + itemId + "/data";
        console.log(chalk.blue("Downloading report from: " + itemURL));

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
    });
}

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
            reportSubType: reportOptions.subType ?? "serviceUsages",
            timeDuration: reportOptions.timeDuration ?? "monthly",
            startTime: determineStartTime(reportOptions).getTime(),
            title: reportOptions.title
        };
        try {
            request(portalURL, {
                httpMethod: "GET",
                authentication: authentication,
                params: parameters
            })
            .then(async function(response) {
                console.log("Service usage report response:\n" + JSON.stringify(response));
                const itemId = response.itemId;
                const statusURL = `${authentication.portal}/sharing/rest/content/users/${authentication.username}/items/${itemId}/status?token=${authentication.token}`;
                let taskStatus = response.status;
                let waitDelay = 3000;
                let pollCount = 10;

                // wait and poll for task status
                while (taskStatus === "processing" && pollCount > 0) {
                    await new Promise(function(resolve) { setTimeout(resolve, waitDelay); });
                    const statusResponse = await request(statusURL, {
                        httpMethod: "GET",
                        authentication: authentication
                    });
                    taskStatus = statusResponse.status;
                    pollCount --;
                    if (waitDelay > 1000) {
                        waitDelay -= 1000;
                    }
                }

                // download report CSV file
                if (taskStatus === "completed") {
                    console.log("Report generation completed. Downloading report...");
                    await downloadReportFile(itemId, authentication);
                } else {
                    console.log(chalk.red(`Report generation failed or timed out. Final task status: ${taskStatus}`));
                }
                resolve();
            })
            .catch(async function(exception) {
                // ArcGISRequestError: 400: The monthly report is already generated. Report item id: 70ebb99cef5d48738e507b930f3cbacf
                const message = exception.toString();
                if (message.indexOf("ArcGISRequestError: 400") >= 0 && message.indexOf("item id:") >= 0) {
                    const itemId = message.split("item id:")[1].trim();
                    console.log("Report already exists. Downloading existing report from item: " + itemId);
                    downloadReportFile(itemId, authentication)
                    .then(function() {
                        resolve();
                    })
                    .catch(function(exception) {
                        reject(exception);
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
        // last week (1), or (n) weeks ago on Sunday
        startDate.setDate(startDate.getDate() - startDate.getDay() - 7);
    } else {
        startDate = new Date(dateToday.getFullYear(), dateToday.getMonth(), 1);
    }
    startDate.setHours(0, 0, 0, 0);
    return startDate;
}

export { createServiceUsageReport };
