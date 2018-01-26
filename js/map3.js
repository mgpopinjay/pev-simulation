"use strict";
var map;

var SPEED = 200;
var SUBWAYSPEED = 60 * 6;
var pushTimes = [];
var waitTimes = [];
var T_API = "mTBUGDZNyU6IS_nJpCzNSw";
var Tee;
var T_opacity = 0.8;

// MEGAUPDATE pt 1
// Made ran_nums dictionary to hold onto current ranodm number generated
var ran_nums = {'num' : 0};
var emissions = [0, 0, 0];
var tot_distances = [0, 0, 0];
var emissions_coeffs = [2, 10, 5];

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

// Value
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

function fleet_sim() {
  var fleet_size = slider_fleetSize;
  var publicTransit_size = slider_publicTransit
  var rebalanceSize = slider_rebalanceSize;
  var rng = Math.floor(Math.random()*10000);
  ran_nums['num'] = rng
  var sim_params = {
    size: fleet_size,
    maxDist: publicTransit_size,
    parcels: rebalanceSize,
    code: rng
  };
  $.post('/fleetsim', JSON.stringify(sim_params), function(data) {
    sim_data = data;
    objectCreation(data);
  }, 'json');
}


function test_fleet_sim() {
  Tee = new BostonTee(SUBWAYSPEED, T_API, map, 0.6)
  Tee.start();
  $.post('/', function(data) {
    objectCreation(data);
  }, 'json');
}

// function tableDataCreation(data) {
//   console.log(data);
//   // var object = JSON.stringify(data);
//   // console.log(object);
//   console.log(data['fleet'].length);
//   // for(var fleet=0; fleet < data['fleet'].length; i++) {
//   //   console.log(data['fleet'][fleet]);
//   // }
//     // for(var history=0; history < data['fleet'][i]['history'].length; history++) {
//   //     if(data['fleet'][i]['history'].length < history+3) {
//   //       break;
//   //     } else {
//   //       var index = history/3;
//   //       for(var k=history; k<history+3; i++) {
//   //         // var object = data['fleet'][i]['history'][k];
//   //         console.log(data);
//   //         // if (object['type'] == 'Navigation') {
//   //           // console.log(object);
//   //           // startTimeSet[fleet][index]['NAV'] = (object['start_time'] * SPEED);
//   //           // endTimeSet[fleet][index]['NAV'] = (object['end_time'] * SPEED);
//   //           // var wattingTime = endTimeSet[fleet][index]['NAV']-startTimeSet[fleet][index]['NAV'];
//   //           // console.log("Watting Time: " + wattingTime);
//   //         }
//   //       }
//   //     }
//   //   }
//   // }
// }

function objectCreation(data) {
  console.log('running')
  console.log(data);
  let trip = data['fleet'][0]['history'][1];
  let elapsed_time = 0;
  let pendingTrips = [];
  for(let i=0; i < Object.keys(data['fleet']).length; i++) {
    for(let j=0; j < data['fleet'][i]['history'].length; j++) {
      let trip = data['fleet'][i]['history'][j];
      trip['car'] = i;
      pendingTrips.push(trip)
    }
  }
  let loop = setInterval(() => {
    for (var i = pendingTrips.length - 1; i >= 0; i--) {
      let trip = pendingTrips[i];
      if ((elapsed_time * SPEED) / 10 <= trip['start_time']) {
        continue;
      }
      pendingTrips.splice(i, 1);
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
    elapsed_time++;
  }, 100)
  //   for(let i=0; i < Object.keys(data['fleet']).length; i++) {
  //     for(let j=0; j < data['fleet'][i]['history'].length; j++) {
  //       let trip = data['fleet'][i]['history'][j];
  //       if (elapsed_time < trip['start_time']) {
  //         continue;
  //       }
  //       if (trip['type'] == "Idle") {

  //       } else {
  //         startTrip(
  //           trip['start_point'],
  //           trip['end_point'],
  //           trip['start_time'],
  //           trip['end_time'],
  //           trip['duration'],
  //           trip['type'],
  //           polylineFromTask(trip),
  //         );
  //       }
  //     }
  //   }
  // }
}

function idleCar(start_loc, duration) {
  let icon = L.icon({
    iconUrl: './images/gray_circle.png',
    iconSize: [15, 15],
  });
  let idleMarker = L.marker([start_loc[1], start_loc[0]], {icon: icon}).addTo(map);
  setTimeout(() => {
    map.removeLayer(idleMarker);
  }, (duration * 1000) / SPEED)
}

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
        iconUrl: './images/gray_circle.png',
        iconSize: [15, 15],
      });
      break;
    case 'Passenger':
      color = "#F0F000"
      icon = L.icon({
        iconUrl: './images/yellow_circle.png',
        iconSize: [15, 15],
      });
      reqIcon = L.icon({iconUrl: './images/child.png',iconSize: [20, 20]});
      heatLayer = L.heatLayer([[start_loc[1], start_loc[0]]], {gradient: {0.65: 'blue', 1: 'lime', 1: 'red'}, blur: 0.4});
      reqMark = L.marker([start_loc[1], start_loc[0]], {icon: reqIcon}).addTo(map);
      break;
    case 'Parcel':
      color = "#FF8000"
      icon = L.icon({
        iconUrl: './images/orange_circle.png',
        iconSize: [15, 15],
      });
      reqIcon = L.icon({iconUrl: './images/parcel.png', iconSize: [20, 20]});
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
      map.addLayer(heatLayer);
      waitTimes.push(waittime / 60);
      pushTimes.push(pushtime / 60);
      updateWaitTimes();
    };
  }, ((waittime + pushtime) * 1000) / SPEED);
  navMarker.on('end', function(){
    map.removeLayer(this);
    map.removeLayer(polyline);
    if(marker != null)
    map.removeLayer(marker);
  });
}

