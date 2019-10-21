"use strict";
var map;
var mapID = 0;
var mapList = ["Boston", "Taipei"];
var mapSettings = {
    "Boston": { "latitude": 42.359456, "longitude": -71.076336, "zoom": 14 },
    "Taipei": { "latitude": 25.031213, "longitude": 121.502746, "zoom": 13 }
};
var LOOPPERIOD = 10; // milliseconds
var LOOPFREQ = 1000 / LOOPPERIOD;
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
var PAUSED = false;
var RUNNING = {};
var PENDING_TRIPS = [];
var LOOP;
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
var slider_bike = 20;
var slider_random = 20;
var slider_taxi = 20;
var slider_train = 20;
var slider_maxDist = 5;
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
    var bike_freq = slider_bike;
    var random_freq = slider_random;
    var taxi_freq = slider_taxi;
		var train_freq = slider_train;
    var max_dist = slider_maxDist;
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
        parcels: rebalanceSize,
        bike: bike_freq,
        random: random_freq,
        taxi: taxi_freq,
				train: train_freq,
        max_dist: max_dist,
        code: code,
        mapselect: mapSelect,
    };
    START = slider_startHrs * 3600; // start time in seconds
    TIME = START; // not actual time, but loops through the visualizer
    Progress(START);
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
				<td>${data['outputs']['TRIPS'].bike+data['outputs']['TRIPS'].taxi+data['outputs']['TRIPS'].random+data['outputs']['TRIPS'].train}</td>
				<td>${data['outputs']['TRIPS'].bike}  / ${data['outputs']['TRIPS'].taxi}  /  ${data['outputs']['TRIPS'].random}  /  ${data['outputs']['TRIPS'].train}</td>
        <td>${data['outputs']['TRIPS_HR']}</td>
        <td id="trial-${TRIAL}-pickup">0 min</td>
        <td id="trial-${TRIAL}-assign">0 min</td>
        <td>${Math.ceil((data['outputs']['WAITTIME AVERAGE']/60)*100)/100} min</td>
        <td>${Math.ceil((data['outputs']['WAITTIME 50th PERCENTILE']/60)*100)/100} min</td>
        <td>${Math.ceil((data['outputs']['WAITTIME 75th PERCENTILE']/60)*100)/100} min</td>
        <td>${Math.ceil((data['outputs']['AVERAGE CAR NAVIGATION']/60)*100)/100} min</td>
        <td>${Math.ceil((data['outputs']['AVERAGE CAR UTILIZATION']/60)*100)/100} min</td>
        <td>${data['outputs']['AVERAGE CAR UTILIZATION PERCENTAGE']}%</td>
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


/**
 * Make a charging station icon at a location
 */
