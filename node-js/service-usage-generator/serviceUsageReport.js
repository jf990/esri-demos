import dotenv from "dotenv";
import fetch from "node-fetch";
import "isomorphic-form-data";
import { ArcGISIdentityManager, setDefaultRequestOptions, request } from "@esri/arcgis-rest-request";
import * as util from "util";
setDefaultRequestOptions({ fetch });
dotenv.config();

const authentication = new ArcGISIdentityManager({
  portal: "https://arcgis.com/sharing",
  username: process.env.ARCGIS_USER_NAME,
  password: process.env.ARCGIS_USER_PASSWORD
});

var startDay = 1;
var startMonth = 8;
var startYear = 2022;
var start = new Date(startYear, startMonth -1, startDay);
start.setUTCHours(0, 0, 0, 0);

var endDay = 4;
var endMonth = 8;
var endYear = 2022;
var end = new Date(endYear, endMonth -1, endDay);
end.setUTCHours(0, 0, 0, 0);


const { id } = await request(
  // "https://devext.arcgis.com/sharing/rest/portals/self", //dev
  "https://arcgis.com/sharing/rest/portals/self", // prod
  {
    authentication,
  }
);

const usage = await request(
  // `https://devext.arcgis.com/sharing/rest/portals/${id}/usage`, //dev
  `https://arcgis.com/sharing/rest/portals/${id}/usage`, // prod
  {
    httpMethod: "GET",
    authentication,
    params: {
      startTime: start.getTime(),
      endTime: end.getTime(),
      groupby: "etype,stype,task,name",
      period: "1d",
      vars: "bw,num",
      // stype: "basemaps",
      // task: "tile"
      // appId: "UKJNSIudk4cewTEF" //dev API Key id registeredAppInfo call: client_id
      // appId: "Wlmyl8gEMc5OH2L8" //prod API Key id registeredAppInfo call: client_id
      // task: "tile",
    },
  }
);

console.log(util.inspect(usage, { depth: Infinity }));