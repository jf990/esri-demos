import { ArcGISIdentityManager } from "@esri/arcgis-rest-request";
import { clientID } from "./secret.js";

const redirectUri = window.location.origin + "/authenticate.html";

ArcGISIdentityManager.completeOAuth2({
  clientID,
  redirectUri
});
