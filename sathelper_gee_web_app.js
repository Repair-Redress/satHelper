// Create a list of points for the user to select from.
var points = [
  ee.Feature(ee.Geometry.Point([-76.943681, 42.683010]), {name: 'Greenidge Generation'}),
  ee.Feature(ee.Geometry.Point([-76.636753, 42.601217]), {name: 'Miliken Station'}),
  ee.Feature(ee.Geometry.Point([-77.308268, 43.279134]), {name: 'Constellation Nuclear'}),
  ee.Feature(ee.Geometry.Point([-73.910938, 40.919956]), {name: 'Westchester County Water Treatment'})
];

// Function to run the analysis for a selected point.
function runAnalysis(point, targetDate, zoom) {
  var aoiZoom = zoom || 14;

  // Clear any existing widgets and layers from previous selections.
  Map.clear();
  Map.onIdle(updateUrl);

  var pointsLayer = ui.Map.Layer(ee.FeatureCollection(points), {color: 'red'}, 'Selectable Points');
  Map.add(pointsLayer);

  var rightPanel = ui.Panel({
    style: {position: 'top-right'}
  });
  Map.add(rightPanel);

  var resetButton = ui.Button({
    label: 'Select New Site',
    onClick: resetApp,
    style: {stretch: 'horizontal'}
  });
  rightPanel.add(resetButton);

  var legendPanel = ui.Panel({
    style: {
      padding: '5px 5px'
    }
  });
  rightPanel.add(legendPanel);

  var geometry = ee.Geometry.Rectangle([
    point.geometry().coordinates().get(0).getInfo() - 1.0, 
    point.geometry().coordinates().get(1).getInfo() - 0.5, 
    point.geometry().coordinates().get(0).getInfo() + 1.0, 
    point.geometry().coordinates().get(1).getInfo() + 0.5
  ]);

  var l8_raw = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2');
  var l9_raw = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2');
  var raw_collection = ee.ImageCollection(l8_raw.merge(l9_raw)).filterBounds(point.geometry());

/*
Author: Sofia Ermida (sofia.ermida@ipma.pt; @ermida_sofia)

This code is free and open. 
By using this code and any data derived with it, 
you agree to cite the following reference 
in any publications derived from them:
Ermida, S.L., Soares, P., Mantas, V., Göttsche, F.-M., Trigo, I.F., 2020. 
    Google Earth Engine open-source code for Land Surface Temperature estimation from the Landsat series.
    Remote Sensing, 12 (9), 1471; https://doi.org/10.3390/rs12091471

This function selects the Landsat data based on user inputs
and performes the LST computation:
*/
  var LandsatLST = require('users/sofiaermida/landsat_smw_lst:modules/Landsat_LST.js');

  var date_start = '2000-01-01';
  var date_end = '2026-12-31';
  var use_ndvi = true;

  var l8_lst = LandsatLST.collection('L8', date_start, date_end, geometry, use_ndvi);
  var l9_lst = LandsatLST.collection('L9', date_start, date_end, geometry, use_ndvi);

  var collection = ee.ImageCollection(l8_lst.merge(l9_lst));

  var currentImage = null;

  var inspectorPanel = ui.Panel({
    style: {
      padding: '5px 5px',
      shown: false
    }
  });
  rightPanel.add(inspectorPanel);

  Map.style().set('cursor', 'crosshair');
  Map.onClick(function(coords) {
    if (!currentImage) return;

    inspectorPanel.clear();
    inspectorPanel.style().set('shown', true);
    inspectorPanel.add(ui.Label('Loading...', {color: 'gray'}));

    var point = ee.Geometry.Point(coords.lon, coords.lat);
    var temp = currentImage.select('LST').reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point,
      scale: 90
    }).get('LST');

    temp.evaluate(function(val) {
      inspectorPanel.clear();
      var valueLabel;
      if (val !== null) {
        valueLabel = ui.Label('Temperature: ' + val.toFixed(2) + ' °F');
      } else {
        valueLabel = ui.Label('No data at this location.');
      }
      inspectorPanel.add(valueLabel);
      inspectorPanel.add(ui.Button('Close', function() {
        inspectorPanel.style().set('shown', false);
      }));
    });
  });

  // Filter the collection by the point of interest
  var filteredCollection = collection.filterBounds(point.geometry()).sort('system:time_start');

  // Get the unique dates of the images
  var dates = filteredCollection
      .map(function(image) {
          return ee.Feature(null, {date: image.date().format('YYYY-MM-dd')});
      })
      .distinct('date')
      .aggregate_array('date');

  // Use evaluate to bring the date list to the client.
  dates.evaluate(function(dateList) {
    if (!dateList || dateList.length === 0) {
      print('No images found for the given point.');
      return;
    }
    
    var initialIndex = 0;
    if (targetDate) {
      var targetMoment = new Date(targetDate);
      if (!isNaN(targetMoment.getTime())) {
        var closestDate = dateList.reduce(function(prev, curr) {
          var prevDate = new Date(prev);
          var currDate = new Date(curr);
          return (Math.abs(currDate - targetMoment) < Math.abs(prevDate - targetMoment) ? curr : prev);
        });
        initialIndex = dateList.indexOf(closestDate);
      }
    }

    // Create a label to show the selected date.
    var dateLabel = ui.Label('Selected Date: ' + dateList[initialIndex]);

    var imageNumberLabel = ui.Label('Image ' + (initialIndex + 1) + ' of ' + dateList.length);

    // Create a function to update the date label when sliding.
    function updateDate(index) {
      var date = dateList[index];
      dateLabel.setValue('Selected Date: ' + date);
      imageNumberLabel.setValue('Image ' + (index + 1) + ' of ' + dateList.length);
    }
    
    // Create a slider to select an image date.
    var slider = ui.Slider({
      min: 0,
      max: dateList.length - 1,
      value: initialIndex,
      step: 1,
      onChange: showImage,
      style: {stretch: 'horizontal', color: 'white'}
    });
    slider.onSlide(updateDate);

    var backButton = ui.Button('Back', function() {
      var currentValue = slider.getValue();
      if (currentValue > 0) {
        slider.setValue(currentValue - 1);
      }
    });

    var forwardButton = ui.Button('Forward', function() {
      var currentValue = slider.getValue();
      if (currentValue < dateList.length - 1) {
        slider.setValue(currentValue + 1);
      }
    });

    var infoPanel = ui.Panel({
        widgets: [dateLabel, imageNumberLabel],
        layout: ui.Panel.Layout.flow('vertical'),
    });

    // Create a function to display the image for a given index.
    function showImage(index) {
      var date = dateList[index];
      ui.url.set('date', date);
      dateLabel.setValue('Selected Date: ' + date);
      imageNumberLabel.setValue('Image ' + (index + 1) + ' of ' + dateList.length);
      var eeDate = ee.Date(date);
      var image = ee.Image(filteredCollection.filterDate(eeDate, eeDate.advance(1, 'day')).first());
      var rgb_image = ee.Image(raw_collection.filterDate(eeDate, eeDate.advance(1, 'day')).first());

      var lst_fahrenheit = image.select('LST').subtract(273.15).multiply(9/5).add(32).rename('LST');
      image = image.addBands(lst_fahrenheit, null, true);
      currentImage = image;
      
      // Calculate LST from raw thermal band for display, without cloud masking.
      // This is surface temperature from the ST_B10 band.
      var unmasked_st = rgb_image.select('ST_B10').multiply(0.00341802).add(149); // to Kelvin
      var unmasked_st_fahrenheit = unmasked_st.subtract(273.15).multiply(9/5).add(32).rename('LST');
      
      var scaled_rgb = rgb_image.multiply(0.0000275).add(-0.2);
      
      // Load ESA WorldCover for land masking.
      var worldCover = ee.ImageCollection('ESA/WorldCover/v200').first();
      var waterMask = worldCover.eq(80); // 80 is the value for permanent water bodies.
      
      var image_masked = image.updateMask(waterMask);
      
      var lst_reducer = ee.Reducer.percentile([1, 99]);
      
      var rgb_reducer = ee.Reducer.median().combine({
        reducer2: ee.Reducer.stdDev(),
        sharedInputs: true
      });
      
      var lst_stats = image_masked.select('LST').reduceRegion({
        reducer: lst_reducer,
        geometry: geometry,
        scale: 90,
        maxPixels: 1e9
      });
      
      var rgb_stats = scaled_rgb.select(['SR_B4', 'SR_B3', 'SR_B2']).reduceRegion({
        reducer: rgb_reducer,
        geometry: geometry,
        scale: 30,
        maxPixels: 1e9
      });
      
      ee.List([lst_stats, rgb_stats]).evaluate(function(stats) {
        var lst_min, lst_max, rgb_min, rgb_max;

        if (stats && stats[0] && stats[0].LST_p1 !== null && stats[0].LST_p99 !== null) {
          var lst_stats_client = stats[0];
          lst_min = lst_stats_client.LST_p1;
          lst_max = lst_stats_client.LST_p99;
        } else {
          print('Could not compute statistics for the image. It might be fully clouded. Using default LST visualization.');
          lst_min = 50;
          lst_max = 90;
        }

        if (stats && stats[1] && stats[1].SR_B4_median !== null) {
          var rgb_stats_client = stats[1];
          rgb_min = [
            rgb_stats_client.SR_B4_median - 2 * rgb_stats_client.SR_B4_stdDev,
            rgb_stats_client.SR_B3_median - 2 * rgb_stats_client.SR_B3_stdDev,
            rgb_stats_client.SR_B2_median - 2 * rgb_stats_client.SR_B2_stdDev
          ];
          rgb_max = [
            rgb_stats_client.SR_B4_median + 2 * rgb_stats_client.SR_B4_stdDev,
            rgb_stats_client.SR_B3_median + 2 * rgb_stats_client.SR_B3_stdDev,
            rgb_stats_client.SR_B2_median + 2 * rgb_stats_client.SR_B2_stdDev
          ];
        } else {
          print('Could not compute RGB statistics for the image. Using default RGB visualization.');
          rgb_min = [-0.1, -0.1, -0.1];
          rgb_max = [0.3, 0.3, 0.3];
        }
        
        var cmap1 = ['blue', 'cyan', 'green', 'yellow', 'red'];
        var lstVisParams = {min: lst_min, max: lst_max, palette: cmap1};
        
        legendPanel.clear();

        var legendTitle = ui.Label('LST (°F)', {fontWeight: 'bold', fontSize: '14px', margin: '0 0 4px 0', padding: '0'});
        legendPanel.add(legendTitle);
        
        var makeColorBarParams = function(palette) {
          return {
            bbox: [0, 0, 1, 0.1],
            dimensions: '100x10',
            format: 'png',
            min: 0,
            max: 1,
            palette: palette,
          };
        };
        
        var colorBar = ui.Thumbnail({
          image: ee.Image.pixelLonLat().select(0),
          params: makeColorBarParams(lstVisParams.palette),
          style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '20px'},
        });
        
        var minTextBox, maxTextBox, midLabel;
        
        var updateMapAndLegend = function() {
          var min = parseFloat(minTextBox.getValue());
          var max = parseFloat(maxTextBox.getValue());
          if (!isNaN(min) && !isNaN(max) && min < max) {
            var newVisParams = {min: min, max: max, palette: cmap1};
            var lstLayer = Map.layers().get(1); // Assumes LST is at index 1
            lstLayer.setVisParams(newVisParams);
            midLabel.setValue(((max + min) / 2).toFixed(2));
          }
        };
        
        minTextBox = ui.Textbox({
          value: lst_min.toFixed(2),
          placeholder: 'Min Temp',
          onChange: updateMapAndLegend,
          style: {margin: '4px 0px 4px 8px', width: '70px'}
        });
        
        maxTextBox = ui.Textbox({
          value: lst_max.toFixed(2),
          placeholder: 'Max Temp',
          onChange: updateMapAndLegend,
          style: {margin: '4px 8px 4px 0px', width: '70px'}
        });
        
        midLabel = ui.Label(
          ((lst_max + lst_min) / 2).toFixed(2),
          {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}
        );
        
        var legendLabels = ui.Panel({
          widgets: [minTextBox, midLabel, maxTextBox],
          layout: ui.Panel.Layout.flow('horizontal')
        });
        
        legendPanel.add(colorBar);
        legendPanel.add(legendLabels);
        
        var rgbVisParams = {bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: rgb_min, max: rgb_max};
        
        var rgbLayer = ui.Map.Layer(scaled_rgb, rgbVisParams, 'RGB');
        var lstLayer = ui.Map.Layer(unmasked_st_fahrenheit.resample('bicubic'), lstVisParams, 'LST');
        
        // Create a black land mask from the inverted water mask.
        var landMask = waterMask.not();
        var landMaskLayer = ui.Map.Layer(landMask.selfMask(), {palette: '000000'}, 'Land Mask');
        
        Map.layers().reset([rgbLayer, lstLayer, landMaskLayer, pointsLayer]);
        
        backButton.setDisabled(index === 0);
        forwardButton.setDisabled(index === dateList.length - 1);
      });
    }

    // Create a panel to hold the widgets.
    var panel = ui.Panel({
      widgets: [infoPanel, backButton, forwardButton, slider],
      layout: ui.Panel.Layout.flow('horizontal'),
      style: {
        position: 'bottom-center',
        padding: '5px 5px',
        width: '75%'
      }
    });

    // Add the panel to the map.
    Map.add(panel);

    // Show the first image.
    showImage(initialIndex);
    
    Map.centerObject(point.geometry(), aoiZoom);
  });
}

