"use strict";
var SPEED = 60 * 6;
var SUBWAYSPEED = 60 * 6 * 5;
var map;
var t;

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

var bluelineStopLine = [];

var orangelineStopLine = [];
var redlineStopLine = [];

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

//  Value
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


    function fleet_sim() {
      // var fleet_size = $('#fleetSize').val();
      // var maxDist = $('#maxTripDist').val();
      // var parcelFreq = $('#parcelAmount').val();
      var fleet_size = slider_fleetSize;
      var publicTransit_size = slider_publicTransit
      var rebalanceSize = slider_rebalanceSize;
      var rng = Math.floor(Math.random()*10000);
      ran_nums['num'] = rng
      var sim_params = {
        size: fleet_size,
        maxDist: 10,
        parcels: 10,
        code: rng
      };
      $.post( '/fleetsim', JSON.stringify(sim_params), function( data ) {
        console.log(data);
        sim_data = data;
        animateCars();
      }, 'json');
    }

    //
    function test_fleet_sim() {
      // var fleet_size = slider_fleetSize
      // var maxDist = $('#maxTripDist').val();
      // var parcelFreq = $('#parcelAmount').val();
      var fleet_size = slider_fleetSize;
      var publicTransit_size = slider_publicTransit;
      var rebalanceSize = slider_rebalanceSize;
      // MEGAUPATE pt2
      // make a random number and store in the dictionary in update pt1
      var rng = Math.floor(Math.random()*10000);
      //NUMBER OF RESULTS
      ran_nums['num'] = 1300;
      console.log("Input Test01: " + fleet_size);
      console.log("Input Test02: " + publicTransit_size);
      console.log("Input Test03: " + rebalanceSize);

      var sim_params = {
        size: fleet_size,
        maxDist: publicTransit_size,
        parcels: rebalanceSize,
        // MEGAUPDATE pt3
        // add 'code' attribute to sim_params
        code: rng
      };

      var bluePath = [];
      var redPath = [];
      var redPathLeft = [];
      var redPathRight = [];
      var orangePath = [];

      $.get('http://realtime.mbta.com/developer/api/v2/stopsbyroute', {api_key:"mTBUGDZNyU6IS_nJpCzNSw", route: "Blue", format:"json"}, function(data2){
        // console.log(data2);
        var route = data2['direction'];
        // for(var i=0; i<route.length; i++) {
        for(var k=0; k<1; k++) {
          var stops = route[k]['stop'];
          for(var j=0; j < stops.length; j++) {
            bluePath.push([stops[j]['stop_lat'], stops[j]['stop_lon']]);
            var blueIcon = L.icon({iconUrl: './images/blues.png',iconSize: [10, 10]});
            var station = new L.marker([stops[j]['stop_lat'], stops[j]['stop_lon']], {icon: blueIcon}).bindPopup("Blue Line<br/>"+stops[j]['parent_station_name']).addTo(map);
            bluelineStopLine.push(stops[j]['parent_station_name']);
            station.on('mouseover', function (e) {
              this.openPopup();
            });
            station.on('mouseout', function (e) {
              this.closePopup();
            });
          }
        }
        bluelineAnimation(bluelineStopLine, bluePath);
      }, 'json');

      $.get('http://realtime.mbta.com/developer/api/v2/stopsbyroute', {api_key:"mTBUGDZNyU6IS_nJpCzNSw", route: "Orange", format:"json"}, function(data2){
        var route = data2['direction'];
        // for(var i=0; i<route.length; i++) {
        for(var k=0; k<1; k++) {
          var stops = route[k]['stop'];
          for(var j=0; j < stops.length; j++) {
            orangePath.push([stops[j]['stop_lat'], stops[j]['stop_lon']]);
            var orangeIcon = L.icon({iconUrl: './images/oranges.png',iconSize: [10, 10]});
            var station = new L.marker([stops[j]['stop_lat'], stops[j]['stop_lon']], {icon: orangeIcon}).bindPopup("Orange Line<br/>"+stops[j]['parent_station_name']).addTo(map);
            orangelineStopLine.push(stops[j]['parent_station_name']);
            station.on('mouseover', function (e) {
              this.openPopup();
            });
            station.on('mouseout', function (e) {
              this.closePopup();
            });
          }
        }
        orangelineAnimation(orangelineStopLine, orangePath);
      }, 'json');

      var animatedRedLeftPath = [];
      var animatedRedRightPath = [];

      $.get('http://realtime.mbta.com/developer/api/v2/stopsbyroute', {api_key:"mTBUGDZNyU6IS_nJpCzNSw", route: "Red", format:"json"}, function(data2){
        // console.log(data2);
        var route = data2['direction'];
        // for(var i=0; i<route.length; i++) {
        for(var k=0; k<1; k++) {
          var stops = route[k]['stop'];
          for(var j=0; j < stops.length; j++) {
            var redIcon = L.icon({iconUrl: './images/reds.png',iconSize: [10, 10]});
            if (stops[j]['stop_order'] <=170 && stops[j]['stop_order'] != 130) {
              animatedRedLeftPath.push([stops[j]['stop_lat'], stops[j]['stop_lon']]);
            }

            if (stops[j]['stop_order'] <=220) {
              if(stops[j]['stop_order']>=130 && stops[j]['stop_order']<=170) {
                // No
              } else {
                animatedRedRightPath.push([stops[j]['stop_lat'], stops[j]['stop_lon']]);
              }
            }

            if(stops[j]['stop_order'] < 130) {
              redPath.push([stops[j]['stop_lat'], stops[j]['stop_lon']]);
              var station = new L.marker([stops[j]['stop_lat'], stops[j]['stop_lon']], {icon: redIcon}).bindPopup("Red Line<br/>" + stops[j]['parent_station_name']).addTo(map);
              station.on('mouseover', function (e) {
                this.openPopup();
              });
              station.on('mouseout', function (e) {
                this.closePopup();
              });
            } else if (stops[j]['stop_order'] >= 140 && stops[j]['stop_order'] <=170) {
              redPathLeft.push([stops[j]['stop_lat'], stops[j]['stop_lon']]);
              var station = new L.marker([stops[j]['stop_lat'], stops[j]['stop_lon']], {icon: redIcon}).bindPopup(stops[j]['parent_station_name']).addTo(map);
              station.on('mouseover', function (e) {
                this.openPopup();
              });
              station.on('mouseout', function (e) {
                this.closePopup();
              });

            } else if (stops[j]['stop_order'] >= 180 && stops[j]['stop_order'] <=220) {
              redPathRight.push([stops[j]['stop_lat'], stops[j]['stop_lon']]);
              var station = new L.marker([stops[j]['stop_lat'], stops[j]['stop_lon']], {icon: redIcon}).bindPopup(stops[j]['parent_station_name']).addTo(map);;
              station.on('mouseover', function (e) {
                this.openPopup();
              });
              station.on('mouseout', function (e) {
                this.closePopup();
              });
            }
          }
        }

        redPathLeft.unshift(redPath[redPath.length-1]);
        redPathRight.unshift(redPath[redPath.length-1]);
        var redPathPoly = L.polyline(redPath, {color: "#FF4500"});
        redPathPoly.addTo(map);
        var redPathLeftPoly = L.polyline(redPathLeft, {color: "#FF4500"}).addTo(map);
        var redPathRigthPoly = L.polyline(redPathRight, {color: "#FF4500"}).addTo(map);

        animatedRedLeftPath.unshift(animatedRedLeftPath[0]);
        animatedRedRightPath.unshift(animatedRedRightPath[0]);
        var animatedRedLeftPoly = L.polyline(animatedRedLeftPath, {color: "#FF4500"}).addTo(map);
        var animatedRedRightPoly = L.polyline(animatedRedRightPath, {color: "#FF4500"}).addTo(map);
        var redIcon = L.icon({
          iconUrl: './images/redline.png',
          iconSize: [25, 25]
        });


        //
        var time = [];
        for(var i=0; i<animatedRedRightPoly.getLatLngs().length; i++){
          time.push(2000);
        }
        // console.log(time);
        // console.log(animatedRedRightPoly.length);
        var redline = L.Marker.movingMarker(animatedRedRightPoly.getLatLngs(), time);
        redline.options.icon = redIcon;
        redline.addTo(map);
        redline.start();
        redlineAnimation("", redPathLeft, redPathRight);
      }, 'json');

      // MEGAUPDATE pt4
      // Change the path for post so that sim_params is sent to the right 'Variables' file
      // Timeout for a bit to give the simulation time to run
      var filename = '/Results/trial_sim_hubway_data' + ran_nums['num'] + '.JSON';
      $.post(filename, JSON.stringify(sim_params), function(data) {
        objectCreation(data);
      }, 'json');
    }

    function bluelineAnimation(bluelineStopLine, bluePath){
      var time = [];
      $.get('http://realtime.mbta.com/developer/api/v2/schedulebyroute', {api_key:"mTBUGDZNyU6IS_nJpCzNSw", route:"Blue", direction: 0}, function(data){
        for(var i=0; i<data['direction'][0]['trip'][0]['stop'].length; i++) {
          var subwayTime = data['direction'][0]['trip'][0]['stop'][i]['sch_dep_dt'];
          var currentTime = Math.round(new Date().getTime()/1000);
          var operateTime = Math.abs(subwayTime-currentTime) / 1000 * SUBWAYSPEED;
          time.push(operateTime);
          // console.log("OperateTime: " + operateTime);
        }
        var blueLinePoly = L.polyline(bluePath, {color: "#4286f4"}).addTo(map);
        var blueIcon = L.icon({
          iconUrl: './images/blueline.png',
          iconSize: [25, 25]
        });

        var blueline = L.Marker.movingMarker(blueLinePoly.getLatLngs(), time);
        blueline.options.icon = blueIcon;
        blueline.addTo(map);
        blueline.start();
      }, 'json')
  }

  function orangelineAnimation(orangelineStopLine, orangePath){
    var time = [];
    $.get('http://realtime.mbta.com/developer/api/v2/schedulebyroute', {api_key:"mTBUGDZNyU6IS_nJpCzNSw", route:"Orange", direction: 0}, function(data){
      for(var i=0; i<data['direction'][0]['trip'][0]['stop'].length; i++) {
        var subwayTime = data['direction'][0]['trip'][0]['stop'][i]['sch_dep_dt'];
        var currentTime = Math.round(new Date().getTime()/1000);
        var operateTime = Math.abs(subwayTime-currentTime) / 1000 * SUBWAYSPEED;
        time.push(operateTime);
        // console.log("OperateTime: " + operateTime);
      }
      var orangeLinePoly = L.polyline(orangePath, {color: "#FF8C00"}).addTo(map);
      var orangeIcon = L.icon({
          iconUrl: './images/orangeline.png',
          iconSize: [25, 25]
        });

      var orangeline = L.Marker.movingMarker(orangeLinePoly.getLatLngs(), time);
      orangeline.options.icon = orangeIcon;
      orangeline.addTo(map);
      orangeline.start();
    }, 'json')
  }

  function redlineAnimation(redlineStopLine, redPath, redPathRight){
    var timeRight = [];
    var timeLeft = [];
    $.get('http://realtime.mbta.com/developer/api/v2/schedulebyroute', {api_key:"mTBUGDZNyU6IS_nJpCzNSw", route:"Red", direction: 0}, function(data){
      for(var i=0; i<data['direction'][0]['trip'][0]['stop'].length; i++) {
        var subwayTime = data['direction'][0]['trip'][0]['stop'][i]['sch_dep_dt'];
        var currentTime = Math.round(new Date().getTime()/1000);
        var operateTime = Math.abs(subwayTime-currentTime) / 1000 * SUBWAYSPEED;
        timeRight.push(operateTime);
        // console.log("Index: " + i);
        // console.log(data['direction'][0]['trip'][0]['stop'][i]['stop_name']);
        // console.log("OperateTime: " + operateTime);
        // console.log("====================================================");
      }

      for(var i=0; i<data['direction'][0]['trip'][3]['stop'].length; i++) {
        var subwayTime = data['direction'][0]['trip'][3]['stop'][i]['sch_dep_dt'];
        var currentTime = Math.round(new Date().getTime()/1000);
        var operateTime = Math.abs(subwayTime-currentTime) / 1000 * SUBWAYSPEED;
        timeLeft.push(operateTime);
        // console.log("Index2: " + i);
        // console.log(data['direction'][0]['trip'][3]['stop'][i]['stop_name']);
        // console.log("OperateTime: " + operateTime);
        // console.log("====================================================");
      }

      var redLinePoly = L.polyline(redPath, {color: "#FF8C00"}).addTo(map);
      var redIcon = L.icon({
          iconUrl: './images/orangeline.png',
          iconSize: [25, 25]
        });
      var redline = L.Marker.movingMarker(redLinePoly.getLatLngs(), timeLeft);
      redline.options.icon = redIcon;
      redline.addTo(map);
      redline.start();

      var redLinePolyRight = L.polyline(redPathRight, {color: "#FF8C00"}).addTo(map);
      var redlineRigth = L.Marker.movingMarker(redLinePolyRight.getLatLngs(), timeRight);
      redlineRigth.options.icon = redIcon;
      redlineRigth.addTo(map);
      redlineRigth.start();
    }, 'json')
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
      console.log(data);
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
          // console.log("DATA: [" + i + ", " + j + "]");
          // console.log(startTimeSet[i][j]);
          // console.log(endTimeSet[i][j]);
          // console.log("==========================================================");
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
      // console.log("===", data, start, end, i, j)
      setTimeout(function() {
        var marker;
        var car = data['fleet'][i];
        var ctask = data['fleet'][i]['history'][3*j];
        var carMarkerIcon = L.icon({iconUrl: './images/circle.png',iconSize: [20, 20]});
        var idleMarker = L.marker([ ctask.start_point[1],  ctask.start_point[0]], {icon: carMarkerIcon}).addTo(map);
        var count =0;
        var numarr = [];
        map.addLayer(idleMarker);
        setTimeout(function() {
          ctask = data['fleet'][i]['history'][3*j+1];
          ctask['color'] = 'white';
          var navPolyline = polylineFromTask(ctask);
          count += 1;
          var time = (end['NAV'] - start['NAV']);
          var avg = time / count;
          numarr.push(time);
          var med = median(numarr);
          ////////////////////////////////////////////////////////
          console.log("Waiting Time: " + time);
          $("#wtavg").html(""+avg);
          $("#wtmd").html(""+med);
          ////////////////////////////////////////////////////////
          var navMarker = L.Marker.movingMarker(navPolyline.getLatLngs(), time).addTo(map);
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
          //PASSENGER
          if(end['PASSENGER'] == 0) {
            setTimeout(function(){
              // map.removeLayer(marker);
              ctask = data['fleet'][i]['history'][3*j+2];
              ctask['color'] = '#FF8000'
              var parcelPolyline = polylineFromTask(ctask);
              var time = (end['PARCEL'] - start['PARCEL']);
              var parcelMarker = L.Marker.movingMarker(parcelPolyline.getLatLngs(), time).addTo(map);
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
          //PARCEL
          } else {
            setTimeout(function(){
              // map.removeLayer(marker);
              ctask = data['fleet'][i]['history'][3*j+2];
              ctask['color'] = '#F0F000';
              var passPolyline = polylineFromTask(ctask);
              var time = (end['PASSENGER'] - start['PASSENGER']);
              var passengerMaker = L.Marker.movingMarker(passPolyline.getLatLngs(), time).addTo(map);
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
      L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}',
        {
          attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
          maxZoom: 100,
          zoomControl: false,
          id: 'mapbox.dark',
          accessToken: 'pk.eyJ1IjoicGhsZWUwNjA4IiwiYSI6ImNqNXEyemV1YzBnazQyd3BxbnljNXcwZWgifQ.bDNLVHhQaQZou-OM0c9NKw'
        }).addTo(map);
        // document.getElementById("trip-file").value = "";
        // document.getElementById("bothBtn").disabled = true;
        // document.getElementById("bikeBtn").disabled = true;
        // document.getElementById("driveBtn").disabled = true;
      };