function placeChargingStations() {
    // TODO: POSSIBLY CHANGE THIS SO STATION LOCATIONS ARE NOT HARDCODED
    let station_coords = [['-71.129164', '42.363796'], ['-71.10878613', '42.38032335'], ['-71.10402523', '42.38100143'], ['-71.104412', '42.370803'], ['-71.14871614', '42.37500235'], ['-71.15412891', '42.38078817'], ['-71.143941', '42.3936'], ['-71.03277501', '42.37411262'], ['-71.14260614', '42.39558846'], ['-71.139459', '42.396105'], ['-71.13275303', '42.34922469'], ['-71.0875672', '42.3636929'], ['-71.08822', '42.3625'], ['-71.05701685', '42.33047365'], ['-71.05142981', '42.35991176'], ['-71.05822917', '42.35533502'], ['-71.12119539', '42.29266593'], ['-71.07746601', '42.39223284'], ['-71.108279', '42.350406'], ['-71.07657015', '42.34807412'], ['-71.0901582', '42.3294633'], ['-71.069849', '42.356052'], ['-71.08981088', '42.35082681'], ['-71.13894682', '42.3382668'], ['-71.105668', '42.37842'], ['-71.1367213', '42.28634589'], ['-71.01619095', '42.38353252'], ['-71.01063069', '42.38522394'], ['-71.08688294', '42.36616223'], ['-71.09372552', '42.27462067'], ['-71.07798629', '42.31786021'], ['-71.057629', '42.35892'], ['-71.04535997', '42.34776345'], ['-71.04102008', '42.37331213'], ['-71.06880777', '42.33671641'], ['-71.05737358', '42.36254854'], ['-71.06512249', '42.30785224'], ['-71.06770543', '42.35256693'], ['-71.07329249', '42.35114198'], ['-71.07655', '42.350413'], ['-71.07946779', '42.34958942'], ['-71.082383', '42.348762'], ['-71.09732501', '42.34465063'], ['-71.088088', '42.347265'], ['-71.10407918', '42.33462893'], ['-71.15027189', '42.34894857'], ['-71.13776207', '42.36154571'], ['-71.09850592', '42.3951715'], ['-71.0782814', '42.38614141'], ['-71.05747275', '42.34278116'], ['-71.12046447', '42.33376473'], ['-71.116205', '42.332799'], ['-71.06905997', '42.37408991'], ['-71.100694', '42.345733'], ['-71.09759867', '42.37119728'], ['-71.111075', '42.373379'], ['-71.094445', '42.372969'], ['-71.0653062', '42.36121165'], ['-71.076472', '42.366981'], ['-71.105495', '42.366426'], ['-71.1031', '42.36507'], ['-71.1142981', '42.3121203'], ['-71.07086598', '42.360185'], ['-71.054812', '42.37412455'], ['-71.027448', '42.379772'], ['-71.07249312', '42.37150494'], ['-71.059367', '42.351356'], ['-71.062679', '42.352409'], ['-71.08582377', '42.34366582'], ['-71.132446', '42.406302'], ['-71.1506152', '42.33554308'], ['-71.071111', '42.2873611'], ['-71.10061884', '42.34011512'], ['-71.0729', '42.309572'], ['-71.05060093', '42.33023071'], ['-71.08138848', '42.34054262'], ['-71.11903489', '42.35169202'], ['-71.12126246', '42.35154735'], ['-71.15168806', '42.34024645'], ['-71.13997217', '42.34835863'], ['-71.11133695', '42.39407224'], ['-71.05752244', '42.36041775'], ['-71.03764', '42.3481'], ['-71.04930013', '42.3510045'], ['-71.107593', '42.383405'], ['-71.123338', '42.341598'], ['-71.07738554', '42.34993464'], ['-71.056067', '42.362811'], ['-71.11543', '42.309054'], ['-71.12536222', '42.32784317'], ['-71.10809952', '42.36178044'], ['-71.132788', '42.388966'], ['-71.07782811', '42.35096144'], ['-71.123024', '42.396969'], ['-71.0972821', '42.34924377'], ['-71.05737627', '42.34404051'], ['-71.08416483', '42.32854046'], ['-71.075354', '42.325333'], ['-71.06198', '42.320561'], ['-71.039431', '42.369536'], ['-71.08318716', '42.38762811'], ['-71.068607', '42.378965'], ['-71.069957', '42.369885'], ['-71.098634', '42.315692'], ['-71.0445714', '42.35339051'], ['-71.15988486', '42.35276621'], ['-71.150226', '42.35484'], ['-71.02495', '42.3334'], ['-71.0605833', '42.2996667'], ['-71.09039426', '42.39108438'], ['-71.07929528', '42.30412793'], ['-71.092225', '42.309796'], ['-71.085347', '42.303469'], ['-71.14347895', '42.38267828'], ['-71.05466698', '42.28297568'], ['-71.03024304', '42.38240378'], ['-71.05960783', '42.35980252'], ['-71.107341', '42.310579'], ['-71.080952', '42.30791'], ['-71.12011306', '42.39638681'], ['-71.0620996', '42.3494261'], ['-71.06384031', '42.34521562'], ['-71.13022771', '42.34953017'], ['-71.12188071', '42.3722168'], ['-71.119945', '42.379011'], ['-71.120886', '42.373231'], ['-71.118579', '42.373268'], ['-71.09522222', '42.36599433'], ['-71.116865', '42.377945'], ['-71.114025', '42.376369'], ['-71.114214', '42.366621'], ['-71.125107', '42.380287'], ['-71.11714125', '42.36919032'], ['-71.056605', '42.377022'], ['-71.10286117', '42.33741748'], ['-71.12852452', '42.3602737'], ['-71.09886996', '42.33658555'], ['-71.13426981', '42.38165061'], ['-71.10984161', '42.32176526'], ['-71.028664', '42.344827'], ['-71.031614', '42.344796'], ['-71.063187', '42.345901'], ['-71.10015746', '42.37438409'], ['-71.124565', '42.363732'], ['-71.10014141', '42.32293117'], ['-71.09785348', '42.34468084'], ['-71.128374', '42.346563'], ['-71.05118036', '42.32033974'], ['-71.08216792', '42.36356016'], ['-71.08495474', '42.36242784'], ['-71.097009', '42.348706'], ['-71.10057324', '42.36346469'], ['-71.10169709', '42.34519429'], ['-71.076529', '42.370677'], ['-71.11901879', '42.38674802'], ['-71.050877', '42.363871'], ['-71.130516', '42.397828'], ['-71.1065', '42.338629'], ['-71.11387163', '42.3572185'], ['-71.107818', '42.398365'], ['-71.064608', '42.375603'], ['-71.070629', '42.380857'], ['-71.06383499', '42.37487847'], ['-71.09670274', '42.36135838'], ['-71.12260755', '42.39120972'], ['-71.09325', '42.2773889'], ['-71.093641', '42.267902'], ['-71.03977829', '42.36884408'], ['-71.06055722', '42.38042947'], ['-71.093198', '42.3581'], ['-71.10129476', '42.3595732'], ['-71.09115601', '42.36213123'], ['-71.10394478', '42.35560121'], ['-71.09126061', '42.32143814'], ['-71.08617242', '42.28072514'], ['-71.13320231', '42.37478629'], ['-71.0728687', '42.35553628'], ['-71.023739', '42.336448'], ['-71.07116282', '42.36769018'], ['-71.064263', '42.365673'], ['-71.091946', '42.316902'], ['-71.1467354', '42.35732922'], ['-71.085954', '42.348717'], ['-71.066498', '42.326599'], ['-71.090179', '42.341814'], ['-71.166491', '42.35057'], ['-71.10446509', '42.3339227'], ['-71.08311072', '42.36224179'], ['-71.09169', '42.366277'], ['-71.08043551', '42.36161932'], ['-71.006098', '42.386781'], ['-71.123413', '42.40449'], ['-71.123831', '42.352261'], ['-71.105301', '42.347241'], ['-71.06781138', '42.35182807'], ['-71.0783056', '42.2944167'], ['-71.10341903', '42.37927325'], ['-71.03497177', '42.36489293'], ['-71.119084', '42.387995'], ['-71.055407', '42.356755'], ['-71.116772', '42.400877'], ['-71.08065777', '42.34652004'], ['-71.053181', '42.354659'], ['-71.129042', '42.392766'], ['-71.08044855', '42.34827839'], ['-71.07699394', '42.36575798'], ['-71.127754', '42.287072'], ['-71.12820532', '42.28630716'], ['-71.050699', '42.357143'], ['-71.095171', '42.331184'], ['-71.08243078', '42.31787329'], ['-71.08798563', '42.33624445'], ['-71.056664', '42.317642'], ['-71.1108917', '42.32760387'], ['-71.0539', '42.3106'], ['-71.04817357', '42.35317809'], ['-71.04167744', '42.34881026'], ['-71.04436085', '42.35148193'], ['-71.10393405', '42.35775309'], ['-71.10057592', '42.349496'], ['-71.1182757', '42.36426344'], ['-71.09812', '42.386844'], ['-71.1096257', '42.39088802'], ['-71.03877', '42.335741'], ['-71.076847', '42.341332'], ['-71.055547', '42.352175'], ['-71.048927', '42.378338'], ['-71.10728681', '42.34619708'], ['-71.052608', '42.344137'], ['-71.104374', '42.316966'], ['-71.066289', '42.351146'], ['-71.052163', '42.358155'], ['-71.087111', '42.2945833'], ['-71.12845883', '42.33209606'], ['-71.06446669', '42.36590788'], ['-71.12653291', '42.40203828'], ['-71.044201', '42.370744'], ['-71.044024', '42.344792'], ['-71.07942931', '42.28621295'], ['-71.08277142', '42.36544486'], ['-71.069616', '42.345392'], ['-71.06166646', '42.35668335'], ['-71.08149976', '42.3388956'], ['-71.07421449', '42.34254914'], ['-71.063348', '42.354979'], ['-71.062256', '42.343749'], ['-71.137313', '42.353334'], ['-71.09530799', '42.37959526'], ['-71.041269', '42.314507'], ['-71.10006094', '42.36264779'], ['-71.06537004', '42.31727474'], ['-71.06978148', '42.31869734'], ['-71.13961272', '42.38393225'], ['-71.11305356', '42.37250865'], ['-71.0514432', '42.3391085'], ['-71.045859', '42.335693'], ['-71.083235', '42.324081'], ['-71.060292', '42.371848'], ['-71.07271846', '42.29791808'], ['-71.16031677', '42.34895285'], ['-71.14127841', '42.34286835'], ['-71.07903779', '42.33509899'], ['-71.081198', '42.332817'], ['-71.08377589', '42.38169983'], ['-71.07404083', '42.3385146'], ['-71.071806', '42.290333'], ['-71.068922', '42.341522'], ['-71.04569256', '42.351586'], ['-71.09627098', '42.33758601'], ['-71.107669', '42.306539'], ['-71.113341', '42.385582']];
    let icon = L.icon({
       iconUrl: './img/blue_circle.png',
       iconSize: [10, 10],
    });
    for (let i = 0; i < station_coords.length; i++) {
        let stationMarker = L.marker([station_coords[i][1], station_coords[i][0]], { icon: icon, opacity: 0.6 }).addTo(map);
    }
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
                iconSize: [15, 15],
            });
            break;
        case 'NavToCharge':
            color = "#B80000";
            icon = L.icon({
                iconUrl: './img/gray_circle.png',
                iconSize: [15, 15],
            });
            break;
        case 'Rebalance':
            color = "#FF00FF";
            icon = L.icon({
                iconUrl: './img/magenta_circle.png',
                iconSize: [15, 15],
            });
            break;
        case 'Passenger':
            color = "#F0F000";
            icon = L.icon({
                iconUrl: './img/yellow_circle.png',
                iconSize: [15, 15],
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
                iconSize: [15, 15],
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

    placeChargingStations();
    addLegend();
    //lineGraph("assign-graph", 20, 50, 270, 150, "Assignment Times");

    // lineGraph("pickup-graph", 24, 100, 270, 150, "Demand Graph");
    // $('#line-graph').css('display', 'block');
}

$(document).ready(function() {
    setMap(0);
    placeChargingStations();
    addLegend();
    //lineGraph("assign-graph", 20, 50, 270, 150, "Assignment Times");

    // lineGraph("pickup-graph", 24, 100, 270, 150, "Demand Graph");
    // $('#line-graph').css('display', 'block');
});
