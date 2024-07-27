# JavaScript layers demo

This project demonstrates how to load various layers with [ArcGIS Maps SDK for JavaScript](https://developers.arcgis.com/javascript/latest/) app.

- Trail heads as points with a renderer.
- Trails as polylines with a renderer.
- Open space areas as polygons with a renderer.
- [Live traffic service](https://www.arcgis.com/home/item.html?id=ff11eb5b930b4fabba15c47feb130de4) as a map image layer.
- [Transportation data](https://server.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer) as a tile layer.

## Installation

1. Clone or fork this repository and `cd` into the `JavaScript/layers-demo`, or copy all the files in `JavaScript/layers-demo` into a new folder.

2. Go to your [ArcGIS Location Platform dashboard](https://location.arcgis.com/credentials/) or [ArcGIS Online portal](https://www.arcgis.com/home/content.html) and get an **API key**.
    - If you do not have an ArcGIS Location Platform account you can [create one for free](https://location.arcgis.com/sign-up/).
    - If you do not have an API key you can create one by following the tutorial [Create an API key](https://developers.arcgis.com/documentation/security-and-authentication/api-key-authentication/tutorials/create-an-api-key/).

3. Rename `secret-sample.js` to `secret.js`. Edit this file and replace `YOUR_API_KEY` with your **API key**.

```javascript
const YOUR_API_KEY = "YOUR_API_KEY";
```

4. Run the app by loading index.html in a web browser.
