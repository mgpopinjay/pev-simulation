"use strict";
// const fs = require('fs')
var map;
var stationGroup = L.layerGroup();
var mapID = 0;
var mapList = ["Boston", "Taipei"];
var mapSettings = {
    "Boston": { "latitude": 42.359456, "longitude": -71.076336, "zoom": 14 },
    "Taipei": { "latitude": 25.031213, "longitude": 121.502746, "zoom": 13 }
};
var LOOPPERIOD = 10; // milliseconds
var LOOPFREQ = 1000 / LOOPPERIOD;
var LOADLOOPPERIOD = 500;
var SPEED = 600;
var SUBWAYSPEED = 1000 / 200;
var pickUpTimes = [];
var assignTimes = [];
var startTimes = [];
var T_API = "mTBUGDZNyU6IS_nJpCzNSw";
var Tee;
var T_opacity = 0.8;
var TRIAL = 0;
var FLEET_SIZE = 0;
var STATIONS = 271;
var PAUSED = false;
var RUNNING = {};
var PENDING_TRIPS = [];
var LOOP;
var LOADLOOP;
var START = 0;
var TIME = 0;
// var t0 = 0;
// var t1 = 0;
// var filteredspeed = SPEED;

var bike_triphr = {
    "Boston": 4516 / 24,
    "Taipei": 73649 / 24
};
var taxi_triphr = {
    "Boston": 107 / 24,
    "Taipei": 0
};

var train_triphr = {
    "Boston": 2000 / 24, // total number of people = 145,923,904
    "Taipei": 0
};

///////////////////////////////////////////////////////////
////////////////////                 //////////////////////
////////////////////  Slider inputs  //////////////////////
////////////////////                 //////////////////////
///////////////////////////////////////////////////////////

var slider_rebalanceSize = 20;
var slider_fleetSize = 20;
var slider_chargingStations = 20;
var slider_jobDrop = 10;
var slider_bike = 20;
var slider_random = 20;
var slider_taxi = 20;
var slider_train = 20;
var slider_maxDist = 5;
var slider_battery = 10;
var toggle_fuzz = 0;
var toggle_rebalance = 0;
// var slider_hrs = 3;
var slider_startHrs = 6;
var slider_endHrs = 18;

var timeLength = slider_endHrs - slider_startHrs;

$(function() {
    $("#sliderfleet").slider({
        value: 20,
        min: 0,
        max: 2500,
        step: 1,
        slide: function(event, ui) {
            $("#fleet").val(ui.value + " ");
            slider_fleetSize = ui.value;
        }
    });
    $("#fleet").val($("#sliderfleet").slider("value"));
});

$(function() {
    $("#sliderChargingStations").slider({
        value: 20,
        min: 0,
        max: 271,
        step: 1,
        slide: function(event, ui) {
            $("#charging").val(ui.value + " ");
            slider_chargingStations = ui.value;
	      }
	  });
	  $("#charging").val($("#sliderChargingStations").slider("value"));
});

$(function() {
    $("#sliderRebalance").slider({
        value: 20,
        min: 0,
        max: 100,
        step: 10,
        slide: function(event, ui) {
            $("#rebalance").val(ui.value + " %");
            slider_rebalanceSize = ui.value;
        }
    });
    $("#rebalance").val($("#sliderRebalance").slider("value") + " %");
});

$(function() {
    $("#slidermax").slider({
        value: 5,
        min: 0,
        max: 5,
        step: 1,
        slide: function(event, ui) {
            $("#maxdist").val(ui.value + " mi");
            slider_maxDist = ui.value;
        }
    });
    $("#maxdist").val($("#slidermax").slider("value") + " mi");
});

$(function() {
    $("#sliderbattery").slider({
        value: 10,
        min: 0,
        max: 25,
        step: 1,
        slide: function(event, ui) {
            $("#battery").val(ui.value + " mi");
            slider_battery = ui.value;
        }
    });
    $("#battery").val($("#sliderbattery").slider("value") + " mi");
});

