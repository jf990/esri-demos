/**
 * ArcGIS API for JavaScript demo app
 */
// import esriConfig from "@arcgis/core/config";
import WebMap from "@arcgis/core/webmap";
import MapView from "@arcgis/core/views/MapView";
// import { apiKey } from "./secret";
 
// esriConfig.apiKey = apiKey;
 
const educationItemID = "05e015c5f0314db9a487a9b46cb37eca";
// const trailsItemID = "41281c51f9de45edaf1c8ed44bb10e30";
 
const map = new WebMap({
     portalItem: {
         id: educationItemID
     }
 });
 
 const mapView = new MapView({
     map,
     container: "appDiv"
 });
 
 // @TODO: app token
 
 // @TODO: user token
 