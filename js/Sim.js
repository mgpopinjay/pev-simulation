"use strict";
var map;
var SPEED = 600;
var SUBWAYSPEED = 1000 / 200;
var pushTimes = [];
var pickUpTimes = [];
var startTimes = [];
var T_API = "mTBUGDZNyU6IS_nJpCzNSw";
var Tee;
var T_opacity = 0.8;
var TRIAL = 0;
var FLEET_SIZE = 0;
var PAUSED = false
var RUNNING = {};
var PENDING_TRIPS = [];
var LOOP;

///////////////////////////////////////////////////////////
////////////////////                 //////////////////////
////////////////////  Slider inputs  //////////////////////
////////////////////                 //////////////////////
///////////////////////////////////////////////////////////

var slider_rebalanceSize = 20;
var slider_fleetSize = 20;
var slider_hubway = 20;
var slider_random = 20;
var slider_taxi = 20;
var slider_max = 5;
var slider_hrs = 3;

$(function() {
    $("#sliderfleet").slider({
        value: 20,
        min: 0,
        max: 200,
        step: 5,
        slide: function(event, ui) {
            $("#fleet").val(ui.value + " ");
            slider_fleetSize = ui.value;
        }
    });
    $("#fleet").val($("#sliderfleet").slider("value"));
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
})
$(function() {
    $("#slidermax").slider({
        value: 5,
        min: 0,
        max: 5,
        step: 1,
        slide: function(event, ui) {
            $("#maxdist").val(ui.value + " mi");
            slider_max = ui.value;
        }
    });
    $("#maxdist").val($("#slidermax").slider("value") + " mi");
});

$(function() {
    let triphr = 4;
    $("#slidertaxi").slider({
        value: 20,
        min: 0,
        max: 100,
        step: 10,
        slide: function(event, ui) {
            let trips = Math.round(ui.value / 100 * triphr * slider_hrs)
            $("#taxidata").val(ui.value + " %" + " (" + trips + " trips)");
            slider_taxi = ui.value;
        }
    });
    $("#taxidata").val($("#slidertaxi").slider("value") + " %" + " (" + Math.round(.2 * triphr * slider_hrs) + " trips)");
});

$(function() {
    let triphr = 50;
    $("#sliderhubway").slider({
        value: 20,
        min: 0,
        max: 100,
        step: 10,
        slide: function(event, ui) {
            let trips = Math.round(ui.value / 100 * triphr * slider_hrs)
            $("#hubwaydata").val(ui.value + " %" + " (" + trips + " trips)");
            slider_hubway = ui.value;
        }
    });
    $("#hubwaydata").val($("#sliderhubway").slider("value") + " %" + " (" + Math.round(.2 * triphr * slider_hrs) + " trips)");
});