$(function() {
    $("#slidertaxi").slider({
        value: 20,
        min: 0,
        max: 100,
        step: 10,
        slide: function(event, ui) {
            let trips = Math.round(ui.value / 100 * taxi_triphr[mapList[mapID]] * timeLength);
            $("#taxidata").val(ui.value + " %" + " (" + trips + " trips)");
            slider_taxi = ui.value;
        }
    });
    $("#taxidata").val($("#slidertaxi").slider("value") + " %" + " (" + Math.round(.2 * taxi_triphr[mapList[mapID]] * timeLength) + " trips)");
});

$(function() {
    $("#sliderbike").slider({
        value: 20,
        min: 0,
        max: 100,
        step: 10,
        slide: function(event, ui) {
            let trips = Math.round(ui.value / 100 * bike_triphr[mapList[mapID]] * timeLength);
            $("#bikedata").val(ui.value + " %" + " (" + trips + " trips)");
            slider_bike = ui.value;
        }
    });
    $("#bikedata").val($("#sliderbike").slider("value") + " %" + " (" + Math.round(.2 * bike_triphr[mapList[mapID]] * timeLength) + " trips)");
});

$(function() {
    let triphr = 60;
    $("#sliderrandom").slider({
        value: 20,
        min: 0,
        max: 100,
        step: 10,
        slide: function(event, ui) {
            let trips = Math.round(ui.value / 100 * triphr * timeLength);
            $("#randomdata").val(ui.value + " %" + " (" + trips + " trips)");
            slider_random = ui.value;
        }
    });
    $("#randomdata").val($("#sliderrandom").slider("value") + " %" + " (" + Math.round(.2 * triphr * timeLength) + " trips)");
});

$(function() {
    $("#sliderParcelAmount").slider({
        value: 10,
        min: 0,
        max: 250,
        step: 10,
        slide: function(event, ui) {
            $("#parcelAmount").val(ui.value + " /hr");
        }
    });
    $("#parcelAmount").val($("#sliderParcelAmount").slider("value") + " /hr");
});

$(function() {
    $("#slidertrain").slider({
        value: 20,
        min: 0,
        max: 100,
        step: 10,
        slide: function(event, ui) {
            let trips = Math.round(ui.value / 100 * train_triphr[mapList[mapID]] * timeLength);
            $("#traindata").val(ui.value + " %" + " (" + trips + " trips)");
            slider_train = ui.value;
        }
    });
    $("#traindata").val($("#slidertrain").slider("value") + " %" + " (" + Math.round(.2 * train_triphr[mapList[mapID]] * timeLength) + " trips)");
});

$(function() {
    $("#sliderJobDrop").slider({
        value: 10,
        min: 5,
        max: 30,
        step: 1,
        slide: function(event, ui) {
            $("#dropping").val(ui.value + " min");
            slider_jobDrop = ui.value;
	      }
	  });
	  $("#dropping").val($("#sliderJobDrop").slider("value") + " min");
});

function fuzz() {
	  var first = true;
	  if(first) {
        rebalance();
	      first = false;
    }
    var fuzzStatus = document.getElementById("toggleFuzzing").checked;
	  if(fuzzStatus) {
        $("#fuzzing").val("On");
	      toggle_fuzz = 1;
	  }
	  else {
        $("#fuzzing").val("Off");
        toggle_fuzz = 0;
	  }
}

function rebalance() {
    var rebalanceStatus = document.getElementById("toggleRebalancing").checked;
	  if(rebalanceStatus) {
        $("#rebalance").val("On");
	      toggle_rebalance = 1;
	  }
	  else {
        $("#rebalance").val("Off");
        toggle_rebalance = 0;
	  }
}

// $(function() {
// $(function() {
//     $("#sliderhrs").slider({
//         value: 3,
//         min: 0,
//         max: 24,
//         step: 1,
//         slide: function(event, ui) {
//             $("#simhrs").val(ui.value + " hrs");
//             slider_hrs = ui.value;
//             $("#hubwaydata").val(slider_hubway + " %" + " (" + Math.round(slider_hubway / 100 * 50 * slider_hrs) + " trips)");
//             $("#randomdata").val(slider_random + " %" + " (" + Math.round(slider_random / 100 * 60 * slider_hrs) + " trips)");
//             $("#taxidata").val(slider_taxi + " %" + " (" + Math.round(slider_taxi / 100 * 4 * slider_hrs) + " trips)");
//         }
//     });
//     $("#simhrs").val($("#sliderhrs").slider("value") + " hrs");
// });

