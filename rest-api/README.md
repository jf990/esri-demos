# ArcGIS REST API

There are many ways to make REST requests and get responses back from REST servers. Here are just a few.

For more information and the full API reference visit [ArcGIS REST API](https://developers.arcgis.com/rest/). If you are new to the ArcGIS REST API then [start here](https://developers.arcgis.com/rest/services-reference/get-started-with-the-services-directory.htm).

## Use the web browser

You can make a REST request directly in your web browser if the method is GET. For example, here is a geocode request:

```html
https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&SingleLine=Washington+Convention+Center%2C+Washington+DC&category=POI&outFields=*&forStorage=false
```

Note the parameters must all be made URL safe.

## Use command line

You can make REST requests from the command line using cURL. The [`curltest.sh`](curltest.sh) file is an example shell script written for this purpose. To run this, enter a terminal (or command prompt) then enter:

`sh ./curltest.sh "Washington+Convention+Center%2C+Washington+DC"`

Replace the quoted string with any point of interest you wish to geocode. The string must be URL and CLI safe.

If you prefer windows, [`curltest.bat`](curltest.bat) is the Windows batch version of the same script. You may be required to install cURL and have it in your PATH.

For more information about cURL, including download and install, see [curl.haxx.se](https://curl.haxx.se/).

## Use Postman

[Postman](https://www.getpostman.com/apps) is an app that is well suited for trying REST endpoints. It handles everything you need to make requests: URLs, parameters, methods, responses, and organizing your requests into collections. Esri España created a handy repository with many ArcGIS REST endpoints organized into collections. See [ArcGIS REST API](https://github.com/esri-es/ArcGIS-REST-API) on github.com.

[Postman](https://www.postman.com/downloads/) is a proprietary app that requires download and install.

## Use HTML forms

You can make a request using an HTML form. See [`postform.html`](viewsource:postform.html) for an example. Edit the file with your text editor to change the parameters or how it works. Load it in your web browser and give it a try.

Because the `<form>` element supports the `method` attribute, you can use GET or POST.

## Use JavaScript

You can write an app and have greater control over your REST requests and processing the responses. See `fetchapp.html` and `xmlhttprequest.html` as examples. Load these examples in your web browser and give it a try. You must run this from a web server so that the origin protocol is `HTTP://` or `HTTPS://`, not `FILE://`, due to CORS restrictions it will not fetch from FILE:.

Since this is written with JavaScript, you have full control over how it works and more importantly, how to process the response.

## Use node JS with ArcGIS REST JS

You can perform ArcGIS REST requests using [Node.js](https://nodejs.org) and the [ArcGIS REST JS](https://esri.github.io/arcgis-rest-js/) open source library. Review the content in the `node-example` folder. Examine the code in the `index.js` file to understand how the demo is set up and how to run the various code snippets.

To run this project see the [README](node-example/README.md).

## Resources

Links to many of the dependencies used in these demos:

* [ArcGIS for Developers](https://developers.arcgis.com)
* [ArcGIS REST API](https://developers.arcgis.com/rest/)
* [ArcGIS REST JS](https://esri.github.io/arcgis-rest-js/)
* [ArcGIS REST API Postman collections](https://github.com/esri-es/ArcGIS-REST-API)
* [Node.js](https://nodejs.org)
* [Postman](https://www.getpostman.com/apps)
* [curl.haxx.se](https://curl.haxx.se/)
* [jq](https://stedolan.github.io/jq/)
* [XMLHTTPRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest)
* [fetch](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch)
* [HTTP protocol](https://developer.mozilla.org/en-US/docs/Web/HTTP)
* [REST Architectural style dissertation](https://www.ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm)
* [ArcGIS REST API Getting Started](https://developers.arcgis.com/rest/services-reference/get-started-with-the-services-directory.htm)
