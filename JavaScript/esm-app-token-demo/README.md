# JavaScript demo using Vite bundler

This demo project will use ArcGIS API for JavaScript with Vite to produce a browser app.
This demonstrates how to use ESM, or [JavaScript Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) in a very simple and easy to use Node.js project.

There are a lot of good programing practices preferring modules over traditional `<script>` tags. This project tries to demonstrate modules while most of the [ArcGIS Platform examples](https://developers.arcgis.com/javascript/latest/display-a-map/) use `<script>` tags for simplicity. To learn more, see [Why use modules instead of script tags](https://hacks.mozilla.org/2015/08/es6-in-depth-modules/).

Also for simplicity, I chose to use [Vite](https://vitejs.dev/guide/) for the module bundler. This was a recommendation from [@odoe](https://github.com/odoe) and [@hhkaos](https://github.com/hhkaos) that actually turned out to work. Vite is the least amount of friction and learning of all the many [options for module bundling](https://openbase.com/categories/js/best-javascript-bundler-libraries).

## Create a map project

1. Create a new folder and create a new node project:

```bash
mkdir vite-demo
cd vite-demo
npm init
```

2. Install dependencies for [Vite](https://vitejs.dev/guide/) and [ArcGIS API for JavaScript](https://developers.arcgis.com/javascript/latest/):

```bash
npm install --save-dev vite
npm install @arcgis/core@next
```

3. Create `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no">
    <title>ArcGIS Map with JavaScript</title>
    <link rel="stylesheet" type="text/css" href="index.css" />
</head>
<body>
  <div id="appDiv"></div>
  <script type="module" src="/index.js"></script>
</body>
</html>
```

4. Create `index.css`:

```css
@import "https://js.arcgis.com/4.21/@arcgis/core/assets/esri/themes/dark/main.css";

html,
body,
#appDiv {
    padding: 0;
    margin: 0;
    height: 100%;
    width: 100%;
}
```

5. Create `index.js`:

```javascript
import esriConfig from "@arcgis/core/config";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";

const map = new Map({
    basemap: "arcgis-topographic"
});

const mapView = new MapView({
    map,
    container: "appDiv",
    center: [-118.805, 34.027],
    zoom: 13
});
```

6. Go to your developer dashboard at https://developers.arcgis.com/dashboard, copy your default API key or create a new one and copy it. Create secret.js file to hold your API key and replace `YOUR_API_KEY` with your copied key. Create a `.gitignore` file and add `secret.js` to it so that you do not commit this file to version control.

Create `secret.js`

```javascript
export const apiKey = "YOUR_API_KEY";
```

Create `.gitignore`

```ini
secret.js
```

7. Update `index.js` to get your API key from the secrets:

```javascript
import esriConfig from "@arcgis/core/config";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import { apiKey } from "./secret";

esriConfig.apiKey = apiKey;
```

8. Update package.json

```json
  "main": "index.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "serve": "vite preview"
  },
```

9. You are now ready to build and run the project.

```bash
npm run dev
```

when the build is complete Vite will display a message on the console:

```bash
  vite v2.5.0 dev server running at:

  > Local: http://localhost:3000/
```

Open a browser to `http://localhost:3000/` and observe your map.

### Create an app token

You can use [application credentials](https://developers.arcgis.com/documentation/mapping-apis-and-services/security/application-credentials/) to access content and services.

**Advantages**

* short-lived, will expire and require refreshing the token.
* scoped to all privileges of the subscribing user.
* requires an application definition on the server.
* Uses secure OAuth 2.0 protocol with server.

**Disadvantages**

* ?
