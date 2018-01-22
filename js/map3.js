"use strict";
var map;

var SPEED = 60 * 6;
var SUBWAYSPEED = 60 * 6 * 5;
var T_API = "mTBUGDZNyU6IS_nJpCzNSw";
var Tee;
var T_opacity = 0.8;

// MEGAUPDATE pt 1
// Made ran_nums dictionary to hold onto current ranodm number generated
var ran_nums = {'num' : 0};

var RedLeftMarker = [];
var leftMarkerCheck = false;
// Json data
var sim_data;
//  Opeation Data Set
var startTimeSet = [];
var endTimeSet = [];
var waittingSet = [];
var routeSet = [];
var heatMap;
var emissions = [0, 0, 0];
var tot_distances = [0, 0, 0];
var emissions_coeffs = [2, 10, 5];
var person_wait_times = [
  { key: 0, value: 0 },
  { key: 5, value: 0 },
  { key: 10, value: 0 },
  { key: 15, value: 0 },
  { key: 20, value: 0 },
  { key: 25, value: 0 },
  { key: 30, value: 0 },
  { key: 35, value: 0 }];
var package_wait_times = [
  { key: 0, value: 0 },
  { key: 5, value: 0 },
  { key: 10, value: 0 },
  { key: 15, value: 0 },
  { key: 20, value: 0 },
  { key: 25, value: 0 },
  { key: 30, value: 0 },
  { key: 35, value: 0 }];

var slider_rebalanceSize = 20;
var slider_fleetSize = 20;
var slider_publicTransit = 20;

    // window.localStorage.setItem(id, json string)
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
    console.log(data);
    sim_data = data;
    objectCreation(data);
  }, 'json');
}


function test_fleet_sim() {
  Tee = new BostonTee(SPEED, T_API, map, 0.6)
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
  for(let fleet=0; fleet < Object.keys(data['fleet']).length; fleet++) {
    startTimeSet.push([]);
    endTimeSet.push([]);
    for(var history=0; history < data['fleet'][fleet]['history'].length; history+=3) {
      if(data['fleet'][fleet]['history'].length < history+3) {
        break;
      } else {
        var index = history/3;
        startTimeSet[fleet].push({'IDLE': 0, 'NAV': 0, 'PASSENGER': 0, 'PARCEL': 0});
        endTimeSet[fleet].push({'IDLE': 0, 'NAV': 0, 'PASSENGER': 0, 'PARCEL': 0});
        for(var i=history; i<history+3; i++) {
          var object = data['fleet'][fleet]['history'][i];
          if(object['type'] == 'Idle') {
            // console.log('IDLE Case');
            startTimeSet[fleet][index]['IDLE'] = (object['start_time'] * SPEED);
            endTimeSet[fleet][index]['IDLE'] = (object['end_time'] * SPEED);
          } else if (object['type'] == 'Navigation') {
            // console.log('NAV Case');
            startTimeSet[fleet][index]['NAV'] = (object['start_time'] * SPEED);
            endTimeSet[fleet][index]['NAV'] = (object['end_time'] * SPEED);
          } else if ((object['type']== 'Request') && (object['kind'] == 'Parcel')) {
            startTimeSet[fleet][index]['PARCEL'] = (object['start_time'] * SPEED);
            endTimeSet[fleet][index]['PARCEL'] = (object['end_time'] * SPEED);
          } else if((object['type']== 'Request') && (object['kind'] == 'Passenger')){
            // console.log('PASSENGER Case');
            startTimeSet[fleet][index]['PASSENGER'] = (object['start_time'] * SPEED);
            endTimeSet[fleet][index]['PASSENGER'] = (object['end_time'] * SPEED);
          }
        }
      }
    }
  }
  for(var i=0; i<startTimeSet.length; i++) {
    for(var j=0; j<startTimeSet[i].length; j++) {
      jsonDataAnimationAction(data, startTimeSet[i][j], endTimeSet[i][j], i, j);
    }
  }
}

function median(values) {
  values.sort( function(a,b) {return a - b;} );
  var half = Math.floor(values.length/2);
  if(values.length % 2)
    return values[half];
  else
    return (values[half-1] + values[half]) / 2.0;
}

