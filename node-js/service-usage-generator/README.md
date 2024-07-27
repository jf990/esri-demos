# ArcGIS service usage generator

The purpose of this project is to generate usage against ArcGIS services. It really is not designed to test the service itself, rather use a set of pre-determined parameters to generate usage. I use this to test the services are generating usage properly and the correct usage metering is taking place.
The intent of this project is to test and verify expected service usage, it is not intended to be a production app.

## Set up

1. Run `npm install` to install the project dependencies.

2. Create or edit `.env` to set your ArcGIS **client ID**, **client secret**, and **API key** on the account you want to test. Use `.env.sample` for a sample of the expected format. You may not be required to set all the private keys depending on the tests you want to run. You must read the source code to determine this.

| Key | Description |
| --- | ----------- |
| `ARCGIS_USER_NAME` | If provided, the tests will log in with this user and use the OAuth access token in all requests. This would override the API key setting. |
| `ARCGIS_USER_PASSWORD` | Only used if `ARCGIS_USER_NAME` is set. |
| `CLIENT_ID` | If provided, use application credentials to generate an OAuth access token for use in all requests. |
| `CLIENT_SECRET` | Only used if `CLIENT_ID` is set. |
| `API_KEY` | If provided, use this API key in all requests. Note it must be scoped to the services used in the tests. |
| `FEATURE_SERVICE_URL` | When testing data hosting usage, this is the feature service to issue requests against. The authentication must match (e.g. the user or app credentials have access, or the API key is scoped to this item.) |

3. Edit `index.js` to set up the tests you want to run and any parameters to control the test.

    - All of the tests are pre-configured and coded to run specific hard-coded tests to generate usage. If you are trying to test something specific you probably have to edit the code.

    - Select which tile service(s) you want to test, and the levels of detail range. The higher the LOD the more tiles, and therefore the longer the test will run.

    - Select which services you want to test.

    ```javascript
    const testSwitches = {
        analysis: false,
        featureEdit: false,
        featureQuery: false,
        geocode: false,
        geocodeClientTest: false,
        geoenrichment: false,
        places: false,
        routing: false,
        suggest: false,
        tiles: false,
        nonExistingTiles: false,
        useDev: false,
        useEnhancedServices: false,
        useOceansImageryTiles: false,
        iterations: 2000,
        tileRequestDelay: 100,
        serviceRequestDelay: 350,
        startLOD: 3,
        endLOD: 9,
        tileService: ["image" | "vector" | "hillshade" | "OSM"]
    };
    ```

    `useDev`:
    Set to `true` to use the Dev/DevExt endpoints, otherwise set to `false` to use the production endpoints (there are no tests for QA.)

    `useEnhancedServices`:
    Set to `true` to use the enhanced endpoints instead of the ArcGIS Location Platform `-api` endpoints.

    `iterations`:
    The number of times to hit the service. 25 means make 25 requests.

    `tileRequestDelay`:
    Number of milliseconds to wait between tile requests. It will slow your testing down, but we want to be nice to the tile servers.

    `serviceRequestDelay`:
    Number of milliseconds to wait in between service test requests. It will slow your testing down, but we want to be nice to the tile servers. For example, setting `serviceRequestDelay` to 100 and `iterations` to 25 means it will take 2.5 seconds to run the test 25 times.

    `analysis`:
    Run pre-configured tests against the spatial analysis service.

    `featureQuery`:
    Run pre-configured tests for feature service query. This test requires a feature service URL.

    `featureEdit`:
    Run pre-configured tests for feature service editing. This test requires a feature service URL that has been enabled for edit.

    `places`:
    Run pre-configured tests against the places service.

    `geocode`:
    Run pre-configured tests against the world geocoding service.

    `suggest`:
    Run pre-configured tests against the world geocoding service auto-suggest endpoint.

    `geoenrichment`:
    Run pre-configured tests against the world geoenrichment service.

    `routing`:
    Run pre-configured tests against the world routing service.

    `tiles`:
    Set to `true` to enable basemaps test.

    `useOceansImageryTiles`:
    Use the Oceans tile service for the basemaps test.

    `nonExistingTiles`:
    Include requests for tiles that do not exist (to see how that affects usage metering.)

    If you set `tiles` to `true`, configure which tile services you want to test and which LOD(s) you want to query.

    ```javascript
    const tileService = ["hillshade"]; // "image", "vector", "hillshade", or "OSM"
    const startLOD = 2;
    const endLOD = 2;
    ```

4. Run `npm start`
