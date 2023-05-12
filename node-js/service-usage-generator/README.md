# ArcGIS service usage generator

The purpose of this project is to generate usage against ArcGIS services. I use this to test the services are working properly and the correct usage metering is taking place.
The intent of this project is to test and verify expected service usage, it is not intended to be a production app.

## Set up

1. Run `npm install` to install the project dependencies.

2. Create or edit `.env` to set your ArcGIS **client ID**, **client secret**, and **API key** on the account you want to test. Use `.env.sample` for a sample of the expected format. You may not be required to set all the private keys depending on the tests you want to run. You must read the source code to determine this.

3. Edit `index.js` to set up the tests you want to run and any parameters to control the test.

    - Select which tile service(s) you want to test, and the levels of detail range. The higher the LOD the more tiles, and therefore the longer the test will run.

    - Select which services you want to test.

    ```javascript
    const testSwitches = {
        analysis: true,
        featureEdit: false,
        featureQuery: false,
        geocode: false,
        geoenrichment: false,
        routing: false,
        suggest: false,
        tiles: false,
        useDev: false,
        useEnhancedServices: false,
        useOceansImageryTiles: false
    };
    ```

    If you set `tiles` to `true`, configure which tile services you want to test and which LOD(s) you want to query.

    ```javascript
    const tileService = ["hillshade"]; // "image", "vector", "hillshade", or "OSM"
    const startLOD = 2;
    const endLOD = 2;
    ```

4. Run `npm start`