$(function() {
    let triphr = 60;
    $("#sliderrandom").slider({
        value: 20,
        min: 0,
        max: 100,
        step: 10,
        slide: function(event, ui) {
            let trips = Math.round(ui.value / 100 * triphr * slider_hrs);
            $("#randomdata").val(ui.value + " %" + " (" + trips + " trips)");
            slider_random = ui.value;
        }
    });
    $("#randomdata").val($("#sliderrandom").slider("value") + " %" + " (" + Math.round(.2 * triphr * slider_hrs) + " trips)");
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
    $("#sliderhrs").slider({
        value: 3,
        min: 0,
        max: 24,
        step: 1,
        slide: function(event, ui) {
            $("#simhrs").val(ui.value + " hrs");
            slider_hrs = ui.value;
            $("#hubwaydata").val(slider_hubway + " %" + " (" + Math.round(slider_hubway / 100 * 50 * slider_hrs) + " trips)");
            $("#randomdata").val(slider_random + " %" + " (" + Math.round(slider_random / 100 * 60 * slider_hrs) + " trips)");
            $("#taxidata").val(slider_taxi + " %" + " (" + Math.round(slider_taxi / 100 * 4 * slider_hrs) + " trips)");
        }
    });
    $("#simhrs").val($("#sliderhrs").slider("value") + " hrs");
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
    var bike_freq = slider_hubway;
    var random_freq = slider_random;
    var taxi_freq = slider_taxi;
    var max_dist = slider_max;
    // var publicTransit_size = slider_publicTransit;
    var rebalanceSize = slider_rebalanceSize;
    var endhrs = slider_hrs;
    var code = Math.floor(Math.random() * 10000);
    var sim_params = {
        starthrs: 0,
        endhrs: endhrs,
        size: fleet_size,
        parcels: rebalanceSize,
        bike: bike_freq,
        random: random_freq,
        taxi: taxi_freq,
        max_dist: max_dist,
        code: code,
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
    console.log(data);
    TIME = 0;
    Object.keys(RUNNING).forEach(i => {
        RUNNING[i].marker.stop();
    });
    RUNNING = {};
    PAUSED = false;
    TRIAL++;
    FLEET_SIZE = Object.keys(data['fleet']).length;
    $('#summary').append(`
      <tr id="summary-${TRIAL}">
        <td>${TRIAL}</td>
        <td>${FLEET_SIZE}</td>
        <td>${data['outputs']['TRIPS'].bike+data['outputs']['TRIPS'].taxi+data['outputs']['TRIPS'].random}</td>
        <td>${data['outputs']['TRIPS'].bike}  / ${data['outputs']['TRIPS'].taxi}  /  ${data['outputs']['TRIPS'].random}</td>
        <td>${data['outputs']['TRIPS_HR']}</td>
        <td id="trial-${TRIAL}-pickup">0 min</td>
        <td id="trial-${TRIAL}-push">0 min</td>
        <td>${Math.ceil((data['outputs']['WAITTIME AVERAGE']/60)*100)/100} min</td>
        <td>${Math.ceil((data['outputs']['WAITTIME 50th PERCENTILE']/60)*100)/100} min</td>
        <td>${Math.ceil((data['outputs']['WAITTIME 75th PERCENTILE']/60)*100)/100} min</td>
        <td>${Math.ceil((data['outputs']['AVERAGE CAR NAVIGATION']/60)*100)/100} min</td>
        <td>${Math.ceil((data['outputs']['AVERAGE CAR UTILIZATION']/60)*100)/100} min</td>
        <td>${data['outputs']['AVERAGE CAR UTILIZATION PERCENTAGE']}%</td>
        <td>${data['outputs']['AVERAGE CAR MOVEMENT PERCENTAGE']}%</td>
      </tr>`)
    pushTimes = [];
    pickUpTimes = [];
    startTimes = [];
    //let pendingTrips = [];
    for (let i = 0; i < Object.keys(data['fleet']).length; i++) {
        for (let j = 0; j < data['fleet'][i]['history'].length; j++) {
            let trip = data['fleet'][i]['history'][j];
            trip['car'] = i;
            PENDING_TRIPS.push(trip)
        }
    }
    PENDING_TRIPS.sort((a, b) => {
        return a['start_time'] - b['start_time']
    })
    runTrips();
}

function runTrips() {
    console.log("running");
    LOOP = setInterval(() => timeStep(), 100);
};


function timeStep() {
    if (PENDING_TRIPS.length == 0 || PAUSED) {
        clearInterval(LOOP);
    }

    //know how to fix this (mutation of pending trips)
    while (PENDING_TRIPS[0]['start_time'] <= (TIME * SPEED / 10)) {
        let trip = PENDING_TRIPS[0];
        PENDING_TRIPS.splice(0, 1);
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
                trip['pickuptime'],
                trip['pushtime'],
                trip['duration'],
                trip['type'],
                trip['steps_polyline'],
            );
        }
    }
    TIME++;
    UpdateTime(TIME * SPEED / 10);
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

/**
 * Start a trip
 * @param  {[[xlat, ylat],  [xlng, ylng]]} start_loc [starting lat,lng]
 * @param  {[[xlat, ylat],  [xlng, ylng]]} end_loc [starting lat,lng]
 * @param  {int} start_time [starting time in seconds **UNUSED**]
 * @param  {int} end_time   [ending time in seconds **UNUSED**]
 * @param  {int} pickuptime   [time spent waiting for a car in seconds]
 * @param  {int} pushtime   [time spent waiting for trip assignment in seconds]
 * @param  {int} duration   [duration of trip in seconds]
 * @param  {string} type    [type of drip ('Navigation', 'Passenger', 'Parcel')]
 * @param  {path} path      [OSRM path]
 */
function startTrip(start_loc, end_loc, start_time, end_time, pickuptime, pushtime, duration, type, path) {
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
            reqIcon = L.icon({ iconUrl: './img/child.png', iconSize: [20, 20] });
            heatLayer = L.heatLayer([
                [start_loc[1], start_loc[0]]
            ], { gradient: { 0.65: 'blue', 1: 'lime', 1: 'red' }, blur: 0.4 });
            reqMark = L.marker([start_loc[1], start_loc[0]], { icon: reqIcon }).addTo(map);
            break;
        case 'Parcel':
            color = "#FF8000"
            icon = L.icon({
                iconUrl: './img/orange_circle.png',
                iconSize: [15, 15],
            });
            reqIcon = L.icon({ iconUrl: './img/parcel.png', iconSize: [20, 20] });
            heatLayer = L.heatLayer([
                [start_loc[1], start_loc[0]]
            ], { gradient: { 0.65: 'blue', 1: 'lime', 1: 'red' }, blur: 0.4 });
            reqMark = L.marker([start_loc[1], start_loc[0]], { icon: reqIcon }).addTo(map);
            break;
    };
    let polyline = polylineFromTask(path, color, 0.9, 4)
    var navMarker = L.Marker.movingMarker(polyline.getLatLngs(), (((duration) * 1000) / SPEED), { icon: icon });

    let id = Math.random(0, 1000);
    RUNNING[id] = navMarker;

    let timer = new Timer(() => {
        polyline.addTo(map);
        navMarker.addTo(map);
        if (!PAUSED) {
            navMarker.start();
        };
        if (reqMark) {
            map.removeLayer(reqMark);
            // map.addLayer(heatLayer);  HEAT LAYER - Slows down simulation
            pickUpTimes.push(pickuptime / 60);
            pushTimes.push(pushtime / 60);
            startTimes.push(start_time / 60 / 60);
            updateLines();
        };
    }, ((pickuptime + pushtime) * 1000) / SPEED);
    RUNNING[id].timer = timer;
    RUNNING[id].marker = navMarker

    navMarker.on('end', function() {
        delete RUNNING[id]
        map.removeLayer(this);
        map.removeLayer(polyline);
        if (reqMark) {
            map.removeLayer(reqMark);
        };
        if (navMarker) {
            map.removeLayer(navMarker);
        };
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
    })
    Object.keys(data).forEach(key => {
        dataset[key] = data[key];
    })
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
    })
    Object.keys(data).forEach(key => {
        dataset[key] = data[key];
    })
    return dataset
}

