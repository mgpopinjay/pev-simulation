"use strict";
var map;
var SPEED =600;
var SUBWAYSPEED = 1000 / 200;
var pushTimes = [];
var waitTimes = [];
var T_API = "mTBUGDZNyU6IS_nJpCzNSw";
var Tee;
var T_opacity = 0.8;
var TRIAL = 0;
var FLEET_SIZE = 0;

///////////////////////////////////////////////////////////
////////////////////                 //////////////////////
////////////////////  Slider inputs  //////////////////////
////////////////////                 //////////////////////
///////////////////////////////////////////////////////////

var slider_rebalanceSize = 20;
var slider_fleetSize = 20;
var slider_publicTransit = 20;

$(function() {
  $( "#sliderRebalance" ).slider({
    value: 20,
    min: 0,
    max: 100,
    step: 10,
    slide: function( event, ui ) {
      $( "#rebalance" ).val( ui.value + " %" );
      slider_rebalanceSize = ui.value;
    }
  });
  $( "#rebalance" ).val(  $( "#sliderRebalance" ).slider( "value" ) + " %");
});

$(function() {
  $("#sliderfleet").slider({
    value: 20,
    min: 0,
    max: 100,
    step: 5,
    slide: function( event, ui ) {
      $("#fleet").val( ui.value + " " );
      slider_fleetSize = ui.value;
    }
  });
  $( "#fleet" ).val( $( "#sliderfleet" ).slider( "value" ));
});

$(function() {
  $( "#sliderpublicTransit" ).slider({
    value: 20,
    min: 0,
    max: 100,
    step: 10,
    slide: function( event, ui ) {
      $( "#publicTransit" ).val( ui.value + " %" );
      slider_publicTransit = ui.value;
    }
  });
  $( "#publicTransit" ).val( $( "#sliderpublicTransit" ).slider( "value" ) + " %"  );
});


$(function() {
  $( "#sliderParcelAmount" ).slider({
    value: 10,
    min: 0,
    max: 250,
    step: 10,
    slide: function( event, ui ) {
      $( "#parcelAmount" ).val( ui.value + " /hr");
    }
  });
  $( "#parcelAmount" ).val(  $( "#sliderParcelAmount" ).slider( "value" ) + " /hr"  );
});

$(function() {
  $( "#sliderSimSpeed" ).slider({
    value: 10,
    min: 5,
    max: 20,
    step: 1,
    slide: function( event, ui ) {
      $( "#simSpeed" ).val( ui.value + "x" );
    }
  });
  $( "#simSpeed" ).val(  $( "#sliderSimSpeed" ).slider( "value" ) + "x"  );
});


function setMapNewbury() {
  map = L.map('map-canvas', {zoomControl: false}).setView([42.359456, -71.076336], 14);
}

function T_off() {
  Tee.hide();
}

function T_on() {
  Tee.show();
}


///////////////////////////////////////////////////////////
//////////////////////              ///////////////////////
//////////////////////  Simulation  ///////////////////////
//////////////////////              ///////////////////////
///////////////////////////////////////////////////////////

/**
 * Run on Simulation start button
 * Runs the backend simulation with given parameters
 * Creates all trips given the data received
 */
function fleet_sim() {
  var fleet_size = slider_fleetSize;
  var publicTransit_size = slider_publicTransit
  var rebalanceSize = slider_rebalanceSize;
  var rng = Math.floor(Math.random()*10000);
  var sim_params = {
    size: fleet_size,
    maxDist: publicTransit_size,
    parcels: rebalanceSize,
    code: rng
  };
  $('#loader').removeClass('disabled');
  $.post('/fleetsim', JSON.stringify(sim_params), function(data) {
    $('#loader').addClass('disabled');
    createTrips(data);
  }, 'json');
}


function test_fleet_sim() {
  // Tee = new BostonTee(SUBWAYSPEED, T_API, map, 0.6)
  // Tee.start();
  $.post('/', function(data) {
    createTrips(data);
  }, 'json');
}

/**
 * Receives a data object and creates all trips from them.
 * Runs a loop as trips are started and completed
 * Keeps track of completed trips
 * @param  {data object} data [a large object containing all cars and their completed trips]
 */