function resetApp() {
  Map.clear();
  ui.url.set('latitude', null);
  ui.url.set('longitude', null);
  ui.url.set('date', null);
  ui.url.set('zoom', null);
  showDefaultView();
}

function showDefaultView() {
  var pointsLayer = ui.Map.Layer(ee.FeatureCollection(points), {color: 'red'}, 'Selectable Points');
  Map.add(pointsLayer);
  Map.centerObject(ee.FeatureCollection(points), 7);
  
  var instructionsPanel = ui.Panel({
    widgets: [
      ui.Label('Click on a point to start the analysis.')
    ],
    style: {
      position: 'top-center',
      padding: '8px 15px'
    }
  });
  Map.add(instructionsPanel);
  
  // Add a click handler to the map.
  Map.onClick(function(coords) {
    var point = ee.Feature(ee.Geometry.Point(coords.lon, coords.lat), {name: 'Custom Location'});
    runAnalysis(point);
  });
}

// Function to update the URL with the current map center and zoom.
function updateUrl() {
  var center = Map.getCenter();
  var zoom = Map.getZoom();
  center.evaluate(function(coords) {
    ui.url.set('latitude', coords.coordinates[1].toFixed(6));
    ui.url.set('longitude', coords.coordinates[0].toFixed(6));
    ui.url.set('zoom', zoom);
  });
}

function initializeApp() {
  var lat = ui.url.get('latitude');
  var lon = ui.url.get('longitude');
  var date = ui.url.get('date');
  var zoom = ui.url.get('zoom');

  if (lat && lon) {
    var latFloat = parseFloat(lat);
    var lonFloat = parseFloat(lon);
    
    if (!isNaN(latFloat) && !isNaN(lonFloat)) {
      var point = ee.Feature(ee.Geometry.Point([lonFloat, latFloat]), {name: 'Custom Location'});
      var zoomLevel = zoom ? parseInt(zoom) : null;
      runAnalysis(point, date, zoomLevel);
    } else {
      // Fallback to default view if lat/lon are invalid
      showDefaultView();
    }
  } else {
    showDefaultView();
  }
}

// Listen for map changes to update the URL.
Map.onIdle(updateUrl);

initializeApp();