/**
 * Update pickup times with the current push and pickuptimes
 * Redraws graphs using barGraph() function defined in Graphs.js
 */
function updateLines() {
    let pickUpTimeDataSet = prepareLines(pickUpTimes);
    let pushTimeDataSet = prepareLines(pushTimes);
    let startTimesDataSet = prepareStartTimes(startTimes);
    addLine(startTimesDataSet, "pickup-graph", TRIAL);
    //addLine(pushTimeDataSet, "push-graph", TRIAL);
    var pickUpSum = pickUpTimes.reduce(function(a, b) { return a + b; });
    var pickUpAvg = Math.round(100 * pickUpSum / pickUpTimes.length) / 100;
    var pushSum = pushTimes.reduce(function(a, b) { return a + b; });
    var pushAvg = Math.round(100 * pushSum / pushTimes.length) / 100;
    $(`#trial-${TRIAL}-pickup`).html(pickUpAvg);
    $(`#trial-${TRIAL}-push`).html(pushAvg);
}

$(document).ready(function() {
    // map = L.map('map-canvas', {zoomControl: false}).setView([42.359456, -71.076336], 14);
    L.mapbox.accessToken = 'pk.eyJ1IjoiamJvZ2xlIiwiYSI6ImNqY3FrYnR1bjE4bmsycW9jZGtwZXNzeDIifQ.Y9bViJkRjtBUr6Ftuh0I4g';
    map = L.map('map-canvas', { zoomControl: false }).setView([42.359456, -71.076336], 14);
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
    Progress(0);
    //lineGraph("push-graph", 20, 50, 270, 150, "Assignment Times");
    lineGraph("pickup-graph", 24, 100, 270, 150, "Demand Graph");
    $('#line-graph').css('display', 'block');
});