$(function() {
    $("#slider-time").slider({
        range: true,
        min: 0,
        max: 24,
        values: [slider_startHrs, slider_endHrs],
        slide: function(event, ui) {
            $("#hours").val(ui.values[0] + ":00 - " + ui.values[1] + ":00");
            slider_startHrs = ui.values[0];
            slider_endHrs = ui.values[1];
            timeLength = ui.values[1] - ui.values[0];
            $("#bikedata").val(slider_bike + " %" + " (" + Math.round(slider_bike / 100 * bike_triphr[mapList[mapID]] * timeLength) + " trips)");
            $("#randomdata").val(slider_random + " %" + " (" + Math.round(slider_random / 100 * 60 * timeLength) + " trips)");
            $("#taxidata").val(slider_taxi + " %" + " (" + Math.round(slider_taxi / 100 * taxi_triphr[mapList[mapID]] * timeLength) + " trips)");
	          $("#traindata").val(slider_train + " %" + " (" + Math.round(slider_train / 100 * train_triphr[mapList[mapID]] * timeLength) + " trips)");
        }
    });
    $("#hours").val($("#slider-time").slider("values", 0) +
        ":00 - " + $("#slider-time").slider("values", 1) + ":00");
});

$(function() {
    $("#sliderspeed").slider({
        value: 600,
        min: 100,
        max: 1000,
        step: 100,
        slide: function(event, ui) {
            $("#simspeed").val(ui.value + "x");
            SPEED = ui.value
        }
    });
    $("#simspeed").val($("#sliderspeed").slider("value") + "x");
});


function setMapNewbury() {
    map = L.map('map-canvas', { zoomControl: false }).setView([42.359456, -71.076336], 14);
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
    var charging_stations = slider_chargingStations;
    var job_drop = slider_jobDrop;
    var bike_freq = slider_bike;
    var random_freq = slider_random;
    var taxi_freq = slider_taxi;
    var train_freq = slider_train;
	  var fuzzing_toggle = toggle_fuzz;
	  var rebalance_toggle = toggle_rebalance;
    var max_dist = slider_maxDist;
    var battery = slider_battery;
    // var publicTransit_size = slider_publicTransit;
    var rebalanceSize = slider_rebalanceSize;
    var starthrs = slider_startHrs;
    var endhrs = slider_endHrs;
    var code = Math.floor(Math.random() * 10000);
    // CHANGE THIS TO A SELECTION BUTTON / DROPDOWN
    var mapSelect = mapList[mapID];
    var sim_params = {
        starthrs: starthrs,
        endhrs: endhrs,
        size: fleet_size,
        stations: charging_stations,
        job_drop: job_drop,
        parcels: rebalanceSize,
        bike: bike_freq,
        random: random_freq,
        taxi: taxi_freq,
        train: train_freq,
	      fuzzing: fuzzing_toggle,
        rebalance_toggle: rebalance_toggle,
        max_dist: max_dist,
        battery: battery,
        code: code,
        mapselect: mapSelect,
    };
    START = slider_startHrs * 3600; // start time in seconds
    TIME = START; // not actual time, but loops through the visualizer
    Progress(START);
    $('#loadingProgress').removeClass('disabled');
	  // load();
    $.post('/fleetsim', JSON.stringify(sim_params), function(data) {
        $('#loadingProgress').addClass('disabled');
        createStations(data);
        createTrips(data);
    }, 'json');
    console.log("Beginning sim");
    updateLoadingProgress();
}


function test_fleet_sim() {
    // Tee = new BostonTee(SUBWAYSPEED, T_API, map, 0.6)
    // Tee.start();
    $.post('/', function(data) {
        createTrips(data);
    }, 'json');
}

function updateLoadingProgress() {
    console.log("loading");
    // Run getLoadProgress() every LOADLOOPPERIOD (default=500ms)
    LOADLOOP = setInterval(() => getLoadProgress(), LOADLOOPPERIOD);
}

