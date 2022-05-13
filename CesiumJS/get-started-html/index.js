function startCesium(Cesium) {
    'use strict';

    // If you do not set a Cesium Access Token you will see a watermark on your map view.
    Cesium.Ion.defaultAccessToken = cesiumAccessToken;

    // Calling as documented today
    // requests https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/8/111/191
    const arcGISImageTileProvider = new Cesium.ArcGisMapServerImageryProvider({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
    });
    // Calling with a token, for some reason it insists on calling the export tiles endpoint
    // requests https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=0,45,22.5,67.5&size=256,256&format=png32&transparent=true&f=image&bboxSR=4326&imageSR=4326&token=AAPK...
    // response is {"error":{"code":498,"message":"Invalid Token","details":[]}}
    const arcGISImageTileProviderWithToken = new Cesium.ArcGisMapServerImageryProvider({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
        usePreCachedTilesIfAvailable: true,
        token: arcgisAccessToken
    });
    // Calling the ArcGIS Platform endpoint is immediately rejected due to CORS/CORB
    // Cross-Origin Read Blocking (CORB) blocked cross-origin response https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/?callback=loadJsonp249314&f=json&token=AAPK... with MIME type application/json.
    const arcGISImageTileProviderPlatform = new Cesium.ArcGisMapServerImageryProvider({
        url: "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer",
        usePreCachedTilesIfAvailable: true,
        token: arcgisAccessToken
    });
    // Adding token to the elevation services fails
    // {
    //  "error": {
    //   "code": 498,
    //   "message": "Invalid Token",
    //   "details": []
    //  }
    // }
    const arcGISTerrainProvider = new Cesium.ArcGISTiledElevationTerrainProvider({
        url: "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer",
        // token: arcgisAccessToken
    });

    const viewer = new Cesium.Viewer("mapView", {
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        sceneModePicker: false,
        terrainProvider: arcGISTerrainProvider,
        imageryProvider: arcGISImageTileProviderPlatform
    });

    viewer.scene.globe.enableLighting = true;
    viewer.scene.fog.enabled = true;
    lookAtMtEverest(viewer);
};

function lookAtMtEverest(viewer) {
    var target = new Cesium.Cartesian3(
        300770.50872389384,
        5634912.131394585,
        2978152.2865545116
    );
    var offset = new Cesium.Cartesian3(
        6344.974098678562,
        -793.3419798081741,
        2499.9508860763162
    );
    viewer.camera.lookAt(target, offset);
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
};

function flyToSanFrancisco(viewer) {
    // Fly the camera to San Francisco at the given longitude, latitude, and height.
    viewer.camera.flyTo({
        destination : Cesium.Cartesian3.fromDegrees(-122.4175, 37.655, 400),
        orientation : {
            heading : Cesium.Math.toRadians(0.0),
            pitch : Cesium.Math.toRadians(-15.0),
        }
    });
}

if (typeof Cesium !== 'undefined') {
    startCesium(Cesium);
} else {
    document.getElementById("mapView").innerText = "Cesium modules were not loaded, please check your network connection.";
}
