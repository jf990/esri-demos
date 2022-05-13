#!/bin/bash
# Edit .env file to set `ARCGIS_APIKEY=YOUR_API_KEY` with the api key you want to use for the request.
# sh ./curltest.sh "Washington%20Convention%20Center%2C%20Washington%20DC"
##################################################
set -a
. ./.env
set +a
protocol="https://"
host="geocode-api.arcgis.com"
endpoint="/arcgis/rest/services/World/GeocodeServer/findAddressCandidates"
url="${protocol}${host}${endpoint}"
parameters="f=json&forStorage=false&category=POI&outFields=*&SingleLine=${1}&token=${ARCGIS_APIKEY}"
echo "curl ${url}?${parameters}"
curl -X GET "${url}?${parameters}"
