# Creating API keys

You can generate your own API keys for testing and for production.

You must have an account in order to generate API keys through REST or the developer dashboard. If you already have an account, you should be able to use it in the steps below. If not, you can sign up for a Developer Account on the developer website.  

## Authenticating with REST

In order to generate API keys with REST, you must have an account. There are two possibilities:

* [ArcGIS Developer account](https://www.esri.com/en-us/arcgis/products/arcgis-platform/overview). You can [sign up for a free account](https://developers.arcgis.com/sign-up/) if you do not have one.
* [ArcGIS Online account](https://www.esri.com/en-us/arcgis/products/user-types/overview) of type Creator (or high privilege level).

> API keys are not supported with ArcGIS Enterprise.

## Create an API key from dashboard

The easiest way to manage API keys is from the ArcGIS Developers dashboard.

* https://developers.arcgis.com/api-keys/

However, there may be use cases where you want to generate your keys programmatically or maintain your own fine-grained management of your access tokens.

## Get an access token

In order to use the ArcGIS REST API to create items under your account you will need a short-lived OAuth access token generated from your user credentials. There are several ways to create this token depending on your approach:

* Follow the instructions at [generate-token](https://developers.arcgis.com/rest/users-groups-and-items/generate-token.htm) to generate an OAuth access token with the REST API.
* Use Postman to generate an access token by using the ArcGIS Identity example at https://www.postman.com/arcgis-developer/workspace/67f6e6f1-326f-4c0e-bcb9-b07c7a343257/overview.
* Use ArcGIS REST JS [ArcGISIdentityManager](https://developers.arcgis.com/arcgis-rest-js/authentication/).
* Use ArcGIS API for JavaScript [IdentityManager](https://developers.arcgis.com/javascript/latest/authenticate-with-an-arcgis-identity/).

Once you have your account and an access token, use it where indicated in the instructions below.

## Creating an API key via REST

API keys are stored as items in ArcGIS. It is a 2-step process to create a new API key.

Create a new API key item with your account and access token by calling the `addItem` endpoint reflected below.  

You will need your user name as a part of the URL. This is the same user you used to generate the access token from the prior step.

### `addItem` request

Method:
**POST**

Endpoint:
https://arcgis.com/sharing/rest/content/users/${your-user-name}/addItem

Parameters:
| key           | value |
|---------------|-------|
| `f`           | `json` |
| `title`       | "Short title of your api key" |
| `snippet`     | "description of your api key" |
| `description` | "description of your api key" |
| `tags`        |  "comma,separated,list,of,search,tags" |
| `type`        | "API Key" |
| `token`       | your access token from the authentication procedure above |

### `addItem` response

```json
{
  "success": true,
  "id": "17ddxxxmmmxxxmmmd88a",
  "folder": null
}
```

The `id` references the unique item that is used to update the API key settings and access in the next step or in the future when you want to change the API key settings such as scope, referrers, or metadata.

More info: https://developers.arcgis.com/rest/users-groups-and-items/add-item.htm

## Update API key settings

Once the API Key item is created, update that item with the settings for your API key, such as privileges (scopes) and referrers and other information.

You have the option to define HTTP referrers and you will need to establish privileges for your key to authenticate with ArcGIS services. You can add, remove, or update these settings at any time and maintain the same API Key value in your app.  

### `registerApp` request

Method:
**POST**

Endpoint:
https://arcgis.com/sharing/rest/oauth2/registerApp

Parameters:
| key             | value |
|-----------------|-------|
| `f`             | `json` |
| `itemId`        | The `id` from the `addItem` response |
| `appType`       | `apikey` |
| `httpReferrers` | JSON array of strings: `["https://test1.com","https://test2.com"]` Use an empty array `[]` if none. |
| `redirect_uris` | JSON array of strings: `["https://test1.com/authorize.html","myapp://"]` Use an empty array `[]` if none. |
| `privileges`    | JSON array of string for each privilege to scope your API key. `["portal:apikey:basemaps","premium:user:geocode:stored"]` |
| `token`         | your access token from the authentication procedure above |

### `registerApp` response

```json
 { 
    itemId: "17ddxxxmmmxxxmmmd88a", 
    client_id: "abcdef", 
    client_secret: "abcdefgh", 
    appType: "apikey", 
    redirect_uris: [ 
        "https://test1.com/authorize.html",
        "myapp://"
    ], 
    registered: 1576196335000, 
    modified: 1576196335000, 
    apnsProdCert: null, 
    apnsSandboxCert: null, 
    gcmApiKey: null, 
    httpReferrers: [ 
        "https://test1.com", 
        "https://test2.com" 
    ], 
    privileges: [ 
        "portal:apikey:basemaps", 
        "premium:user:geocode:stored", 
    ], 
    apiKey: "AAPK……1111" 
} 
```

Use the `apiKey` value in place of the `token` parameter on the endpoints that accept API keys.

More info: https://developers.arcgis.com/rest/users-groups-and-items/register-app.htm

## Retrieving API keys

Once the API keys are created, you can retrieve all of your API key items by calling the [`search` endpoint](https://developers.arcgis.com/rest/users-groups-and-items/search.htm).

### `search` request

Method:
**GET**

Endpoint:
https://arcgis.com/sharing/rest/search

Parameters:
| key             | value |
|-----------------|-------|
| `f`             | `json` |
| `q`             | `owner:`${your-user-name} `AND (type:"API Key") AND (typekeywords:"Registered App")` |
| `num`           | 100   |
| `start`         | 1     |
| `sortField`     | `modified`     |
| `sortOrder`     | `desc`    |
| `token`         | your access token from the authentication procedure above |

See https://developers.arcgis.com/rest/users-groups-and-items/search.htm

### `search` response

See https://developers.arcgis.com/rest/users-groups-and-items/search.htm for the response format.

## Update an API key

You can alter the configuration of an existing API key given its client ID and item ID.

https://www.arcgis.com/sharing/rest/oauth2/apps/{client_id}/update

f: json
token: 
appType: apikey
privileges:  ["premium:user:geocode:temporary","premium:user:networkanalysis:routing","portal:apikey:basemaps"]
httpReferrers: []
redirect_uris: []

## Invalidate an API key

Use the `resetApiKey` endpoint.

Once an API key has been created, you can invalidate it and create a new one by using the REST endpoint `resetApiKey`. This service requires the item ID and the app client ID from the `registerApp` response above.
Doing this will maintain the historical data for an existing API key but invalidate it from any current client application authorization and prevent it from accumulating any additional usage on the old key. Usage will resume on the new key and preserve the prior usage history.

Note: When you invalidate and create a new API key, the historical usage will be maintained with the itemID used to create the key.

Method:
Post

URL endpoint:
https://arcgis.com/sharing/rest/oauth2/apps/{client_id}/resetApiKey 

Parameters:
| key             | value |
|-----------------|-------|
| `f`             | `json` |
| `itemId`        | The item ID associated with your API key. |
| `token`         | your access token from the authentication procedure above. |

Response:
??? Includes the information on the ItemId and a new API key

## Delete an API key

Since an API key is a portal item, delete the item using the item ID. This will also remove all historical usage data.

Method:
Post

URL endpoint:
https://arcgis.com/sharing/rest/content/users/${your-user-name}/items/${item-id}/delete

Parameters:
| key             | value |
|-----------------|-------|
| `f`             | `json` |
| `items`         | A comma separated list of item IDs to be deleted. |
| `token`         | your access token from the authentication procedure above. |

Response:
Includes the information on the ItemId and a new API key

See https://developers.arcgis.com/rest/users-groups-and-items/delete-items.htm

## Resources

* Full list of privileges:
  * "portal:apikey:basemaps",
  * "premium:user:geocode:stored",
  * "premium:user:geocode:temporary",
  * "premium:user:elevation",
  * "premium:user:geoenrichment",
  * "premium:user:demographics",
  * "premium:user:featurereport",
  * "premium:user:networkanalysis:optimizedrouting",
  * "premium:user:networkanalysis:servicearea",
  * "premium:user:networkanalysis:origindestinationcostmatrix",
  * "premium:user:networkanalysis:locationallocation",
  * "premium:user:networkanalysis:vehiclerouting",
  * "premium:user:networkanalysis:routing",
  * "premium:user:networkanalysis:closestfacility"
  * "premium:user:spatialanalysis",
  * "premium:publisher:geoanalytics",
  * "premium:publisher:rasteranalysis",
* https://developers.arcgis.com/documentation/mapping-apis-and-services/security/api-keys/
* Complete list of location services https://developers.arcgis.com/documentation/mapping-apis-and-services/services/


---

f: 
json
title: 
John Test key
snippet: 
Testing services
type: 
API Key
token: 
uiTfBpwx7DPPKBcuS8C8Bn8R1n3SB7pSkX7PMiPWDcHkoz-Ph8bloZ5Kd-Tl3gwwNoBa0pvW9S_k2Dz3jAFSC_4KHoRN2JAmKGTSo3wVbVhBD__mx7BRlnjQXuCkj2i5ZNcIaAHAZVm4xYm3BitsJ2ZV3jFsqwDInLQ909BsDFy6f_TPsCiGni7E7bVTiFBONPILWuz1YKm1WF7ua6LDBe_JqYSwSjEFIUasQjJFFZc.

f: 
json
appType: 
apikey
httpReferrers: 
[]
redirect_uris: 
[]
privileges: 
["premium:user:geocode:temporary","portal:apikey:basemaps"]
itemId: 
be559a35903b44b1a63c1a664437196c
token: 
uiTfBpwx7DPPKBcuS8C8Bn8R1n3SB7pSkX7PMiPWDcHkoz-Ph8bloZ5Kd-Tl3gwwNoBa0pvW9S_k2Dz3jAFSC_4KHoRN2JAmKGTSo3wVbVhBD__mx7BRlnjQXuCkj2i5ZNcIaAHAZVm4xYm3BitsJ2ZV3jFsqwDInLQ909BsDFy6f_TPsCiGni7E7bVTiFBONPILWuz1YKm1WF7ua6LDBe_JqYSwSjEFIUasQjJFFZc.