function createTrips(data) {
  TIME = 0;
  TRIAL++;
  FLEET_SIZE = Object.keys(data['fleet']).length;
  pushTimes = [];
  waitTimes = [];
  console.log(data);
  // let trip = data['fleet'][0]['history'][1];
  let pendingTrips = [];
  for(let i=0; i < Object.keys(data['fleet']).length; i++) {
    for(let j=0; j < data['fleet'][i]['history'].length; j++) {
      let trip = data['fleet'][i]['history'][j];
      trip['car'] = i;
      pendingTrips.push(trip)
    }
  }
  pendingTrips.sort((a, b) => {
    return a['start_time'] - b['start_time']
  })
  let loop = setInterval(() => {
    if (pendingTrips.length == 0){
      clearInterval(loop);
    }
    while (pendingTrips[0]['start_time'] <= (TIME * SPEED / 10)) {
      let trip = pendingTrips[0];
      pendingTrips.splice(0, 1);
      if (trip['type'] == "Idle") {
        idleCar(
            trip['start_point'],
            trip['duration'],
          )
      } else {
        startTrip(
          trip['start_point'],
          trip['end_point'],
          trip['start_time'],
          trip['end_time'],
          trip['waittime'],
          trip['pushtime'],
          trip['duration'],
          trip['type'],
          trip['steps_polyline'],
        );
      }
    }
    TIME++;
    UpdateTime(TIME*SPEED/10);
  }, 100)
}

/**
 * Make a car idle at a location for a given duration
 * @param  {[[xlat, ylat], [xlng, ylng]]} start_loc [starting lat,lng]
 * @param  {int} duration  [idle duration in seconds]
 */
function idleCar(start_loc, duration) {
  let icon = L.icon({
    iconUrl: './img/gray_circle.png',
    iconSize: [15, 15],
  });
  let idleMarker = L.marker([start_loc[1], start_loc[0]], {icon: icon}).addTo(map);
  setTimeout(() => {
    map.removeLayer(idleMarker);
  }, (duration * 1000) / SPEED)
}

/**
 * Start a trip
 * @param  {[[xlat, ylat],  [xlng, ylng]]} start_loc [starting lat,lng]
 * @param  {[[xlat, ylat],  [xlng, ylng]]} end_loc [starting lat,lng]
 * @param  {int} start_time [starting time in seconds **UNUSED**]
 * @param  {int} end_time   [ending time in seconds **UNUSED**]
 * @param  {int} waittime   [time spent waiting for a car in seconds]
 * @param  {int} pushtime   [time spent waiting for trip assignment in seconds]
 * @param  {int} duration   [duration of trip in seconds]
 * @param  {string} type    [type of drip ('Navigation', 'Passenger', 'Parcel')]
 * @param  {path} path      [OSRM path]
 */
function startTrip(start_loc, end_loc, start_time, end_time, waittime, pushtime, duration, type, path) {
  let marker;
  let icon;
  let color;
  let reqIcon;
  let heatLayer;
  let reqMark;
  switch (type) {
    case 'Navigation':
      color = "#B2B2B2"
      icon = L.icon({
        iconUrl: './img/gray_circle.png',
        iconSize: [15, 15],
      });
      break;
    case 'Passenger':
      color = "#F0F000"
      icon = L.icon({
        iconUrl: './img/yellow_circle.png',
        iconSize: [15, 15],
      });
      reqIcon = L.icon({iconUrl: './img/child.png',iconSize: [20, 20]});
      heatLayer = L.heatLayer([[start_loc[1], start_loc[0]]], {gradient: {0.65: 'blue', 1: 'lime', 1: 'red'}, blur: 0.4});
      reqMark = L.marker([start_loc[1], start_loc[0]], {icon: reqIcon}).addTo(map);
      break;
    case 'Parcel':
      color = "#FF8000"
      icon = L.icon({
        iconUrl: './img/orange_circle.png',
        iconSize: [15, 15],
      });
      reqIcon = L.icon({iconUrl: './img/parcel.png', iconSize: [20, 20]});
      heatLayer = L.heatLayer([[start_loc[1], start_loc[0]]], {gradient: {0.65: 'blue', 1: 'lime', 1: 'red'}, blur: 0.4});
      reqMark = L.marker([start_loc[1], start_loc[0]], {icon: reqIcon}).addTo(map);
      break;
  };
  let polyline = polylineFromTask(path, color, 0.9, 4)
  var navMarker = L.Marker.movingMarker(polyline.getLatLngs(), (((duration) * 1000) / SPEED), {icon: icon});
  setTimeout(() => {
    polyline.addTo(map);
    navMarker.addTo(map);
    navMarker.start();
    if (reqMark) {
      map.removeLayer(reqMark);
      // map.addLayer(heatLayer);
      waitTimes.push(waittime / 60);
      pushTimes.push(pushtime / 60);
      updateLines();
    };
  }, ((waittime + pushtime) * 1000) / SPEED);
  navMarker.on('end', function(){
    map.removeLayer(this);
    map.removeLayer(polyline);
    if(marker != null)
    map.removeLayer(marker);
  });
}