function getLoadProgress() {
    $.get('/loading', function(data) {
        // Replace the line below with a line to update the Progress bar visual
        console.log(data);
        var elem = document.getElementById("loadingBar");
        var width = parseFloat(data) * 100;
        elem.style.width = width + "%";
        if (data == '1.000') {
            clearInterval(LOADLOOP);
        }
    }, 'text');
}

/**
 * Receives a data object and visualizes all charging stations from it.
 * @param {data object} data [a large object containing all cars and their completed trips]
 */
function createStations(data) {
    let LAT = 1;
    let LON = 0;
    let station_coords = data['stations'];
    let icon = L.icon({
       iconUrl: './img/charge.png',
       iconSize: [18, 18],
    });
	  stationGroup.clearLayers();
    for (let i = 0; i < station_coords.length; i++) {
        let stationMarker = L.marker([station_coords[i][LAT], station_coords[i][LON]], { icon: icon, opacity: 0.5 });
	      stationGroup.addLayer(stationMarker);
    }
    map.addLayer(stationGroup);
}

/**
 * Receives a data object and creates all trips from them.
 * Runs a loop as trips are started and completed
 * Keeps track of completed trips
 * @param  {data object} data [a large object containing all cars and their completed trips]
 */
function createTrips(data) {
    console.log(data);
    Object.keys(RUNNING).forEach(i => {
        RUNNING[i].marker.stop();
    });
    RUNNING = {};
    PAUSED = false;
    TRIAL++;
    FLEET_SIZE = Object.keys(data['fleet']).length;
    $('#summary > tbody').append(`
      <tr id="summary-${TRIAL}">
        <td>${TRIAL}</td>
        <td>${FLEET_SIZE}</td>
        <td>${Math.ceil((data['inputs']['STATIONS']))}</td>
        <td>${Math.ceil(data['inputs']['MAX_DIST']/1609.34)} mi</td>
        <td>${Math.ceil((data['inputs']['BATTERY']))} mi</td>
        <td>${data['inputs']['FUZZ_TOGGLE']}</td>
        <td>${data['inputs']['REBALANCE_TOGGLE']}</td>
        <td>${data['outputs']['TRIPS'].taxi+data['outputs']['TRIPS'].bike+data['outputs']['TRIPS'].train+data['outputs']['TRIPS'].random}</td>
        <td>${data['outputs']['TRIPS'].taxi}  / ${data['outputs']['TRIPS'].bike}  /  ${data['outputs']['TRIPS'].train}  /  ${data['outputs']['TRIPS'].random}</td>
        <td>${data['outputs']['TRIPS_HR']}</td>
        <td>${data['inputs']['JOB_DROP']} min</td>
        <td>${data['outputs']['SIM RUNTIME']/60} min</td>
        <td>${Math.ceil((data['outputs']['WAITTIME AVERAGE']/60)*100)/100} min</td>
        <td>${Math.ceil((data['outputs']['WAITTIME 50th PERCENTILE']/60)*100)/100} min</td>
        <td>${Math.ceil((data['outputs']['WAITTIME 75th PERCENTILE']/60)*100)/100} min</td>
        <td>${data['outputs']['AVERAGE CAR MOVEMENT PERCENTAGE']}%</td>
      </tr>`);
    pickUpTimes = [];
    assignTimes = [];
    startTimes = [];
    PENDING_TRIPS = [];
    for (let i = 0; i < Object.keys(data['fleet']).length; i++) {
        for (let j = 0; j < data['fleet'][i]['history'].length; j++) {
            let trip = data['fleet'][i]['history'][j];
            trip['car'] = i;
            PENDING_TRIPS.push(trip)
        }
    }
    PENDING_TRIPS.sort((a, b) => {
        return a['start_time'] - b['start_time']
    });
    runTrips();
}

function runTrips() {
    console.log("running");
    // Run timeStep() every LOOPPERIOD (default=100ms)
    LOOP = setInterval(() => timeStep(), LOOPPERIOD);
}


