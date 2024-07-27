# JavaScript layers demo

This project demonstrates how to load the [real-time traffic service layer](https://www.arcgis.com/home/item.html?id=ff11eb5b930b4fabba15c47feb130de4) with [ArcGIS Maps SDK for JavaScript](https://developers.arcgis.com/javascript/latest/). The traffic service data is updated every 5 minutes and requires an access token for authentication.

This demo brings together two traffic layers from the [ArcGIS Living Atlas](https://livingatlas.arcgis.com/en/browse/#d=2&categories=Transportation) with the Maps SDK for JavaScript:

- https://server.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer
- https://traffic.arcgis.com/arcgis/rest/services/World/Traffic/MapServer

You will need an ArcGIS Online or ArcGIS Location Platform account to run this demo as authentication is required to access these services.

## Installation

1. Clone or fork this repository and `cd` into the `JavaScript/traffic-service-demo`, or copy all the files in `JavaScript/traffic-service-demo` into a new folder.

2. Go to your [ArcGIS Location Platform dashboard](https://location.arcgis.com/credentials/) or [ArcGIS Online portal](https://www.arcgis.com/home/content.html) and get an **API key**.
    - If you do not have an ArcGIS Location Platform account you can [create one for free](https://location.arcgis.com/sign-up/).
    - If you do not have an API key you can create one by following the tutorial [Create an API key](https://developers.arcgis.com/documentation/security-and-authentication/api-key-authentication/tutorials/create-an-api-key/).

3. Rename `secret-sample.js` to `secret.js`. Edit this file and replace `YOUR_API_KEY` with your **API key**.

```javascript
const YOUR_API_KEY = "YOUR_API_KEY";
```

4. Run the app by loading index.html in a web browser.
