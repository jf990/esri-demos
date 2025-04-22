/**
 * Demo app using ArcGIS Location Platform and ArcGIS Maps SDK for JavaScript that demonstrates the following features:
 * Basemap select: navigation, imagery, custom
 * Data hosting with feature service: curated Palm Springs tourist attractions, popup; style points by unique value renderer
 * Route and directions between two selected points
 * show/hide traffic
 * show elevation at point
 * Places layer
 */
const routeUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";
const placesCategoriesURL = "https://places-api.arcgis.com/arcgis/rest/services/places-service/v1/categories";
const trafficLayerURL = "https://traffic.arcgis.com/arcgis/rest/services/World/Traffic/MapServer";
const elevationURL = "https://elevation-api.arcgis.com/arcgis/rest/services/elevation-service/v1/elevation/at-point";
const elevationMeasure = "meanSeaLevel";
const customBasemapItemId = "545aec7d28a34e08a0579a648199921b";
const touristFeatureServiceURL = "https://services6.arcgis.com/ruf7rSM6pRXYMxKO/arcgis/rest/services/Palm_Springs_Tourist_Locations/FeatureServer";
const radiusBase = 500;

require([
    "esri/config",
    "esri/Basemap",
    "esri/Map",
    "esri/views/MapView",
    "esri/support/BasemapStyle",
    "esri/Graphic",
    "esri/rest/route",
    "esri/rest/support/RouteParameters",
    "esri/rest/support/FeatureSet",
    "esri/layers/FeatureLayer",
    "esri/layers/MapImageLayer",
    "esri/layers/VectorTileLayer",
    "esri/request",
    "esri/rest/places",
    "esri/rest/support/FetchPlaceParameters",
    "esri/rest/support/PlacesQueryParameters",
    "esri/geometry/Point",
    "esri/Graphic",
    "esri/layers/GraphicsLayer"
], function(esriConfig, Basemap, Map, MapView, BasemapStyle, Graphic, route, RouteParameters, FeatureSet, FeatureLayer, MapImageLayer, VectorTileLayer, esriRequest, places, FetchPlaceParameters, PlacesQueryParameters, Point, Graphic, GraphicsLayer) {
  setEventHandlers();
  let languageCode = "en";
  let localizeCategories = true;
  let routingActive = false;
  let showElevation = false;
  let placesCategoriesList = null;
  let placesCategoriesToShow = null;
  let activePlaceCategory = "Restaurants";
  let processingPlaceSearch = false;
  let lastPlaceId = null;

  updateConfigurationFromURL();
  esriConfig.apiKey = my_secret_api_key;
  const placesLayer = new GraphicsLayer({
    id: "placesLayer"
  });
  const initialBasemapId = document.getElementById("basemap-select").value;
  const map = new Map({
    basemap: basemapFromSelection(initialBasemapId),
    layers: [placesLayer]
  });
  const view = new MapView({
      container: "viewDiv",
      map: map,
      center: [-116.5418227, 33.8258333],
      zoom: 11
  });

  getPlacesCategoriesList(languageCode);
  showTouristAttractions(map);

  view.on("click", function(event) {
    const mapPoint = event.mapPoint;
    if (routingActive) {
      if (view.graphics.length === 0) {
        addGraphic("origin", mapPoint);
      } else if (view.graphics.length === 1) {
        addGraphic("destination", mapPoint);
        getRoute();
      } else {
        view.graphics.removeAll();
        addGraphic("origin", mapPoint);
      }
    } else if (showElevation) {
      view.graphics.removeAll();
      getElevationDataAtPoint(view, mapPoint);
    } else {
      getPlacesNearby(activePlaceCategory, mapPoint);
    }
  });

  view.on("pointer-move", pointerMoveEventHandler);

  /**
   * Read the URL query string for any parameters to set up the application.
   */
  function updateConfigurationFromURL() {
    const queryParams = new URLSearchParams(location.search.substring(1));
    languageCode = queryParams.get("language") || "en";
  }

  /**
   * ---------------------------- Basemap -----------------------------------------
   */
  /**
   * Listen for a change event on the basemap picker UI.
   * @param {Event} event Event attributes.
   */
  function onChangeBasemap(event) {
    const element = event.target;
    map.basemap = basemapFromSelection(element.value);
  }

  /**
   * Create a new Basemap object based on the basemap selected in the UI.
   * @param {string} basemapId Which basemap was selected.
   * @returns {Basemap}
   */
  function basemapFromSelection(basemapId) {
    let basemap;
    switch (basemapId) {
      case "imagery":
        basemap = new Basemap({
          style: new BasemapStyle({
            id: "arcgis/imagery",
            places: "attributed",
            worldview: "unitedStatesOfAmerica",
            language: languageCode
          })
        });
        break;
      case "custom":
        basemap = new Basemap({
          baseLayers: [
            new VectorTileLayer({
              portalItem: {
                id: customBasemapItemId
              }
            })
          ]
        });
        break;
      case "navigation":
      default:
        basemap = new Basemap({
          style: new BasemapStyle({
            id: "arcgis/navigation",
            places: "attributed",
            worldview: "unitedStatesOfAmerica",
            language: languageCode
          })
        });
        break;
      }
      return basemap;
  }

  /**
   * Add a graphic symbol on the map indicating a reference point.
   * @param {string} type Modifier for the graphic, either "origin" or "destination".
   * @param {Point} point x, y where the point will appear on the map.
   */
  function addGraphic(type, point) {
    const graphic = new Graphic({
      symbol: {
        type: "simple-marker",
        color: (type === "origin") ? "white" : "black",
        size: "10px"
      },
      geometry: point
    });
    view.graphics.add(graphic);
  }

  /**
   * ---------------------------- Routing -----------------------------------------
   */
  /**
   * Solve the route between the origin and destination points.
   */
  function getRoute() {
    const routeParams = new RouteParameters({
      stops: new FeatureSet({
        features: view.graphics.toArray()
      }),
      returnDirections: true,
      directionsOutputType: "complete"
    });

    route.solve(routeUrl, routeParams)
    .then(function(routeSolveResult) {
      routeSolveResult.routeResults.forEach(function(result) {
        result.route.symbol = {
          type: "simple-line",
          color: [5, 150, 255],
          width: 3
        };
        view.graphics.add(result.route);
      });

      // Display directions
      if (routeSolveResult.routeResults.length > 0) {
        const routeResult = routeSolveResult.routeResults[0].directions;
        const directions = document.createElement("ol");
        directions.classList = "esri-widget esri-widget--panel esri-directions__scroller";
        directions.style.marginTop = "50px";
        directions.style.padding = "12px 12px 12px 30px";
        const features = routeResult.features;

        // Show each direction
        features.forEach(function(result,i){
          const direction = document.createElement("li");
          direction.innerHTML = result.attributes.text + " (" + result.attributes.length.toFixed(2) + " miles)";
          directions.appendChild(direction);
        });

        // show summary
        let summary = document.createElement("p");
        summary.innerText = 
          "Distance: " + routeResult.totalLength.toFixed(2) +
          " miles; drive time: " + routeResult.totalDriveTime.toFixed(2) + " minutes";
        directions.appendChild(summary);
        view.ui.empty("top-right");
        view.ui.add(directions, "top-right");
      }
    })
    .catch(function(error){
        console.log(error);
    });
  }

  /**
   * Traffic layer uses Map image tile layer, requires valid authentication.
   * @param {Map} map Map object to add traffic layer to.
   */
  function showTraffic(map) {
    let trafficLayer = map.findLayerById("traffic");
    if (trafficLayer) {
      trafficLayer.visible = true;
    } else {
      trafficLayer = new MapImageLayer({
        url: trafficLayerURL,
        id: "traffic",
        opacity: 0.6
      });
      map.layers.add(trafficLayer);
    }
  }

  function hideTraffic(map) {
    const trafficLayer = map.findLayerById("traffic");
    if (trafficLayer) {
      trafficLayer.visible = false;
    }
  }

  /**
   * Handle the route UI switch to enable or disable the routing service.
   */
  function onChangeRoute(event) {
    const element = event.target;
    routingActive = element.checked;
    if ( ! routingActive) {
      view.ui.empty("top-right");
      view.graphics.removeAll();
    }
  }

  /**
   * Handle the UI switch to show or hide the traffic layer.
   */
  function onChangeTraffic(event) {
    const element = event.target;
    const isChecked = element.checked;
    if (isChecked) {
      showTraffic(map);
    } else {
      hideTraffic(map);
    }
  }

  /**
   * ---------------------------- Feature Service -----------------------------------------
   */
  /**
   * Create a feature layer from our curated places data, add the unique value symbol
   * renderer with places icons, and add to the map.
   * @param {Map} map Map object to add the operational layer to.
   */
  function showTouristAttractions(map) {
    const otherSymbol = {
      type: "picture-marker",
      url: "https://static.arcgis.com/icons/places/Default_Building_48.png",
      width: "22px",
      height: "22px"
    };
    const museumSymbol = {
      type: "picture-marker",
      url: "https://static.arcgis.com/icons/places/Museum_48.png",
      width: "22px",
      height: "22px"
    };
    const parkSymbol = {
      type: "picture-marker",
      url: "https://static.arcgis.com/icons/places/Park_48.png",
      width: "22px",
      height: "22px"
    };
    const zooSymbol = {
      type: "picture-marker",
      url: "https://static.arcgis.com/icons/places/Zoo_48.png",
      width: "22px",
      height: "22px"
    };
    const trailSymbol = {
      type: "picture-marker",
      url: "https://static.arcgis.com/icons/places/National_Park_48.png",
      width: "22px",
      height: "22px"
    };
    const placesRenderer = {
      type: "unique-value",
      legendOptions: {
        title: "Place type",
      },
      defaultSymbol: otherSymbol,
      defaultLabel: "Other",
      field: "Category",
      uniqueValueInfos: [
        {
          value: "museum",
          symbol: museumSymbol,
          label: "Museum"
        },
        {
          value: "park",
          symbol: parkSymbol,
          label: "Park"
        },
        {
          value: "zoo",
          symbol: zooSymbol,
          label: "Zoo"
        },
        {
          value: "hiking trail",
          symbol: trailSymbol,
          label: "Hiking trail"
        }
      ],
    }
    const popupPlaces = {
      "title": "{Title}",
      "content": "<b>Type:</b> {Category}<br><b>Address:</b> {Address}<br><b>Website:</b> <a href=\"{URL}\">{URL}</a><br><b>Hours:</b> {hours}<br><b>Rating:</b> {rating}<p>{description}</p>"
    }

    const placesLayer = new FeatureLayer({
      url: touristFeatureServiceURL,
      outFields: ["*"],
      popupTemplate: popupPlaces,
      renderer: placesRenderer
    });
    map.add(placesLayer);
  }

  /**
   * ---------------------------- Elevation -----------------------------------------
   */
  /**
   * Query elevation data for the given point and then render the UI
   * popup element to display the data.
   * @param {MapView} mapView Map view to add UI elements to.
   * @param {Point} mapPoint x, y where to query elevation data.
   */
  function getElevationDataAtPoint(mapView, mapPoint) {
    const longitude = mapPoint.longitude;
    const latitude = mapPoint.latitude;
    esriRequest(elevationURL, {
      query: {
        lon: longitude,
        lat: latitude,
        relativeTo: elevationMeasure
      },
      responseType: "json",
    })
    .then(function(response) {
      const { x, y, z } = response.data.result.point;
      mapView.popup = {
        autoCloseEnabled: true,
        buttonEnabled: false,
        dockEnabled: true,
        visibleElements: {
          collapseButton: false,
          closeButton: true,
          actionBar: false,
        },
      };
  
      const title = `Relative to ${
        elevationMeasure === "meanSeaLevel"
          ? "mean sea level"
          : "ground level"
      }`;
      const content = `Elevation: ${z} m<br>Latitude: ${y.toFixed(5)}<br>Longitude: ${x.toFixed(5)}`;
  
      addGraphic("origin", mapPoint) 
      mapView.openPopup({
        location: [longitude, latitude],
        content: content,
        title: title,
      });
    });
  }

  /**
   * Handle the UI switch to enable or disable elevation query.
   */
  function onChangeElevation(event) {
    const element = event.target;
    showElevation = element.checked;
    if ( ! showElevation) {
      view.graphics.removeAll();
      view.popup.close();
    }
  }

  /**
   * ---------------------------- Places -----------------------------------------
   */
  /**
   * Pre-load all place categories in the requested language. Once loaded,
   * update the place category buttons with the new labels.
   */
  function getPlacesCategoriesList(language) {
    fetch(`${placesCategoriesURL}?icon=svg&language=${language}&token=${my_secret_api_key}`, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    })
    .then(function(response) {
      response.json().then(function(categoriesResponse) {
        placesCategoriesList = categoriesResponse.categories;
        showPlacesCategories(view);
      })
    });
  }

  /**
   * Return the URL to the icon for the place category id. Requires the place
   * categories have been previously loaded.
   */
  function getCategoryIconURL(categoryId) {
    if ( ! placesCategoriesList) {
      return "https://static.arcgis.com/icons/places/Default_Arts_and_Entertainment_15.svg";
    }
    return placesCategoriesList.find(
      function(category) {
        return category.categoryId == categoryId;
      }
    ).icon.url;
  }

  /**
   * Return the name of a category id such that is can be localized from
   * the server response.
   */
  function getCategoryNameLocalized(categoryId) {
    if ( ! placesCategoriesList) {
      return "unknown";
    }
    const categoryNames = placesCategoriesList.find(
      function(category) {
        return category.categoryId == categoryId
      }
    ).fullLabel;
    return categoryNames[categoryNames.length - 1];  
  }

  /**
   * Return the place type given its category name.
   * @param {string} name 
   * @returns 
   */
  function getPlaceTypeByName(categoryName) {
    return placesCategoriesToShow.find(placeType => placeType.name === categoryName)
  }

  /**
   * Show the places category buttons based on the curated set of places
   * we want to use in our app.
   * @param {MapView} mapView Parent of the display objects.
   */
  function showPlacesCategories(mapView) {
    if ( ! placesCategoriesToShow) {
      placesCategoriesToShow = [
        {
          name: "Default",
          isButton: false,
          categoryIds: "",
          icon: "https://static.arcgis.com/icons/places/Default_15.svg",
        },
        {
          name: "Restaurants",
          categoryIds: ["4d4b7105d754a06374d81259"],
          labelCategoryId: "4d4b7105d754a06374d81259",
          isButton: true,
          isSelected: true,
          icon: "https://static.arcgis.com/icons/places/Restaurant_15.svg",
        },
        {
          name: "Bars/pubs",
          categoryIds: [
            "4bf58dd8d48988d117941735",
            "4bf58dd8d48988d118941735",
            "4bf58dd8d48988d1d5941735",
            "4bf58dd8d48988d11b941735",
            "5f2c224bb6d05514c70440a3",
            "4bf58dd8d48988d123941735",
            "50327c8591d4c4b30a586d5d",
            "5e189fd6eee47d000759bbfd",
            "52e81612bcbc57f1066b7a06"
          ],
          labelCategoryId: "4bf58dd8d48988d116941735",
          isButton: true,
          icon: "https://static.arcgis.com/icons/places/Bar_or_Pub_15.svg",
        },
        {
          name: "Grocery",
          categoryIds: ["4bf58dd8d48988d118951735", "52f2ab2ebcbc57f1066b8b45", "50aa9e744b90af0d42d5de0e", "52f2ab2ebcbc57f1066b8b2c", "5f2c41945b4c177b9a6dc7d6", "63be6904847c3692a84b9bf0"],
          labelCategoryId: "4bf58dd8d48988d118951735",
          isButton: true,
          icon: "https://static.arcgis.com/icons/places/Grocery_Store_15.svg",
        },
        {
          name: "Coffee",
          categoryIds: ["4bf58dd8d48988d1e0931735", "5e18993feee47d000759b256"],
          labelCategoryId: "4bf58dd8d48988d1e0931735",
          isButton: true,
          icon: "https://static.arcgis.com/icons/places/Coffee_or_Tea_15.svg",
        }
      ];
    }
    const categoryButtons = document.getElementById("categoryButtons");
    // Set up each category button to the categories we want to offer in the UI
    placesCategoriesToShow.forEach(function(placeType) {
      if ( ! placeType.isButton) {
        return;
      }
      const categoryButton = document.createElement("calcite-chip");
      categoryButton.classList.add("categoryButton");
      categoryButton.setAttribute("scale", "s");
      categoryButton.setAttribute("kind", "neutral");
      categoryButton.setAttribute("appearance", "solid");
      categoryButton.setAttribute("value", placeType.name);
      categoryButton.innerHTML = localizeCategories ? getCategoryNameLocalized(placeType.labelCategoryId) : placeType.name;
      if (placeType.isSelected) {
        categoryButton.setAttribute("selected", true);
        activePlaceCategory = getPlaceTypeByName(placeType.name);
      }
      categoryButton.addEventListener("calciteChipSelect", function(event) {
        if (processingPlaceSearch) {
          return;
        }
        clearPlaces();
        activePlaceCategory = getPlaceTypeByName(event.currentTarget.value);
      });

      const buttonAvatar = document.createElement("calcite-avatar");
      buttonAvatar.setAttribute("slot", "image");
      buttonAvatar.setAttribute("scale", "s");

      // add the icon
      const icon = getCategoryIconURL(placeType.categoryIds[0]);
      buttonAvatar.setAttribute("thumbnail", icon);
      categoryButton.append(buttonAvatar);
      categoryButtons.append(categoryButton);
    });
  }

  /**
   * remove any prior results/details from prior place search.
   */
  function clearPlaces() {
    placesLayer.removeAll();
  }

  /**
   * Get places of the selected category near the point.
   */
  async function getPlacesNearby(placeCategory, mapPoint) {
    if (processingPlaceSearch) {
      return;
    }
    processingPlaceSearch = true;
    clearPlaces();
    const searchPoint = {
      type: "point",
      longitude: Math.round(mapPoint.longitude * 1000) / 1000,
      latitude: Math.round(mapPoint.latitude * 1000) / 1000
    }
    const placesQueryParameters = new PlacesQueryParameters({
      categoryIds: placeCategory.categoryIds,
      radius: radiusBase,
      point: searchPoint,
      icon: "png"
    });
    places.queryPlacesNearPoint(placesQueryParameters)
    .then(async function(placesResults) {
      if (placesResults.results.length > 0) {
        placesResults.results.forEach(function(searchResult) {
          addPlaceMarker(searchResult);
        });
        // @todo: placesResults.nextQueryParams for more results
      }
      processingPlaceSearch = false;
    });
  }

  /**
   * Add a place result to the map in a graphics layer using the icon
   * based on the place category.
   * @param {Place} place Place result.
   */
  async function addPlaceMarker(placeAttributes) {
    const placeGraphic = new Graphic({
      geometry: {
        type: "point",
        y: placeAttributes.location.y,
        x: placeAttributes.location.x
      },
      symbol: {
        type: "picture-marker",
        url: placeAttributes.icon.url,
        width: 16,
        height: 16
      },
      attributes: placeAttributes
    });
    placesLayer.graphics.add(placeGraphic);
  }

  async function pointerMoveEventHandler(pointerEvent) {
    const response = await view.hitTest(pointerEvent, {include: placesLayer});
    if (response.results.length > 0) {
      // hit something on the places layer, show the details
      const graphic = response.results[0].graphic;
      const placeAttributes = graphic.attributes;
      if (lastPlaceId != placeAttributes.placeId) {
        lastPlaceId = placeAttributes.placeId;
        getPlaceDetails(placeAttributes);
      }
    } else {
      // no results, clear any previous place detail
      lastPlaceId = null;
      view.ui.empty("top-right");
    }
  }

  /**
   * Get details about a place given its place ID returned from a place query.
   * @param {Place} placeAttributes Place attributes returned from a place query.
   */
  function getPlaceDetails(placeAttributes) {
    const fetchPlaceParameters = new FetchPlaceParameters({
      placeId: placeAttributes.placeId,
      requestedFields: ["all"],
    });
    places.fetchPlace(fetchPlaceParameters)
    .then(function(placeDetailsResult) {
      const placeDetails = placeDetailsResult.placeDetails;
      const details = document.createElement("div");
      details.classList = "esri-widget esri-widget--panel esri-directions__scroller";
      details.style.marginTop = "50px";
      details.style.padding = "12px 12px 12px 30px";

      // Take each place attribute and display in details panel
      function setAttribute(infoPanel, heading, icon, validValue) {
        if (validValue) {
          const element = document.createElement("calcite-block");
          element.heading = heading;
          element.description = validValue;
          const attributeIcon = document.createElement("calcite-icon");
          attributeIcon.icon = icon;
          attributeIcon.slot = "icon";
          attributeIcon.scale = "m";
          element.appendChild(attributeIcon);
          infoPanel.appendChild(element);
        }
      }

      details.innerHTML = `<h3>${placeDetails.name}</h3><p>${placeDetails.categories[0].label}</p>`;
      setAttribute(details, "Address", "map-pin", placeDetails.address.streetAddress);
      setAttribute(details, "Phone", "mobile", placeDetails.contactInfo.telephone);
      setAttribute(details, "Website", "web", placeDetails.contactInfo.website);
      setAttribute(details, "Email", "email-address", placeDetails.contactInfo.email);

      view.ui.empty("top-right");
      view.ui.add(details, "top-right");
    })
  }

  function setEventHandlers() {
    let element = document.getElementById("basemap-select");
    if (element) {
      element.addEventListener("calciteComboboxChange", onChangeBasemap);
    }
    element = document.getElementById("traffic-switch");
    if (element) {
      element.addEventListener("calciteSwitchChange", onChangeTraffic);
    }
    element = document.getElementById("route-switch");
    if (element) {
      element.addEventListener("calciteSwitchChange", onChangeRoute);
    }
    element = document.getElementById("elevation-switch");
    if (element) {
      element.addEventListener("calciteSwitchChange", onChangeElevation);
    }
  }
});