function timeStep() {
    if (PENDING_TRIPS.length == 0 || PAUSED) {
        clearInterval(LOOP);
    }
    //console.log(`Time is ${(TIME/3600).toFixed(2)} and remaining trips is ${PENDING_TRIPS.length}.`);
    //know how to fix this (mutation of pending trips)
    // Time based on speed with an initial offset of START seconds
    //while (PENDING_TRIPS[0]['start_time'] <= (TIME * SPEED / LOOPFREQ + START)) {
    while (PENDING_TRIPS[0]['start_time'] <= (TIME)) {
        let trip = PENDING_TRIPS[0];
        //console.log(`Trip of trip type: ${trip['type']}`);
        PENDING_TRIPS.splice(0, 1);
        if (trip['type'] == "Idle" || trip['type'] == "Wait") {
            idleCar(
                trip['start_point'],
                trip['duration'],
            )
        }
        else if (trip['type'] == "Recharge") {
            // EDIT TO NEW FUNCTION FOR RECHARGE VISUAL
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
                trip['pickuptime'],
                trip['assigntime'],
                trip['duration'],
                trip['type'],
                trip['steps_polyline'],
            );
        }
    }
    // UpdateTime(TIME * SPEED / LOOPFREQ); // Update progress bar
    // TIME++; // Increment to next timestep, not next second
    UpdateTime(TIME - START);
    document.getElementById("debugclock").innerHTML = (TIME/3600).toFixed(2);
    document.getElementById("debugtripcount").innerHTML = (PENDING_TRIPS.length);
    // TIME = TIME + SPEED / LOOPFREQ;
    TIME = TIME + SPEED / LOOPFREQ;
    // t0 = t1;
    // t1 = performance.now();
    // var instspeed = (SPEED / LOOPFREQ * 1000) / (t1 - t0);
    // filteredspeed = 0.9 * filteredspeed + 0.1 * instspeed;
    // document.getElementById("debugspeed").innerHTML = filteredspeed;
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
    let idleMarker = L.marker([start_loc[1], start_loc[0]], { icon: icon }).addTo(map);
    setTimeout(() => {
        map.removeLayer(idleMarker);
    }, (duration * 1000) / SPEED)
}

function addLegend() {
    let legend = L.control({position: 'bottomright'});
    legend.onAdd = function (map) {
        let div = L.DomUtil.create('div', 'info legend'),
                grades = ["Passenger", "Parcel", "Navigation", "NavToCharge", "Rebalance"],
                labels = [];

        for (let i = 0; i < grades.length; i++) {
            div.innerHTML +=
                '<i style="background:' + legendColors(grades[i]) + '">'+
                grades[i] + '</i> ' + '<br>';
        }
        return div;
    };
    legend.addTo(map);
}


function legendColors(type) {
    switch(type) {
        case 'Navigation': return "#B2B2B2";
        case 'NavToCharge': return "#B80000";
        case 'Rebalance': return "#FF00FF";
        case 'Passenger': return "#F0F000";
        case 'Parcel': return "#FF8000";
    }
}


/**
 * Start a trip
 * @param  {[[xlat, ylat],  [xlng, ylng]]} start_loc [starting lat,lng]
 * @param  {[[xlat, ylat],  [xlng, ylng]]} end_loc [starting lat,lng]
 * @param  {int} start_time [starting time in seconds **UNUSED**]
 * @param  {int} end_time   [ending time in seconds **UNUSED**]
 * @param  {int} pickuptime   [time spent waiting for a car in seconds]
 * @param  {int} assigntime   [time spent waiting for trip assignment in seconds]
 * @param  {int} duration   [duration of trip in seconds]
 * @param  {string} type    [type of drip ('Navigation', 'Passenger', 'Parcel')]
 * @param  {path} path      [OSRM path]
 */
