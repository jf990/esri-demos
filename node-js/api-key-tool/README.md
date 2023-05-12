# ArcGIS API key tool

Node.js CLI app to provide various helpers for working with ArcGIS API keys.

1. Get a list of your API keys and OAuth apps.
2. Get a report of your API key and OAuth app service usage.

## Accounts

You need an ArcGIS account in order to use this tool. There are two possibilities:

* [ArcGIS Developer account](https://www.esri.com/en-us/arcgis/products/arcgis-platform/overview). You can [sign up for a free account](https://developers.arcgis.com/sign-up/) if you do not have one.
* [ArcGIS Online account](https://www.esri.com/en-us/arcgis/products/user-types/overview) of type Creator (or high privilege level).

## Set up

1. Run `npm install` to install the project dependencies.

2. Create or edit `.env` to set your ArcGIS account credentials. See .env.sample for a sample. Edit this file with your information and save it as `.env`.

3. Run `npm start`