/**
 * Creates a polyline corresponding to given inputs
 * @param  {path} steps     [path of polyline]
 * @param  {string} color   [color of polyline]
 * @param  {int} opacity    [opacity of polyline]
 * @param  {int} weight     [weight of polyline]
 * @return {polyline}       [a polyline to be mapped on the map]
 */
function polylineFromTask(steps, color, opacity, weight) {
  var polyline;
  var polylinePath = [];
  var steps_polyline = steps;
  for (var i = 0; i < steps_polyline.length; i++) {
    var encoded = steps_polyline[i];
    polyline = L.Polyline.fromEncoded(encoded);
    var nextSegment = polyline.getLatLngs();
    for (var k = 0; k < nextSegment.length; k++) {
      polylinePath.push([nextSegment[k].lat, nextSegment[k].lng]);
    }
  }
  polyline = L.polyline(polylinePath, {color: color, opacity: opacity, weight: weight});
  return polyline;
}

///////////////////////////////////////////////////////////
/////////////////////////          ////////////////////////
/////////////////////////  Graphs  ////////////////////////
/////////////////////////          ////////////////////////
///////////////////////////////////////////////////////////


/**
 * Prepares the data sets for the graph by rounding off and
 * counting the number of occurances of each waittime
 * @param  {[int]} times    [list of waittimes]
 * @return {obj}   dataset  [object with waittimed (by 5) mapped to number of occurances]
 */
function prepareLines(times) {
  let dataset = Array.apply(null, Array(35)).map(Number.prototype.valueOf,0);
  let data = {};
  times.forEach(time => {
    let t = Math.round(time) > 20 ? 20 : Math.round(time);
    if (data[t]) {
      data[t] += 1;
    } else {
      data[t] = 1;
    }
  })
  Object.keys(data).forEach(key => {
    dataset[key] = data[key];
  })
  return dataset
}
/**
 * Update wait times with the current push and waittimes
 * Redraws graphs using barGraph() function defined in Graphs.js
 */
function updateLines() {
  let waitTimeDataSet = prepareLines(waitTimes);
  let pushTimeDataSet = prepareLines(pushTimes);
  addLine(waitTimeDataSet, "wait-graph", TRIAL);
  addLine(pushTimeDataSet, "push-graph", TRIAL);
  var waitSum = waitTimes.reduce(function(a, b) { return a + b; });
  var waitAvg = Math.round(100*waitSum / waitTimes.length)/100;
  var pushSum = pushTimes.reduce(function(a, b) { return a + b; });
  var pushAvg = Math.round(100*pushSum / pushTimes.length)/100;
  $(`#summary-${TRIAL}`).remove()
  if ($('#summary-' + TRIAL).length) {
    //just removed the old row and readding it next
  } else {
    $('#summary').append(`
      <tr id="summary-${TRIAL}">
        <td>${TRIAL}</td>
        <td>${FLEET_SIZE}</td>
        <td>${waitAvg}</td>
        <td>${pushAvg}</td>
      </tr>`)
  }
}

$(document).ready(function() {
  // map = L.map('map-canvas', {zoomControl: false}).setView([42.359456, -71.076336], 14);
  L.mapbox.accessToken = 'pk.eyJ1IjoiamJvZ2xlIiwiYSI6ImNqY3FrYnR1bjE4bmsycW9jZGtwZXNzeDIifQ.Y9bViJkRjtBUr6Ftuh0I4g';
  map = L.map('map-canvas', {zoomControl: false}).setView([42.359456, -71.076336], 14);
  L.mapbox.styleLayer('mapbox://styles/jbogle/cjcqkdujd4tnr2roaeq00m30t').addTo(map);
  L.geoJson(mapdata, {
    style: function(feature) {
        console.log(feature)
        return {
            color: "#B1260A",
            fill: true,
            opacity: 1,
            clickable: false
        };
    },
    onEachFeature: function(feature, layer) {
        return
    }
  }).addTo(map);
  L.tileLayer('https://api.mapbox.com/styles/v1/jbogle/cjcqkdujd4tnr2roaeq00m30t/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiamJvZ2xlIiwiYSI6ImNqY3FrYnR1bjE4bmsycW9jZGtwZXNzeDIifQ.Y9bViJkRjtBUr6Ftuh0I4g').addTo(map);
  Progress(0, 800);
  lineGraph("push-graph", 20, 50, 270, 150, "Assignment Times");
  lineGraph("wait-graph", 20, 50, 270, 150, "Wait Times");
  $('#line-graph').css('display', 'block');
});