function startTrip(start_loc, end_loc, start_time, end_time, pickuptime, assigntime, duration, type, path) {
    let icon;
    let color;
    let reqIcon;
    let heatLayer;
    let reqMark;
    switch (type) {
        case 'Navigation':
            color = "#B2B2B2";
            icon = L.icon({
                iconUrl: './img/gray_circle.png',
                iconSize: [12, 12],
            });
            break;
        case 'NavToCharge':
            color = "#B80000";
            icon = L.icon({
                iconUrl: './img/gray_circle.png',
                iconSize: [12, 12],
            });
            break;
        case 'Rebalance':
            color = "#FF00FF";
            icon = L.icon({
                iconUrl: './img/magenta_circle.png',
                iconSize: [12, 12],
            });
            break;
        case 'Passenger':
            color = "#F0F000";
            icon = L.icon({
                iconUrl: './img/yellow_circle.png',
                iconSize: [12, 12],
            });
            reqIcon = L.icon({ iconUrl: './img/child.png', iconSize: [20, 20] });
            heatLayer = L.heatLayer([
                [start_loc[1], start_loc[0]]
            ], { gradient: { 'blue': 0.65, 'lime': 1, 'red': 1 }, blur: 0.4 });
            reqMark = L.marker([start_loc[1], start_loc[0]], { icon: reqIcon }).addTo(map);
            break;
        case 'Parcel':
            color = "#FF8000";
            icon = L.icon({
                iconUrl: './img/orange_circle.png',
                iconSize: [12, 12],
            });
            reqIcon = L.icon({ iconUrl: './img/parcel.png', iconSize: [20, 20] });
            heatLayer = L.heatLayer([
                [start_loc[1], start_loc[0]]
            ], { gradient: { 'blue': 0.65, 'lime': 1, 'red': 1 }, blur: 0.4 });
            reqMark = L.marker([start_loc[1], start_loc[0]], { icon: reqIcon }).addTo(map);
            break;
    }
    let polyline = polylineFromTask(path, color, 0.6, 4);
    let navMarker = L.Marker.movingMarker(polyline.getLatLngs(), (((duration) * 1000) / SPEED), { icon: icon });

    let id = Math.random(0, 1000);
    RUNNING[id] = navMarker;

    let timer = new Timer(() => {
        polyline.addTo(map);
        navMarker.addTo(map);
        if (!PAUSED) {
            navMarker.start();
        }
        if (reqMark) {
            map.removeLayer(reqMark);
            // map.addLayer(heatLayer);  HEAT LAYER - Slows down simulation
            pickUpTimes.push(pickuptime / 60);
            assignTimes.push(assigntime / 60);
            startTimes.push(start_time / 60 / 60);
            updateLines();
        }
    }, ((pickuptime + assigntime) * 1000) / SPEED);
    RUNNING[id].timer = timer;
    RUNNING[id].marker = navMarker;

    navMarker.on('end', function() {
        delete RUNNING[id];
        map.removeLayer(this);
        map.removeLayer(polyline);
        if (reqMark) {
            map.removeLayer(reqMark);
        }
        if (navMarker) {
            map.removeLayer(navMarker);
        }
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
    polyline = L.polyline(polylinePath, { color: color, opacity: opacity, weight: weight });
    return polyline;
}

///////////////////////////////////////////////////////////
/////////////////////////          ////////////////////////
/////////////////////////  Graphs  ////////////////////////
/////////////////////////          ////////////////////////
///////////////////////////////////////////////////////////


/**
 * Prepares the data sets for the graph by rounding off and
 * counting the number of occurances of each pickuptime
 * @param  {[int]} times    [list of pickuptimes]
 * @return {obj}   dataset  [object with pickuptime (by 5) mapped to number of occurances]
 */
function prepareLines(times) {
    let dataset = Array.apply(null, Array(35)).map(Number.prototype.valueOf, 0);
    let data = {};
    times.forEach(time => {
        let t = Math.round(time) > 20 ? 20 : Math.round(time);
        if (data[t]) {
            data[t] += 1;
        } else {
            data[t] = 1;
        }
    });
    Object.keys(data).forEach(key => {
        dataset[key] = data[key];
    });
    return dataset
}

function round5(x) {
    return Math.ceil(x / 5) * 5;
}

function prepareStartTimes(times) {
    let dataset = Array.apply(null, Array(180)).map(Number.prototype.valueOf, 0);
    let data = {};
    times.forEach(time => {
        let t = Math.round(time);
        if (data[t]) {
            data[t] += 1;
        } else {
            data[t] = 1;
        }
    });
    Object.keys(data).forEach(key => {
        dataset[key] = data[key];
    });
    return dataset
}

/**
 * Update pickup times with the current assign and pickuptimes
 * Redraws graphs using barGraph() function defined in Graphs.js
 */
function updateLines() {
    let pickUpTimeDataSet = prepareLines(pickUpTimes);
    let assignTimeDataSet = prepareLines(assignTimes);
    let startTimesDataSet = prepareStartTimes(startTimes);
    addLine(startTimesDataSet, "pickup-graph", TRIAL);
    //addLine(assignTimeDataSet, "assign-graph", TRIAL);
    var pickUpSum = pickUpTimes.reduce(function(a, b) { return a + b; });
    var pickUpAvg = Math.round(100 * pickUpSum / pickUpTimes.length) / 100;
    var assignSum = assignTimes.reduce(function(a, b) { return a + b; });
    var assignAvg = Math.round(100 * assignSum / assignTimes.length) / 100;
    $(`#trial-${TRIAL}-pickup`).html(pickUpAvg);
    $(`#trial-${TRIAL}-assign`).html(assignAvg);
}


// CREATE DIFFERENT FUNCTIONS FOR EACH MAP
function setMap(id) {
    var currentMap = mapList[id];
    var currentSettings = [mapSettings[currentMap]["latitude"], mapSettings[currentMap]["longitude"], mapSettings[currentMap]["zoom"]];
    // L.mapbox.accessToken = 'pk.eyJ1IjoiamJvZ2xlIiwiYSI6ImNqY3FrYnR1bjE4bmsycW9jZGtwZXNzeDIifQ.Y9bViJkRjtBUr6Ftuh0I4g';
    L.mapbox.accessToken = 'pk.eyJ1IjoiZGFyeHRhcjAwMDAiLCJhIjoiY2p5N255M3ZhMDFocjNtcWxobzV0M293cSJ9.pHza8i4YLcgP4vvfn3EVeA';
    // map = L.map('map-canvas', { zoomControl: false }).setView([25.031213, 121.502746], 13);
    map = L.map('map-canvas', { zoomControl: false }).setView([currentSettings[0], currentSettings[1]], currentSettings[2]);
    L.mapbox.styleLayer('mapbox://styles/jbogle/cjcqkdujd4tnr2roaeq00m30t').addTo(map);
    // CUSTOM MAP DATA
    // L.geoJson(mapdata, {
    //     style: function(feature) {
    //         console.log(feature)
    //         return {
    //             color: "#B1260A",
    //             fill: true,
    //             opacity: 1,
    //             clickable: false
    //         };
    //     },
    //     onEachFeature: function(feature, layer) {
    //         return
    //     }
    // }).addTo(map);
    // L.tileLayer('https://api.mapbox.com/styles/v1/jbogle/cjcqkdujd4tnr2roaeq00m30t/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiamJvZ2xlIiwiYSI6ImNqY3FrYnR1bjE4bmsycW9jZGtwZXNzeDIifQ.Y9bViJkRjtBUr6Ftuh0I4g').addTo(map);
    L.tileLayer('https://api.mapbox.com/styles/v1/jbogle/cjcqkdujd4tnr2roaeq00m30t/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiZGFyeHRhcjAwMDAiLCJhIjoiY2p5N255M3ZhMDFocjNtcWxobzV0M293cSJ9.pHza8i4YLcgP4vvfn3EVeA').addTo(map);

}

function changeMap() {
    map.remove();
    mapID = (mapID + 1) % mapList.length;
    setMap(mapID);

    $('#summary > tbody').empty();
    d3.selectAll("#graphs > *").remove();

    addLegend();
    //lineGraph("assign-graph", 20, 50, 270, 150, "Assignment Times");

    // lineGraph("pickup-graph", 24, 100, 270, 150, "Demand Graph");
    // $('#line-graph').css('display', 'block');
}

$(document).ready(function() {
    setMap(0);
    addLegend();
    //lineGraph("assign-graph", 20, 50, 270, 150, "Assignment Times");

    // lineGraph("pickup-graph", 24, 100, 270, 150, "Demand Graph");
    // $('#line-graph').css('display', 'block');
});