function jsonDataAnimationAction(data, start, end, i, j) {
  setTimeout(function() {
    var marker;
    var car = data['fleet'][i];
    var ctask = data['fleet'][i]['history'][3*j];
    var gray_circle_icon = L.icon({
        iconUrl: './images/gray_circle.png',
        iconSize: [15, 15],
    });
    var yellow_circle_icon = L.icon({
        iconUrl: './images/yellow_circle.png',
        iconSize: [15, 15],
    });
    var orange_circle_icon = L.icon({
        iconUrl: './images/orange_circle.png',
        iconSize: [15, 15],
    });
    var idleMarker = L.marker([ctask.start_point[1], ctask.start_point[0]], {icon: gray_circle_icon}).addTo(map);
    var count = 0;
    var numarr = [];
    map.addLayer(idleMarker);
    setTimeout(function() {
      map.removeLayer(idleMarker);
      ctask = data['fleet'][i]['history'][3*j+1];
      ctask['color'] = '#B2B2B2';
      var navPolyline = polylineFromTask(ctask);
      count += 1;
      var time = (end['NAV'] - start['NAV']);
      var avg = time / count;
      numarr.push(time);
      var med = median(numarr);
      ////////////////////////////////////////////////////////
      $("#wtavg").html(""+avg);
      $("#wtmd").html(""+med);
      ////////////////////////////////////////////////////////

      var navMarker = L.Marker.movingMarker(navPolyline.getLatLngs(), time, {icon: gray_circle_icon}).addTo(map);
      navMarker.on('end', function(){
        map.removeLayer(this);
        map.removeLayer(navPolyline);
        if(marker != null)
        map.removeLayer(marker);
      });
      // NOTIFICATION
      if (data['fleet'][i]['history'][3*j+2]['kind'] == 'Passenger') {
        var origin = {lat: data['fleet'][i]['history'][3*j+1].end_point[1], lng: data['fleet'][i]['history'][3*j+1].end_point[0]};
        var childIcon = L.icon({iconUrl: './images/child.png',iconSize: [20, 20]});
        marker = L.marker([origin['lat'], origin['lng']], {icon: childIcon}).addTo(map);
        heatMap = L.heatLayer([[origin['lat'], origin['lng']]], {gradient: {0.1: 'blue', 0.65: 'lime', 1: 'red'}, blur: 0});
      } else {
        var dest = data['fleet'][i]['history'][3*j+1];
        var parcelIcon = L.icon({iconUrl: './images/parcel.png', iconSize: [20, 20]});
        marker = L.marker([dest['end_point'][1], dest['end_point'][0]], {icon: parcelIcon}).addTo(map);
        heatMap = L.heatLayer([[dest['end_point'][1], dest['end_point'][0]]]);
      }
      navMarker.start();
      //PARCEL
      if(end['PASSENGER'] == 0) {
        setTimeout(function(){
          // map.removeLayer(marker);
          ctask = data['fleet'][i]['history'][3*j+2];
          ctask['color'] = '#FF8000'
          var parcelPolyline = polylineFromTask(ctask);
          var time = (end['PARCEL'] - start['PARCEL']);
          var parcelMarker = L.Marker.movingMarker(parcelPolyline.getLatLngs(), time, {icon: orange_circle_icon}).addTo(map);
          parcelMarker.on('end', function(){
            map.removeLayer(this);
            map.removeLayer(parcelPolyline);
            map.removeLayer(marker);
            map.removeLayer(idleMarker);
            map.addLayer(heatMap);
          });
          parcelMarker.start();
          setTimeout(function(){
            // map.removeLayer(marker);
            //  console.log("PASS: " + i);
            //  console.log("Animation PASS END: " + i);
          }, end['PARCEL']);
        }, end['NAV'] - start['NAV']);
      //PASSENGER
      } else {
        setTimeout(function(){
          // map.removeLayer(marker);
          ctask = data['fleet'][i]['history'][3*j+2];
          ctask['color'] = '#F0F000';
          var passPolyline = polylineFromTask(ctask);
          var time = (end['PASSENGER'] - start['PASSENGER']);
          var passengerMaker = L.Marker.movingMarker(passPolyline.getLatLngs(), time, {icon: yellow_circle_icon}).addTo(map);
          passengerMaker.on('end', function(){
            map.removeLayer(this);
            map.removeLayer(passPolyline);
            map.removeLayer(idleMarker);
            map.addLayer(heatMap);
          });
          passengerMaker.start();
          setTimeout(function(){
            //  console.log("PASS: " + i);
            //  console.log("Animation PASS END: " + i);
            // map.removeLayer(idleMarker);
          }, end['PASSENGER']);
        }, end['NAV'] - start['NAV']);
      }
    }, end['IDLE'] - start['IDLE']);
  }, start['IDLE']);
}

function polylineFromTask(ctask) {
  var polyline;
  var polylinePath = [];
  var path = ctask['overview_polyline'];
  var steps_polyline = ctask['steps_polyline'];
  for (var i = 0; i < steps_polyline.length; i++) {
    var encoded = steps_polyline[i];
    polyline = L.Polyline.fromEncoded(encoded);
    var nextSegment = polyline.getLatLngs();
    for (var k = 0; k < nextSegment.length; k++) {
      polylinePath.push([nextSegment[k].lat, nextSegment[k].lng]);
    }
  }
  polyline = L.polyline(polylinePath, {color: ctask.color}).addTo(map)
  polyline.opacity = 0.5;
  polyline.weight = 7;
  return polyline;
}

window.onload = function() {
  map = L.map('map-canvas', {zoomControl: false}).setView([42.359456, -71.076336], 14);
  L.tileLayer('https://api.mapbox.com/styles/v1/jbogle/cjcqkdujd4tnr2roaeq00m30t/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiamJvZ2xlIiwiYSI6ImNqY3FrYnR1bjE4bmsycW9jZGtwZXNzeDIifQ.Y9bViJkRjtBUr6Ftuh0I4g').addTo(map);
  // L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}',
  //   {
  //     attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
  //     maxZoom: 100,
  //     zoomControl: false,
  //     id: 'mapbox.dark',
  //     accessToken: 'pk.eyJ1IjoicGhsZWUwNjA4IiwiYSI6ImNqNXEyemV1YzBnazQyd3BxbnljNXcwZWgifQ.bDNLVHhQaQZou-OM0c9NKw'
  //   }).addTo(map);
};