function prepareDataSets(times) {
  function round5(x) {
    return (x % 5) >= 2.5 ? parseInt(x / 5) * 5 + 5 : parseInt(x / 5) * 5;
  }
  let dataset = [];
  let data = {};
  times.forEach(time => {
    if (data[round5(time)]) {
      data[round5(time)] += 1;
    } else {
      data[round5(time)] = 1;
    }
  })
  Object.keys(data).forEach(key => {
    dataset.push({
      key: key,
      value: data[key],
    })
  })
  return dataset
}

function updateWaitTimes() {
  let waitTimeDataSet = prepareDataSets(pushTimes);
  let pushTimeDataSet = prepareDataSets(waitTimes);
  barGraph(waitTimeDataSet, "#waitTimePassenger", "#FFCC00");
  barGraph(pushTimeDataSet, "#waitTimeParcel", "#FF9900");
}

  //   startTimeSet.push([]);
  //   endTimeSet.push([]);
  //   for(var history=0; history < data['fleet'][fleet]['history'].length; history+=3) {
  //     if(data['fleet'][fleet]['history'].length < history+3) {
  //       break;
  //     } else {
  //       var index = history/3;
  //       startTimeSet[fleet].push({'IDLE': 0, 'NAV': 0, 'PASSENGER': 0, 'PARCEL': 0});
  //       endTimeSet[fleet].push({'IDLE': 0, 'NAV': 0, 'PASSENGER': 0, 'PARCEL': 0});
  //       for(var i=history; i<history+3; i++) {
  //         var object = data['fleet'][fleet]['history'][i];
  //         if(object['type'] == 'Idle') {
  //           // console.log('IDLE Case');
  //           startTimeSet[fleet][index]['IDLE'] = (object['start_time'] * SPEED);
  //           endTimeSet[fleet][index]['IDLE'] = (object['end_time'] * SPEED);
  //         } else if (object['type'] == 'Navigation') {
  //           // console.log('NAV Case');
  //           startTimeSet[fleet][index]['NAV'] = (object['start_time'] * SPEED);
  //           endTimeSet[fleet][index]['NAV'] = (object['end_time'] * SPEED);
  //         } else if ((object['type']== 'Request') && (object['kind'] == 'Parcel')) {
  //           startTimeSet[fleet][index]['PARCEL'] = (object['start_time'] * SPEED);
  //           endTimeSet[fleet][index]['PARCEL'] = (object['end_time'] * SPEED);
  //         } else if((object['type']== 'Request') && (object['kind'] == 'Passenger')){
  //           // console.log('PASSENGER Case');
  //           startTimeSet[fleet][index]['PASSENGER'] = (object['start_time'] * SPEED);
  //           endTimeSet[fleet][index]['PASSENGER'] = (object['end_time'] * SPEED);
  //         }
  //       }
  //     }
  //   }
  // }
  // console.log(startTimeSet, endTimeSet)
  // for(var i=0; i<startTimeSet.length; i++) {
  //   for(var j=0; j<startTimeSet[i].length; j++) {
  //     jsonDataAnimationAction(data, startTimeSet[i][j], endTimeSet[i][j], i, j);
  //   }
  // }
  // }

// function median(values) {
//   values.sort( function(a,b) {return a - b;} );
//   var half = Math.floor(values.length/2);
//   if(values.length % 2)
//     return values[half];
//   else
//     return (values[half-1] + values[half]) / 2.0;
// }

