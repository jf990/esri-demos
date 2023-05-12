/**
 * Utility functions to work with ArcGIS Online reports.
 */
import { ArcGISIdentityManager, request } from "@esri/arcgis-rest-request";

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
function createServiceUsageReport(reportOptions, authentication) {
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
                console.log(JSON.stringify(jsonResponse));

                // wait for task status

                // download report CSV file

                resolve();
            })
            .catch(function(exception) {
                reject(exception);
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
