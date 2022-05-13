@echo OFF
REM Windows batch script to use cURL to ArcGIS geocoder to find places near the given parameter
REM Set environment variable ARCGIS_APIKEY with the api key you want to use for the request.
REM curltest this-place
SET apikey=ARCGIS_APIKEY
SET protocol=https://
SET host=geocode-api.arcgis.com
SET endpoint=/arcgis/rest/services/World/GeocodeServer/findAddressCandidates
SET url=%protocol%%host%%endpoint%
SET parameters=f=json^forStorage=false^&category=POI^&outField=*^&SingleLine=%1^&token=%apikey%
echo "curl %url%?%parameters%"
curl "%url%?%parameters%"