// function jsonDataAnimationAction(data, start, end, i, j) {
//   setTimeout(function() {
//     var marker;
//     var car = data['fleet'][i];
//     var ctask = data['fleet'][i]['history'][3*j];
//     var gray_circle_icon = L.icon({
//         iconUrl: './images/gray_circle.png',
//         iconSize: [15, 15],
//     });
//     var yellow_circle_icon = L.icon({
//         iconUrl: './images/yellow_circle.png',
//         iconSize: [15, 15],
//     });
//     var orange_circle_icon = L.icon({
//         iconUrl: './images/orange_circle.png',
//         iconSize: [15, 15],
//     });
//     var idleMarker = L.marker([ctask.start_point[1], ctask.start_point[0]], {icon: gray_circle_icon}).addTo(map);
//     var count = 0;
//     var numarr = [];
//     map.addLayer(idleMarker);
//     setTimeout(function() {
//       map.removeLayer(idleMarker);
//       ctask = data['fleet'][i]['history'][3*j+1];
//       ctask['color'] = '#B2B2B2';
//       var navPolyline = polylineFromTask(ctask);
//       count += 1;
//       var time = (end['NAV'] - start['NAV']);
//       var avg = time / count;
//       numarr.push(time);
//       var med = median(numarr);
//       ////////////////////////////////////////////////////////
//       $("#wtavg").html(""+avg);
//       $("#wtmd").html(""+med);
//       ////////////////////////////////////////////////////////

//       var navMarker = L.Marker.movingMarker(navPolyline.getLatLngs(), time, {icon: gray_circle_icon}).addTo(map);
//       navMarker.on('end', function(){
//         map.removeLayer(this);
//         map.removeLayer(navPolyline);
//         if(marker != null)
//         map.removeLayer(marker);
//       });
//       // NOTIFICATION
//       if (data['fleet'][i]['history'][3*j+2]['kind'] == 'Passenger') {
//         var origin = {lat: data['fleet'][i]['history'][3*j+1].end_point[1], lng: data['fleet'][i]['history'][3*j+1].end_point[0]};
//         var childIcon = L.icon({iconUrl: './images/child.png',iconSize: [20, 20]});
//         marker = L.marker([origin['lat'], origin['lng']], {icon: childIcon}).addTo(map);
//         heatMap = L.heatLayer([[origin['lat'], origin['lng']]], {gradient: {0.1: 'blue', 0.65: 'lime', 1: 'red'}, blur: 0});
//       } else {
//         var dest = data['fleet'][i]['history'][3*j+1];
//         var parcelIcon = L.icon({iconUrl: './images/parcel.png', iconSize: [20, 20]});
//         marker = L.marker([dest['end_point'][1], dest['end_point'][0]], {icon: parcelIcon}).addTo(map);
//         heatMap = L.heatLayer([[dest['end_point'][1], dest['end_point'][0]]]);
//       }
//       navMarker.start();
//       //PARCEL
//       if(end['PASSENGER'] == 0) {
//         setTimeout(function(){
//           // map.removeLayer(marker);
//           ctask = data['fleet'][i]['history'][3*j+2];
//           ctask['color'] = '#FF8000'
//           var parcelPolyline = polylineFromTask(ctask);
//           var time = (end['PARCEL'] - start['PARCEL']);
//           var parcelMarker = L.Marker.movingMarker(parcelPolyline.getLatLngs(), time, {icon: orange_circle_icon}).addTo(map);
//           parcelMarker.on('end', function(){
//             map.removeLayer(this);
//             map.removeLayer(parcelPolyline);
//             map.removeLayer(marker);
//             map.removeLayer(idleMarker);
//             map.addLayer(heatMap);
//           });
//           parcelMarker.start();
//           setTimeout(function(){
//             // map.removeLayer(marker);
//             //  console.log("PASS: " + i);
//             //  console.log("Animation PASS END: " + i);
//           }, end['PARCEL']);
//         }, end['NAV'] - start['NAV']);
//       //PASSENGER
//       } else {
//         setTimeout(function(){
//           // map.removeLayer(marker);
//           ctask = data['fleet'][i]['history'][3*j+2];
//           ctask['color'] = '#F0F000';
//           var passPolyline = polylineFromTask(ctask);
//           var time = (end['PASSENGER'] - start['PASSENGER']);
//           var passengerMaker = L.Marker.movingMarker(passPolyline.getLatLngs(), time, {icon: yellow_circle_icon}).addTo(map);
//           passengerMaker.on('end', function(){
//             map.removeLayer(this);
//             map.removeLayer(passPolyline);
//             map.removeLayer(idleMarker);
//             map.addLayer(heatMap);
//           });
//           passengerMaker.start();
//           setTimeout(function(){
//             //  console.log("PASS: " + i);
//             //  console.log("Animation PASS END: " + i);
//             // map.removeLayer(idleMarker);
//           }, end['PASSENGER']);
//         }, end['NAV'] - start['NAV']);
//       }
//     }, end['IDLE'] - start['IDLE']);
//   }, start['IDLE']);
// }

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

window.onload = function() {
  map = L.map('map-canvas', {zoomControl: false}).setView([42.359456, -71.076336], 14);
  L.tileLayer('https://api.mapbox.com/styles/v1/jbogle/cjcqkdujd4tnr2roaeq00m30t/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiamJvZ2xlIiwiYSI6ImNqY3FrYnR1bjE4bmsycW9jZGtwZXNzeDIifQ.Y9bViJkRjtBUr6Ftuh0I4g').addTo(map);
  barGraph([], "#waitTimePassenger", "#FFCC00");
  barGraph([], "#waitTimeParcel", "#FF9900");
};
