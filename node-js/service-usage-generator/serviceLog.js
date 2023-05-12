import dotenv from "dotenv";
import { ArcGISIdentityManager, request } from "@esri/arcgis-rest-request";
import * as portalTools from "@esri/arcgis-rest-portal"

dotenv.config();

var startDay = 10;
var startMonth = 8;
var startYear = 2022;
var start = new Date(startYear, startMonth - 1, startDay);
start.setUTCHours(0, 0, 0, 0);

var endDay = 11;
var endMonth = 8;
var endYear = 2022;
var end = new Date(endYear, endMonth - 1, endDay);
end.setUTCHours(0, 0, 0, 0);

function signIn() {
  return ArcGISIdentityManager.signIn({
      portal: "https://arcgis.com/sharing",
      username: process.env.ARCGIS_USER_NAME,
      password: process.env.ARCGIS_USER_PASSWORD
  })
  .then(function(identityManager) {
      return identityManager;
  })
  .catch(function(exception) {
      throw exception;
  });
}

async function logUsage() {
  signIn()
  .then(async function(authentication) {

    portalTools.getSelf({
      authentication: authentication
    })
    .then(async function(userAttributes) {
      let userId = userAttributes.id;
      if (userId) {
        request(
          `https://arcgis.com/sharing/rest/portals/${userId}/usage`,
          {
            httpMethod: "GET",
            authentication: authentication,
            params: {
              startTime: start.getTime(),
              endTime: end.getTime(),
              groupby: "etype,stype,task,name",
              period: "1d",
              vars: "bw,num",
              stype: "basemaps",
              // appId: "UKJNSIudk4cewTEF" //dev API Key id registeredAppInfo call: client_id
              // appId: "Wlmyl8gEMc5OH2L8" //prod API Key id registeredAppInfo call: client_id
              // task: "tile",
            },
          }
        )
        .then(function(usage) {
          console.log(usage);
        })
        .catch(function(exception) {
          console.error(`Error getting usage for ${authentication.username}: ${exception.toString()}`);
        })
      }
    });
  })
  .catch(function(exception) {
    console.error("ArcGIS log in failed " + exception.toString());
  });
}

logUsage();
