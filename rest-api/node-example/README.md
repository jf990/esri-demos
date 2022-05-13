# ArcGIS REST JS example

You can perform ArcGIS REST requests using [Node.js](https://nodejs.org) and the [ArcGIS REST JS](https://esri.github.io/arcgis-rest-js/) open source library. To run this project do the following:

1. Clone this repo to your local computer.
2. `cd` into the `ArcGIS-REST-API/node-example` folder.
3. Run `npm install`
4. Run `npm start`

For example, to geocode the address, run it like this:

```bash
npm start -- "Washington convention center"
```

Review the code in the `index.js` file to understand how the demo is set up and how to run the various code snippets.

## Authentication

This example uses [application authentication](https://developers.arcgis.com/documentation/core-concepts/security-and-authentication/accessing-arcgis-online-services/) to access the routing service, which requires an authentication token. Running this code successfully will require additional steps, as follows:

1. [Log in](https://developers.arcgis.com/sign-in/) with your ArcGIS for Developer account, or [create one](https://developers.arcgis.com/sign-up/) (it's free.)
2. Go to your [dashboard](https://developers.arcgis.com/dashboard) and create a new application or select an application you already have.
3. Copy the Client ID and Client Secret.
4. Create a `.env` file in this folder, or copy the example file `.env-sample` to `.env`.
5. Paste your client ID and client secret in place of the placeholders, as follows:

```ini
CLIENTID=LdcYLdcYLdcYLdcY
CLIENTSECRET=39aaff39aaff39aaff39aaff39aaff39
```

6. Save the file and run the app.

NOTE: You do not want to include your client credentials in source control, as they should be treated as a password. This is the reason this example factors those values out of the source code and into a separate `.env` file. This file is ignored from source control.
