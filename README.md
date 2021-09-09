# Esri Demos

Demonstration code using ArcGIS Platform APIs and services.

See the [ArcGIS Developer](https://developers.arcgis.com) website for more information regarding the many ArcGIS APIs available to develop geospatial and location-based apps.

## Contents

* [Resources](./Resources/index.md) - companion resources including blogs, Living Atlas data sets, HUB, and other resources to help gather data for development.

### JavaScript

* [Basic JavaScript demo based on ArcGIS API for JavaScript tutorials](./JavaScript/basic-demo/): a simple demo of Map, MapView, FeatureService and Pop ups.
* [ESM API key demo](./JavaScript/esm-api-key-demo): demonstrates using ArcGIS API for JavaScript ESM with Vite to produce a browser app and using ArcGIS API key authentication.
* [ESM user login demo](./JavaScript/esm-user-login-demo): demonstrates using ArcGIS API for JavaScript ESM with Vite to produce a browser app and OAuth 2.0 user login authentication.
* [ESM application credentials demo](./JavaScript/esm-app-token-demo): demonstrates using ArcGIS API for JavaScript ESM with Vite to produce a browser app with application credential authentication. Requires using a token server component (see either the node-js or PHP projects.)

### Node.js

* [App token server demo](./node-js/app-token-server-demo/): demonstrates how to build a server using Node.js, Express, ArcGIS REST JS to proxy application token requests with ArcGIS Platform. Intended to be used with [ESM application credentials demo](./JavaScript/esm-app-token-demo).

### PHP

* [App token server demo](./PHP/app-token-server-demo/): demonstrates how to build a server using PHP to proxy application token requests with ArcGIS Platform. Intended to be used with [ESM application credentials demo](./JavaScript/esm-app-token-demo).

### Python

* [Basic JavaScript demo based on ArcGIS API for JavaScript tutorials](./Python/): a simple ArcGIS API for Python Jupyter notebook to help get started with the API, data analysis, and geoprocessing.
